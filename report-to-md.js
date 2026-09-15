#!/usr/bin/env node
// report-to-md — turn a Playwright JSON report into a markdown summary.
//
//   npx playwright test --reporter=json > results.json
//   node report-to-md.js results.json > SUMMARY.md
//
// Exits 1 when there are failures (so it can gate a CI job); pass --no-fail
// to always exit 0.

const fs = require("fs");

// Walk the nested suites/specs tree and flatten to one record per spec.
function collectSpecs(node, file, out) {
  const currentFile = node.file || file || "";
  for (const spec of node.specs || []) {
    const results = (spec.tests || []).flatMap((t) => t.results || []);
    const duration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
    const statuses = results.map((r) => r.status);
    const retries = Math.max(0, ...results.map((r) => r.retry || 0), 0);
    let status = "passed";
    if (statuses.length === 0 || statuses.every((s) => s === "skipped")) status = "skipped";
    else if (spec.ok && retries > 0) status = "flaky";
    else if (!spec.ok) status = "failed";
    const firstError = results.map((r) => r.error).find(Boolean);
    out.push({
      title: spec.title,
      file: currentFile,
      line: spec.line,
      status,
      duration,
      error: firstError ? String(firstError.message || "").split("\n")[0].trim() : "",
    });
  }
  for (const child of node.suites || []) collectSpecs(child, currentFile, out);
}

function summarise(report) {
  const specs = [];
  for (const suite of report.suites || []) collectSpecs(suite, "", specs);

  const by = (s) => specs.filter((x) => x.status === s);
  return {
    total: specs.length,
    passed: by("passed").length,
    failed: by("failed").length,
    flaky: by("flaky").length,
    skipped: by("skipped").length,
    durationMs: specs.reduce((sum, s) => sum + s.duration, 0),
    failures: by("failed"),
    flakyList: by("flaky"),
    slowest: [...specs].sort((a, b) => b.duration - a.duration),
  };
}

const ms = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`);
const loc = (s) => (s.file ? `${s.file}${s.line ? ":" + s.line : ""}` : "");

function toMarkdown(s, { top = 5 } = {}) {
  const lines = [];
  const verdict = s.failed > 0 ? "❌ Failed" : s.flaky > 0 ? "⚠️ Passed with flakes" : "✅ Passed";
  lines.push(`## Test report — ${verdict}`);
  lines.push("");
  lines.push(`| Passed | Failed | Flaky | Skipped | Duration |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  lines.push(`| ${s.passed} | ${s.failed} | ${s.flaky} | ${s.skipped} | ${ms(s.durationMs)} |`);
  lines.push("");

  if (s.failures.length) {
    lines.push("### Failures");
    lines.push("");
    for (const f of s.failures) {
      lines.push(`- **${f.title}** — \`${loc(f)}\``);
      if (f.error) lines.push(`  - ${f.error}`);
    }
    lines.push("");
  }

  if (s.flakyList.length) {
    lines.push("### Flaky (passed on retry)");
    lines.push("");
    for (const f of s.flakyList) lines.push(`- ${f.title} — \`${loc(f)}\``);
    lines.push("");
  }

  lines.push(`### Slowest ${Math.min(top, s.slowest.length)} tests`);
  lines.push("");
  lines.push(`| Test | Time |`);
  lines.push(`| --- | --- |`);
  for (const t of s.slowest.slice(0, top)) lines.push(`| ${t.title} | ${ms(t.duration)} |`);

  return lines.join("\n") + "\n";
}

module.exports = { summarise, toMarkdown };

if (require.main === module) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("-")) || "results.json";
  const noFail = args.includes("--no-fail");

  let report;
  try {
    report = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`Could not read report at "${file}": ${err.message}`);
    process.exit(2);
  }

  const summary = summarise(report);
  process.stdout.write(toMarkdown(summary));
  process.exit(!noFail && summary.failed > 0 ? 1 : 0);
}
