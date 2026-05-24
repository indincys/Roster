import {
  imageGenerationDimensions,
  imageGenerationSize,
  IMAGE_GENERATION_RESOLUTIONS_BY_ASPECT_RATIO,
  IMAGE_GENERATION_PROMPT_MAX_LENGTH,
  type ImageGenerationOutputFormat,
  type ImageGenerationQuality,
  type ImageGenerationResolution
} from "@roster/shared-types";

export type ImageProviderId = string;
export type ImageAspectRatio = "1:1" | "3:4" | "9:16" | "16:9";

export interface ImageGenerateRequest {
  provider: ImageProviderId;
  model: string;
  prompt: string;
  count: number;
  ratio: ImageAspectRatio;
  resolution: ImageGenerationResolution;
  quality: ImageGenerationQuality;
  outputFormat: ImageGenerationOutputFormat;
  apiKey?: string;
  signal?: AbortSignal;
}

export interface GeneratedImageRef {
  id: string;
  bytes: Buffer;
  extension: "svg" | "jpg" | ImageGenerationOutputFormat;
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
  id?: ImageProviderId;
  fetch?: ProviderFetch;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
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

export function imageDimensions(
  ratio: ImageAspectRatio,
  resolution: ImageGenerationResolution = "1k"
): { width: number; height: number } {
  try {
    return imageGenerationDimensions(ratio, resolution);
  } catch {
    throw new ImageProviderError(`${ratio} does not support ${resolution} resolution`, "invalid_request");
  }
}

export function imageSize(ratio: ImageAspectRatio, resolution: ImageGenerationResolution = "1k"): string {
  return imageGenerationSize(ratio, resolution);
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
  readonly id: ImageProviderId;

  constructor(id: ImageProviderId = "mock") {
    this.id = id;
  }

  async listModels(): Promise<string[]> {
    return ["mock-image"];
  }

  listSupportedAspectRatios(): ImageAspectRatio[] {
    return ["1:1", "3:4", "9:16", "16:9"];
  }

  async generate(request: ImageGenerateRequest): Promise<ImageGenerateResult> {
    validateImageGenerateRequest(request);
    const dimensions = imageDimensions(request.ratio, request.resolution);

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
  const htmlMessage = htmlResponseMessage(body);
  if (htmlMessage) {
    return htmlMessage;
  }
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

function htmlResponseMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const message = (body as Record<string, unknown>).message;
  if (typeof message !== "string") {
    return null;
  }
  const trimmed = message.trim().toLowerCase();
  if (!trimmed.startsWith("<!doctype html") && !trimmed.startsWith("<html")) {
    return null;
  }
  return "图片 Provider 返回了网页 HTML，不是图片生成 API JSON。请检查 baseURL，云雾图片接口应填写 https://yunwu.ai/v1，不要填写 wlai.vip、网站首页或 Apifox 文档地址。";
}

function compactResponseBody(body: unknown): string {
  const htmlMessage = htmlResponseMessage(body);
  if (htmlMessage) {
    return htmlMessage;
  }
  if (body === null || body === undefined) {
    return "empty response";
  }
  try {
    return JSON.stringify(body).slice(0, 500);
  } catch {
    return String(body).slice(0, 500);
  }
}

function requireApiKey(request: ImageGenerateRequest, fallback?: string): string {
  const apiKey = request.apiKey?.trim() || fallback?.trim();
  if (!apiKey) {
    throw new ImageProviderError("InvalidAPIKey", "provider_error");
  }
  return apiKey;
}

function validateImageGenerateRequest(request: ImageGenerateRequest): void {
  if (request.signal?.aborted) {
    throw new ImageProviderError("Image request canceled", "canceled");
  }
  if (request.count < 1 || request.count > 10) {
    throw new ImageProviderError("Image count must be between 1 and 10", "invalid_request");
  }
  if (request.prompt.trim().length === 0) {
    throw new ImageProviderError("Image prompt is required", "invalid_request");
  }
  if (request.prompt.length > IMAGE_GENERATION_PROMPT_MAX_LENGTH) {
    throw new ImageProviderError(`Image prompt must be ${IMAGE_GENERATION_PROMPT_MAX_LENGTH} characters or less`, "invalid_request");
  }
  if (!IMAGE_GENERATION_RESOLUTIONS_BY_ASPECT_RATIO[request.ratio].includes(request.resolution)) {
    throw new ImageProviderError(`${request.ratio} does not support ${request.resolution} resolution`, "invalid_request");
  }
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
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

function mimeTypeForFormat(format: ImageGenerationOutputFormat): string {
  return format === "jpeg" ? "image/jpeg" : `image/${format}`;
}

function formatFromMimeType(mimeType: string | null): ImageGenerationOutputFormat | null {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return "jpeg";
  }
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  return null;
}

function decodeBase64Image(
  value: string,
  fallback: ImageGenerationOutputFormat
): { bytes: Buffer; extension: ImageGenerationOutputFormat; mimeType: string } {
  const dataUrlMatch = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i.exec(value.trim());
  const mimeType = dataUrlMatch?.[1]?.toLowerCase() ?? mimeTypeForFormat(fallback);
  const encoded = dataUrlMatch?.[2] ?? value;
  const extension = formatFromMimeType(mimeType) ?? fallback;
  return {
    bytes: Buffer.from(encoded, "base64"),
    extension,
    mimeType: mimeTypeForFormat(extension)
  };
}

function firstImageUrl(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0) ?? null;
  }
  return null;
}

