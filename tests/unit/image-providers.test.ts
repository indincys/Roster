import { describe, expect, it } from "vitest";
import { ImageProviderError, MockImageProvider, OpenAIImageProvider, createDefaultImageProviders, imageDimensions, imageSize } from "@roster/image-providers";

describe("image providers", () => {
  it("generates mock image bytes with requested ratio metadata", async () => {
    const provider = new MockImageProvider();
    const result = await provider.generate({
      provider: "mock",
      model: "mock-image",
      prompt: "白底主图",
      count: 2,
      ratio: "3:4",
      resolution: "1k",
      quality: "auto",
      outputFormat: "png"
    });

    expect(result.provider).toBe("mock");
    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toMatchObject({
      extension: "svg",
      mimeType: "image/svg+xml",
      width: 768,
      height: 1024,
      prompt: "白底主图"
    });
    expect(result.images[0].bytes.toString("utf8")).toContain("白底主图");
  });

  it("maps aspect ratios to stable dimensions", () => {
    expect(imageDimensions("1:1", "1k")).toEqual({ width: 1024, height: 1024 });
    expect(imageDimensions("3:4", "2k")).toEqual({ width: 1536, height: 2048 });
    expect(imageDimensions("9:16", "4k")).toEqual({ width: 2160, height: 3840 });
    expect(imageDimensions("16:9", "4k")).toEqual({ width: 3840, height: 2160 });
    expect(imageSize("3:4", "2k")).toBe("1536x2048");
  });

  it("rejects prompts longer than the image API limit before network I/O", async () => {
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
        model: "gpt-image-2",
        prompt: "x".repeat(1001),
        count: 1,
        ratio: "1:1",
        resolution: "1k",
        quality: "auto",
        outputFormat: "png",
        apiKey: "sk-test"
      })
    ).rejects.toMatchObject({ name: "ImageProviderError", code: "invalid_request" });
    expect(called).toBe(false);
  });

  it("rejects unsupported resolution combinations before network I/O", async () => {
    const provider = new OpenAIImageProvider();

    await expect(
      provider.generate({
        provider: "openai",
        model: "gpt-image-2",
        prompt: "白底主图",
        count: 1,
        ratio: "1:1",
        resolution: "4k",
        quality: "auto",
        outputFormat: "png",
        apiKey: "sk-test"
      })
    ).rejects.toMatchObject({ name: "ImageProviderError", code: "invalid_request" });
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
        resolution: "1k",
        quality: "auto",
        outputFormat: "png",
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
          size: "864x1536",
          quality: "high",
          format: "webp"
        });
        return new Response(
          JSON.stringify({
            data: [{ b64_json: Buffer.from("webp-bytes").toString("base64") }]
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
      resolution: "1k",
      quality: "high",
      outputFormat: "webp",
      apiKey: "sk-test"
    });

    expect(result.provider).toBe("openai");
    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toMatchObject({ extension: "webp", mimeType: "image/webp", width: 864, height: 1536 });
    expect(result.images[0].bytes.toString("utf8")).toBe("webp-bytes");
  });

  it("downloads OpenAI image bytes from URL responses", async () => {
    const provider = new OpenAIImageProvider({
      fetch: async (url, init) => {
        if (String(url).includes("/images/generations")) {
          expect(JSON.parse(String(init?.body))).toMatchObject({
            model: "gpt-image-2",
            prompt: "白底主图",
            n: 2,
            size: "2048x1152",
            quality: "auto",
            format: "jpeg"
          });
          return new Response(
            JSON.stringify({
              data: [{ url: "https://cdn.example.com/a.jpg" }, { url: "https://cdn.example.com/b.jpeg" }]
            }),
            { status: 200 }
          );
        }
        return new Response(Buffer.from(`bytes:${url}`), {
          status: 200,
          headers: { "content-type": "image/jpeg" }
        });
      }
    });

    const result = await provider.generate({
      provider: "openai",
      model: "gpt-image-2",
      prompt: "白底主图",
      count: 2,
      ratio: "16:9",
      resolution: "2k",
      quality: "auto",
      outputFormat: "jpeg",
      apiKey: "sk-test"
    });

    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toMatchObject({ extension: "jpeg", mimeType: "image/jpeg", width: 2048, height: 1152 });
    expect(result.images[0].bytes.toString("utf8")).toBe("bytes:https://cdn.example.com/a.jpg");
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
        ratio: "1:1",
        resolution: "1k",
        quality: "auto",
        outputFormat: "png"
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
        resolution: "1k",
        quality: "auto",
        outputFormat: "png",
        apiKey: "bad-key"
      })
    ).rejects.toMatchObject({ name: "ImageProviderError", code: "provider_error", message: "bad key" });
  });

  it("rejects HTML provider responses as a baseURL configuration error", async () => {
    const provider = new OpenAIImageProvider({
      baseUrl: "https://wlai.vip",
      fetch: async () =>
        new Response("<!DOCTYPE html><html><head><title>Loading...</title></head><body></body></html>", {
          status: 200,
          headers: { "content-type": "text/html" }
        })
    });

    await expect(
      provider.generate({
        provider: "yunwu",
        model: "gpt-image-1.5",
        prompt: "白底主图",
        count: 1,
        ratio: "1:1",
        resolution: "1k",
        quality: "auto",
        outputFormat: "png",
        apiKey: "sk-test"
      })
    ).rejects.toMatchObject({
      name: "ImageProviderError",
      code: "provider_error",
      message: expect.stringContaining("https://yunwu.ai/v1")
    });
  });

  it("preserves custom image provider base URLs for parallel providers", async () => {
    const seenUrls: string[] = [];
    const provider = new OpenAIImageProvider({
      baseUrl: "https://custom-image-gateway.example.com/v1/",
      fetch: async (url) => {
        seenUrls.push(String(url));
        return new Response(
          JSON.stringify({
            data: [{ b64_json: Buffer.from("png-bytes").toString("base64") }]
          }),
          { status: 200 }
        );
      }
    });

    await provider.generate({
      provider: "yunwu",
      model: "gpt-image-1.5",
      prompt: "白底主图",
      count: 1,
      ratio: "1:1",
      resolution: "1k",
      quality: "auto",
      outputFormat: "png",
      apiKey: "sk-test"
    });

    expect(seenUrls).toEqual(["https://custom-image-gateway.example.com/v1/images/generations"]);
  });
});
