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
