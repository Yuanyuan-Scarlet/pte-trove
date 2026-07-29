import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("never exposes a development OTP in production", async () => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "prep-trove-sms-security-"));
  process.env.APP_DATA_DIR = dataRoot;
  process.env.APP_SECRET = "sms-security-test-secret-20260729";
  process.env.SMS_MODE = "mock";
  process.env.ENVIRONMENT = "production";

  const database = await import("../lib/db");
  const sms = await import("../lib/sms");
  const http = await import("../lib/http");

  try {
    await assert.rejects(
      () => sms.issueOtp("13800000008", "127.0.0.8"),
      (error: unknown) => error instanceof http.HttpError && error.status === 503 && error.code === "SMS_NOT_CONFIGURED",
    );
    assert.equal(
      (await database.first<{ count: number }>("SELECT COUNT(*) AS count FROM otp_challenges"))?.count,
      0,
    );

    process.env.ENVIRONMENT = "development";
    const development = await sms.issueOtp("13800000009", "127.0.0.9");
    assert.match(development.devCode ?? "", /^\d{6}$/);
  } finally {
    database.closeDatabase();
    await rm(dataRoot, { recursive: true, force: true });
  }
});
