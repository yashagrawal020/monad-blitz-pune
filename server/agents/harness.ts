import type { AgentName, AgentToolTrace } from "../../shared/types";
import type { AgentTool, AgentToolContext } from "./toolRegistry";
import { summarizeToolResult } from "./toolRegistry";

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ToolCall[];
};

type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type AgentHarnessInput<T> = {
  agentName: Exclude<AgentName, "Orchestrator">;
  systemPrompt: string;
  task: string;
  context: unknown;
  outputContract: string;
  tools: AgentTool[];
  toolContext: AgentToolContext;
  maxSteps?: number;
  parseFinal: (value: unknown, trace: AgentToolTrace[]) => T;
  onToolResult?: (trace: AgentToolTrace) => void;
};

export function isLlmConfigured() {
  if ((process.env.VITEST || process.env.NODE_ENV === "test") && process.env.AGENT_TEST_LLM !== "true") {
    return false;
  }
  return Boolean(readLlmApiKey());
}

export async function runAgentHarness<T>(input: AgentHarnessInput<T>): Promise<T> {
  const apiKey = readLlmApiKey();
  if (!apiKey) throw new Error("LLM_API_KEY is not configured");

  const maxSteps = input.maxSteps ?? 6;
  const trace: AgentToolTrace[] = [];
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        input.systemPrompt,
        "You are inside a backend-controlled harness. Use tools when computation or data lookup is needed.",
        "Never attempt blockchain writes. The backend orchestrator records validated final commitments on Monad.",
        "Return final output as JSON only, with no markdown."
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        task: input.task,
        context: input.context,
        outputContract: input.outputContract
      })
    }
  ];
  let forceFinalJson = false;

  for (let step = 0; step < maxSteps; step += 1) {
    const mustFinalize = forceFinalJson || step === maxSteps - 1;
    const requestMessages = mustFinalize
      ? [
          ...messages,
          {
            role: "system" as const,
            content: "This is the final harness step. Do not call tools. Return the final JSON now."
          }
        ]
      : messages;

    const assistant = await callOpenAiCompatibleChat({
      apiKey,
      messages: requestMessages,
      tools: mustFinalize ? [] : input.tools
    });

    if (assistant.tool_calls?.length && !mustFinalize) {
      messages.push({ role: "assistant", content: assistant.content ?? null, tool_calls: assistant.tool_calls });
      for (const call of assistant.tool_calls) {
        const tool = input.tools.find((candidate) => candidate.name === call.function.name);
        if (!tool) throw new Error(`${input.agentName} requested disallowed tool ${call.function.name}`);
        const args = parseToolArgs(call.function.arguments);
        const result = tool.execute(args, input.toolContext);
        const toolTrace = { toolName: tool.name, args, resultSummary: summarizeToolResult(result) };
        trace.push(toolTrace);
        input.onToolResult?.(toolTrace);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: tool.name,
          content: JSON.stringify(result)
        });
      }
      continue;
    }

    const finalText = assistant.content ?? "";
    try {
      const parsed = parseJsonObject(finalText);
      return input.parseFinal(parsed, trace);
    } catch (error) {
      if (step === maxSteps - 1) throw error;
      messages.push({ role: "assistant", content: finalText });
      messages.push({
        role: "user",
        content: [
          "Your previous final answer was not valid JSON.",
          `Parser error: ${error instanceof Error ? error.message : String(error)}`,
          "Return the final answer again as one valid JSON object only.",
          "Do not call tools. Do not use markdown. Do not include prose outside JSON."
        ].join("\n")
      });
      forceFinalJson = true;
      continue;
    }
  }

  throw new Error(`${input.agentName} did not return a final response`);
}

async function callOpenAiCompatibleChat(input: {
  apiKey: string;
  messages: ChatMessage[];
  tools: AgentTool[];
}): Promise<{ content?: string | null; tool_calls?: ToolCall[] }> {
  const attempts = Number(process.env.LLM_RETRY_ATTEMPTS || 3);
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await callOpenAiCompatibleChatOnce(input);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === attempts) break;
      await delay(750 * attempt);
    }
  }
  throw lastError ?? new Error("LLM request failed");
}

async function callOpenAiCompatibleChatOnce(input: {
  apiKey: string;
  messages: ChatMessage[];
  tools: AgentTool[];
}): Promise<{ content?: string | null; tool_calls?: ToolCall[] }> {
  const baseUrl = process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
  const model = process.env.LLM_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free";
  const body = {
    model,
    temperature: 0.2,
    max_tokens: Number(process.env.LLM_MAX_TOKENS || 1200),
    messages: input.messages,
    tools: input.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    })),
    tool_choice: input.tools.length ? "auto" : undefined
  };

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
      "http-referer": "http://127.0.0.1:5173",
      "x-title": "Monad Agent Treasury Council"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed ${response.status}: ${text.slice(0, 300)}`);
  }

  const json = await response.json() as {
    error?: { message?: string; code?: string | number };
    choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
  };
  if (json.error) {
    throw new Error(`LLM provider error: ${json.error.message ?? JSON.stringify(json.error).slice(0, 300)}`);
  }
  const message = json.choices?.[0]?.message;
  if (!message) throw new Error(`LLM response did not contain a message: ${JSON.stringify(json).slice(0, 300)}`);
  return message;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readLlmApiKey() {
  return process.env.LLM_API_KEY || process.env.llm_api_key || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
}

function parseToolArgs(value: string) {
  if (!value.trim()) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("tool arguments must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function parseJsonObject(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("final response did not contain a JSON object");
  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}
