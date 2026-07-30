import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

interface QuestionType {
  id: string;
  filename: string;
  section: "speaking-writing" | "reading" | "listening";
  scoreTraits: string[];
  source: string;
  task: string;
}

interface QuestionTypeData {
  checkedOn: string;
  footer: string;
  questionTypes: QuestionType[];
  sectionCounts: Record<QuestionType["section"], number>;
}

const contentRoot = new URL(
  "../marketing/pte-academic-question-types/",
  import.meta.url,
);

async function loadData(): Promise<QuestionTypeData> {
  return JSON.parse(
    await readFile(new URL("question-types.json", contentRoot), "utf8"),
  ) as QuestionTypeData;
}

test("covers all 22 scored PTE Academic question types plus Personal Introduction", async () => {
  const data = await loadData();
  const personalIntroduction = data.questionTypes.filter(
    (item) => item.id === "personal-introduction",
  );
  const scoredTypes = data.questionTypes.filter(
    (item) => item.id !== "personal-introduction",
  );

  assert.equal(data.checkedOn, "2026-07-31");
  assert.equal(data.questionTypes.length, 23);
  assert.equal(scoredTypes.length, 22);
  assert.equal(personalIntroduction.length, 1);
  assert.deepEqual(data.sectionCounts, {
    "speaking-writing": 9,
    reading: 5,
    listening: 8,
  });

  for (const [section, expectedCount] of Object.entries(data.sectionCounts)) {
    assert.equal(
      scoredTypes.filter((item) => item.section === section).length,
      expectedCount,
    );
  }
  assert.equal(new Set(data.questionTypes.map((item) => item.id)).size, 23);
  assert.equal(new Set(data.questionTypes.map((item) => item.filename)).size, 23);
});

test("every card has reviewable content, scoring details, and an official source", async () => {
  const data = await loadData();

  for (const item of data.questionTypes) {
    assert.ok(item.task.length >= 20, `${item.id} needs a clear task summary`);
    assert.ok(item.scoreTraits.length >= 1, `${item.id} needs scoring traits`);
    assert.match(item.source, /^https:\/\/www\.pearsonpte\.com\/pte-academic\/test-format\//);
  }
});

test("generated preview uses the approved logo, exact footer, and 4:3 card geometry", async () => {
  const data = await loadData();
  const preview = await readFile(new URL("index.html", contentRoot), "utf8");

  assert.ok(preview.includes('../detail-pages/logo.png'));
  assert.ok(preview.includes(data.footer));
  assert.ok(preview.includes("width:1200px;height:900px"));
  assert.equal((preview.match(/class="question-card"/g) ?? []).length, 23);
});

test("generates one 1200 by 900 PNG for every question type", async () => {
  const data = await loadData();
  const cardsUrl = new URL("cards/", contentRoot);
  const generatedFiles = (await readdir(cardsUrl)).filter((name) => name.endsWith(".png"));

  assert.deepEqual(generatedFiles.sort(), data.questionTypes.map((item) => item.filename).sort());
  for (const item of data.questionTypes) {
    const png = await readFile(new URL(item.filename, cardsUrl));
    assert.deepEqual([...png.subarray(1, 4)], [0x50, 0x4e, 0x47]);
    assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR");
    assert.equal(png.readUInt32BE(16), 1200, `${item.filename} width`);
    assert.equal(png.readUInt32BE(20), 900, `${item.filename} height`);
  }
});
