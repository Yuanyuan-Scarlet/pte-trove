import assert from "node:assert/strict";
import test from "node:test";
import { isEmbeddedWebView } from "../lib/browser";

test("detects Android and iOS embedded WebViews", () => {
  assert.equal(isEmbeddedWebView(
    "Mozilla/5.0 (Linux; Android 10; ANA-AN00 Build/HUAWEIANA-AN00; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/92.0.4515.105 Mobile Safari/537.36",
  ), true);
  assert.equal(isEmbeddedWebView(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  ), true);
});

test("keeps Edge, Chrome, and Safari outside the WebView warning", () => {
  assert.equal(isEmbeddedWebView(
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36 EdgA/150.0.0.0",
  ), false);
  assert.equal(isEmbeddedWebView(
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
  ), false);
  assert.equal(isEmbeddedWebView(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  ), false);
});

test("does not warn when the user agent is unavailable", () => {
  assert.equal(isEmbeddedWebView(""), false);
});
