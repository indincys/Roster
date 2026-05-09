export type ImageProviderId = "mock" | "openai";
export type ImageAspectRatio = "1:1" | "3:4" | "9:16" | "16:9";

export interface ImageGenerateRequest {
  provider: ImageProviderId;
  model: string;
  prompt: string;
  count: number;
  ratio: ImageAspectRatio;
  apiKey?: string;
  signal?: AbortSignal;
}

export interface GeneratedImageRef {
  id: string;
  bytes: Buffer;
  extension: "svg" | "png" | "jpg" | "webp";
  mimeType: string;
  prompt: string;
  width: number;
  height: number;
}

export interface ImageGenerateResult {
  provider: ImageProviderId;
  model: string;
  images: GeneratedImageRef[];
}

export interface ImageProvider {
  id: ImageProviderId;
  listModels(): Promise<string[]>;
  listSupportedAspectRatios(model: string): ImageAspectRatio[];
  generate(request: ImageGenerateRequest): Promise<ImageGenerateResult>;
}

export type ProviderFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface OpenAIImageProviderOptions {
  fetch?: ProviderFetch;
  baseUrl?: string;
  apiKey?: string;
}

export class ImageProviderError extends Error {
  constructor(
    message: string,
    readonly code: "canceled" | "unsupported_provider" | "provider_error" | "invalid_request"
  ) {
    super(message);
    this.name = "ImageProviderError";
  }
}

export function imageDimensions(ratio: ImageAspectRatio): { width: number; height: number } {
  if (ratio === "3:4") {
    return { width: 900, height: 1200 };
  }
  if (ratio === "9:16") {
    return { width: 900, height: 1600 };
  }
  if (ratio === "16:9") {
    return { width: 1600, height: 900 };
  }
  return { width: 1200, height: 1200 };
}

function escapeSvgText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").slice(0, 120);
}

function buildMockImageSvg(input: { prompt: string; index: number; width: number; height: number }): Buffer {
  const safePrompt = escapeSvgText(input.prompt);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}">
  <rect width="100%" height="100%" fill="#f7f7f8"/>
  <rect x="48" y="48" width="${input.width - 96}" height="${input.height - 96}" rx="8" fill="#ffffff" stroke="#d4d4d8"/>
  <text x="80" y="120" font-size="32" fill="#18181b">Mock Image ${input.index + 1}</text>
  <text x="80" y="176" font-size="22" fill="#52525b">${safePrompt}</text>
</svg>`,
    "utf8"
  );
}

export class MockImageProvider implements ImageProvider {
  readonly id = "mock" as const;

  async listModels(): Promise<string[]> {
    return ["mock-image"];
  }

  listSupportedAspectRatios(): ImageAspectRatio[] {
    return ["1:1", "3:4", "9:16", "16:9"];
  }

  async generate(request: ImageGenerateRequest): Promise<ImageGenerateResult> {
    if (request.signal?.aborted) {
      throw new ImageProviderError("Image request canceled", "canceled");
    }
    if (request.count < 1) {
      throw new ImageProviderError("Image count must be positive", "invalid_request");
    }
    const dimensions = imageDimensions(request.ratio);

    return {
      provider: this.id,
      model: request.model,
      images: Array.from({ length: request.count }, (_, index) => ({
        id: `mock-image-${Date.now()}-${index}`,
        bytes: buildMockImageSvg({ prompt: request.prompt, index, ...dimensions }),
        extension: "svg",
        mimeType: "image/svg+xml",
        prompt: request.prompt,
        ...dimensions
      }))
    };
  }
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

function providerErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "Image provider request failed";
  }
  const record = body as Record<string, unknown>;
  if (record.error && typeof record.error === "object") {
    const error = record.error as Record<string, unknown>;
    if (typeof error.message === "string") {
      return error.message;
    }
  }
  return typeof record.message === "string" ? record.message : "Image provider request failed";
}

function openAIImageSize(ratio: ImageAspectRatio): string {
  if (ratio === "9:16") {
    return "1024x1536";
  }
  if (ratio === "16:9") {
    return "1536x1024";
  }
  return "1024x1024";
}

function requireApiKey(request: ImageGenerateRequest, fallback?: string): string {
  const apiKey = request.apiKey?.trim() || fallback?.trim();
  if (!apiKey) {
    throw new ImageProviderError("InvalidAPIKey", "provider_error");
  }
  return apiKey;
}

function extractImageModelIds(body: unknown): string[] {
  if (!body || typeof body !== "object") {
    return [];
  }
  const data = (body as Record<string, unknown>).data;
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((item) => (item && typeof item === "object" && typeof (item as Record<string, unknown>).id === "string" ? (item as { id: string }).id : null))
    .filter((id): id is string => typeof id === "string" && (/image/i.test(id) || /dall-e/i.test(id)));
}

export class OpenAIImageProvider implements ImageProvider {
  readonly id = "openai" as const;
  private readonly fetchImpl: ProviderFetch;
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(options: OpenAIImageProviderOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
    this.apiKey = options.apiKey;
  }

  async listModels(): Promise<string[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/models`, {
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined
    });
    const body = await parseJsonResponse(response);
    if (!response.ok) {
      throw new ImageProviderError(providerErrorMessage(body), response.status === 401 || response.status === 403 ? "provider_error" : "provider_error");
    }
    const ids = extractImageModelIds(body);
    return ids.length > 0 ? ids : ["gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"];
  }

  listSupportedAspectRatios(model: string): ImageAspectRatio[] {
    return model.startsWith("gpt-image") ? ["1:1", "9:16", "16:9"] : ["1:1"];
  }

  async generate(request: ImageGenerateRequest): Promise<ImageGenerateResult> {
    if (request.signal?.aborted) {
      throw new ImageProviderError("Image request canceled", "canceled");
    }
    if (request.count < 1) {
      throw new ImageProviderError("Image count must be positive", "invalid_request");
    }
    const apiKey = requireApiKey(request, this.apiKey);
    const response = await this.fetchImpl(`${this.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        n: request.count,
        size: openAIImageSize(request.ratio)
      }),
      signal: request.signal
    });
    const body = await parseJsonResponse(response);
    if (!response.ok) {
      throw new ImageProviderError(providerErrorMessage(body), "provider_error");
    }
    const dimensions = imageDimensions(request.ratio);
    const data = body && typeof body === "object" ? (body as Record<string, unknown>).data : null;
    const images: GeneratedImageRef[] = [];
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        if (!item || typeof item !== "object" || typeof (item as Record<string, unknown>).b64_json !== "string") {
          return;
        }
        images.push({
          id: `openai-image-${Date.now()}-${index}`,
          bytes: Buffer.from((item as { b64_json: string }).b64_json, "base64"),
          extension: "png" as const,
          mimeType: "image/png",
          prompt: request.prompt,
          ...dimensions
        });
      });
    }
    if (images.length === 0) {
      throw new ImageProviderError("Image provider returned no image data", "provider_error");
    }
    return {
      provider: this.id,
      model: request.model,
      images
    };
  }
}

export function createDefaultImageProviders(options: OpenAIImageProviderOptions = {}): Record<ImageProviderId, ImageProvider | null> {
  return {
    mock: new MockImageProvider(),
    openai: new OpenAIImageProvider(options)
  };
}
