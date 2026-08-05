import assert from "node:assert/strict";
import test from "node:test";
import { GET as downloadManual } from "../app/api/admin/manual-generations/[manualId]/download/route";
import { GET as listManual, POST as createManual } from "../app/api/admin/versions/[versionId]/manual-generations/route";

const versionContext = { params: Promise.resolve({ versionId: "version-1" }) };
const manualContext = { params: Promise.resolve({ manualId: "manual-1" }) };

async function assertAdminRequired(response: Response) {
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "请先登录管理后台", code: "ADMIN_AUTH_REQUIRED" });
}

test("rejects listing manual generations without an admin session", async () => {
  const response = await listManual(new Request("http://localhost:3000/api/admin/versions/version-1/manual-generations"), versionContext);
  await assertAdminRequired(response);
});

test("rejects creating a manual generation without an admin session", async () => {
  const response = await createManual(new Request("http://localhost:3000/api/admin/versions/version-1/manual-generations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entry: "WFD", salutation: "张同学", phone: "+61 412 345 678" }),
  }), versionContext);
  await assertAdminRequired(response);
});

test("rejects downloading a manual generation without an admin session", async () => {
  const response = await downloadManual(new Request("http://localhost:3000/api/admin/manual-generations/manual-1/download"), manualContext);
  await assertAdminRequired(response);
});

test("rejects a manual generation request from a foreign origin before touching auth", async () => {
  const response = await createManual(new Request("http://localhost:3000/api/admin/versions/version-1/manual-generations", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://evil.example", host: "bzzl.ysspark.cn" },
    body: JSON.stringify({ entry: "WFD", salutation: "张同学", phone: "13800000000" }),
  }), versionContext);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "请求来源无效", code: "INVALID_ORIGIN" });
});
