/*
 * Status screen for 128x32 SSD1306.
 *
 * Layout:
 *   LEFT (~72px):
 *     TOP    (montserrat_14): layer-icon  BT-num  battery-symbol
 *     BOTTOM (montserrat_8):  held modifiers
 *   RIGHT (~56px):
 *     Animated ASCII vampire (lv_font_unscii_8 — monospace, fixed position)
 *
 * After 20 s idle → love mode: "love you! <3" centered, montserrat_14.
 * Exits on any activity event (WPM change, modifier, layer, BT profile).
 *
 * SPDX-License-Identifier: MIT
 */

#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <lvgl.h>

#include <zmk/display.h>
#include <zmk/event_manager.h>
#include <zmk/events/wpm_state_changed.h>
#include <zmk/events/layer_state_changed.h>
#include <zmk/events/battery_state_changed.h>
#include <zmk/events/modifiers_state_changed.h>
#include <zmk/events/ble_active_profile_changed.h>
#include <zmk/wpm.h>
#include <zmk/keymap.h>
#include <zmk/battery.h>
#include <zmk/hid.h>
#include <zmk/ble.h>
#include <dt-bindings/zmk/modifiers.h>

LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

/* ----------------------------------------------------------------
 * Vampire ASCII frames — 7 chars wide x 4 lines (lv_font_unscii_8)
 * Fixed position: no walking to avoid LVGL clear artifacts on
 * MONO10+SET_REVERSE displays.
 * ---------------------------------------------------------------- */
static const char VAMP_IDLE[]  = " /v_v\\ \n( o.o )\n )   ( \n  | |  ";
static const char VAMP_LEFT[]  = " /v_v\\ \n( >.< )\n/)   ( \n  | |  ";
static const char VAMP_RIGHT[] = " /v_v\\ \n( <.> )\n )   (\\\n  | |  ";
static const char VAMP_FAST[]  = " /v_v\\ \n(*^.^*)\n/~~~~~\\\n  / \\  ";

/* ----------------------------------------------------------------
 * LVGL objects
 * ---------------------------------------------------------------- */
static lv_obj_t *info_label;   /* layer icon + BT + battery — top-left  */
static lv_obj_t *mods_label;   /* held modifiers          — bottom-left */
static lv_obj_t *vamp_label;   /* vampire animation        — right       */
static lv_obj_t *love_label;   /* idle message             — center      */

/* ----------------------------------------------------------------
 * Shared state (all accessed only from display work queue)
 * ---------------------------------------------------------------- */
static int64_t          last_activity_ms   = 0;
static bool             love_mode          = false;
static uint8_t          current_wpm        = 0;
static uint8_t          anim_tick          = 0;
static uint8_t          anim_step          = 0;
static uint8_t          current_bt_profile = 0;
static uint8_t          current_layer_idx  = 0;
static const char      *current_batt_sym   = LV_SYMBOL_BATTERY_EMPTY;
static zmk_mod_flags_t  current_mods       = 0;

#define LOVE_TIMEOUT_MS 20000
#define FAST_WPM        40

/* ----------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------- */
static const char *layer_symbol(uint8_t idx) {
    switch (idx) {
        case 0:  return LV_SYMBOL_KEYBOARD;
        case 1:  return LV_SYMBOL_LOOP;
        case 2:  return LV_SYMBOL_EDIT;
        case 3:  return LV_SYMBOL_SETTINGS;
        default: return LV_SYMBOL_WARNING;
    }
}

static void refresh_info_label(void) {
    char buf[32];
    snprintf(buf, sizeof(buf), "%s %u  %s",
             layer_symbol(current_layer_idx),
             current_bt_profile + 1,
             current_batt_sym);
    lv_label_set_text(info_label, buf);
}

static void refresh_mods_label(void) {
    char buf[20] = "";
    if (current_mods & (MOD_LSFT | MOD_RSFT)) strcat(buf, "Sh ");
    if (current_mods & (MOD_LCTL | MOD_RCTL)) strcat(buf, "Ct ");
    if (current_mods & (MOD_LALT | MOD_RALT)) strcat(buf, "Al ");
    if (current_mods & (MOD_LGUI | MOD_RGUI)) strcat(buf, "Gu");
    lv_label_set_text(mods_label, buf);
}

/* ----------------------------------------------------------------
 * Love mode
 * ---------------------------------------------------------------- */
