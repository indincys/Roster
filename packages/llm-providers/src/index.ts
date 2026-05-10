export type LlmProviderId = string;
export type LLMProviderErrorCode = "NetworkError" | "RateLimited" | "InvalidAPIKey" | "ContentRejected" | "Canceled" | "ProviderError";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ChatRequest {
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  abortSignal?: AbortSignal;
}

export interface ChatCompletionResult {
  fullText: string;
  usage: TokenUsage;
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: LLMProviderError, attempt: number) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

export interface ChatStream {
  onText(cb: (chunk: string) => void): void;
  onError(cb: (error: Error) => void): void;
  onComplete(cb: (result: ChatCompletionResult) => void): void;
}

export interface LLMProvider {
  readonly name: LlmProviderId;
  listModels(): Promise<string[]>;
  chat(request: ChatRequest): Promise<ChatStream>;
}

export type ProviderFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface HttpProviderOptions {
  fetch?: ProviderFetch;
  baseUrl?: string;
  apiKey?: string;
  id?: string;
}

export class LLMProviderError extends Error {
  constructor(
    readonly code: LLMProviderErrorCode,
    message: string,
    readonly retryable = false,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "LLMProviderError";
  }
}

type TextCallback = (chunk: string) => void;
type ErrorCallback = (error: Error) => void;
type CompleteCallback = (result: ChatCompletionResult) => void;

class InMemoryChatStream implements ChatStream {
  private readonly textCallbacks: TextCallback[] = [];
  private readonly errorCallbacks: ErrorCallback[] = [];
  private readonly completeCallbacks: CompleteCallback[] = [];

  onText(cb: TextCallback): void {
    this.textCallbacks.push(cb);
  }

  onError(cb: ErrorCallback): void {
    this.errorCallbacks.push(cb);
  }

  onComplete(cb: CompleteCallback): void {
    this.completeCallbacks.push(cb);
  }

  emitText(chunk: string): void {
    for (const callback of this.textCallbacks) {
      callback(chunk);
    }
  }

  emitError(error: Error): void {
    for (const callback of this.errorCallbacks) {
      callback(error);
    }
  }

  emitComplete(result: ChatCompletionResult): void {
    for (const callback of this.completeCallbacks) {
      callback(result);
    }
  }
}

function requireApiKey(request: ChatRequest): string {
  const apiKey = request.apiKey?.trim();
  if (!apiKey) {
    throw new LLMProviderError("InvalidAPIKey", "InvalidAPIKey", false);
  }
  return apiKey;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function providerErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") {
    return fallback;
  }
  const record = body as Record<string, unknown>;
  if (record.error && typeof record.error === "object") {
    const error = record.error as Record<string, unknown>;
    if (typeof error.message === "string") {
      return error.message;
    }
    if (typeof error.type === "string") {
      return error.type;
    }
  }
  if (typeof record.message === "string") {
    return record.message;
  }
  return fallback;
}

function classifyHttpFailure(status: number, body: unknown, cause?: unknown): LLMProviderError {
  const message = providerErrorMessage(body, `Provider request failed with HTTP ${status}`);
  if (status === 401 || status === 403) {
    return new LLMProviderError("InvalidAPIKey", "InvalidAPIKey", false, cause);
  }
  if (status === 429) {
    return new LLMProviderError("RateLimited", "RateLimited", true, cause);
  }
  if (status === 400 && /safety|moderation|content/i.test(message)) {
    return new LLMProviderError("ContentRejected", "ContentRejected", false, cause);
  }
  if (status >= 500) {
    return new LLMProviderError("NetworkError", message, true, cause);
  }
  return new LLMProviderError("ProviderError", message, false, cause);
}

function extractResponseOutputText(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "";
  }
  const record = body as Record<string, unknown>;
  if (typeof record.output_text === "string") {
    return record.output_text;
  }
  const output = Array.isArray(record.output) ? record.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") {
        chunks.push((part as Record<string, string>).text);
      }
    }
  }
  return chunks.join("");
}