function imageExtensionFromUrl(url: string, fallback: ImageGenerationOutputFormat): "jpg" | ImageGenerationOutputFormat {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const ext = pathname.split(".").pop();
    if (ext === "jpg") {
      return "jpg";
    }
    if (ext === "jpeg" || ext === "png" || ext === "webp") {
      return ext;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function imageMimeType(extension: "svg" | "jpg" | ImageGenerationOutputFormat): string {
  if (extension === "svg") {
    return "image/svg+xml";
  }
  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }
  return `image/${extension}`;
}

function responseArrayBuffer(response: Response): Promise<ArrayBuffer> {
  return response.arrayBuffer();
}

export class OpenAIImageProvider implements ImageProvider {
  readonly id: ImageProviderId;
  private readonly fetchImpl: ProviderFetch;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly defaultModel?: string;

  constructor(options: OpenAIImageProviderOptions = {}) {
    this.id = options.id ?? "openai";
    this.fetchImpl = options.fetch ?? fetch;
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.defaultModel = options.defaultModel;
  }

  async listModels(): Promise<string[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/models`, {
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined
    });
    const body = await parseJsonResponse(response);
    if (!response.ok) {
      if ((response.status === 404 || response.status === 405) && this.defaultModel) {
        return [this.defaultModel];
      }
      throw new ImageProviderError(providerErrorMessage(body), response.status === 401 || response.status === 403 ? "provider_error" : "provider_error");
    }
    const ids = extractImageModelIds(body);
    return ids.length > 0 ? ids : this.defaultModel ? [this.defaultModel] : ["gpt-image-2", "gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"];
  }

  listSupportedAspectRatios(model: string): ImageAspectRatio[] {
    return model.startsWith("gpt-image") ? ["1:1", "3:4", "9:16", "16:9"] : ["1:1"];
  }

  async generate(request: ImageGenerateRequest): Promise<ImageGenerateResult> {
    validateImageGenerateRequest(request);
    const apiKey = requireApiKey(request, this.apiKey);
    const size = imageSize(request.ratio, request.resolution);
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
        size,
        quality: request.quality,
        format: request.outputFormat
      }),
      signal: request.signal
    });
    const body = await parseJsonResponse(response);
    if (!response.ok) {
      throw new ImageProviderError(providerErrorMessage(body), "provider_error");
    }
    const htmlMessage = htmlResponseMessage(body);
    if (htmlMessage) {
      throw new ImageProviderError(htmlMessage, "provider_error");
    }
    const dimensions = imageDimensions(request.ratio, request.resolution);
    const images = await this.imagesFromResponse(body, request, dimensions);
    if (images.length === 0) {
      throw new ImageProviderError(`Image provider returned no image data: ${compactResponseBody(body)}`, "provider_error");
    }
    return {
      provider: this.id,
      model: request.model,
      images
    };
  }

  private async imagesFromResponse(
    body: unknown,
    request: ImageGenerateRequest,
    dimensions: { width: number; height: number }
  ): Promise<GeneratedImageRef[]> {
    const data = body && typeof body === "object" ? (body as Record<string, unknown>).data : null;
    const records = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : [];
    const images: GeneratedImageRef[] = [];
    for (const [index, item] of records.entries()) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const record = item as Record<string, unknown>;
      if (typeof record.b64_json === "string") {
        const decoded = decodeBase64Image(record.b64_json, request.outputFormat);
        images.push({
          id: `openai-image-${Date.now()}-${index}`,
          bytes: decoded.bytes,
          extension: decoded.extension,
          mimeType: decoded.mimeType,
          prompt: request.prompt,
          ...dimensions
        });
        continue;
      }
      const url = firstImageUrl(record.url);
      if (url) {
        images.push(await this.downloadImageUrl(url, request, index, dimensions));
      }
    }
    return images;
  }

  private async downloadImageUrl(
    url: string,
    request: ImageGenerateRequest,
    index: number,
    dimensions: { width: number; height: number }
  ): Promise<GeneratedImageRef> {
    const response = await this.fetchImpl(url, { signal: request.signal });
    if (!response.ok) {
      const body = await parseJsonResponse(response);
      throw new ImageProviderError(providerErrorMessage(body), "provider_error");
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const extension = formatFromMimeType(contentType) ?? imageExtensionFromUrl(url, request.outputFormat);
    return {
      id: `openai-image-${Date.now()}-${index}`,
      bytes: Buffer.from(await responseArrayBuffer(response)),
      extension,
      mimeType: imageMimeType(extension),
      prompt: request.prompt,
      ...dimensions
    };
  }
}

export function createDefaultImageProviders(options: OpenAIImageProviderOptions = {}): Record<ImageProviderId, ImageProvider | null> {
  return {
    mock: new MockImageProvider(),
    openai: new OpenAIImageProvider(options)
  };
}
