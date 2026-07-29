import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { adminRoute, assertAdminRoute, isAdminRoute } from "../lib/auth";

test("requires the configured high-entropy administrator route in production", () => {
  const previousEnvironment = process.env.ENVIRONMENT;
  const previousRoute = process.env.ADMIN_ROUTE;
  process.env.ENVIRONMENT = "production";
  process.env.ADMIN_ROUTE = `manage-${"a".repeat(48)}`;

  try {
    assert.equal(adminRoute(), process.env.ADMIN_ROUTE);
    assert.equal(isAdminRoute(process.env.ADMIN_ROUTE), true);
    assert.equal(isAdminRoute("admin"), false);
    assert.doesNotThrow(() => assertAdminRoute(process.env.ADMIN_ROUTE!));
    assert.throws(
      () => assertAdminRoute("admin"),
      (error: unknown) => typeof error === "object" && error !== null && "status" in error && error.status === 404,
    );
  } finally {
    if (previousEnvironment === undefined) delete process.env.ENVIRONMENT;
    else process.env.ENVIRONMENT = previousEnvironment;
    if (previousRoute === undefined) delete process.env.ADMIN_ROUTE;
    else process.env.ADMIN_ROUTE = previousRoute;
  }
});

test("limits administrator login requests at nginx", async () => {
  for (const filename of ["bzzl.ysspark.cn.http.conf", "bzzl.ysspark.cn.conf"]) {
    const source = await readFile(`deploy/nginx/${filename}`, "utf8");
    assert.match(source, /limit_req_zone \$binary_remote_addr zone=prep_admin_login:10m rate=5r\/m;/);
    assert.match(source, /location = \/api\/admin\/login/);
    assert.match(source, /limit_req zone=prep_admin_login burst=3 nodelay;/);
  }
});

test("enforces HTTPS transport security in the production nginx site", async () => {
  const source = await readFile("deploy/nginx/bzzl.ysspark.cn.conf", "utf8");
  assert.match(source, /ssl_protocols TLSv1\.2 TLSv1\.3;/);
  assert.match(source, /Strict-Transport-Security "max-age=31536000; includeSubDomains" always;/);
  assert.match(source, /return 301 https:\/\/bzzl\.ysspark\.cn\$request_uri;/);
});