function extractChatCompletionText(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "";
  }
  const choices = (body as Record<string, unknown>).choices;
  if (!Array.isArray(choices)) {
    return "";
  }
  const chunks: string[] = [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") {
      continue;
    }
    const message = (choice as Record<string, unknown>).message;
    const content = message && typeof message === "object" ? (message as Record<string, unknown>).content : null;
    if (typeof content === "string") {
      chunks.push(content);
      continue;
    }
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") {
          chunks.push((part as { text: string }).text);
        }
      }
    }
  }
  return chunks.join("");
}

function extractAnthropicText(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "";
  }
  const content = (body as Record<string, unknown>).content;
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string" ? (part as { text: string }).text : ""))
    .join("");
}

function extractGoogleText(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "";
  }
  const candidates = (body as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates)) {
    return "";
  }
  const chunks: string[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }
    const content = (candidate as Record<string, unknown>).content;
    const parts = content && typeof content === "object" ? (content as Record<string, unknown>).parts : null;
    if (!Array.isArray(parts)) {
      continue;
    }
    for (const part of parts) {
      if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") {
        chunks.push((part as { text: string }).text);
      }
    }
  }
  return chunks.join("");
}

function usageFromOpenAI(body: unknown): TokenUsage {
  const usage = body && typeof body === "object" ? (body as Record<string, unknown>).usage : null;
  const record = usage && typeof usage === "object" ? (usage as Record<string, unknown>) : {};
  const inputTokens = typeof record.input_tokens === "number" ? record.input_tokens : 0;
  const outputTokens = typeof record.output_tokens === "number" ? record.output_tokens : 0;
  const totalTokens = typeof record.total_tokens === "number" ? record.total_tokens : inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}

function usageFromChatCompletion(body: unknown): TokenUsage {
  const usage = body && typeof body === "object" ? (body as Record<string, unknown>).usage : null;
  const record = usage && typeof usage === "object" ? (usage as Record<string, unknown>) : {};
  const inputTokens = typeof record.prompt_tokens === "number" ? record.prompt_tokens : 0;
  const outputTokens = typeof record.completion_tokens === "number" ? record.completion_tokens : 0;
  const totalTokens = typeof record.total_tokens === "number" ? record.total_tokens : inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}

