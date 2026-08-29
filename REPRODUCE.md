# Reproduction guide (clean environment)

## Prerequisites

- Node.js 20+ (developed on Node 22.23.1, npm 10.9.8), macOS/Linux/WSL
- An Anthropic API key (https://platform.claude.com)

## Setup

```bash
git clone <this repo> && cd text2sql-agent   # or unzip the submission
npm install                                   # ~30s; installs @anthropic-ai/sdk, better-sqlite3, zod, tsx, vitest
cp .env.example .env                          # then paste your ANTHROPIC_API_KEY into .env
```

The Chinook SQLite database ships in `data/chinook.sqlite` (public sample data,
~1 MB). If missing, download v1.4.5:

```bash
curl -fsSL -o data/chinook.sqlite \
  "https://github.com/lerocha/chinook-database/releases/download/v1.4.5/Chinook_Sqlite.sqlite"
```

## 1. Verify the plumbing (no API key needed)

```bash
npm test
```

Expected: `Tests 18 passed (18)` - covers the result comparator and the
read-only SQL guard (injection, PRAGMA, multi-statement, row cap).

## 2. Run the baseline

```bash
npm run eval:baseline
```

Runs 1 model call per case over the 16 cases in `eval/cases.jsonl`, executes the
predicted SQL read-only, and compares against the gold result set. Prints a
summary and writes `eval/results/baseline-latest.{json,md}`.

Expected output shape:

```
=== baseline summary ===
Execution accuracy: N/16
Valid-SQL rate:     N/16
Total cost:         $0.xx
Avg latency/case:   x.xs
```

## 3. Run the agent

```bash
npm run eval:agent
```

Same 16 cases, same comparator, same gold queries. Also writes one trajectory
file per case to `eval/results/trajectories/agent-case-XX.json` (writer drafts,
executor feedback, critic verdicts - the "agent trajectories" deliverable).

## 4. Try it interactively

```bash
npm run ask -- "Which artists have more than 10 albums?"
```

Prints the full trajectory, the final SQL (for human verification), the result
table, and the cost of the run.

## Approximate runtime & cost

Model: `claude-opus-5` ($5/M input, $25/M output tokens). Prompts are small
(schema ~2K tokens).

- Baseline eval: 16 model calls, roughly 1-3 minutes, well under $1.
- Agent eval: ~2-6 model calls per case (writer + critic + retries), roughly
  5-15 minutes, typically a few dollars. Exact numbers are printed per run and
  stored in the results JSON.

To trade cost for capability, set `WRITER_MODEL` / `CRITIC_MODEL` in `.env`
(e.g. `claude-sonnet-5` or `claude-haiku-4-5`) - but publish results from
whatever configuration you report.

## Determinism note

LLM outputs vary between runs (current Claude models do not accept a temperature
parameter), so accuracy may shift by a case or two run-to-run. The comparator,
gold queries, and guard are fully deterministic; gold queries were authored to
avoid tie-boundary nondeterminism (verified against the data).
