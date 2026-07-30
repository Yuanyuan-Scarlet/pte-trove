import assert from "node:assert/strict";
import test from "node:test";
import { GENERATION_WINDOW_MS, LINK_WINDOW_MS, RECOMMENDED_DOWNLOAD_WINDOW_MS } from "../lib/constants";
import { calculateDeadlines, formatLocalTime, getLinkPhase, isValidOrderNumber, isValidPhone, normalizeOrderNumber, normalizePhone, recommendedDownloadDeadline } from "../lib/domain";

test("calculates independent 240-hour and 720-hour deadlines", () => {
  const publishedAt = Date.UTC(2026, 6, 29, 12, 0, 0);
  const deadlines = calculateDeadlines(publishedAt);
  assert.equal(deadlines.generationDeadline, publishedAt + GENERATION_WINDOW_MS);
  assert.equal(deadlines.expiresAt, publishedAt + LINK_WINDOW_MS);
});

test("switches phases exactly at each boundary", () => {
  const publishedAt = 1_000_000;
  const { generationDeadline, expiresAt } = calculateDeadlines(publishedAt);
  assert.equal(getLinkPhase(publishedAt, generationDeadline, expiresAt, publishedAt), "GENERATION_OPEN");
  assert.equal(getLinkPhase(publishedAt, generationDeadline, expiresAt, generationDeadline - 1), "GENERATION_OPEN");
  assert.equal(getLinkPhase(publishedAt, generationDeadline, expiresAt, generationDeadline), "DOWNLOAD_ONLY");
  assert.equal(getLinkPhase(publishedAt, generationDeadline, expiresAt, expiresAt - 1), "DOWNLOAD_ONLY");
  assert.equal(getLinkPhase(publishedAt, generationDeadline, expiresAt, expiresAt), "EXPIRED");
});

test("shows a 14-day download reminder without extending the hard expiry", () => {
  const generatedAt = Date.UTC(2026, 6, 30, 8, 30, 0);
  const expiresAt = generatedAt + LINK_WINDOW_MS;
  const deadline = recommendedDownloadDeadline(generatedAt, expiresAt);

  assert.equal(deadline, generatedAt + RECOMMENDED_DOWNLOAD_WINDOW_MS);
  assert.equal(formatLocalTime(deadline, "Australia/Perth"), "2026/08/13 16:30");
  assert.equal(formatLocalTime(deadline, "America/New_York"), "2026/08/13 04:30");
  assert.equal(recommendedDownloadDeadline(generatedAt, generatedAt + 1_000), generatedAt + 1_000);
});

test("validates mainland phone numbers and normalizes +86", () => {
  assert.equal(normalizePhone("+86 138 0000 0000"), "13800000000");
  assert.equal(isValidPhone("13800000000"), true);
  assert.equal(isValidPhone("12800000000"), false);
  assert.equal(isValidPhone("61400000000"), false);
});

test("normalizes and validates Xiaohongshu order numbers", () => {
  const order = normalizeOrderNumber(" p800671590267238141 ");
  assert.equal(order, "P800671590267238141");
  assert.equal(isValidOrderNumber(order), true);
  assert.equal(isValidOrderNumber("P80067159026723814"), false);
  assert.equal(isValidOrderNumber("X800671590267238141"), false);
});