function usageFromAnthropic(body: unknown): TokenUsage {
  const usage = body && typeof body === "object" ? (body as Record<string, unknown>).usage : null;
  const record = usage && typeof usage === "object" ? (usage as Record<string, unknown>) : {};
  const inputTokens = typeof record.input_tokens === "number" ? record.input_tokens : 0;
  const outputTokens = typeof record.output_tokens === "number" ? record.output_tokens : 0;
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

function usageFromGoogle(body: unknown): TokenUsage {
  const metadata = body && typeof body === "object" ? (body as Record<string, unknown>).usageMetadata : null;
  const record = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const inputTokens = typeof record.promptTokenCount === "number" ? record.promptTokenCount : 0;
  const outputTokens = typeof record.candidatesTokenCount === "number" ? record.candidatesTokenCount : 0;
  const totalTokens = typeof record.totalTokenCount === "number" ? record.totalTokenCount : inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}

function completedStream(fullText: string, usage: TokenUsage): ChatStream {
  const stream = new InMemoryChatStream();
  setTimeout(() => {
    if (fullText) {
      for (const chunk of fullText.match(/.{1,80}/gs) ?? [fullText]) {
        stream.emitText(chunk);
      }
    }
    stream.emitComplete({ fullText, usage });
  }, 0);
  return stream;
}

function extractModelIds(body: unknown): string[] {
  if (!body || typeof body !== "object") {
    return [];
  }
  const record = body as Record<string, unknown>;
  const data = Array.isArray(record.data) ? record.data : Array.isArray(record.models) ? record.models : [];
  return data
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (!item || typeof item !== "object") {
        return null;
      }
      const model = item as Record<string, unknown>;
      const raw = typeof model.id === "string" ? model.id : typeof model.name === "string" ? model.name : null;
      return raw?.replace(/^models\//, "") ?? null;
    })
    .filter((model): model is string => Boolean(model))
    .slice(0, 100);
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function buildMockTitles(request: ChatRequest): string {
  const seed = `${request.systemPrompt ?? ""}\n${request.userPrompt}`.replace(/\s+/g, " ").trim();
  const brief = seed.slice(0, 24) || "新品";
  return [
    `1. ${brief}，这样拍更容易被看见`,
    `2. ${brief}，三秒讲清卖点`,
    `3. ${brief}，今天这条适合直接发布`,
    `4. ${brief}，同款人群会停留`,
    `5. ${brief}，把核心利益点放前面`
  ].join("\n");
}

function buildMockScript(request: ChatRequest): string {
  const seed = `${request.systemPrompt ?? ""}\n${request.userPrompt}`.replace(/\s+/g, " ").trim();
  const brief = seed.slice(0, 36) || "新品";
  return [
    `开场：今天这条视频讲 ${brief}。`,
    `版本：${request.model}。`,
    "卖点：先把用户最在意的场景说清楚，再给出一个具体理由。",
    "口播：如果你想要通勤和日常都能直接用的选择，这一款可以重点看版型、材质和上身效果。",
    "转化：评论区留下需求，我把适合的人群和搭配建议整理给你。"
  ].join("\n");
}

export class MockLLMProvider implements LLMProvider {
  readonly name = "mock";

  async listModels(): Promise<string[]> {
    return ["mock-title-fast", "mock-title-balanced", "mock-script-fast", "mock-script-balanced", "mock-fail"];
  }

  async chat(request: ChatRequest): Promise<ChatStream> {
    const stream = new InMemoryChatStream();
    const rawChunkDelayMs = Number(globalThis.process?.env.ROSTER_MOCK_LLM_CHUNK_DELAY_MS ?? 8);
    const chunkDelayMs = Number.isFinite(rawChunkDelayMs) ? Math.max(0, rawChunkDelayMs) : 8;
    setTimeout(() => {
      if (request.abortSignal?.aborted) {
        stream.emitError(new LLMProviderError("Canceled", "LLM request canceled", false));
        return;
      }
      if (request.model.includes("fail")) {
        stream.emitError(new LLMProviderError("ProviderError", "MockProviderFailure", false));
        return;
      }
      if (request.model.includes("invalid-key")) {
        stream.emitError(new LLMProviderError("InvalidAPIKey", "InvalidAPIKey", false));
        return;
      }
      if (request.model.includes("rate-limit")) {
        stream.emitError(new LLMProviderError("RateLimited", "RateLimited", true));
        return;
      }

      const fullText = request.model.includes("script") ? buildMockScript(request) : buildMockTitles(request);
      const chunks = fullText.match(/.{1,12}/gs) ?? [fullText];
      let index = 0;
      const emitNextChunk = (): void => {
        if (request.abortSignal?.aborted) {
          stream.emitError(new LLMProviderError("Canceled", "LLM request canceled", false));
          return;
        }
        const chunk = chunks[index];
        if (chunk) {
          stream.emitText(chunk);
          index += 1;
          setTimeout(emitNextChunk, chunkDelayMs);
          return;
        }
        stream.emitComplete({
          fullText,
          usage: {
            inputTokens: estimateTokens(`${request.systemPrompt ?? ""}\n${request.userPrompt}`),
            outputTokens: estimateTokens(fullText),
            totalTokens: estimateTokens(`${request.systemPrompt ?? ""}\n${request.userPrompt}\n${fullText}`)
          }
        });
      };
      emitNextChunk();
    }, 0);
    return stream;
  }
}

export class OpenAILLMProvider implements LLMProvider {
  readonly name: string;
  private readonly fetchImpl: ProviderFetch;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly endpoint: "responses" | "chat-completions";

  constructor(options: HttpProviderOptions & { endpoint?: "responses" | "chat-completions" } = {}) {
    this.name = options.id ?? "openai";
    this.fetchImpl = options.fetch ?? fetch;
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint ?? "responses";
  }

  async listModels(): Promise<string[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/models`, {
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined
    });
    const body = await parseJsonResponse(response);
    if (!response.ok) {
      throw classifyHttpFailure(response.status, body);
    }
    return extractModelIds(body);
  }

  async chat(request: ChatRequest): Promise<ChatStream> {
    const apiKey = requireApiKey(request);
    if (this.endpoint === "chat-completions") {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: request.model,
          messages: [
            ...(request.systemPrompt ? [{ role: "system", content: request.systemPrompt }] : []),
            { role: "user", content: request.userPrompt }
          ],
          temperature: request.temperature,
          max_tokens: request.maxTokens
        }),
        signal: request.abortSignal
      });
      const body = await parseJsonResponse(response);
      if (!response.ok) {
        throw classifyHttpFailure(response.status, body);
      }
      return completedStream(extractChatCompletionText(body), usageFromChatCompletion(body));
    }
    const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: request.model,
        instructions: request.systemPrompt || undefined,
        input: request.userPrompt,
        temperature: request.temperature,
        max_output_tokens: request.maxTokens
      }),
      signal: request.abortSignal
    });
    const body = await parseJsonResponse(response);
    if (!response.ok) {
      throw classifyHttpFailure(response.status, body);
    }
    const fullText = extractResponseOutputText(body);
    return completedStream(fullText, usageFromOpenAI(body));
  }
}

export class AnthropicLLMProvider implements LLMProvider {
  readonly name: string;
  private readonly fetchImpl: ProviderFetch;
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(options: HttpProviderOptions = {}) {
    this.name = options.id ?? "anthropic";
    this.fetchImpl = options.fetch ?? fetch;
    this.baseUrl = (options.baseUrl ?? "https://api.anthropic.com/v1").replace(/\/+$/, "");
    this.apiKey = options.apiKey;
  }

  async listModels(): Promise<string[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/models`, {
      headers: { "anthropic-version": "2023-06-01", ...(this.apiKey ? { "x-api-key": this.apiKey } : {}) }
    });
    const body = await parseJsonResponse(response);
    if (!response.ok) {
      throw classifyHttpFailure(response.status, body);
    }
    return extractModelIds(body);
  }

  async chat(request: ChatRequest): Promise<ChatStream> {
    const apiKey = requireApiKey(request);
    const response = await this.fetchImpl(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: request.model,
        system: request.systemPrompt || undefined,
        max_tokens: request.maxTokens ?? 1_000,
        temperature: request.temperature,
        messages: [{ role: "user", content: request.userPrompt }]
      }),
      signal: request.abortSignal
    });
    const body = await parseJsonResponse(response);
    if (!response.ok) {
      throw classifyHttpFailure(response.status, body);
    }
    return completedStream(extractAnthropicText(body), usageFromAnthropic(body));
  }
}

