export type HelpEntry = {
  short: string;
  long?: string;
  learnMoreSlug?: string;
};

export const HELP: Record<string, HelpEntry> = {
  'rgb.enabled': {
    short: 'Turn the LED driver on or off entirely.',
    long: 'When off, the LEDs go fully dark and the driver does not initialize. Power savings are small (~12 mA at most). Recommended: leave this on and use "Start LEDs on" to control whether they appear at boot — that avoids "ghost LEDs" caused by a floating data line.',
    learnMoreSlug: 'rgb',
  },
  'rgb.onStart': {
    short: 'Should the LEDs be on when the keyboard boots?',
    long: 'If off, the LEDs are dark at boot, but the driver is still active and you can turn them on with the H key on the Adj layer.',
    learnMoreSlug: 'rgb',
  },
  'rgb.extPower': {
    short: 'Allow the LED toggle to cut the peripheral power rail.',
    long: 'Leave this OFF. The nice!nano v2 has a single peripheral rail shared by both the LEDs and the OLED. If this is on, toggling the LEDs off via the Adj layer will also kill the OLED.',
    learnMoreSlug: 'rgb',
  },
  'rgb.effect': {
    short: 'Which animation to run at boot.',
    long: 'Solid uses the least battery. Animations (breathe, spectrum, swirl) cycle colors continuously and keep the LED bus active, so they cost more power.',
    learnMoreSlug: 'rgb',
  },
  'rgb.hue': {
    short: 'Color, as a position on the color wheel (0–359).',
    long: 'Only applies to Solid and Breathe — Spectrum and Swirl cycle their own colors.',
    learnMoreSlug: 'rgb',
  },
  'rgb.saturation': {
    short: 'How colorful (0 = white, 100 = pure color).',
  },
  'rgb.brightness': {
    short: 'How bright (0 = off, 100 = max).',
    long: 'Battery drain scales roughly linearly with brightness. Dropping from 80 to 20 cuts LED current draw by ~75%.',
    learnMoreSlug: 'rgb',
  },
  'rgb.speed': {
    short: 'Animation speed (1 = slow, 5 = fast). Ignored for Solid.',
  },
  'rgb.brightnessStep': {
    short: 'How much each BR+/BR- press changes brightness.',
    long: 'Default is 10. Set lower (e.g. 5) for finer control. If you start at brightness 5 and step is 10, one BR- press will clamp to 0.',
    learnMoreSlug: 'rgb',
  },
  'oled.loveTimeoutMs': {
    short: 'How long without activity before the love message appears (milliseconds).',
    long: 'After this many ms with no key presses, the OLED switches to the full-screen idle message. Any keypress brings the normal display back. 20000 = 20 seconds.',
    learnMoreSlug: 'oled',
  },
  'oled.fastWpm': {
    short: 'WPM threshold for the fast vampire frame.',
    long: 'Once your typing speed crosses this words-per-minute number, the vampire switches to its "going fast" pose. Lower values trigger it sooner.',
    learnMoreSlug: 'oled',
  },
  'oled.loveText': {
    short: 'The full-screen idle message.',
    long: 'Shown after the idle timeout. Newlines are allowed. Long text may not fit on the 128×32 display.',
    learnMoreSlug: 'oled',
  },
};
