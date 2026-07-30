#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  delimiter,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const marketingRoot = resolve(repositoryRoot, "marketing");
const defaultOutputDirectory = resolve(marketingRoot, "detail-page-images");

export const PRODUCTS = ["wfd", "di", "sst", "rs", "we"];

export function buildSlicePlan(contentHeight, sliceHeight) {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) {
    throw new Error("Content height must be a positive number.");
  }
  if (!Number.isInteger(sliceHeight) || sliceHeight <= 0) {
    throw new Error("Slice height must be a positive integer.");
  }

  const count = Math.ceil(contentHeight / sliceHeight);
  return Array.from({ length: count }, (_, index) => ({
    index: index + 1,
    y: index * sliceHeight,
    height: sliceHeight,
  }));
}

function positiveInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive integer.`);
  }
  return parsed;
}

function positiveNumber(value, option) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive number.`);
  }
  return parsed;
}

export function parseCliArgs(argv) {
  const options = {
    browserPath: process.env.PTE_SCREENSHOT_BROWSER || "",
    height: 1600,
    only: [...PRODUCTS],
    outputDirectory: defaultOutputDirectory,
    scale: 1,
    width: 900,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === "--help" || argument === "-h") {
      return { ...options, help: true };
    }
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${argument}.`);
    }

    if (argument === "--browser") {
      options.browserPath = value;
    } else if (argument === "--width") {
      options.width = positiveInteger(value, argument);
    } else if (argument === "--height") {
      options.height = positiveInteger(value, argument);
    } else if (argument === "--scale") {
      options.scale = positiveNumber(value, argument);
    } else if (argument === "--only") {
      const selected = value.split(",").map((item) => item.trim().toLowerCase());
      const invalid = selected.filter((item) => !PRODUCTS.includes(item));
      if (selected.length === 0 || invalid.length > 0) {
        throw new Error(`--only accepts: ${PRODUCTS.join(", ")}.`);
      }
      options.only = [...new Set(selected)];
    } else if (argument === "--output") {
      options.outputDirectory = isAbsolute(value)
        ? resolve(value)
        : resolve(repositoryRoot, value);
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
    index += 1;
  }

  const relativeOutput = relative(marketingRoot, options.outputDirectory);
  if (
    relativeOutput === "" ||
    relativeOutput === ".." ||
    relativeOutput.startsWith(`..${sep}`) ||
    isAbsolute(relativeOutput)
  ) {
    throw new Error("--output must point to a new directory inside marketing.");
  }

  return options;
}

function printHelp() {
  console.log(`Generate continuous vertical PNGs from the five marketing HTML pages.

Usage:
  npm run marketing:images
  npm run marketing:images -- --width 1080 --height 1920 --scale 1

Options:
  --width <px>       CSS width of every image (default: 900)
  --height <px>      CSS height of every image (default: 1600)
  --scale <number>   Output pixel multiplier (default: 1)
  --only <list>      Comma-separated products, e.g. wfd,di
  --output <path>    Directory inside marketing (default: marketing/detail-page-images)
  --browser <path>   Chrome or Edge executable
  --help             Show this help

The PTE_SCREENSHOT_BROWSER environment variable can also specify the browser.`);
}

function executableFromPath(names) {
  const pathEntries = (process.env.PATH || "").split(delimiter).filter(Boolean);
  const extensions = process.platform === "win32" ? ["", ".exe", ".cmd"] : [""];

  for (const directory of pathEntries) {
    for (const name of names) {
      for (const extension of extensions) {
        const candidate = join(directory, `${name}${extension}`);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return "";
}

export function resolveBrowserPath(explicitPath) {
  if (explicitPath) {
    const resolvedPath = resolve(explicitPath);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Browser executable does not exist: ${resolvedPath}`);
    }
    return resolvedPath;
  }

  const localAppData = process.env.LOCALAPPDATA || "";
  const candidates = process.platform === "win32"
    ? [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        localAppData && join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        localAppData && join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
      ]
    : process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser",
          "/usr/bin/microsoft-edge",
        ];

  const knownBrowser = candidates.find((candidate) => candidate && existsSync(candidate));
  const pathBrowser = executableFromPath([
    "google-chrome",
    "google-chrome-stable",
    "chrome",
    "chromium",
    "chromium-browser",
    "msedge",
    "microsoft-edge",
  ]);
  const browserPath = knownBrowser || pathBrowser;

  if (!browserPath) {
    throw new Error(
      "Chrome or Edge was not found. Pass --browser <path> or set PTE_SCREENSHOT_BROWSER.",
    );
  }
  return browserPath;
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function waitForDevTools(profileDirectory, browserProcess, stderr) {
  const activePortPath = join(profileDirectory, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (browserProcess.exitCode !== null) {
      throw new Error(`Browser exited before startup.\n${stderr()}`);
    }
    if (existsSync(activePortPath)) {
      const [port, browserPath] = readFileSync(activePortPath, "utf8").trim().split(/\r?\n/);
      if (port && browserPath) {
        return {
          browserWebSocketUrl: `ws://127.0.0.1:${port}${browserPath}`,
          port: Number(port),
        };
      }
    }
    await wait(100);
  }

  throw new Error(`Timed out while starting the browser.\n${stderr()}`);
}