export class GoogleLLMProvider implements LLMProvider {
  readonly name: string;
  private readonly fetchImpl: ProviderFetch;
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(options: HttpProviderOptions = {}) {
    this.name = options.id ?? "google";
    this.fetchImpl = options.fetch ?? fetch;
    this.baseUrl = (options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
    this.apiKey = options.apiKey;
  }

  async listModels(): Promise<string[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/models${this.apiKey ? `?key=${encodeURIComponent(this.apiKey)}` : ""}`);
    const body = await parseJsonResponse(response);
    if (!response.ok) {
      throw classifyHttpFailure(response.status, body);
    }
    return extractModelIds(body);
  }

  async chat(request: ChatRequest): Promise<ChatStream> {
    const apiKey = requireApiKey(request);
    const modelPath = request.model.startsWith("models/") ? request.model : `models/${request.model}`;
    const response = await this.fetchImpl(`${this.baseUrl}/${modelPath}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: request.systemPrompt
          ? {
              parts: [{ text: request.systemPrompt }]
            }
          : undefined,
        contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens
        }
      }),
      signal: request.abortSignal
    });
    const body = await parseJsonResponse(response);
    if (!response.ok) {
      throw classifyHttpFailure(response.status, body);
    }
    return completedStream(extractGoogleText(body), usageFromGoogle(body));
  }
}

export function createDefaultLLMProviders(options: HttpProviderOptions = {}): Record<LlmProviderId, LLMProvider | null> {
  return {
    mock: new MockLLMProvider(),
    openai: new OpenAILLMProvider(options),
    anthropic: new AnthropicLLMProvider(options),
    google: new GoogleLLMProvider(options)
  };
}

