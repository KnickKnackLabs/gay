/** @jsxImportSource jsx-md */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import {
	Badge,
	Badges,
	Bold,
	Cell,
	Center,
	Code,
	CodeBlock,
	Heading,
	HR,
	Item,
	LineBreak,
	Link,
	List,
	Paragraph,
	Raw,
	Section,
	Sub,
	Table,
	TableHead,
	TableRow,
} from "readme";

const PROJECT = {
	name: "gay",
	oneLine: "Tiny Pi SDK chat pipeline experiments.",
	tagline: "Compose local model calls with ordinary Unix pipes.",
	license: "MIT",
};

const REPO_DIR = resolve(import.meta.dirname);
const TASK_DIR = join(REPO_DIR, ".mise/tasks");
const TEST_DIR = join(REPO_DIR, "test");

interface TaskInfo {
	name: string;
	description: string;
}

function read(path: string): string {
	return readFileSync(path, "utf8");
}

function walkFiles(
	dir: string,
	predicate: (path: string) => boolean,
): string[] {
	if (!existsSync(dir)) return [];

	const results: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...walkFiles(full, predicate));
		} else if (predicate(full)) {
			results.push(full);
		}
	}
	return results;
}

function taskDescription(src: string): string {
	return (
		src.match(/^\/\/MISE description="(.+)"$/m)?.[1] ??
		src.match(/^#MISE description="(.+)"$/m)?.[1] ??
		""
	);
}

function discoverTasks(dir = TASK_DIR, prefix = ""): TaskInfo[] {
	if (!existsSync(dir)) return [];

	const tasks: TaskInfo[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name.startsWith(".")) continue;
		const full = join(dir, entry.name);
		const name = prefix ? `${prefix}:${entry.name}` : entry.name;

		if (entry.isDirectory()) {
			tasks.push(...discoverTasks(full, name));
			continue;
		}

		const mode = statSync(full).mode;
		if ((mode & 0o111) === 0) continue;

		tasks.push({ name, description: taskDescription(read(full)) });
	}

	return tasks.sort((a, b) => a.name.localeCompare(b.name));
}

