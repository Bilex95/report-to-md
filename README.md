# report-to-md

**The problem:** a CI test job fails and you get a wall of console output or a 4 MB HTML report you have to download and open. What you wanted was three lines in the PR: what failed, why, and what's slow.

**The solution:** a zero-dependency script that reads Playwright's JSON report and prints a markdown summary — pass/fail/flaky/skipped counts, the failures with their first error line, and the slowest tests — ready to drop into a PR comment or a CI step summary.

## Use it

```bash
npx playwright test --reporter=json > results.json
node report-to-md.js results.json > SUMMARY.md
```

Try it now against the bundled fixture:

```bash
npm run demo
```

In GitHub Actions:

```yaml
- run: node report-to-md.js results.json >> "$GITHUB_STEP_SUMMARY"
```

The script exits `1` when there are failures (so it can gate a job); pass `--no-fail` to always exit `0`.

## How it's built

- `report-to-md.js` — `summarise(report)` flattens Playwright's nested `suites`/`specs` tree into one record per spec and classifies each as passed / failed / flaky / skipped; `toMarkdown(summary)` renders it. The CLI wrapper runs only under `require.main === module`, so the functions stay unit-testable.
- `sample-report.json` — a realistic fixture with a failure, a flake, and a skip.
- `test/report-to-md.test.js` — `node:test` cases for the counts, the headline, the error extraction, and the slowest-first ordering.

## Contribute

- **Add a `--top=N` flag** for the slowest-tests count (see the open issue).
- Support the Jest JSON format behind a `--format=jest` flag.
- Add a `--fail-on-flaky` flag that makes the script exit `1` when flakes are present.

---

Scaffolded by an automated weekly pipeline, then refined by hand — see the factory repo for how it works.