export function classifyLLMProviderError(error: unknown): LLMProviderError {
  if (error instanceof LLMProviderError) {
    return error;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return new LLMProviderError("Canceled", "LLM request canceled", false, error);
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid[_\s-]?api[_\s-]?key|unauthorized|401/i.test(message)) {
    return new LLMProviderError("InvalidAPIKey", "InvalidAPIKey", false, error);
  }
  if (/rate[_\s-]?limit|too many requests|429/i.test(message)) {
    return new LLMProviderError("RateLimited", "RateLimited", true, error);
  }
  if (/content[_\s-]?rejected|safety|moderation/i.test(message)) {
    return new LLMProviderError("ContentRejected", "ContentRejected", false, error);
  }
  if (/network|fetch|timeout|econnreset|enotfound/i.test(message)) {
    return new LLMProviderError("NetworkError", "NetworkError", true, error);
  }
  return new LLMProviderError("ProviderError", message, false, error);
}

export function createAbortableChatRequest(input: Omit<ChatRequest, "abortSignal">): {
  request: ChatRequest;
  controller: AbortController;
} {
  const controller = new AbortController();
  return {
    request: {
      ...input,
      abortSignal: controller.signal
    },
    controller
  };
}

export async function chatWithRetry(provider: LLMProvider, request: ChatRequest, options: RetryOptions = {}): Promise<ChatStream> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 4_000;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const shouldRetry =
    options.shouldRetry ??
    ((error: LLMProviderError) => error.retryable && error.code !== "Canceled" && !request.abortSignal?.aborted);
  let attempt = 0;
  while (true) {
    try {
      if (request.abortSignal?.aborted) {
        throw new LLMProviderError("Canceled", "LLM request canceled", false);
      }
      return await provider.chat(request);
    } catch (error) {
      const classified = classifyLLMProviderError(error);
      if (attempt >= retries || !shouldRetry(classified, attempt)) {
        throw classified;
      }
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      attempt += 1;
      await sleep(delay);
    }
  }
}

export async function collectChatStream(stream: ChatStream, onText?: TextCallback): Promise<ChatCompletionResult> {
  return new Promise((resolve, reject) => {
    stream.onText((chunk) => {
      onText?.(chunk);
    });
    stream.onError((error) => {
      reject(classifyLLMProviderError(error));
    });
    stream.onComplete((result) => {
      resolve(result);
    });
  });
}

export async function collectChatWithRetry(
  provider: LLMProvider,
  request: ChatRequest,
  onText?: TextCallback,
  options: RetryOptions = {}
): Promise<ChatCompletionResult> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 4_000;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const shouldRetry =
    options.shouldRetry ??
    ((error: LLMProviderError) => error.retryable && error.code !== "Canceled" && !request.abortSignal?.aborted);
  let attempt = 0;
  while (true) {
    try {
      const stream = await chatWithRetry(provider, request, { ...options, retries: 0 });
      return await collectChatStream(stream, onText);
    } catch (error) {
      const classified = classifyLLMProviderError(error);
      if (attempt >= retries || !shouldRetry(classified, attempt)) {
        throw classified;
      }
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      attempt += 1;
      await sleep(delay);
    }
  }
}

export async function runModelsAllSettled(
  provider: LLMProvider,
  requests: Array<ChatRequest & { columnId: string }>,
  onText?: (columnId: string, chunk: string) => void
): Promise<
  Array<
    | { status: "fulfilled"; columnId: string; model: string; value: ChatCompletionResult }
    | { status: "rejected"; columnId: string; model: string; reason: string }
  >
> {
  const settled = await Promise.allSettled(
    requests.map(async (request) => {
      const value = await collectChatWithRetry(provider, request, (chunk) => onText?.(request.columnId, chunk));
      return {
        columnId: request.columnId,
        model: request.model,
        value
      };
    })
  );

  return settled.map((result, index) => {
    const request = requests[index];
    if (result.status === "fulfilled") {
      return {
        status: "fulfilled",
        columnId: result.value.columnId,
        model: result.value.model,
        value: result.value.value
      };
    }
    return {
      status: "rejected",
      columnId: request.columnId,
      model: request.model,
      reason: result.reason instanceof Error ? result.reason.message : String(result.reason)
    };
  });
}
