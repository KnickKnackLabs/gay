# Contributing

`gay` is a small KnickKnackLabs Bun/TypeScript tool for Pi SDK chat pipelines.
Keep it simple: thin mise tasks, tested shared code under `src/`, and clear command-line behavior.

## Local setup

```sh
mise trust
mise install
bun install --ignore-scripts
mise run check
```

## Structure

```text
gay/
├── bin/gay              # PATH-friendly dispatcher for mise tasks
├── src/                 # Shared TypeScript implementation
├── test/                # Bun unit tests
├── .mise/tasks/         # Bun-backed TypeScript mise tasks
├── README.tsx           # Source for generated README.md
├── README.md            # Generated; keep in sync with README.tsx
└── mise.toml            # Tools and codebase lint config
```

## Task pattern

Tasks under `.mise/tasks/` are executable TypeScript files with Bun shebangs:

```ts
#!/usr/bin/env bun
//MISE description="Do the thing"
//USAGE flag "--name <name>" default="world" help="Name to greet"
```

Use explicit `//USAGE` defaults for optional flags/args to avoid inherited `usage_*` values from parent mise sessions.

Keep tasks thin. Put reusable behavior in `src/` and test it with Bun.

## README workflow

Edit `README.tsx`, then regenerate and check:

```sh
readme build
readme build --check
```

CI checks that `README.md` is current.

## Validation before merge

```sh
mise run check
codebase lint "$PWD"
readme build --check
git diff --check
```

The default model assumes a local vLLM server is already running. Unit tests should not require that server.
