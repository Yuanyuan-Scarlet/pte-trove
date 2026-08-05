import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { unzipSync } from "fflate";

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const originHeaders = { origin: baseUrl };
const adminRoute = process.env.ADMIN_ROUTE ?? "admin";
const adminUsername = process.env.ADMIN_USERNAME ?? "admin";
const adminPassword = process.env.ADMIN_PASSWORD ?? "admin12345";
const runDigits = String(Date.now()).slice(-8);
const phone = `139${runDigits}`;
const orderNumber = `P${String(Date.now()).padStart(18, "0").slice(-18)}`;

async function jsonResponse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(data)}`);
  return data;
}

const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
  method: "POST",
  headers: { ...originHeaders, "content-type": "application/json" },
  body: JSON.stringify({ routeKey: adminRoute, username: adminUsername, password: adminPassword }),
});
await jsonResponse(loginResponse);
const adminCookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
assert.ok(adminCookie, "admin session cookie missing");

const createResponse = await fetch(`${baseUrl}/api/admin/versions`, {
  method: "POST",
  headers: { ...originHeaders, cookie: adminCookie, "content-type": "application/json" },
  body: JSON.stringify({ displayName: `E2E ${Date.now()}` }),
});
const { version } = await jsonResponse(createResponse);

const source = await readFile(new URL("../.tmp/e2e-source.pdf", import.meta.url));
for (const type of ["WFD", "DI", "SST", "RS", "WE"]) {
  const form = new FormData();
  form.set("file", new File([source], `${type}.pdf`, { type: "application/pdf" }));
  const uploadResponse = await fetch(`${baseUrl}/api/admin/versions/${version.id}/assets/${type}`, {
    method: "POST",
    headers: { ...originHeaders, cookie: adminCookie },
    body: form,
  });
  const uploaded = await jsonResponse(uploadResponse);
  assert.equal(uploaded.asset.type, type);
  assert.ok(uploaded.asset.pageCount >= 1);
}

const publishResponse = await fetch(`${baseUrl}/api/admin/versions/${version.id}/publish`, {
  method: "POST",
  headers: { ...originHeaders, cookie: adminCookie },
});
const published = await jsonResponse(publishResponse);
assert.equal(published.links.length, 6);
assert.equal(published.expiresAt - published.publishedAt, 720 * 60 * 60 * 1000);
assert.equal(published.generationDeadline - published.publishedAt, 240 * 60 * 60 * 1000);

const wfd = published.links.find((link) => link.entry === "WFD");
assert.ok(wfd);
const token = new URL(wfd.url).pathname.split("/").pop();

const codeResponse = await fetch(`${baseUrl}/api/public/${token}/send-code`, {
  method: "POST",
  headers: { ...originHeaders, "content-type": "application/json" },
  body: JSON.stringify({ phone }),
});
const codeResult = await jsonResponse(codeResponse);
assert.match(codeResult.devCode, /^\d{6}$/);

const accessResponse = await fetch(`${baseUrl}/api/public/${token}/access`, {
  method: "POST",
  headers: { ...originHeaders, "content-type": "application/json" },
  body: JSON.stringify({ phone, code: codeResult.devCode, orderNumber }),
});
const access = await jsonResponse(accessResponse);
assert.equal(access.state, "READY");
const buyerCookie = accessResponse.headers.get("set-cookie")?.split(";", 1)[0];
assert.ok(buyerCookie, "buyer session cookie missing");

const status = await jsonResponse(await fetch(`${baseUrl}/api/public/${token}/status`, { headers: { cookie: buyerCookie } }));
assert.equal(status.ready, true);
assert.equal(status.phone, `${phone.slice(0, 3)}****${phone.slice(-4)}`);
assert.equal(status.filename, "PTE突击宝藏资料-WFD.pdf");

const download = await fetch(`${baseUrl}/api/public/${token}/download`, { headers: { cookie: buyerCookie } });
assert.equal(download.status, 200);
assert.match(download.headers.get("content-type") ?? "", /application\/pdf/);
const pdf = await PDFDocument.load(await download.arrayBuffer());
assert.ok(pdf.getPageCount() >= 1);
const unauthorizedDownload = await fetch(`${baseUrl}/api/public/${token}/download`);
assert.equal(unauthorizedDownload.status, 401);

const conflictingPhone = `136${runDigits}`;
const conflictCodeResponse = await fetch(`${baseUrl}/api/public/${token}/send-code`, {
  method: "POST",
  headers: { ...originHeaders, "content-type": "application/json" },
  body: JSON.stringify({ phone: conflictingPhone }),
});
const conflictCode = await jsonResponse(conflictCodeResponse);
const conflictAccess = await fetch(`${baseUrl}/api/public/${token}/access`, {
  method: "POST",
  headers: { ...originHeaders, "content-type": "application/json" },
  body: JSON.stringify({ phone: conflictingPhone, code: conflictCode.devCode, orderNumber }),
});
assert.equal(conflictAccess.status, 409, "one order must not bind to a second phone in the same version and entry");

const versionList = await jsonResponse(await fetch(`${baseUrl}/api/admin/versions`, { headers: { cookie: adminCookie } }));
const publishedVersion = versionList.versions.find((item) => item.id === version.id);
assert.equal(publishedVersion.generationCount, 1, "reopening and downloading must not regenerate the file");

const bundle = published.links.find((link) => link.entry === "BUNDLE");
assert.ok(bundle);
const bundleToken = new URL(bundle.url).pathname.split("/").pop();
const bundlePhone = `137${runDigits}`;
const bundleOrder = `P9${String(Date.now()).padStart(17, "0").slice(-17)}`;
const bundleCodeResponse = await fetch(`${baseUrl}/api/public/${bundleToken}/send-code`, {
  method: "POST",
  headers: { ...originHeaders, "content-type": "application/json" },
  body: JSON.stringify({ phone: bundlePhone }),
});
const bundleCode = await jsonResponse(bundleCodeResponse);
const bundleAccessResponse = await fetch(`${baseUrl}/api/public/${bundleToken}/access`, {
  method: "POST",
  headers: { ...originHeaders, "content-type": "application/json" },
  body: JSON.stringify({ phone: bundlePhone, code: bundleCode.devCode, orderNumber: bundleOrder }),
});
const bundleAccess = await jsonResponse(bundleAccessResponse);
assert.equal(bundleAccess.state, "READY");
const bundleCookie = bundleAccessResponse.headers.get("set-cookie")?.split(";", 1)[0];
const bundleDownload = await fetch(`${baseUrl}/api/public/${bundleToken}/download`, { headers: { cookie: bundleCookie } });
assert.equal(bundleDownload.status, 200);
assert.match(bundleDownload.headers.get("content-type") ?? "", /application\/zip/);
const bundleFiles = unzipSync(new Uint8Array(await bundleDownload.arrayBuffer()));
assert.equal(Object.keys(bundleFiles).length, 5);

const manualCreateResponse = await fetch(`${baseUrl}/api/admin/versions/${version.id}/manual-generations`, {
  method: "POST",
  headers: { ...originHeaders, cookie: adminCookie, "content-type": "application/json" },
  body: JSON.stringify({ entry: "WFD", salutation: "张同学", phone: "+61 412 345 678" }),
});
const { record: manualRecord } = await jsonResponse(manualCreateResponse);
assert.equal(manualCreateResponse.status, 201);
assert.equal(manualRecord.status, "ACTIVE");
assert.equal(manualRecord.downloadFilename, "PTE突击宝藏资料-WFD-张同学.pdf");

const manualList = await jsonResponse(await fetch(`${baseUrl}/api/admin/versions/${version.id}/manual-generations`, { headers: { cookie: adminCookie } }));
assert.equal(manualList.records.length, 1);
assert.equal(manualList.records[0].id, manualRecord.id);

const manualDownload = await fetch(`${baseUrl}/api/admin/manual-generations/${manualRecord.id}/download`, { headers: { cookie: adminCookie } });
assert.equal(manualDownload.status, 200);
assert.match(manualDownload.headers.get("content-type") ?? "", /application\/pdf/);
const manualPdf = await PDFDocument.load(await manualDownload.arrayBuffer());
assert.ok(manualPdf.getPageCount() >= 1);
const manualUnauthorized = await fetch(`${baseUrl}/api/admin/manual-generations/${manualRecord.id}/download`);
assert.equal(manualUnauthorized.status, 401);

const invalidManual = await fetch(`${baseUrl}/api/admin/versions/${version.id}/manual-generations`, {
  method: "POST",
  headers: { ...originHeaders, cookie: adminCookie, "content-type": "application/json" },
  body: JSON.stringify({ entry: "WFD", salutation: "", phone: "13800000000" }),
});
assert.equal(invalidManual.status, 400, "an empty salutation must be rejected");

const bindingList = await jsonResponse(await fetch(`${baseUrl}/api/admin/versions/${version.id}/bindings`, { headers: { cookie: adminCookie } }));
const wfdBinding = bindingList.bindings.find((item) => item.entry === "WFD");
assert.ok(wfdBinding, "the WFD purchase record must appear in the bindings list");
assert.equal(wfdBinding.phone, phone);
assert.equal(wfdBinding.orderNumber, orderNumber);
assert.equal(wfdBinding.jobStatus, "SUCCEEDED");
assert.equal(wfdBinding.fileStatus, "ACTIVE");
const unauthorizedBindings = await fetch(`${baseUrl}/api/admin/versions/${version.id}/bindings`);
assert.equal(unauthorizedBindings.status, 401);

const statsList = await jsonResponse(await fetch(`${baseUrl}/api/admin/versions`, { headers: { cookie: adminCookie } }));
const statsVersion = statsList.versions.find((item) => item.id === version.id);
const wfdStats = statsVersion.entryStats.find((item) => item.entry === "WFD");
assert.deepEqual(wfdStats, { entry: "WFD", bindingCount: 1, succeededCount: 1 });

console.log(JSON.stringify({ versionId: version.id, links: published.links.length, generated: status.filename, pages: pdf.getPageCount(), bundleFiles: Object.keys(bundleFiles).length, manualRecord: manualRecord.downloadFilename, bindings: bindingList.bindings.length }));
