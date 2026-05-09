import { describe, expect, it } from "vitest";
import {
  AnthropicLLMProvider,
  GoogleLLMProvider,
  LLMProviderError,
  MockLLMProvider,
  OpenAILLMProvider,
  classifyLLMProviderError,
  collectChatWithRetry,
  createAbortableChatRequest,
  createDefaultLLMProviders,
  runModelsAllSettled,
  type ChatStream,
  type LLMProvider
} from "@roster/llm-providers";

class ImmediateStream implements ChatStream {
  constructor(private readonly behavior: "rate-limit" | "success") {}

  onText(cb: (chunk: string) => void): void {
    if (this.behavior === "success") {
      cb("ok");
    }
  }

  onError(cb: (error: Error) => void): void {
    if (this.behavior === "rate-limit") {
      cb(new LLMProviderError("RateLimited", "RateLimited", true));
    }
  }

  onComplete(cb: (result: { fullText: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }) => void): void {
    if (this.behavior === "success") {
      cb({ fullText: "ok", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } });
    }
  }
}

class FlakyProvider implements LLMProvider {
  readonly name = "mock" as const;
  attempts = 0;

  async listModels(): Promise<string[]> {
    return ["flaky"];
  }

  async chat(): Promise<ChatStream> {
    this.attempts += 1;
    return new ImmediateStream(this.attempts < 3 ? "rate-limit" : "success");
  }
}

