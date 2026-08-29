# Safe Text-to-SQL Agent

**micro1 Agentic Workflows Hackathon submission.**

A plain-English data assistant that lets non-technical teammates answer their own
questions from the company database - safely (read-only), verifiably (it shows the
SQL and the result), and measurably better than "just ask an LLM for SQL".

## Who has this problem?

The data analyst at any small company. Teammates ping them all day with questions
like "how much revenue did we make in 2010?" or "who is our best customer?". Each
answer is a two-minute query for the analyst - but the asker waits hours for a
reply, and the analyst's real work is constantly interrupted. The analyst is a
human query bottleneck.

## What bottleneck makes it worth solving?

Non-technical staff cannot self-serve because (a) they don't know SQL, (b) raw
database access is dangerous (one bad UPDATE ruins everyone's day), and (c) naive
LLM-generated SQL fails in ways they cannot detect: it hallucinates columns, or -
worse - runs fine and returns a confidently wrong answer. The failure mode that
matters is not broken SQL; it is *valid SQL that answers the wrong question*.

## Does the agent solve it well?

The agent wraps the LLM in an execute-verify-repair loop with hard safety rails:

| Capability (per the hackathon brief) | Concrete component in this repo |
|---|---|
| Better context | Live schema introspection -> compact DDL in every prompt (`src/db/introspect.ts`) |
| Tools | `safeExecute`: read-only, single-statement, SELECT-only, row-capped query runner (`src/db/safeExecute.ts`) |
| Verification | Executor feedback (does it run?) + an independent **critic** role (does it answer the question as asked?) (`src/agent/critic.ts`) |
| Memory | A business glossary + reporting conventions - the institutional knowledge a human analyst carries (`src/context/glossary.ts`) |
| Orchestration | Writer -> executor -> critic repair loop, bounded at 4 attempts (`src/agent/runAgent.ts`) |
| Human oversight | The final answer always shows the SQL for a human to verify; unapproved answers are flagged; writes are impossible by construction |

## Evaluation

**Primary metric: execution accuracy** - does the agent's query return the same
result set as a hand-written gold query? Compared as an order-insensitive multiset
of normalized rows (`src/eval/compareResults.ts`), so it is objective and
automatic; no human judging.

16 cases over the public Chinook database (`eval/cases.jsonl`), graded easy ->
hard, including one deliberately ambiguous challenge case ("Who is our best
customer?") where "best" is undefined and the output format is unstated.

Baseline = one direct prompt with the same schema (same model, same structured
output). The baseline deliberately lacks execution, repair, the critic, and the
glossary - that difference is exactly what is being measured.

| Metric | Simple baseline | Agent solution | Change |
|---|---|---|---|
| Execution accuracy (primary) | _run `npm run eval:baseline`_ | _run `npm run eval:agent`_ | _fill from results_ |
| Valid-SQL rate | _fill_ | _fill_ | _fill_ |
| Cost per task (USD) | _fill_ | _fill_ | _fill_ |
| Human time per task | ~5-30 min (wait for analyst) | seconds, self-serve | - |

Both commands print these numbers and write them to `eval/results/*-latest.md`.

## Improvement Changelog

> Fill the Evidence column from real eval runs as you iterate. Keep entries for
> experiments you removed - the brief explicitly rewards them.

| Stage | What we tried and why | Evidence | Decision / learning |
|---|---|---|---|
| Baseline | One direct prompt with schema (structured output, same model) | `eval/results/baseline-latest.md` | Establishes the floor |
| Iteration 1 | Added executor + error-repair loop, because baseline queries that fail syntax/schema checks are unrecoverable | _accuracy after_ | _kept/removed_ |
| Iteration 2 | Added independent critic after observing valid-but-wrong queries (wrong join grain, NULL vs empty string) | _accuracy after_ | _kept/removed_ |
| Iteration 3 | Added business glossary + reporting conventions after the ambiguous "best customer" case failed on interpretation, not SQL | _accuracy after_ | _kept/removed_ |
| Final | Writer + executor + critic + glossary | `eval/results/agent-latest.md` | _main contribution_ |

## Main failure mode & hot take

**Failure mode observed:** the dominant failure is not broken SQL - it is valid
SQL that answers the wrong question. Execution feedback catches syntax; only a
semantic critic catches intent.

**Hot take:** making an agent's output *runnable* creates a false sense of
correctness. "It executed" is the new "it compiles". Verification layers should
be split by failure class: cheap mechanical checks (does it run?) and a separate
adversarial semantic check (does it answer what was asked?) - collapsing them
into one prompt loses the second.

## What existed before vs. what we added

- Existed before: the public Chinook sample database (lerocha/chinook-database,
  MIT-style licensed), the Anthropic SDK, better-sqlite3, zod, vitest.
- Added during the hackathon: everything in `src/`, `test/`, `eval/`, and all docs.

## Safety & ground rules

- The DB handle is opened **read-only** and `safeExecute` additionally rejects
  anything that is not a single SELECT/WITH statement (sandboxing, rule 4).
- Every answer surfaces the SQL for human verification; critic-unapproved answers
  carry an explicit warning (human reviewer, rule 5).
- Data is the public Chinook sample dataset (rule 7). No credentials in the repo -
  the API key lives in `.env`, which is git-ignored (rule 8).
- Every metric traces to `eval/results/` JSON + per-case trajectories (rule 9).

## Quickstart

See [REPRODUCE.md](REPRODUCE.md) for the full clean-environment guide.

```bash
npm install
cp .env.example .env   # add your ANTHROPIC_API_KEY
npm test               # 18 unit tests, no API needed
npm run eval:baseline  # score the simple baseline
npm run eval:agent     # score the agent (writes trajectories too)
npm run ask -- "Who is our best customer?"
```
