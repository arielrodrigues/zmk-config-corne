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