describe("LLM provider abstraction", () => {
  it("registers real provider adapters by default", () => {
    const providers = createDefaultLLMProviders();
    expect(providers.openai).toBeInstanceOf(OpenAILLMProvider);
    expect(providers.anthropic).toBeInstanceOf(AnthropicLLMProvider);
    expect(providers.google).toBeInstanceOf(GoogleLLMProvider);
  });

  it("calls OpenAI Responses API and parses text plus usage", async () => {
    const requests: RequestInit[] = [];
    const provider = new OpenAILLMProvider({
      fetch: async (_url, init) => {
        requests.push(init ?? {});
        return new Response(
          JSON.stringify({
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: "标题 A\n标题 B" }]
              }
            ],
            usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 }
          }),
          { status: 200 }
        );
      }
    });

    const stream = await provider.chat({
      model: "gpt-5.4-mini",
      systemPrompt: "系统",
      userPrompt: "用户",
      apiKey: "sk-test-key",
      maxTokens: 100
    });
    const result = await new Promise<{ fullText: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }>(
      (resolve, reject) => {
        stream.onError(reject);
        stream.onComplete(resolve);
      }
    );
    expect(result.fullText).toContain("标题 A");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 4, totalTokens: 14 });
    expect(JSON.parse(String(requests[0].body))).toMatchObject({
      model: "gpt-5.4-mini",
      instructions: "系统",
      input: "用户",
      max_output_tokens: 100
    });
  });

  it("calls OpenAI-compatible chat completions with a custom base URL", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const provider = new OpenAILLMProvider({
      id: "deepseek",
      baseUrl: "https://api.deepseek.test/v1/",
      endpoint: "chat-completions",
      fetch: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "自定义模型返回" } }],
            usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 }
          }),
          { status: 200 }
        );
      }
    });

    const result = await collectChatWithRetry(provider, {
      model: "deepseek-chat",
      systemPrompt: "系统",
      userPrompt: "用户",
      apiKey: "custom-key"
    });

    expect(requests[0]?.url).toBe("https://api.deepseek.test/v1/chat/completions");
    expect(JSON.parse(String(requests[0]?.init.body))).toMatchObject({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "系统" },
        { role: "user", content: "用户" }
      ]
    });
    expect(result.fullText).toBe("自定义模型返回");
    expect(result.usage).toEqual({ inputTokens: 5, outputTokens: 4, totalTokens: 9 });
  });

  it("calls Anthropic Messages API and parses content blocks", async () => {
    const provider = new AnthropicLLMProvider({
      fetch: async (_url, init) => {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          model: "claude-sonnet-4-5",
          system: "系统",
          messages: [{ role: "user", content: "用户" }]
        });
        return new Response(
          JSON.stringify({
            content: [{ type: "text", text: "文案 A" }],
            usage: { input_tokens: 7, output_tokens: 3 }
          }),
          { status: 200 }
        );
      }
    });

    const result = await collectChatWithRetry(provider, {
      model: "claude-sonnet-4-5",
      systemPrompt: "系统",
      userPrompt: "用户",
      apiKey: "anthropic-test",
      maxTokens: 120
    });

    expect(result.fullText).toBe("文案 A");
    expect(result.usage).toEqual({ inputTokens: 7, outputTokens: 3, totalTokens: 10 });
  });

  it("calls Google generateContent and parses candidates", async () => {
    const provider = new GoogleLLMProvider({
      fetch: async (url, init) => {
        expect(String(url)).toContain("/models/gemini-2.5-flash:generateContent?key=AIza-test");
        expect(JSON.parse(String(init?.body))).toMatchObject({
          contents: [{ role: "user", parts: [{ text: "用户" }] }]
        });
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "标题 C" }] } }],
            usageMetadata: { promptTokenCount: 6, candidatesTokenCount: 2, totalTokenCount: 8 }
          }),
          { status: 200 }
        );
      }
    });

    const result = await collectChatWithRetry(provider, {
      model: "gemini-2.5-flash",
      systemPrompt: "系统",
      userPrompt: "用户",
      apiKey: "AIza-test"
    });

    expect(result.fullText).toBe("标题 C");
    expect(result.usage.totalTokens).toBe(8);
  });

  it("maps HTTP auth and rate-limit failures to stable provider errors", async () => {
    const invalid = new OpenAILLMProvider({
      fetch: async () => new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401 })
    });
    await expect(invalid.chat({ model: "gpt-5.4-mini", userPrompt: "x", apiKey: "bad" })).rejects.toMatchObject({
      code: "InvalidAPIKey"
    });

    const limited = new OpenAILLMProvider({
      fetch: async () => new Response(JSON.stringify({ error: { message: "slow down" } }), { status: 429 })
    });
    await expect(limited.chat({ model: "gpt-5.4-mini", userPrompt: "x", apiKey: "sk-test" })).rejects.toMatchObject({
      code: "RateLimited",
      retryable: true
    });
  });

  it("rejects real provider calls without an API key before network I/O", async () => {
    let called = false;
    const provider = new OpenAILLMProvider({
      fetch: async () => {
        called = true;
        return new Response("{}", { status: 200 });
      }
    });

    await expect(provider.chat({ model: "gpt-5.4-mini", userPrompt: "x" })).rejects.toMatchObject({ code: "InvalidAPIKey" });
    expect(called).toBe(false);
  });

  it("streams mock output and isolates failed model columns with allSettled", async () => {
    const chunks: string[] = [];
    const provider = new MockLLMProvider();

    const result = await runModelsAllSettled(
      provider,
      [
        {
          columnId: "ok",
          model: "mock-title-fast",
          systemPrompt: "标题规则",
          userPrompt: "生成 5 条"
        },
        {
          columnId: "failed",
          model: "mock-fail",
          systemPrompt: "标题规则",
          userPrompt: "生成 5 条"
        }
      ],
      (_columnId, chunk) => chunks.push(chunk)
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ status: "fulfilled", columnId: "ok", model: "mock-title-fast" });
    expect(result[1]).toMatchObject({ status: "rejected", columnId: "failed", model: "mock-fail" });
    expect(chunks.join("")).toContain("生成 5 条");
  });

  it("uses a script-shaped mock response for script models", async () => {
    const provider = new MockLLMProvider();
    const stream = await provider.chat({
      model: "mock-script-fast",
      systemPrompt: "视频文案规则",
      userPrompt: "关联 SKU：SKU-001"
    });
    const chunks: string[] = [];
    const result = await new Promise<string>((resolve, reject) => {
      stream.onText((chunk) => chunks.push(chunk));
      stream.onError(reject);
      stream.onComplete((completion) => resolve(completion.fullText));
    });

    expect(result).toContain("开场：");
    expect(result).toContain("转化：");
    expect(chunks.join("")).toContain("SKU-001");
  });

  it("classifies common provider errors into stable codes", () => {
    expect(classifyLLMProviderError(new Error("401 unauthorized")).code).toBe("InvalidAPIKey");
    expect(classifyLLMProviderError(new Error("429 too many requests")).code).toBe("RateLimited");
    expect(classifyLLMProviderError(new Error("network timeout")).code).toBe("NetworkError");
    expect(classifyLLMProviderError(new DOMException("aborted", "AbortError")).code).toBe("Canceled");
  });

  it("retries retryable streaming failures with exponential backoff", async () => {
    const provider = new FlakyProvider();
    const delays: number[] = [];
    const result = await collectChatWithRetry(
      provider,
      { model: "flaky", userPrompt: "retry" },
      undefined,
      {
        retries: 3,
        baseDelayMs: 10,
        sleep: async (ms) => {
          delays.push(ms);
        }
      }
    );

    expect(result.fullText).toBe("ok");
    expect(provider.attempts).toBe(3);
    expect(delays).toEqual([10, 20]);
  });

  it("cancels an abortable mock request without producing text", async () => {
    const provider = new MockLLMProvider();
    const { request, controller } = createAbortableChatRequest({
      model: "mock-title-fast",
      userPrompt: "cancel me"
    });
    controller.abort();
    const stream = await provider.chat(request);
    await expect(
      new Promise((resolve, reject) => {
        stream.onText(resolve);
        stream.onError(reject);
        stream.onComplete(resolve);
      })
    ).rejects.toMatchObject({ code: "Canceled" });
  });
});