function countBunTests(): number {
	return (
		walkFiles(TEST_DIR, (path) => path.endsWith(".test.ts"))
			.map(read)
			.join("\n")
			.match(/\btest\s*\(/g)?.length ?? 0
	);
}

function configuredLints(): string[] {
	const miseToml = read(join(REPO_DIR, "mise.toml"));
	const start = miseToml.indexOf("[_.codebase]");
	if (start === -1) return [];

	const lines = miseToml.slice(start).split("\n");
	const block: string[] = [];
	for (const [index, line] of lines.entries()) {
		if (index > 0 && line.startsWith("[")) break;
		block.push(line);
	}

	const config = block.join("\n");
	const list = config.match(/lint\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
	const configured = [...list.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
	const excluded = new Set(
		[
			...(
				config.match(/lint_exclude\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? ""
			).matchAll(/"([^"]+)"/g),
		].map((match) => match[1]),
	);
	if (!configured.some((rule) => rule.startsWith("@"))) {
		return configured.filter((rule) => !excluded.has(rule));
	}

	const memberships = new Map<string, string[]>();
	let currentGroup = "";
	const groups = execFileSync("codebase", ["lint:groups"], {
		cwd: REPO_DIR,
		encoding: "utf8",
	});
	for (const line of groups.split("\n")) {
		if (line.startsWith("@")) {
			currentGroup = line;
			memberships.set(currentGroup, []);
		} else if (currentGroup && line.startsWith("  ")) {
			memberships.get(currentGroup)?.push(line.trim());
		}
	}

	return [
		...new Set(configured.flatMap((rule) => memberships.get(rule) ?? [rule])),
	].filter((rule) => !excluded.has(rule));
}

function status(path: string): string {
	return existsSync(join(REPO_DIR, path)) ? "✓" : "missing";
}

const tasks = discoverTasks();
const testCount = countBunTests();
const lints = configuredLints();
const scaffold = [
	["bin/gay", "PATH-friendly dispatcher for mise tasks"],
	["src/", "Pi SDK chat implementation"],
	["test/", "Bun unit tests"],
	[".mise/tasks/", "Bun-backed TypeScript task entrypoints"],
	["mise.toml", "tools and codebase lint config"],
	["README.tsx", "programmable README source"],
	["CONTRIBUTING.md", "repo orientation surface"],
	[".github/workflows/test.yml", "Ubuntu/macOS CI"],
];

const readme = (
	<>
		<Center>
			<Heading level={1}>{PROJECT.name}</Heading>

			<Paragraph>
				<Bold>{PROJECT.oneLine}</Bold>
			</Paragraph>

			<Paragraph>{PROJECT.tagline}</Paragraph>

			<Badges>
				<Badge label="shape" value="Bun + Pi SDK" color="f472b6" />
				<Badge
					label="tests"
					value={`${testCount}`}
					color="brightgreen"
					href="test/"
				/>
				<Badge label="lints" value={`${lints.length}`} color="blue" />
				<Badge label="README" value="TSX" color="f472b6" />
				<Badge
					label="License"
					value={PROJECT.license}
					color="blue"
					href="LICENSE"
				/>
			</Badges>
		</Center>

		<LineBreak />

		<Section title="What this is">
			<Paragraph>
				<Code>gay</Code>
				{
					" is a tiny Pi SDK command-line tool for local chat pipelines. It reads prompt text and optional stdin, sends both to a configured Pi model, and streams the response."
				}
			</Paragraph>
			<Paragraph>
				{"The default model is "}
				<Code>local-vllm/gemma-4-12B-it-OptiQ-4bit</Code>
				{" served by a local OpenAI-compatible vLLM-Metal endpoint."}
			</Paragraph>
		</Section>

		<Section title="Quick start">
			<CodeBlock lang="bash">{`gh repo clone KnickKnackLabs/gay
cd gay
mise trust
mise install
bun install --ignore-scripts
mise run check`}</CodeBlock>
		</Section>

		<Section title="Start the local model server">
			<CodeBlock lang="bash">
				{[
					"~/.venv-vllm-metal/bin/vllm serve mlx-community/gemma-4-12B-it-OptiQ-4bit \\",
					"  --served-model-name gemma-4-12B-it-OptiQ-4bit \\",
					"  --max-model-len 8192 \\",
					"  --language-model-only",
				].join("\n")}
			</CodeBlock>
			<Paragraph>
				{"The "}
				<Code>--language-model-only</Code>
				{
					" flag is required for this Gemma 4 unified checkpoint so vLLM serves the text path without initializing multimodal processors."
				}
			</Paragraph>
		</Section>

		<Section title="Configure Pi">
			<Paragraph>
				{"Add a local OpenAI-compatible provider to "}
				<Code>~/.pi/agent/models.json</Code>
				{
					". The important parts are the provider name, base URL, served model id, and vLLM compatibility flags."
				}
			</Paragraph>
			<CodeBlock lang="json">{`{
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
}`}</CodeBlock>
		</Section>

		<Section title="Usage">
			<CodeBlock lang="bash">{`gay chat 'tell me a joke'
cat log.txt | gay chat 'Summarize each error as one bullet. No extra text.'`}</CodeBlock>

			<Paragraph>{"Compose calls with ordinary Unix pipes:"}</Paragraph>
			<CodeBlock lang="bash">
				{[
					"gay chat --label joke 'tell me a joke' \\",
					"  | gay chat --label critique 'critique this joke' \\",
					"  | gay chat --label guess 'guess the joke'",
				].join("\n")}
			</CodeBlock>

			<Paragraph>
				{"When "}
				<Code>--label</Code>
				{
					" is used in a pipeline, raw stdout remains pipeable while a prefixed trace is mirrored to stderr."
				}
			</Paragraph>
		</Section>

		<Section title="Scaffold inventory">
			<Table>
				<TableHead>
					<Cell>Path</Cell>
					<Cell>Status</Cell>
					<Cell>Purpose</Cell>
				</TableHead>
				{scaffold.map(([path, purpose]) => (
					<TableRow>
						<Cell>
							<Code>{path}</Code>
						</Cell>
						<Cell>{status(path)}</Cell>
						<Cell>{purpose}</Cell>
					</TableRow>
				))}
			</Table>
		</Section>

		<Section title="Tasks">
			<Table>
				<TableHead>
					<Cell>Task</Cell>
					<Cell>Description</Cell>
				</TableHead>
				{tasks.map((task) => (
					<TableRow>
						<Cell>
							<Code>{`mise run ${task.name}`}</Code>
						</Cell>
						<Cell>{task.description}</Cell>
					</TableRow>
				))}
			</Table>
		</Section>

		<Section title="Development">
			<List>
				<Item>
					Keep task entrypoints under <Code>.mise/tasks/</Code> thin.
				</Item>
				<Item>
					Put shared TypeScript in <Code>src/</Code>.
				</Item>
				<Item>
					Do not make unit tests require a running local model server.
				</Item>
				<Item>
					Regenerate <Code>README.md</Code> from <Code>README.tsx</Code>.
				</Item>
			</List>
			<CodeBlock lang="bash">{`mise run check
codebase lint "$PWD"
readme build --check
git diff --check`}</CodeBlock>
		</Section>

		<Center>
			<HR />
			<Sub>
				{"This README was generated from "}
				<Code>README.tsx</Code>
				{" with "}
				<Link href="https://github.com/KnickKnackLabs/readme">
					KnickKnackLabs/readme
				</Link>
				{"."}
				<Raw>{"<br />"}</Raw>
				{"Small tools should stay easy to inspect."}
			</Sub>
		</Center>
	</>
);

console.log(readme);
