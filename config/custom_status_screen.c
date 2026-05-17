/*
 * Bongo cat custom status screen for 128×32 SSD1306.
 *
 * Layout (normal mode):
 *   LEFT  (≈80px): layer name (top) + WPM (bottom)
 *   RIGHT (≈48px): animated ASCII bongo cat
 *
 * After 20 s of zero WPM → love mode:
 *   Full screen: "love u!  <3" in a larger font
 *   Returns to cat as soon as typing resumes.
 *
 * SPDX-License-Identifier: MIT
 */

#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <lvgl.h>

#include <zmk/display.h>
#include <zmk/events/wpm_state_changed.h>
#include <zmk/events/layer_state_changed.h>
#include <zmk/event_manager.h>
#include <zmk/wpm.h>
#include <zmk/keymap.h>

LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

/* ----------------------------------------------------------------
 * Cat ASCII art frames  (7 chars wide × 4 lines, '\n'-separated)
 *
 *  Idle  : sitting, paws resting on the bongo
 *  Left  : left paw raised (slow-typing alternation)
 *  Right : right paw raised
 *  Fast  : both paws off, excited face (fast typing)
 * ---------------------------------------------------------------- */
static const char FRAME_IDLE[]  = " /\\_/\\ \n( o.o )\n > ^ < \n (_Y_) ";
static const char FRAME_LEFT[]  = " /\\_/\\ \n( -.- )\n > ^ < \n (Y  ) ";
static const char FRAME_RIGHT[] = " /\\_/\\ \n( -.- )\n > ^ < \n (  Y) ";
static const char FRAME_FAST[]  = " /\\_/\\ \n(*^.^*)\n > v < \n (YY ) ";

/* ----------------------------------------------------------------
 * LVGL objects (created once, hidden/shown for mode switch)
 * ---------------------------------------------------------------- */
static lv_obj_t *layer_label;
static lv_obj_t *wpm_label;
static lv_obj_t *cat_label;
static lv_obj_t *love_label;

/* ----------------------------------------------------------------
 * Shared state — all writes happen on the display work queue so
 * no locking is needed.
 * ---------------------------------------------------------------- */
static uint8_t  current_wpm       = 0;
static uint8_t  anim_tick         = 0;   /* incremented each timer fire */
static uint8_t  anim_step         = 0;   /* incremented each frame change */
static int64_t  wpm_zero_since_ms = 0;
static bool     love_mode         = false;

#define LOVE_TIMEOUT_MS  20000   /* idle seconds before love message */
#define FAST_WPM         40      /* threshold for the excited-cat face */

/* ----------------------------------------------------------------
 * Animation timer → display work queue
 * ---------------------------------------------------------------- */
static void do_animation(struct k_work *work);
static K_WORK_DEFINE(anim_work, do_animation);

static void anim_timer_cb(struct k_timer *t) {
    k_work_submit_to_queue(zmk_display_work_q(), &anim_work);
}
static K_TIMER_DEFINE(anim_timer, anim_timer_cb, NULL);

