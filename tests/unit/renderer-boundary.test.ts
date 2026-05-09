import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listSourceFiles(fullPath);
      }
      return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
    })
  );
  return nested.flat();
}

describe("renderer process boundary", () => {
  it("does not import Node filesystem, process, or database modules in renderer code", async () => {
    const files = await listSourceFiles(path.resolve("apps/desktop/renderer/src"));
    const forbidden = [
      /from ["']node:/,
      /from ["']fs/,
      /from ["']node:fs/,
      /from ["']@roster\/db/,
      /require\(["']fs/
    ];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const pattern of forbidden) {
        expect(source, `${file} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
