# prompt-regress

Prompt/LLM regression tester — run YAML test suites against prompts/models, diff pass/fail, cost and latency, gate releases in CI.

![CI](https://github.com/itsaayush77/-prompt-regress/actions/workflows/ci/badge.svg)
![License](https://img.shields.io/badge/license-MIT-green)

## What it does

- Define test cases in YAML: prompt, variables, expected assertions.
- Run them against a model (`mock` offline, or any OpenAI-compatible API).
- Check outputs with `contains`, `not_contains`, `regex`, `equals`, `json_valid`, `json_schema`, `max_latency_ms`, `llm_judge`.
- View pass/fail, tokens, cost and latency per case in the web bench; compare two runs to see flipped cases.
- Fail CI (`--fail-on-regress`) when any case regresses.

## Stack

TypeScript throughout. React (Vite) frontend, Node.js/Express backend, JSON file store, OpenAI-compatible provider layer.

## Quickstart (no API key)

```bash
npm install
npm test
npx tsx src/cli.ts --file examples/tests.yaml --model mock
npm run build
npm start            # API on :4000
cd client && npm install && npm run dev   # UI on :5173
```

## Real model

```bash
# Windows PowerShell
$env:OPENAI_API_KEY="sk-..."
npx tsx src/cli.ts --file examples/tests.yaml --model gpt-4o-mini --fail-on-regress
```

Any OpenAI-compatible endpoint works via `OPENAI_BASE_URL` (OpenRouter, Ollama with `OPENAI_API_KEY=ollama`).

## API

| Method | Route | Description |
|---|---|---|
| POST | `/api/runs` | Run a suite (`{ suite }` or `{ yaml }`), returns full run record |
| GET | `/api/runs` | List run summaries |
| GET | `/api/runs/:id` | Full run detail |
| GET | `/api/compare?base=&target=` | Pass/cost/latency deltas + flipped cases |

## CI

`.github/workflows/ci.yml` runs unit tests, build, and the mock regression suite as a release gate.

## Eval snapshot (mock, offline)

| Suite | Cases | Pass | Cost | Latency |
|---|---|---|---|---|
| `examples/tests.yaml` | 6 | 6/6 | ~$0.0001 | ~130ms |

## Layout

```
src/        server, runner, assertions, providers, store, cli, types
examples/   tests.yaml
tests/      runner.test.ts
client/src/ App.tsx (bench UI)
Dockerfile  single-container deploy (API + static UI)
```

## License

MIT
