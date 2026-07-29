import assert from "node:assert/strict";
import test from "node:test";
import { assertSameOrigin, HttpError, requestIsSecure, requestPublicOrigin } from "../lib/http";

test("uses the browser Host when standalone exposes its bind address", () => {
  const request = new Request("http://0.0.0.0:3000/api/admin/login", {
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
    },
  });

  assert.equal(requestPublicOrigin(request), "http://127.0.0.1:3000");
  assert.equal(requestIsSecure(request), false);
  assert.doesNotThrow(() => assertSameOrigin(request));
});

test("uses the public HTTPS origin supplied by nginx", () => {
  const request = new Request("http://127.0.0.1:3100/api/admin/versions", {
    headers: {
      host: "bzzl.ysspark.cn",
      origin: "https://bzzl.ysspark.cn",
      "x-forwarded-proto": "https",
    },
  });

  assert.equal(requestPublicOrigin(request), "https://bzzl.ysspark.cn");
  assert.equal(requestIsSecure(request), true);
  assert.doesNotThrow(() => assertSameOrigin(request));
});

test("rejects a cross-origin write behind nginx", () => {
  const request = new Request("http://127.0.0.1:3100/api/admin/login", {
    headers: {
      host: "bzzl.ysspark.cn",
      origin: "https://attacker.example",
      "x-forwarded-proto": "https",
    },
  });

  assert.throws(
    () => assertSameOrigin(request),
    (error: unknown) => error instanceof HttpError && error.status === 403 && error.code === "INVALID_ORIGIN",
  );
});