static void enter_love_mode(void) {
    love_mode = true;
    lv_obj_add_flag(info_label,   LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(mods_label,   LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(vamp_label,   LV_OBJ_FLAG_HIDDEN);
    lv_obj_clear_flag(love_label, LV_OBJ_FLAG_HIDDEN);
}

static void exit_love_mode(void) {
    love_mode = false;
    lv_obj_clear_flag(info_label,  LV_OBJ_FLAG_HIDDEN);
    lv_obj_clear_flag(mods_label,  LV_OBJ_FLAG_HIDDEN);
    lv_obj_clear_flag(vamp_label,  LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(love_label,    LV_OBJ_FLAG_HIDDEN);
}

/* ----------------------------------------------------------------
 * Animation + idle check (200 ms timer → display work queue)
 * ---------------------------------------------------------------- */
static void do_tick(struct k_work *work) {
    int64_t now = k_uptime_get();
    anim_tick++;

    bool should_love = (now - last_activity_ms) >= LOVE_TIMEOUT_MS;

    if (should_love && !love_mode) { enter_love_mode(); return; }
    if (!should_love && love_mode) { exit_love_mode(); }
    if (love_mode) return;

    const char *frame;
    if (current_wpm == 0) {
        frame = VAMP_IDLE;
    } else {
        bool fast = (current_wpm >= FAST_WPM);
        if (fast ? (anim_tick & 1) : (anim_tick % 3 == 0)) anim_step++;
        frame = (anim_step & 1) ? VAMP_LEFT : (fast ? VAMP_FAST : VAMP_RIGHT);
    }
    lv_label_set_text(vamp_label, frame);
}
static K_WORK_DEFINE(tick_work, do_tick);

static void tick_timer_cb(struct k_timer *t) {
    k_work_submit_to_queue(zmk_display_work_q(), &tick_work);
}
static K_TIMER_DEFINE(tick_timer, tick_timer_cb, NULL);

/* ----------------------------------------------------------------
 * WPM listener — drives animation + activity tracking
 * ---------------------------------------------------------------- */
struct sc_wpm_state { uint8_t wpm; };

static struct sc_wpm_state sc_wpm_get_state(const zmk_event_t *eh) {
    return (struct sc_wpm_state){ .wpm = zmk_wpm_get_state() };
}

static void sc_wpm_update_cb(struct sc_wpm_state s) {
    current_wpm      = s.wpm;
    last_activity_ms = k_uptime_get();
}

ZMK_DISPLAY_WIDGET_LISTENER(sc_wpm, struct sc_wpm_state, sc_wpm_update_cb, sc_wpm_get_state)
ZMK_SUBSCRIPTION(sc_wpm, zmk_wpm_state_changed);

/* ----------------------------------------------------------------
 * Layer listener
 * ---------------------------------------------------------------- */
struct sc_layer_state {
    zmk_keymap_layer_index_t index;
};

static struct sc_layer_state sc_layer_get_state(const zmk_event_t *eh) {
    return (struct sc_layer_state){ .index = zmk_keymap_highest_layer_active() };
}

static void sc_layer_update_cb(struct sc_layer_state s) {
    current_layer_idx = (uint8_t)s.index;
    last_activity_ms  = k_uptime_get();
    refresh_info_label();
}

ZMK_DISPLAY_WIDGET_LISTENER(sc_layer, struct sc_layer_state, sc_layer_update_cb, sc_layer_get_state)
ZMK_SUBSCRIPTION(sc_layer, zmk_layer_state_changed);

/* ----------------------------------------------------------------
 * Battery listener
 * ---------------------------------------------------------------- */
struct sc_batt_state { uint8_t level; };

static struct sc_batt_state sc_batt_get_state(const zmk_event_t *eh) {
    const struct zmk_battery_state_changed *ev = as_zmk_battery_state_changed(eh);
    return (struct sc_batt_state){
        .level = (ev != NULL) ? ev->state_of_charge : zmk_battery_state_of_charge(),
    };
}

static void sc_batt_update_cb(struct sc_batt_state s) {
    if      (s.level > 95) current_batt_sym = LV_SYMBOL_BATTERY_FULL;
    else if (s.level > 65) current_batt_sym = LV_SYMBOL_BATTERY_3;
    else if (s.level > 35) current_batt_sym = LV_SYMBOL_BATTERY_2;
    else if (s.level > 5)  current_batt_sym = LV_SYMBOL_BATTERY_1;
    else                   current_batt_sym = LV_SYMBOL_BATTERY_EMPTY;
    refresh_info_label();
}

ZMK_DISPLAY_WIDGET_LISTENER(sc_batt, struct sc_batt_state, sc_batt_update_cb, sc_batt_get_state)
ZMK_SUBSCRIPTION(sc_batt, zmk_battery_state_changed);

/* ----------------------------------------------------------------
 * Modifiers listener
 * ---------------------------------------------------------------- */
struct sc_mods_state { zmk_mod_flags_t mods; };

static struct sc_mods_state sc_mods_get_state(const zmk_event_t *eh) {
    return (struct sc_mods_state){ .mods = zmk_hid_get_explicit_mods() };
}

static void sc_mods_update_cb(struct sc_mods_state s) {
    current_mods     = s.mods;
    last_activity_ms = k_uptime_get();
    refresh_mods_label();
}

ZMK_DISPLAY_WIDGET_LISTENER(sc_mods, struct sc_mods_state, sc_mods_update_cb, sc_mods_get_state)
ZMK_SUBSCRIPTION(sc_mods, zmk_modifiers_state_changed);

/* ----------------------------------------------------------------
 * BT profile listener
 * ---------------------------------------------------------------- */
#if IS_ENABLED(CONFIG_ZMK_BLE)
struct sc_bt_state { uint8_t index; };

static struct sc_bt_state sc_bt_get_state(const zmk_event_t *eh) {
    return (struct sc_bt_state){ .index = (uint8_t)zmk_ble_active_profile_index() };
}

static void sc_bt_update_cb(struct sc_bt_state s) {
    current_bt_profile = s.index;
    refresh_info_label();
}

ZMK_DISPLAY_WIDGET_LISTENER(sc_bt, struct sc_bt_state, sc_bt_update_cb, sc_bt_get_state)
ZMK_SUBSCRIPTION(sc_bt, zmk_ble_active_profile_changed);
#endif

/* ----------------------------------------------------------------
 * Screen creation
 * ---------------------------------------------------------------- */
lv_obj_t *zmk_display_status_screen(void) {
    lv_obj_t *screen = lv_obj_create(NULL);
    lv_obj_remove_flag(screen, LV_OBJ_FLAG_SCROLLABLE);

    /* Top-left: layer icon + BT + battery (montserrat_14) */
    info_label = lv_label_create(screen);
    lv_label_set_text(info_label, LV_SYMBOL_KEYBOARD " 1  " LV_SYMBOL_BATTERY_EMPTY);
    lv_obj_set_style_text_font(info_label, &lv_font_montserrat_14, LV_PART_MAIN);
    lv_obj_set_style_text_color(info_label, lv_color_black(), LV_PART_MAIN);
    lv_obj_align(info_label, LV_ALIGN_TOP_LEFT, 0, 0);

    /* Bottom-left: held modifiers (montserrat_8) */
    mods_label = lv_label_create(screen);
    lv_label_set_text(mods_label, "");
    lv_obj_set_style_text_font(mods_label, &lv_font_montserrat_8, LV_PART_MAIN);
    lv_obj_set_style_text_color(mods_label, lv_color_black(), LV_PART_MAIN);
    lv_obj_align(mods_label, LV_ALIGN_BOTTOM_LEFT, 0, 0);

    /* Right: vampire — monospace UNSCII_8, fixed position */
    vamp_label = lv_label_create(screen);
    lv_label_set_text(vamp_label, VAMP_IDLE);
    lv_obj_set_style_text_font(vamp_label, &lv_font_unscii_8, LV_PART_MAIN);
    lv_obj_set_style_text_color(vamp_label, lv_color_black(), LV_PART_MAIN);
    lv_obj_set_style_text_line_space(vamp_label, 0, LV_PART_MAIN);
    lv_obj_align(vamp_label, LV_ALIGN_TOP_RIGHT, 0, 0);

    /* Center: love mode message (hidden until 20 s idle) */
    love_label = lv_label_create(screen);
    lv_label_set_text(love_label, "love u!");
    lv_obj_set_style_text_font(love_label, &lv_font_montserrat_14, LV_PART_MAIN);
    lv_obj_set_style_text_color(love_label, lv_color_black(), LV_PART_MAIN);
    lv_obj_set_style_text_align(love_label, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN);
    lv_obj_align(love_label, LV_ALIGN_CENTER, 0, 0);
    lv_obj_add_flag(love_label, LV_OBJ_FLAG_HIDDEN);

    sc_wpm_init();
    sc_layer_init();
    sc_batt_init();
    sc_mods_init();
#if IS_ENABLED(CONFIG_ZMK_BLE)
    current_bt_profile = (uint8_t)zmk_ble_active_profile_index();
    sc_bt_init();
#endif

    last_activity_ms = k_uptime_get();
    k_timer_start(&tick_timer, K_MSEC(200), K_MSEC(200));

    return screen;
}
