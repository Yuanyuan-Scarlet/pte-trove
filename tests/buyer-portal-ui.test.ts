import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders the revised buyer portal messaging and hierarchy", async () => {
  const source = await readFile(new URL("../components/BuyerPortal.tsx", import.meta.url), "utf8");

  assert.ok(source.includes('alt="Congratulations!"'));
  assert.ok(!source.includes('className="hero-title-detail"'));
  assert.ok(!source.includes('className="hero-copy"'));
  assert.ok(!source.includes("PURCHASE UNLOCKED"));
  assert.ok(!source.includes('className="treasure-ticket"'));
  assert.ok(source.includes("14天内随时下载"));
  assert.ok(!source.includes("登陆状态自动保存"));
  assert.ok(source.includes("考试好运UPUP"));
  assert.ok(source.includes("生成后记得及时保存哦！加油好好复习，祝考试顺利！"));
  assert.ok(!source.includes('"/design-preview/congratulations-rainbow.png"'));
  assert.ok(!source.includes('"/design-preview/congratulations-gold.png"'));
  assert.ok(!source.includes('"/design-preview/congratulations-candy.png"'));
  assert.ok(source.includes('"/design-preview/congratulations-watercolor.png"'));
  assert.ok(source.includes('<>解锁 <em>{status.entryMeta.label}</em> 宝藏资料</>'));
  assert.ok(source.includes("完成身份验证，领取你的专属资料"));
  assert.ok(source.includes('className="step-kicker">ready'));
  assert.ok(source.includes("专属资料已就绪"));
  assert.ok(source.includes("formatLocalTime(downloadReminderDeadline)"));
  assert.ok(source.includes("<span>请在生成后<strong>14天</strong>内下载，祝考试好运！</span>"));
  assert.ok(source.includes("<span>截止：<strong>{localDownloadReminder}</strong>（本地时间）</span>"));
  assert.ok(!source.includes("请在有效期内及时下载，祝考试好运！"));
  assert.ok(!source.includes("请及时保存文件哦"));
  assert.ok(!source.includes("领取只差一步"));
  assert.ok(source.includes("从小红书订单详情复制。"));
  assert.ok(!source.includes("首次提交后手机号将会和该订单绑定"));
});

test("renders the buyer portal logo as a circle and reduces the detail title", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /\.portal-nav img \{[^}]*border-radius: 50%;[^}]*\}/);
  assert.match(styles, /\.claim-title em \{[^}]*color: var\(--accent\);[^}]*\}/);
  assert.match(styles, /\.privacy-note \{[^}]*align-items: center;[^}]*margin: 24px 6px 0;[^}]*\}/);
  assert.match(styles, /\.privacy-note svg \{[^}]*width: 14px;[^}]*height: 14px;[^}]*\}/);
  assert.match(styles, /\.download-button \{[^}]*margin-bottom: 10px;[^}]*\}/);
  assert.match(styles, /\.download-reminder > span \{[^}]*display: block;[^}]*white-space: nowrap;[^}]*\}/);
  assert.match(styles, /\.download-reminder strong \{[^}]*color: var\(--accent\);[^}]*white-space: nowrap;[^}]*\}/);
});
