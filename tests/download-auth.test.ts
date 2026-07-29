import assert from "node:assert/strict";
import test from "node:test";
import { unauthorizedDownloadResponse } from "../app/api/public/[token]/download/route";

test("redirects an unauthorized browser download to the buyer page", () => {
  const response = unauthorizedDownloadResponse(new Request("http://127.0.0.1:3100/api/public/token/download", {
    headers: {
      accept: "text/html,application/xhtml+xml",
      host: "bzzl.ysspark.cn",
      "sec-fetch-mode": "navigate",
      "x-forwarded-proto": "https",
    },
  }), "buyer-token");

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://bzzl.ysspark.cn/g/buyer-token#auth-required");
});

test("keeps a 401 JSON response for an unauthorized API download", async () => {
  const response = unauthorizedDownloadResponse(new Request("http://localhost:3000/api/public/token/download", {
    headers: { accept: "application/json" },
  }), "buyer-token");

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "请先验证手机号和订单号",
    code: "BUYER_AUTH_REQUIRED",
  });
});
