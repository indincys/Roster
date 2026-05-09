import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertSafeSkillIncludePath, expandSkillIncludes, expandSkillPrompt, SkillIncludeError } from "@roster/skill-engine";

async function createSkill(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "roster-skill-test-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
  }
  return root;
}

describe("skill include engine", () => {
  it("expands direct and nested markdown includes before appending task prompt", async () => {
    const root = await createSkill({
      "SKILL.md": "主规则\n{{include: brand_info.md}}\n{{include: examples/good.md}}",
      "brand_info.md": "品牌信息",
      "examples/good.md": "好案例 {{include: nested/review.md}}",
      "examples/nested/review.md": "自查规则"
    });

    const result = await expandSkillPrompt(root, "生成 20 条标题");

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.text).toContain("主规则\n品牌信息\n好案例 自查规则");
    expect(result.text).toContain("生成 20 条标题");
    expect(result.includedFiles.map((filePath) => path.basename(filePath))).toEqual(
      expect.arrayContaining(["brand_info.md", "good.md", "review.md"])
    );
  });

  it("returns fail-closed errors for missing files and clears expanded text", async () => {
    const root = await createSkill({
      "SKILL.md": "主规则\n{{include: missing.md}}"
    });

    const result = await expandSkillIncludes(root);

    expect(result.ok).toBe(false);
    expect(result.text).toBe("");
    expect(result.errors.map((error) => error.code)).toContain("FILE_MISSING");
  });

  it("rejects traversal, absolute paths, hidden paths, snapshots, and non-markdown files", async () => {
    const root = await createSkill({
      "SKILL.md": [
        "{{include: ../secret.md}}",
        "{{include: /tmp/secret.md}}",
        "{{include: .hidden/rules.md}}",
        "{{include: .snapshots/old/SKILL.md}}",
        "{{include: rules.txt}}"
      ].join("\n")
    });

    const result = await expandSkillIncludes(root);

    expect(result.ok).toBe(false);
    expect(result.text).toBe("");
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(["TRAVERSAL", "ABSOLUTE_PATH", "HIDDEN_PATH", "SNAPSHOT_PATH", "NON_MARKDOWN"])
    );
  });

  it("rejects symbolic links that escape the skill root", async () => {
    const outsideRoot = await mkdtemp(path.join(tmpdir(), "roster-skill-outside-"));
    await writeFile(path.join(outsideRoot, "secret.md"), "外部秘密");
    const root = await createSkill({
      "SKILL.md": "{{include: linked/secret.md}}"
    });
    await mkdir(path.join(root, "linked"), { recursive: true });
    await symlink(path.join(outsideRoot, "secret.md"), path.join(root, "linked", "secret.md"));

    const result = await expandSkillIncludes(root);

    expect(result.ok).toBe(false);
    expect(result.text).toBe("");
    expect(result.errors.map((error) => error.code)).toContain("OUTSIDE_SKILL_ROOT");
  });

  it("detects circular references and excessive include depth", async () => {
    const circularRoot = await createSkill({
      "SKILL.md": "{{include: a.md}}",
      "a.md": "{{include: b.md}}",
      "b.md": "{{include: a.md}}"
    });
    const deepRoot = await createSkill({
      "SKILL.md": "{{include: a1.md}}",
      "a1.md": "{{include: a2.md}}",
      "a2.md": "{{include: a3.md}}",
      "a3.md": "{{include: a4.md}}",
      "a4.md": "{{include: a5.md}}",
      "a5.md": "{{include: a6.md}}",
      "a6.md": "too deep"
    });

    const circular = await expandSkillIncludes(circularRoot);
    const deep = await expandSkillIncludes(deepRoot);

    expect(circular.ok).toBe(false);
    expect(circular.text).toBe("");
    expect(circular.errors.map((error) => error.code)).toContain("CIRCULAR_INCLUDE");
    expect(deep.ok).toBe(false);
    expect(deep.text).toBe("");
    expect(deep.errors.map((error) => error.code)).toContain("DEPTH_EXCEEDED");
  });

  it("rejects oversized include files and validates include path helper", async () => {
    const root = await createSkill({
      "SKILL.md": "{{include: large.md}}",
      "large.md": "x".repeat(257 * 1024)
    });

    const result = await expandSkillIncludes(root);

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("OVERSIZED_FILE");
    expect(() => assertSafeSkillIncludePath("examples/good.md")).not.toThrow();
    expect(() => assertSafeSkillIncludePath("examples/good.txt")).toThrow(SkillIncludeError);
  });
});
