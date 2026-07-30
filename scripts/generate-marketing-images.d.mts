export const PRODUCTS: readonly ["wfd", "di", "sst", "rs", "we", "bundle"];

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

export function resolveBrowserPath(explicitPath: string): string;

export interface LaunchedBrowser {
  browserProcess: import("node:child_process").ChildProcess;
  browserWebSocketUrl: string;
  port: number;
  profileDirectory: string;
}

export interface CdpClient {
  close(): void;
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

export function launchBrowser(browserPath: string): Promise<LaunchedBrowser>;
export function connectCdp(webSocketUrl: string): Promise<CdpClient>;
export function createPage(port: number): Promise<{
  webSocketDebuggerUrl: string;
}>;
export function waitForDocument(cdp: CdpClient, expectedUrl: string): Promise<void>;
export function closeBrowser(browser: LaunchedBrowser): Promise<void>;
