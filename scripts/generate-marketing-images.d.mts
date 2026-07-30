export const PRODUCTS: readonly ["wfd", "di", "sst", "rs", "we"];

export type MarketingProduct = (typeof PRODUCTS)[number];

export interface MarketingImageSlice {
  index: number;
  y: number;
  height: number;
}

export interface MarketingImageOptions {
  browserPath: string;
  height: number;
  help?: boolean;
  only: MarketingProduct[];
  outputDirectory: string;
  scale: number;
  width: number;
}

export function buildSlicePlan(
  contentHeight: number,
  sliceHeight: number,
): MarketingImageSlice[];

export function parseCliArgs(argv: string[]): MarketingImageOptions;
