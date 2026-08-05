import { closeDatabase } from "../lib/db";
import { archiveExpiredFiles } from "../lib/files";

try {
  const result = await archiveExpiredFiles();
  console.log(JSON.stringify({ ok: true, archivedGeneratedFiles: result.generated, archivedSourceFiles: result.sources, archivedManualFiles: result.manual }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "unknown error" }));
  process.exitCode = 1;
} finally {
  closeDatabase();
}
