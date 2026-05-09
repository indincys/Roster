import { describe, expect, it } from "vitest";
import { ImageProviderError, MockImageProvider, OpenAIImageProvider, createDefaultImageProviders, imageDimensions } from "@roster/image-providers";

describe("image providers", () => {
  it("generates mock image bytes with requested ratio metadata", async () => {
    const provider = new MockImageProvider();
    const result = await provider.generate({
      provider: "mock",
      model: "mock-image",
      prompt: "白底主图",
      count: 2,
      ratio: "3:4"
    });

    expect(result.provider).toBe("mock");
    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toMatchObject({
      extension: "svg",
      mimeType: "image/svg+xml",
      width: 900,
      height: 1200,
      prompt: "白底主图"
    });
    expect(result.images[0].bytes.toString("utf8")).toContain("白底主图");
  });

  it("maps aspect ratios to stable dimensions", () => {
    expect(imageDimensions("1:1")).toEqual({ width: 1200, height: 1200 });
    expect(imageDimensions("9:16")).toEqual({ width: 900, height: 1600 });
    expect(imageDimensions("16:9")).toEqual({ width: 1600, height: 900 });
  });

  it("rejects canceled mock generation through a provider error", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      new MockImageProvider().generate({
        provider: "mock",
        model: "mock-image",
        prompt: "取消请求",
        count: 1,
        ratio: "1:1",
        signal: controller.signal
      })
    ).rejects.toMatchObject({
      name: "ImageProviderError",
      code: "canceled"
    } satisfies Partial<ImageProviderError>);
  });

  it("exposes mock and OpenAI providers by default", () => {
    const providers = createDefaultImageProviders();
    expect(providers.mock).toBeInstanceOf(MockImageProvider);
    expect(providers.openai).toBeInstanceOf(OpenAIImageProvider);
  });

  it("generates OpenAI image bytes from base64 response", async () => {
    const provider = new OpenAIImageProvider({
      fetch: async (url, init) => {
        expect(String(url)).toContain("/images/generations");
        expect(JSON.parse(String(init?.body))).toMatchObject({
          model: "gpt-image-1.5",
          prompt: "白底主图",
          n: 1,
          size: "1024x1536"
        });
        return new Response(
          JSON.stringify({
            data: [{ b64_json: Buffer.from("png-bytes").toString("base64") }]
          }),
          { status: 200 }
        );
      }
    });

    const result = await provider.generate({
      provider: "openai",
      model: "gpt-image-1.5",
      prompt: "白底主图",
      count: 1,
      ratio: "9:16",
      apiKey: "sk-test"
    });

    expect(result.provider).toBe("openai");
    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toMatchObject({ extension: "png", mimeType: "image/png", width: 900, height: 1600 });
    expect(result.images[0].bytes.toString("utf8")).toBe("png-bytes");
  });

  it("fails OpenAI image generation without an API key before network I/O", async () => {
    let called = false;
    const provider = new OpenAIImageProvider({
      fetch: async () => {
        called = true;
        return new Response("{}", { status: 200 });
      }
    });

    await expect(
      provider.generate({
        provider: "openai",
        model: "gpt-image-1.5",
        prompt: "白底主图",
        count: 1,
        ratio: "1:1"
      })
    ).rejects.toMatchObject({ name: "ImageProviderError", code: "provider_error" });
    expect(called).toBe(false);
  });

  it("maps OpenAI image provider HTTP failures", async () => {
    const provider = new OpenAIImageProvider({
      fetch: async () => new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401 })
    });

    await expect(
      provider.generate({
        provider: "openai",
        model: "gpt-image-1.5",
        prompt: "白底主图",
        count: 1,
        ratio: "1:1",
        apiKey: "bad-key"
      })
    ).rejects.toMatchObject({ name: "ImageProviderError", code: "provider_error", message: "bad key" });
  });
});
