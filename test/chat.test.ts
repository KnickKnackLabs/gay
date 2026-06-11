import { describe, expect, test } from "bun:test";
import {
	composePrompt,
	DEFAULT_MODEL,
	parseChatArgs,
	parseModelSpec,
} from "../src/chat.ts";

describe("chat task helpers", () => {
	test("parses provider-qualified model specs", () => {
		expect(parseModelSpec("local-vllm/gemma-4-12B-it-OptiQ-4bit")).toEqual({
			provider: "local-vllm",
			id: "gemma-4-12B-it-OptiQ-4bit",
		});
		expect(() => parseModelSpec("missing-provider")).toThrow("provider/model");
	});

	test("parses label/model flags and prompt words from argv", () => {
		expect(parseChatArgs(["Reply", "ok"])).toEqual({
			label: undefined,
			model: DEFAULT_MODEL,
			prompt: "Reply ok",
		});
		expect(
			parseChatArgs(["--label", "joke", "--model", "p/m", "hello"]),
		).toEqual({
			label: "joke",
			model: "p/m",
			prompt: "hello",
		});
		expect(parseChatArgs(["--label=joke", "--model=p/m", "hello"])).toEqual({
			label: "joke",
			model: "p/m",
			prompt: "hello",
		});
	});

	test("combines prompt and stdin with prompt first", () => {
		expect(composePrompt("Summarize", "line one\nline two\n")).toBe(
			"Summarize\n\nline one\nline two",
		);
		expect(composePrompt("", "input\n")).toBe("input");
		expect(composePrompt("prompt", "")).toBe("prompt");
	});
});
