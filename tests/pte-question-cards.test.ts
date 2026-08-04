import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildNotes,
  buildPreview,
  HEIGHT,
  WIDTH,
} from "../scripts/generate-pte-question-cards.mjs";

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
  officialLandingPage: string;
  weightingSource: string;
  weightingTable: Array<{
    id: string;
    overall: string;
    listening: string | null;
    reading: string | null;
    speaking: string | null;
    writing: string | null;
  }>;
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

function renderPreview(data: QuestionTypeData): string {
  return buildPreview(
    data as unknown as Parameters<typeof buildPreview>[0],
  );
}

function renderNotes(data: QuestionTypeData): string {
  return buildNotes(
    data as unknown as Parameters<typeof buildNotes>[0],
  );
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

test("includes the official weighting row for every scored question type", async () => {
  const data = await loadData();
  const scoredIds = data.questionTypes
    .filter((item) => item.id !== "personal-introduction")
    .map((item) => item.id)
    .sort();

  assert.match(data.weightingSource, /^https:\/\/www\.pearsonpte\.com\/.+\.pdf$/);
  assert.equal(data.weightingTable.length, 22);
  assert.deepEqual(data.weightingTable.map((row) => row.id).sort(), scoredIds);
  assert.equal(new Set(data.weightingTable.map((row) => row.id)).size, 22);
  for (const row of data.weightingTable) {
    assert.match(row.overall, /^(?:<1|\d+)%$/);
    assert.ok(
      [row.listening, row.reading, row.speaking, row.writing].some(Boolean),
      `${row.id} needs at least one communicative-skill weighting`,
    );
  }

  const describeImage = data.weightingTable.find((row) => row.id === "describe-image");
  assert.deepEqual(describeImage, {
    id: "describe-image",
    overall: "15%",
    listening: null,
    reading: null,
    speaking: "31%",
    writing: null,
  });
  const writeFromDictation = data.weightingTable.find((row) => row.id === "write-from-dictation");
  assert.deepEqual(writeFromDictation, {
    id: "write-from-dictation",
    overall: "5%",
    listening: "13%",
    reading: null,
    speaking: null,
    writing: "23%",
  });
});

test("generated preview uses the approved logo, exact footer, and 3:4 portrait geometry", async () => {
  const data = await loadData();
  const preview = renderPreview(data);

  assert.ok(preview.includes('../detail-pages/logo.png'));
  assert.ok(preview.includes(data.footer));
  assert.equal(data.footer, "Designed by 小圆PTE突击， 根据PTE官方资料整理");
  assert.ok(preview.includes("width:900px;height:1200px"));
  assert.ok(preview.includes("PTE 官方平均题型权重"));
  assert.ok(preview.includes("weighting-grid"));
  assert.equal((preview.match(/class="question-card"/g) ?? []).length, 23);
});

test("uses prominent text sizes for small-screen image viewing", async () => {
  const preview = renderPreview(await loadData());

  assert.ok(preview.includes(".task-block p{margin:0;color:#463D4A;font-size:22px"));
  assert.ok(preview.includes(".facts strong{font-size:20px"));
  assert.ok(preview.includes(".scoring-copy{margin:0;color:#463C4B;font-size:20px"));
  assert.ok(preview.includes(".rules-box li{display:flex;align-items:flex-start;gap:8px;font-size:18px"));
  assert.ok(preview.includes(".weight-cell strong{font-family:Arial,\"Noto Sans SC\",sans-serif;color:#29222E;font-size:31px"));
  assert.ok(preview.includes("footer{height:74px;padding:0 46px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(111,85,118,.14);color:#655B69;font-size:16px"));
});

test("defines one 900 by 1200 generated card for every question type", async () => {
  const data = await loadData();
  const preview = renderPreview(data);

  assert.equal(WIDTH, 900);
  assert.equal(HEIGHT, 1200);
  for (const item of data.questionTypes) {
    assert.ok(
      preview.includes(`data-filename="${item.filename}"`),
      `${item.filename} needs a generated card`,
    );
  }
});

test("builds the review notes from source data without committed generated files", async () => {
  const data = await loadData();
  const notes = renderNotes(data);

  assert.ok(notes.includes("# PTE Academic 题型整理稿"));
  assert.ok(notes.includes("官方平均权重"));
  assert.ok(notes.includes(data.weightingSource));
});

test("keeps generated PTE card artifacts out of version control", async () => {
  const gitignore = await readFile(new URL("../../.gitignore", contentRoot), "utf8");

  assert.ok(gitignore.includes("/marketing/pte-academic-question-types/cards/"));
  assert.ok(gitignore.includes("/marketing/pte-academic-question-types/index.html"));
  assert.ok(gitignore.includes("/marketing/pte-academic-question-types/question-types.md"));
});