export async function launchBrowser(browserPath) {
  const profileDirectory = mkdtempSync(join(tmpdir(), "prep-trove-marketing-"));
  const browserProcess = spawn(
    browserPath,
    [
      "--headless=new",
      "--disable-background-networking",
      "--disable-extensions",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-default-browser-check",
      "--no-first-run",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDirectory}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"], windowsHide: true },
  );
  let stderrText = "";
  browserProcess.stderr.on("data", (chunk) => {
    stderrText = `${stderrText}${chunk}`.slice(-20_000);
  });

  try {
    const devTools = await waitForDevTools(
      profileDirectory,
      browserProcess,
      () => stderrText,
    );
    return { browserProcess, profileDirectory, ...devTools };
  } catch (error) {
    browserProcess.kill();
    rmSync(profileDirectory, { force: true, recursive: true });
    throw error;
  }
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolvePromise, rejectPromise } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) {
        rejectPromise(new Error(`${message.error.message} (${message.error.code})`));
      } else {
        resolvePromise(message.result);
      }
    });

    socket.addEventListener("close", () => {
      for (const { rejectPromise } of this.pending.values()) {
        rejectPromise(new Error("Browser debugging connection closed."));
      }
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolvePromise, rejectPromise) => {
      this.pending.set(id, { resolvePromise, rejectPromise });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

export async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolvePromise, rejectPromise) => {
    socket.addEventListener("open", resolvePromise, { once: true });
    socket.addEventListener(
      "error",
      () => rejectPromise(new Error("Could not connect to browser debugging interface.")),
      { once: true },
    );
  });
  return new CdpClient(socket);
}

