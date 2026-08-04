export interface MaterialCardProduct {
  slug: string;
  code: string;
  name: string;
  nameZh: string;
  accent: string;
  accentSoft: string;
  title: string;
  hook: string;
  tags: string[];
  facts: Array<{ value: string; label: string; copy: string }>;
  structureTitle: string;
  structureSubtitle: string;
  structure: Array<{ marker: string; title: string; copy: string }>;
  previewImages: string[];
  previewTitle: string;
  previewCopy: string;
  steps: Array<{ label: string; title: string; copy: string }>;
  cta: string;
}

export interface MaterialCardData {
  products: MaterialCardProduct[];
}

export interface MaterialCardCliOptions {
  browserPath: string;
  only: string[];
  help?: boolean;
}

export const WIDTH: number;
export const HEIGHT: number;
export const CARD_TYPES: string[];

export function buildPreview(
  data: MaterialCardData,
  selectedSlugs?: string[],
): string;

export function parseCliArgs(
  argv: string[],
  products: MaterialCardProduct[],
): MaterialCardCliOptions;
