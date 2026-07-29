import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function prepareStandaloneAssets(projectRoot = process.cwd()) {
  const standaloneRoot = path.join(projectRoot, ".next", "standalone");
  const standaloneNextRoot = path.join(standaloneRoot, ".next");

  await mkdir(standaloneNextRoot, { recursive: true });
  await cp(path.join(projectRoot, "public"), path.join(standaloneRoot, "public"), {
    recursive: true,
    force: true,
  });
  await cp(path.join(projectRoot, ".next", "static"), path.join(standaloneNextRoot, "static"), {
    recursive: true,
    force: true,
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await prepareStandaloneAssets();
  console.log("Prepared standalone public and static assets.");
}
