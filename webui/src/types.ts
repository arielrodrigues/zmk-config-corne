export type DocSummary = {
  slug: string;
  title: string;
  group: string;
  order: number;
};

export type DocContent = {
  slug: string;
  title: string;
  markdown: string;
};

export type ApiError = {
  error: { message: string; code: string };
};

export type RGBConfig = {
  enabled: boolean;
  onStart: boolean;
  extPower: boolean;
  effect: number;
  hue: number;
  saturation: number;
  brightness: number;
  speed: number;
  brightnessStep?: number;
};

export type ConfigPayload = {
  rgb: RGBConfig;
  raw: string;
};

export type ConfigDiff = {
  before: string;
  after: string;
};

export type OLEDConstants = {
  loveTimeoutMs: number;
  fastWpm: number;
  loveText: string;
  vampireFrames: {
    idle: string;
    left: string;
    right: string;
    fast: string;
  };
};

export type OLEDPayload = OLEDConstants & { raw: string };

export type Binding = {
  behavior: string;
  args: string[];
  raw: string;
};

export type Layer = {
  name: string;
  displayName: string;
  bindings: Binding[];
};

export type Combo = {
  name: string;
  timeoutMs: number;
  keyPositions: number[];
  bindings: Binding[];
  layers?: number[];
};

export type Keymap = {
  layers: Layer[];
  combos: Combo[];
  raw: string;
};

export type KeymapEdit = {
  layer: string;
  position: number;
  newBinding: string;
};
