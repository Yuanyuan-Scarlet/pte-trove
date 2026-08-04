import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { getSupportedBrowsers } = require("next/dist/build/get-supported-browsers") as {
  getSupportedBrowsers: (directory: string, development: boolean) => string[];
};

test("targets Chrome 92 while preserving the other Next.js browser baselines", async () => {
  const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8")) as {
    browserslist: string[];
  };

  assert.deepEqual(packageJson.browserslist, [
    "chrome 92",
    "edge 111",
    "firefox 111",
    "safari 16.4",
  ]);

  const resolvedTargets = new Set(getSupportedBrowsers(projectRoot, false));
  assert.deepEqual(resolvedTargets, new Set(packageJson.browserslist));
});
