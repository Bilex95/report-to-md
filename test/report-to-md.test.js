const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { summarise, toMarkdown } = require("../report-to-md");

const report = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../sample-report.json"), "utf8")
);

test("summarise counts each status once per spec", () => {
  const s = summarise(report);
  assert.equal(s.total, 6);
  assert.equal(s.passed, 3);
  assert.equal(s.failed, 1);
  assert.equal(s.flaky, 1);
  assert.equal(s.skipped, 1);
  assert.equal(s.durationMs, 5907);
});

test("markdown headline reflects a failing run", () => {
  const md = toMarkdown(summarise(report));
  assert.match(md, /## Test report — ❌ Failed/);
});

test("failures section names the test and its first error line", () => {
  const md = toMarkdown(summarise(report));
  assert.match(md, /### Failures/);
  assert.match(md, /\*\*rejects an unknown email\*\* — `tests\/auth\.spec\.js:47`/);
  assert.match(md, /TimeoutError: locator\.click: Timeout 30000ms exceeded\./);
  // only the first line of the error, not the stack
  assert.doesNotMatch(md, /at tests\/auth\.spec\.js:49/);
});

test("flaky section lists specs that passed on retry", () => {
  const md = toMarkdown(summarise(report));
  assert.match(md, /### Flaky \(passed on retry\)/);
  assert.match(md, /locks out after 3 failed attempts/);
});

test("slowest table is ordered by duration, slowest first", () => {
  const md = toMarkdown(summarise(report));
  const slowestSection = md.split("### Slowest")[1].split("\n");
  const firstDataRow = slowestSection.find(
    (l) => l.startsWith("| ") && !l.includes("Test |") && !l.includes("---")
  );
  assert.match(firstDataRow, /adds items and computes totals/);
  assert.match(firstDataRow, /2\.5s/);
});