export async function createPage(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about%3Ablank`, {
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(`Could not create a browser page: HTTP ${response.status}.`);
  }
  return response.json();
}

export async function waitForDocument(cdp, expectedUrl) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const result = await cdp.send("Runtime.evaluate", {
      expression: `location.href === ${JSON.stringify(expectedUrl)} && document.readyState === "complete"`,
      returnByValue: true,
    });
    if (result.result?.value === true) return;
    await wait(50);
  }
  throw new Error(`Timed out while loading ${expectedUrl}.`);
}

async function prepareDocument(cdp) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await Promise.all(Array.from(document.images, (image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolveImage) => {
          image.addEventListener("load", resolveImage, { once: true });
          image.addEventListener("error", resolveImage, { once: true });
        });
      }));
      await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
      const failedImages = Array.from(document.images)
        .filter((image) => image.naturalWidth === 0)
        .map((image) => image.src);
      const page = document.querySelector(".page");
      return {
        contentHeight: Math.ceil(page?.getBoundingClientRect().height || document.documentElement.scrollHeight),
        failedImages,
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  return result.result.value;
}

function cleanPreviousSlices(outputDirectory, product) {
  const filenamePattern = new RegExp(`^${product}-\\d{2,}\\.png$`);
  for (const entry of readdirSync(outputDirectory, { withFileTypes: true })) {
    if (entry.isFile() && filenamePattern.test(entry.name)) {
      unlinkSync(join(outputDirectory, entry.name));
    }
  }
}

async function renderProduct(cdp, product, options) {
  const sourcePath = resolve(marketingRoot, "detail-pages", `${product}.html`);
  if (!existsSync(sourcePath)) throw new Error(`Missing source page: ${sourcePath}`);

  const sourceUrl = pathToFileURL(sourcePath).href;
  await cdp.send("Page.navigate", { url: sourceUrl });
  await waitForDocument(cdp, sourceUrl);
  const documentInfo = await prepareDocument(cdp);

  if (documentInfo.failedImages.length > 0) {
    throw new Error(
      `${product.toUpperCase()} contains images that failed to load:\n${documentInfo.failedImages.join("\n")}`,
    );
  }

  const slices = buildSlicePlan(documentInfo.contentHeight, options.height);
  const paddedHeight = slices.length * options.height;
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      document.documentElement.style.setProperty("background", "#fffaf4", "important");
      document.documentElement.style.setProperty("min-height", "${paddedHeight}px", "important");
      document.body.style.setProperty("min-height", "${paddedHeight}px", "important");
    })()`,
  });

  cleanPreviousSlices(options.outputDirectory, product);
  const outputFiles = [];
  for (const slice of slices) {
    const screenshot = await cdp.send("Page.captureScreenshot", {
      captureBeyondViewport: true,
      clip: {
        height: slice.height,
        scale: options.scale,
        width: options.width,
        x: 0,
        y: slice.y,
      },
      format: "png",
      fromSurface: true,
    });
    const filename = `${product}-${String(slice.index).padStart(2, "0")}.png`;
    const outputPath = join(options.outputDirectory, filename);
    writeFileSync(outputPath, Buffer.from(screenshot.data, "base64"));
    outputFiles.push(outputPath);
  }

  return {
    contentHeight: documentInfo.contentHeight,
    outputFiles,
  };
}

export async function closeBrowser(browser) {
  try {
    const browserCdp = await connectCdp(browser.browserWebSocketUrl);
    await browserCdp.send("Browser.close");
    browserCdp.close();
  } catch {
    browser.browserProcess.kill();
  }

  const deadline = Date.now() + 5_000;
  while (browser.browserProcess.exitCode === null && Date.now() < deadline) {
    await wait(50);
  }
  if (browser.browserProcess.exitCode === null) browser.browserProcess.kill();

  const temporaryRoot = resolve(tmpdir());
  const resolvedProfile = resolve(browser.profileDirectory);
  if (
    resolvedProfile.startsWith(`${temporaryRoot}${sep}`) &&
    resolvedProfile.includes("prep-trove-marketing-")
  ) {
    rmSync(resolvedProfile, { force: true, recursive: true });
  }
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  mkdirSync(options.outputDirectory, { recursive: true });
  const browserPath = resolveBrowserPath(options.browserPath);
  console.log(`Browser: ${browserPath}`);
  console.log(`Output: ${options.outputDirectory}`);

  const browser = await launchBrowser(browserPath);
  let pageCdp;
  try {
    const page = await createPage(browser.port);
    pageCdp = await connectCdp(page.webSocketDebuggerUrl);
    await pageCdp.send("Page.enable");
    await pageCdp.send("Runtime.enable");
    await pageCdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: options.height,
      mobile: false,
      screenHeight: options.height,
      screenWidth: options.width,
      width: options.width,
    });
    await pageCdp.send("Emulation.setScrollbarsHidden", { hidden: true });
    await pageCdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });

    let totalImages = 0;
    for (const product of options.only) {
      const result = await renderProduct(pageCdp, product, options);
      totalImages += result.outputFiles.length;
      console.log(
        `${product.toUpperCase()}: ${result.outputFiles.length} images from ${result.contentHeight}px`,
      );
    }
    console.log(`Generated ${totalImages} PNG files.`);
  } finally {
    pageCdp?.close();
    await closeBrowser(browser);
  }
}

const invokedScript = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedScript === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
