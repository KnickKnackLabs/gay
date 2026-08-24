<div align="center">

# gay

**Tiny Pi SDK chat pipeline experiments.**

Compose local model calls with ordinary Unix pipes.

![shape: Bun + Pi SDK](https://img.shields.io/badge/shape-Bun%20%2B%20Pi%20SDK-f472b6?style=flat)
[![tests: 3](https://img.shields.io/badge/tests-3-brightgreen?style=flat)](test/)
![lints: 16](https://img.shields.io/badge/lints-16-blue?style=flat)
![README: TSX](https://img.shields.io/badge/README-TSX-f472b6?style=flat)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat)](LICENSE)

</div>

<br />

## What this is

`gay` is a tiny Pi SDK command-line tool for local chat pipelines. It reads prompt text and optional stdin, sends both to a configured Pi model, and streams the response.

The default model is `local-vllm/gemma-4-12B-it-OptiQ-4bit` served by a local OpenAI-compatible vLLM-Metal endpoint.

## Quick start

```bash
gh repo clone KnickKnackLabs/gay
cd gay
mise trust
mise install
bun install --ignore-scripts
mise run check
```

## Start the local model server

```bash
~/.venv-vllm-metal/bin/vllm serve mlx-community/gemma-4-12B-it-OptiQ-4bit \
  --served-model-name gemma-4-12B-it-OptiQ-4bit \
  --max-model-len 8192 \
  --language-model-only
```

The `--language-model-only` flag is required for this Gemma 4 unified checkpoint so vLLM serves the text path without initializing multimodal processors.

## Configure Pi

Add a local OpenAI-compatible provider to `~/.pi/agent/models.json`. The important parts are the provider name, base URL, served model id, and vLLM compatibility flags.

```json
{
  "providers": {
    "local-vllm": {
      "baseUrl": "http://localhost:8000/v1",
      "api": "openai-completions",
      "apiKey": "local-vllm",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false,
        "supportsUsageInStreaming": false,
        "maxTokensField": "max_tokens"
      },
      "models": [
        {
          "id": "gemma-4-12B-it-OptiQ-4bit",
          "name": "Gemma 4 12B Instruct OptiQ 4-bit (local vLLM)",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 8192,
          "maxTokens": 2048,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
```

## Usage

```bash
gay chat 'tell me a joke'
cat log.txt | gay chat 'Summarize each error as one bullet. No extra text.'
```

Compose calls with ordinary Unix pipes:

```bash
gay chat --label joke 'tell me a joke' \
  | gay chat --label critique 'critique this joke' \
  | gay chat --label guess 'guess the joke'
```

When `--label` is used in a pipeline, raw stdout remains pipeable while a prefixed trace is mirrored to stderr.

## Scaffold inventory

| Path                         | Status | Purpose                                 |
| ---------------------------- | ------ | --------------------------------------- |
| `bin/gay`                    | ✓      | PATH-friendly dispatcher for mise tasks |
| `src/`                       | ✓      | Pi SDK chat implementation              |
| `test/`                      | ✓      | Bun unit tests                          |
| `.mise/tasks/`               | ✓      | Bun-backed TypeScript task entrypoints  |
| `mise.toml`                  | ✓      | tools and codebase lint config          |
| `README.tsx`                 | ✓      | programmable README source              |
| `CONTRIBUTING.md`            | ✓      | repo orientation surface                |
| `.github/workflows/test.yml` | ✓      | Ubuntu/macOS CI                         |

## Tasks

| Task              | Description                          |
| ----------------- | ------------------------------------ |
| `mise run chat`   | Prompt the configured local Pi model |
| `mise run check`  | Run lint and tests                   |
| `mise run doctor` | Check local development setup        |
| `mise run fmt`    | Format code with Biome               |
| `mise run lint`   | Run Biome lint/format checks         |
| `mise run test`   | Run the Bun test suite               |

## Development

- Keep task entrypoints under `.mise/tasks/` thin.
- Put shared TypeScript in `src/`.
- Do not make unit tests require a running local model server.
- Regenerate `README.md` from `README.tsx`.

```bash
mise run check
codebase lint "$PWD"
readme build --check
git diff --check
```

<div align="center">

---

<sub>
This README was generated from `README.tsx` with [KnickKnackLabs/readme](https://github.com/KnickKnackLabs/readme).<br />Small tools should stay easy to inspect.
</sub></div>
