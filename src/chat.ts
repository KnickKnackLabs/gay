import {
	AuthStorage,
	createAgentSession,
	createExtensionRuntime,
	ModelRegistry,
	type ResourceLoader,
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";

export const DEFAULT_MODEL = "local-vllm/gemma-4-12B-it-OptiQ-4bit";

export type ChatArgs = {
	label?: string;
	model: string;
	prompt: string;
};

type Writable = Pick<NodeJS.WritableStream, "write"> & { isTTY?: boolean };

export type ChatTaskIO = {
	argv: string[];
	env: Record<string, string | undefined>;
	stdin: NodeJS.ReadableStream;
	stdout: Writable;
	stderr: Writable;
	cwd?: string;
};

export function parseModelSpec(spec: string): { provider: string; id: string } {
	const slash = spec.indexOf("/");
	if (slash <= 0 || slash === spec.length - 1) {
		throw new Error(`Model must be provider/model, got: ${spec}`);
	}

	return {
		provider: spec.slice(0, slash),
		id: spec.slice(slash + 1),
	};
}

function cleanOptionalEnv(value: string | undefined): string | undefined {
	if (value === undefined || value === "" || value === "''" || value === '""') {
		return undefined;
	}
	return value;
}

export function parseChatArgs(
	argv: string[],
	env: Record<string, string | undefined> = {},
): ChatArgs {
	let label = cleanOptionalEnv(env.usage_label);
	let model = cleanOptionalEnv(env.usage_model) || DEFAULT_MODEL;
	const promptParts: string[] = [];

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (!arg) continue;

		if (arg === "--") {
			promptParts.push(...argv.slice(index + 1));
			break;
		}

		if (arg === "--label") {
			const value = argv[index + 1];
			if (!value) throw new Error("--label requires a value");
			label = value;
			index += 1;
			continue;
		}

		if (arg.startsWith("--label=")) {
			const value = arg.slice("--label=".length);
			if (!value) throw new Error("--label requires a value");
			label = value;
			continue;
		}

		if (arg === "--model") {
			const value = argv[index + 1];
			if (!value) throw new Error("--model requires a value");
			model = value;
			index += 1;
			continue;
		}

		if (arg.startsWith("--model=")) {
			const value = arg.slice("--model=".length);
			if (!value) throw new Error("--model requires a value");
			model = value;
			continue;
		}

		if (arg.startsWith("--")) {
			throw new Error(`Unknown flag: ${arg}`);
		}

		promptParts.push(arg);
	}

	return {
		label,
		model,
		prompt: promptParts.join(" ").trim(),
	};
}

export function composePrompt(prompt: string, stdinText: string): string {
	const cleanPrompt = prompt.trim();
	const cleanInput = stdinText.trimEnd();

	if (cleanPrompt && cleanInput) return `${cleanPrompt}\n\n${cleanInput}`;
	return cleanPrompt || cleanInput;
}

async function readStdin(stream: NodeJS.ReadableStream): Promise<string> {
	if (stream.isTTY) return "";

	let text = "";
	stream.setEncoding("utf8");
	for await (const chunk of stream) {
		text += chunk;
	}
	return text;
}

class LineWriter {
	private atLineStart = true;
	private wrote = false;

	constructor(
		private readonly stream: Writable,
		private readonly prefix = "",
	) {}

	write(chunk: unknown): void {
		const text = String(chunk);
		if (!text) return;
		this.wrote = true;

		let output = "";
		for (const char of text) {
			if (this.atLineStart) {
				output += this.prefix;
				this.atLineStart = false;
			}
			output += char;
			if (char === "\n") this.atLineStart = true;
		}

		this.stream.write(output);
	}

	needsTrailingNewline(): boolean {
		return this.wrote && !this.atLineStart;
	}
}

class ChatOutput {
	private readonly primary: LineWriter;
	private readonly mirrors: LineWriter[];

	constructor(params: { stdout: Writable; stderr: Writable; label?: string }) {
		const labelPrefix = params.label ? `[${params.label}] ` : "";
		const prefixStdout = Boolean(params.label && params.stdout.isTTY);

		this.primary = new LineWriter(
			params.stdout,
			prefixStdout ? labelPrefix : "",
		);
		this.mirrors =
			params.label && !prefixStdout
				? [new LineWriter(params.stderr, labelPrefix)]
				: [];
	}

	write(chunk: unknown): void {
		this.primary.write(chunk);
		for (const mirror of this.mirrors) mirror.write(chunk);
	}

	finishLine(): void {
		if (this.primary.needsTrailingNewline()) this.write("\n");
	}
}

function minimalResourceLoader(systemPrompt: string): ResourceLoader {
	return {
		getExtensions: () => ({
			extensions: [],
			errors: [],
			runtime: createExtensionRuntime(),
		}),
		getSkills: () => ({ skills: [], diagnostics: [] }),
		getPrompts: () => ({ prompts: [], diagnostics: [] }),
		getThemes: () => ({ themes: [], diagnostics: [] }),
		getAgentsFiles: () => ({ agentsFiles: [] }),
		getSystemPrompt: () => systemPrompt,
		getAppendSystemPrompt: () => [],
		extendResources: () => {},
		reload: async () => {},
	};
}

export async function runPiChat(params: {
	modelSpec: string;
	prompt: string;
	stdout: Writable;
	cwd?: string;
}): Promise<void> {
	const { provider, id } = parseModelSpec(params.modelSpec);
	const cwd = params.cwd ?? process.cwd();

	const authStorage = AuthStorage.create();
	const modelRegistry = ModelRegistry.create(authStorage);
	const model = modelRegistry.find(provider, id);
	if (!model) {
		throw new Error(`Pi model not found: ${params.modelSpec}`);
	}

	const settingsManager = SettingsManager.inMemory({
		compaction: { enabled: false },
	});
	const resourceLoader = minimalResourceLoader(
		"You are a concise command-line assistant. Answer the user's request directly.",
	);

	const { session } = await createAgentSession({
		cwd,
		model,
		thinkingLevel: "off",
		authStorage,
		modelRegistry,
		resourceLoader,
		noTools: "all",
		sessionManager: SessionManager.inMemory(cwd),
		settingsManager,
	});

	try {
		session.subscribe((event) => {
			if (
				event.type === "message_update" &&
				event.assistantMessageEvent.type === "text_delta"
			) {
				params.stdout.write(event.assistantMessageEvent.delta);
			}
		});

		await session.prompt(params.prompt);
	} finally {
		session.dispose();
	}
}

export async function runChatTask(io: ChatTaskIO): Promise<void> {
	const args = parseChatArgs(io.argv, io.env);
	const stdinText = await readStdin(io.stdin);
	const prompt = composePrompt(args.prompt, stdinText);

	if (!prompt.trim()) {
		throw new Error("Provide a prompt argument, piped stdin, or both.");
	}

	const output = new ChatOutput({
		stdout: io.stdout,
		stderr: io.stderr,
		label: args.label,
	});

	await runPiChat({
		modelSpec: args.model,
		prompt,
		stdout: output,
		cwd: io.cwd,
	});

	output.finishLine();
}