static void enter_love_mode(void) {
    love_mode = true;
    lv_obj_add_flag(cat_label,    LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(layer_label,  LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(wpm_label,    LV_OBJ_FLAG_HIDDEN);
    lv_obj_clear_flag(love_label, LV_OBJ_FLAG_HIDDEN);
}

static void exit_love_mode(void) {
    love_mode = false;
    lv_obj_clear_flag(cat_label,   LV_OBJ_FLAG_HIDDEN);
    lv_obj_clear_flag(layer_label, LV_OBJ_FLAG_HIDDEN);
    lv_obj_clear_flag(wpm_label,   LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(love_label,    LV_OBJ_FLAG_HIDDEN);
}

static void do_animation(struct k_work *work) {
    int64_t now = k_uptime_get();
    anim_tick++;

    /* --- love-mode gate ---------------------------------------- */
    bool should_love = (current_wpm == 0) &&
                       ((now - wpm_zero_since_ms) >= LOVE_TIMEOUT_MS);

    if (should_love && !love_mode) { enter_love_mode(); return; }
    if (!should_love && love_mode) { exit_love_mode(); }
    if (love_mode) return;

    /* --- cat frame selection ----------------------------------- */
    const char *frame;
    if (current_wpm == 0) {
        frame = FRAME_IDLE;
    } else {
        /* Slow typing: alternate LEFT/RIGHT every other tick (≈400 ms).
         * Fast typing: alternate LEFT/FAST every tick (≈200 ms). */
        bool fast = (current_wpm >= FAST_WPM);
        bool flip = fast ? true : (anim_tick & 1);

        if (flip) {
            anim_step++;
        }
        if (anim_step & 1) {
            frame = FRAME_LEFT;
        } else {
            frame = fast ? FRAME_FAST : FRAME_RIGHT;
        }
    }

    lv_label_set_text(cat_label, frame);
}

/* ----------------------------------------------------------------
 * WPM event listener (macro runs callback on display work queue)
 * ---------------------------------------------------------------- */
struct bongo_wpm_state { uint8_t wpm; };

static struct bongo_wpm_state bongo_wpm_get_state(const zmk_event_t *eh) {
    return (struct bongo_wpm_state){.wpm = zmk_wpm_get_state()};
}

static void bongo_wpm_update_cb(struct bongo_wpm_state s) {
    bool was_zero = (current_wpm == 0);
    current_wpm   = s.wpm;

    /* Track when we last had zero WPM */
    if (!was_zero && s.wpm == 0) {
        wpm_zero_since_ms = k_uptime_get();
    }
    /* Typing resumed — exit love mode immediately */
    if (was_zero && s.wpm > 0 && love_mode) {
        exit_love_mode();
    }

    /* Update WPM label */
    char buf[12];
    if (s.wpm == 0) {
        snprintf(buf, sizeof(buf), "wpm: --");
    } else {
        snprintf(buf, sizeof(buf), "wpm: %3d", s.wpm);
    }
    lv_label_set_text(wpm_label, buf);
}

ZMK_DISPLAY_WIDGET_LISTENER(bongo_wpm, struct bongo_wpm_state,
                             bongo_wpm_update_cb, bongo_wpm_get_state)
ZMK_SUBSCRIPTION(bongo_wpm, zmk_wpm_state_changed);

/* ----------------------------------------------------------------
 * Layer event listener
 * ---------------------------------------------------------------- */
struct bongo_layer_state {
    zmk_keymap_layer_index_t index;
    const char *label;
};

static struct bongo_layer_state bongo_layer_get_state(const zmk_event_t *eh) {
    zmk_keymap_layer_index_t index = zmk_keymap_highest_layer_active();
    return (struct bongo_layer_state){
        .index = index,
        .label = zmk_keymap_layer_name(zmk_keymap_layer_index_to_id(index)),
    };
}

static void bongo_layer_update_cb(struct bongo_layer_state s) {
    char buf[16];
    if (s.label == NULL || s.label[0] == '\0') {
        snprintf(buf, sizeof(buf), "Layer %d", s.index);
    } else {
        snprintf(buf, sizeof(buf), "%s", s.label);
    }
    lv_label_set_text(layer_label, buf);
}

ZMK_DISPLAY_WIDGET_LISTENER(bongo_layer, struct bongo_layer_state,
                             bongo_layer_update_cb, bongo_layer_get_state)
ZMK_SUBSCRIPTION(bongo_layer, zmk_layer_state_changed);

/* ----------------------------------------------------------------
 * Screen creation — called once from the display init work item
 * ---------------------------------------------------------------- */
lv_obj_t *zmk_display_status_screen(void) {
    lv_obj_t *screen = lv_obj_create(NULL);

    /* Explicit black background — prevents uninitialized display memory from
     * showing through on the 1-bit SSD1306. */
    lv_obj_set_style_bg_color(screen, lv_color_black(), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(screen, LV_OPA_COVER, LV_PART_MAIN);

    /* Layer name — top left */
    layer_label = lv_label_create(screen);
    lv_label_set_text(layer_label, "---");
    lv_obj_set_style_text_font(layer_label, &lv_font_montserrat_8, LV_PART_MAIN);
    lv_obj_align(layer_label, LV_ALIGN_TOP_LEFT, 0, 0);

    /* WPM — bottom left */
    wpm_label = lv_label_create(screen);
    lv_label_set_text(wpm_label, "wpm: --");
    lv_obj_set_style_text_font(wpm_label, &lv_font_montserrat_8, LV_PART_MAIN);
    lv_obj_align(wpm_label, LV_ALIGN_BOTTOM_LEFT, 0, 0);

    /* Bongo cat — right side, no extra line spacing */
    cat_label = lv_label_create(screen);
    lv_label_set_text(cat_label, FRAME_IDLE);
    lv_obj_set_style_text_font(cat_label, &lv_font_montserrat_8, LV_PART_MAIN);
    lv_obj_set_style_text_line_space(cat_label, 0, LV_PART_MAIN);
    lv_obj_align(cat_label, LV_ALIGN_TOP_RIGHT, 0, 0);

    /* Love message — centred, hidden until idle timeout */
    love_label = lv_label_create(screen);
    lv_label_set_text(love_label, "love u!\n  <3  ");
    lv_obj_set_style_text_font(love_label, &lv_font_montserrat_14, LV_PART_MAIN);
    lv_obj_set_style_text_align(love_label, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN);
    lv_obj_align(love_label, LV_ALIGN_CENTER, 0, 0);
    lv_obj_add_flag(love_label, LV_OBJ_FLAG_HIDDEN);

    /* Register event listeners */
    bongo_wpm_init();
    bongo_layer_init();

    /* Start the idle clock now so love-mode doesn't appear immediately */
    wpm_zero_since_ms = k_uptime_get();

    /* Animation timer: 200 ms base period */
    k_timer_start(&anim_timer, K_MSEC(200), K_MSEC(200));

    return screen;
}
