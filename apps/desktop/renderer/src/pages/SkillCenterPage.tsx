import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CheckCircle2, Copy, FileText, Plus, RotateCcw, Save, TestTube2, UploadCloud, UserRound } from "lucide-react";
import type {
  SkillActivationConfig,
  SkillFile,
  SkillRecord,
  SkillSaveInput,
  SkillSourceType,
  SkillSnapshot,
  SkillTestModel,
  SkillTestResult,
  SkillWorkflowType
} from "@roster/shared-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusStrip, WorkbenchHeader } from "@/components/workbench";
import { configuredLlmModelsFromApiKeys } from "@/lib/provider-options";
import { cn } from "@/lib/utils";
import { activeWorkspace, useAppStore } from "@/stores/app-store";

const typeLabels: Record<SkillWorkflowType, string> = {
  title: "标题类",
  image_prompt: "图片提示词类",
  image: "图片生成类",
  script: "视频文案类",
  cover: "封面类"
};

const sourceLabels: Record<SkillSourceType, string> = {
  official: "官方原版",
  copy: "官方副本",
  user: "自建"
};

const sourceIcons: Record<SkillSourceType, JSX.Element> = {
  official: <BadgeCheck className="size-3.5" />,
  copy: <Copy className="size-3.5" />,
  user: <UserRound className="size-3.5" />
};

const skillIdPrefixes: Record<SkillWorkflowType, string> = {
  title: "title",
  image_prompt: "image-prompt",
  image: "image",
  script: "script",
  cover: "cover"
};

interface SkillForm {
  skillId: string;
  displayName: string;
  type: SkillWorkflowType;
  sourceType: "copy" | "user";
  version: string;
  description: string;
  content: string;
}

const defaultSkillTestModelPresets: SkillTestModel[] = [
];
const emptySkillTestModel: SkillTestModel = { provider: "mock", model: "" };

const emptyForm: SkillForm = {
  skillId: "",
  displayName: "",
  type: "title",
  sourceType: "user",
  version: "0.1.0",
  description: "",
  content: "# 角色\n你是短视频带货标题专家。\n\n{{include: brand_info.md}}\n"
};

function buildSaveInput(form: SkillForm, selected: SkillRecord | null): SkillSaveInput {
  return {
    skillId: selected?.id,
    displayName: form.displayName,
    type: form.type,
    sourceType: form.sourceType,
    version: form.version,
    description: form.description,
    defaultModel: null,
    supportedModels: [],
    content: form.content,
    origin: selected?.origin ?? null
  };
}

function toForm(skill: SkillRecord, content: string): SkillForm {
  return {
    skillId: skill.id,
    displayName: skill.displayName,
    type: skill.type,
    sourceType: skill.sourceType === "copy" ? "copy" : "user",
    version: skill.version,
    description: skill.description,
    content
  };
}

function nextSkillIdPreview(type: SkillWorkflowType, skills: SkillRecord[]): string {
  const prefix = skillIdPrefixes[type];
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const maxIndex = skills.reduce((max, skill) => {
    const match = pattern.exec(skill.id);
    return match ? Math.max(max, Number.parseInt(match[1] ?? "0", 10) || 0) : max;
  }, 0);
  return `${prefix}-${String(maxIndex + 1).padStart(2, "0")}`;
}

function IncludePreview({ content, onOpen }: { content: string; onOpen(includePath: string): void }): JSX.Element {
  const includes = [...content.matchAll(/\{\{include:\s*([^}]+?)\s*\}\}/g)].map((match) => match[1].trim());
  if (includes.length === 0) {
    return <span className="text-xs text-muted-foreground">未检测到 include 标记</span>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {includes.map((includePath) => (
        <button
          key={includePath}
          className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700"
          onClick={() => onOpen(includePath)}
          title={`跳转目标文件：${includePath}`}
          type="button"
          data-include-jump={includePath}
        >
          {`{{include: ${includePath}}}`}
        </button>
      ))}
    </div>
  );
}

export function SkillCenterPage(): JSX.Element {
  const { bootstrap } = useAppStore();
  const workspace = activeWorkspace(bootstrap);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [activation, setActivation] = useState<SkillActivationConfig | null>(null);
  const [snapshots, setSnapshots] = useState<SkillSnapshot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<SkillForm>(emptyForm);
  const [skillFiles, setSkillFiles] = useState<SkillFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState("SKILL.md");
  const [activeFileContent, setActiveFileContent] = useState("");
  const [testPrompt, setTestPrompt] = useState("请用当前 Skill 生成一段测试输出。");
  const [skillTestModelPresets, setSkillTestModelPresets] = useState<SkillTestModel[]>(defaultSkillTestModelPresets);
  const [testModel, setTestModel] = useState<SkillTestModel>(defaultSkillTestModelPresets[0] ?? emptySkillTestModel);
  const [testResult, setTestResult] = useState<SkillTestResult | null>(null);
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const selected = useMemo(() => skills.find((skill) => skill.id === selectedId) ?? null, [selectedId, skills]);
  const enabledIds = useMemo(() => new Set(activation?.enabledSkillIds ?? []), [activation]);
  const generatedSkillIdPreview = useMemo(() => nextSkillIdPreview(form.type, skills), [form.type, skills]);
  const groupedSkills = useMemo(() => {
    const groups = new Map<SkillWorkflowType, SkillRecord[]>();
    for (const skill of skills) {
      groups.set(skill.type, [...(groups.get(skill.type) ?? []), skill]);
    }
    return [...groups.entries()].sort(([a], [b]) => typeLabels[a].localeCompare(typeLabels[b], "zh-Hans-CN"));
  }, [skills]);

  async function loadSkills(): Promise<void> {
    setLoading(true);
    try {
      const [nextSkills, nextActivation] = await Promise.all([
        window.roster.listSkills(),
        workspace ? window.roster.getSkillActivation() : Promise.resolve(null)
      ]);
      setSkills(nextSkills);
      setActivation(nextActivation);
      if (nextSkills.length > 0 && !selectedId) {
        setSelectedId(nextSkills[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  useEffect(() => {
    Promise.all([window.roster.getSettings(), window.roster.listApiKeys()])
      .then(([loaded, apiKeys]) => {
        const options = configuredLlmModelsFromApiKeys(loaded, apiKeys, { enableFirst: true });
        setSkillTestModelPresets(options);
        if (options[0]) {
          setTestModel({ provider: options[0].provider, model: options[0].model });
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let canceled = false;
    async function loadSelected(): Promise<void> {
      if (!selected) {
        setForm(emptyForm);
        setSnapshots([]);
        setSkillFiles([]);
        setActiveFilePath("SKILL.md");
        setActiveFileContent("");
        setTestResult(null);
        return;
      }
      try {
        const [content, files, nextSnapshots] = await Promise.all([
          window.roster.readSkillContent(selected.id),
          window.roster.listSkillFiles(selected.id),
          window.roster.listSkillSnapshots(selected.id)
        ]);
        if (canceled) {
          return;
        }
        setForm(toForm(selected, content.content));
        setSkillFiles(files);
        setActiveFilePath("SKILL.md");
        setActiveFileContent(content.content);
        setSnapshots(nextSnapshots);
        setTestResult(null);
      } catch (error) {
        if (canceled) {
          return;
        }
        setSnapshots([]);
        setSkillFiles([]);
        setMessage(error instanceof Error ? error.message : String(error));
      }
    }
    void loadSelected();
    return () => {
      canceled = true;
    };
  }, [selected]);

  async function saveSkill(): Promise<void> {
    setLoading(true);
    setMessage("");
    try {
      const saved = await window.roster.saveSkill(buildSaveInput(form, selected));
      const nextSkills = await window.roster.listSkills();
      setSkills(nextSkills);
      setSelectedId(saved.id);
      setActiveFilePath("SKILL.md");
      setActiveFileContent(form.content);
      setSkillFiles(await window.roster.listSkillFiles(saved.id));
      setSnapshots(await window.roster.listSkillSnapshots(saved.id));
      setMessage("已保存 Skill，并生成保存前快照");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function toggleEnabled(skillId: string): Promise<void> {
    if (!workspace || !activation) {
      return;
    }
    const current = new Set(activation.enabledSkillIds);
    if (current.has(skillId)) {
      current.delete(skillId);
    } else {
      current.add(skillId);
    }
    const next = await window.roster.updateSkillActivation({
      workspaceId: workspace.id,
      enabledSkillIds: [...current]
    });
    setActivation(next);
    setMessage("已更新当前工作空间的启用配置");
  }

  function startNewSkill(): void {
    setSelectedId(null);
    setForm(emptyForm);
    setSkillFiles([]);
    setActiveFilePath("SKILL.md");
    setActiveFileContent(emptyForm.content);
    setSnapshots([]);
    setTestResult(null);
    setMessage("");
  }

  async function restoreSnapshot(snapshotId: string): Promise<void> {
    if (!selected) {
      return;
    }
    const restored = await window.roster.restoreSkillSnapshot({
      skillId: selected.id,
      snapshotId
    });
    setForm((current) => ({ ...current, content: restored.content }));
    setActiveFilePath("SKILL.md");
    setActiveFileContent(restored.content);
    setSkillFiles(await window.roster.listSkillFiles(selected.id));
    setSnapshots(await window.roster.listSkillSnapshots(selected.id));
    setMessage("已还原到选中快照");
  }

  async function createOfficialCopy(): Promise<void> {
    if (!selected || selected.sourceType !== "official") {
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const copy = await window.roster.createOfficialSkillCopy({ skillId: selected.id });
      const nextSkills = await window.roster.listSkills();
      setSkills(nextSkills);
      setSelectedId(copy.id);
      setMessage("已创建官方副本，可在副本中编辑。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function restoreOfficialCopy(): Promise<void> {
    if (!selected || selected.sourceType !== "copy") {
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const restored = await window.roster.restoreOfficialSkillCopy({ skillId: selected.id });
      setForm((current) => ({ ...current, content: restored.content }));
      setActiveFilePath("SKILL.md");
      setActiveFileContent(restored.content);
      setSkillFiles(await window.roster.listSkillFiles(selected.id));
      setSnapshots(await window.roster.listSkillSnapshots(selected.id));
      setMessage("已复原到创建副本时的官方版本。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function upgradeOfficialCopy(): Promise<void> {
    if (!selected || selected.sourceType !== "copy") {
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const upgraded = await window.roster.upgradeOfficialSkillCopy({ skillId: selected.id });
      const nextSkills = await window.roster.listSkills();
      setSkills(nextSkills);
      setForm((current) => ({ ...current, content: upgraded.content }));
      setActiveFilePath("SKILL.md");
      setActiveFileContent(upgraded.content);
      setSkillFiles(await window.roster.listSkillFiles(selected.id));
      setSnapshots(await window.roster.listSkillSnapshots(selected.id));
      setMessage("已升级副本到最新官方版。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function openSkillFile(relativePath: string): Promise<void> {
    if (!selected) {
      return;
    }
    try {
      const content = await window.roster.readSkillContent(selected.id, relativePath);
      setActiveFilePath(content.relativePath);
      setActiveFileContent(content.content);
      if (content.relativePath === "SKILL.md") {
        setForm((current) => ({ ...current, content: content.content }));
      }
      setMessage(`已打开 ${content.relativePath}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveActiveFile(): Promise<void> {
    if (!selected) {
      return;
    }
    if (activeFilePath === "SKILL.md") {
      await saveSkill();
      return;
    }
    setLoading(true);
    try {
      const saved = await window.roster.saveSkillFile({
        skillId: selected.id,
        relativePath: activeFilePath,
        content: activeFileContent
      });
      setActiveFileContent(saved.content);
      setSkillFiles(await window.roster.listSkillFiles(selected.id));
      setSnapshots(await window.roster.listSkillSnapshots(selected.id));
      setMessage(`已保存 ${saved.relativePath}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function openInclude(includePath: string): Promise<void> {
    await openSkillFile(includePath);
  }

  async function runSkillTest(): Promise<void> {
    if (!selected) {
      setMessage("请先选择或保存一个 Skill");
      return;
    }
    setTesting(true);
    setMessage("");
    setTestResult(null);
    try {
      const result = await window.roster.testSkill({
        skillId: selected.id,
        taskPrompt: testPrompt,
        model: testModel
      });
      setTestResult(result);
      setMessage(result.status === "success" ? "即时测试完成，结果未写入业务库" : `即时测试失败：${result.error ?? "未知错误"}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-5" data-skill-center>
      <WorkbenchHeader
        eyebrow="生成规则"
        title="Skill 中心"
        description={`全局 Skill 池，当前工作空间：${workspace?.name ?? "未选择"}。左侧选择对象，中间编辑文件，右侧查看启用和快照。`}
        actions={
          <>
          <Button variant="outline" onClick={loadSkills} disabled={loading}>
            刷新
          </Button>
          <Button variant="primary" onClick={startNewSkill} data-new-skill>
            <Plus />
            新建 Skill
          </Button>
          </>
        }
      />

      <StatusStrip
        items={[
          { label: "Skill 总数", value: skills.length, hint: "全局可管理", tone: "neutral" },
          { label: "已启用", value: enabledIds.size, hint: "当前工作空间", tone: enabledIds.size > 0 ? "success" : "warning" },
          { label: "当前对象", value: selected ? 1 : 0, hint: selected?.displayName ?? "新建或选择 Skill", tone: selected ? "info" : "neutral" },
          { label: "快照", value: snapshots.length, hint: "可恢复版本", tone: snapshots.length > 0 ? "info" : "neutral" }
        ]}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Skill 列表</div>
          <div className="h-full min-h-0 overflow-y-auto p-3">
            {groupedSkills.length === 0 ? (
              <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-center">
                <FileText className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">还没有 Skill。先新建一个标题类 Skill。</p>
                <Button variant="primary" size="sm" onClick={startNewSkill}>
                  <Plus />
                  新建 Skill
                </Button>
              </div>
            ) : (
              groupedSkills.map(([type, group]) => (
                <section key={type} className="mb-4">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span>{typeLabels[type]}</span>
                    <span>{group.length}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {group.map((skill) => {
                      const enabled = enabledIds.has(skill.id);
                      return (
                        <button
                          key={skill.id}
                          className={cn(
                            "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm",
                            selectedId === skill.id
                              ? "border-primary bg-blue-50 text-blue-800"
                              : "border-transparent hover:bg-muted"
                          )}
                          data-skill-row={skill.id}
                          onClick={() => setSelectedId(skill.id)}
                          type="button"
                        >
                          <span className="min-w-0 flex-1 truncate">{skill.displayName}</span>
                          {enabled ? <CheckCircle2 className="size-4 text-emerald-600" /> : null}
                          <span className="text-muted-foreground" title={sourceLabels[skill.sourceType]}>
                            {sourceIcons[skill.sourceType]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </aside>

        <main className="grid min-h-0 grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_280px]">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{selected ? selected.displayName : "新建 Skill"}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={selected?.sourceType === "official" ? "info" : selected?.sourceType === "copy" ? "warning" : "neutral"}>
                    {selected ? sourceLabels[selected.sourceType] : "自建"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">v{form.version}</span>
                </div>
              </div>
              <Button variant="primary" onClick={saveSkill} disabled={loading || selected?.sourceType === "official"} data-save-skill>
                <Save />
                保存
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_minmax(0,1fr)_180px]">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-foreground">Skill ID（自动生成）</span>
                  <input
                    className="h-9 rounded-md border border-input bg-muted px-3 font-mono text-sm text-muted-foreground outline-none"
                    value={selected?.id ?? generatedSkillIdPreview}
                    readOnly
                    aria-readonly="true"
                    data-skill-id-input
                  />
                </label>
                <Input
                  label="显示名称"
                  value={form.displayName}
                  onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                  data-skill-name-input
                />
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-foreground">类型</span>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
                    value={form.type}
                    onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as SkillWorkflowType }))}
                    data-skill-type-select
                  >
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 flex flex-col gap-4">
                <label className="flex min-h-[360px] flex-col gap-1.5 text-sm lg:min-h-[520px]">
                  <span className="font-medium text-foreground">当前编辑：{activeFilePath}</span>
                  <textarea
                    className="min-h-[320px] flex-1 resize-y rounded-md border border-input bg-background p-3 font-mono text-sm leading-6 outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15 lg:min-h-[480px]"
                    value={activeFilePath === "SKILL.md" ? form.content : activeFileContent}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (activeFilePath === "SKILL.md") {
                        setForm((current) => ({ ...current, content: value }));
                      }
                      setActiveFileContent(value);
                    }}
                    disabled={selected?.sourceType === "official"}
                    data-skill-content-editor
                  />
                </label>
                <aside className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-2 text-sm font-semibold">文件树</div>
                    <div className="mb-4 flex flex-wrap gap-2" data-skill-file-tree>
                      {skillFiles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">保存后显示文件树</span>
                      ) : (
                        skillFiles.map((file) => (
                          <button
                            key={file.relativePath}
                            className={cn(
                              "rounded-md border px-2 py-1 text-left text-xs",
                              activeFilePath === file.relativePath ? "border-primary bg-blue-50 text-blue-800" : "border-border"
                            )}
                            onClick={() => openSkillFile(file.relativePath)}
                            type="button"
                            data-skill-file={file.relativePath}
                          >
                            {file.relativePath}
                          </button>
                        ))
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={saveActiveFile}
                      disabled={loading || selected?.sourceType === "official" || !selected}
                      data-save-skill-file
                    >
                      保存当前文件
                    </Button>
                    <div className="mt-4 mb-2 text-sm font-semibold">include 标记</div>
                    <IncludePreview content={form.content} onOpen={openInclude} />
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-sm font-semibold">即时测试</div>
                    <div className="mt-2 flex flex-col gap-2" data-skill-test-panel>
                      <label className="flex flex-col gap-1.5 text-xs">
                        <span className="font-medium text-foreground">测试提示词</span>
                        <textarea
                          className="min-h-20 resize-none rounded-md border border-input bg-background px-2 py-2 text-xs leading-5 outline-none"
                          value={testPrompt}
                          onChange={(event) => setTestPrompt(event.target.value)}
                          data-skill-test-prompt
                        />
                      </label>
                      <label className="flex flex-col gap-1.5 text-xs">
                        <span className="font-medium text-foreground">模型</span>
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none"
                          value={`${testModel.provider}:${testModel.model}`}
                          disabled={skillTestModelPresets.length === 0}
                          onChange={(event) => {
                            const [provider, model] = event.target.value.split(":");
                            const preset = skillTestModelPresets.find(
                              (candidate) => candidate.provider === provider && candidate.model === model
                            );
                            if (preset) {
                              setTestModel(preset);
                            }
                          }}
                          data-skill-test-model
                        >
                          {skillTestModelPresets.length === 0 ? <option value="">请先到设置页保存文本模型 API key</option> : null}
                          {skillTestModelPresets.map((preset) => (
                            <option key={`${preset.provider}:${preset.model}`} value={`${preset.provider}:${preset.model}`}>
                              {preset.provider} / {preset.model}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void runSkillTest()}
                        disabled={!selected || testing || !testPrompt.trim() || skillTestModelPresets.length === 0}
                        data-run-skill-test
                      >
                        <TestTube2 />
                        {testing ? "测试中" : "运行测试"}
                      </Button>
                      {testResult ? (
                        <div
                          className={cn(
                            "rounded-md border p-2 text-xs leading-5",
                            testResult.status === "success"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-red-200 bg-red-50 text-red-700"
                          )}
                          data-skill-test-result
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="font-semibold">{testResult.status === "success" ? "成功" : "失败"}</span>
                            <span className="font-mono text-[11px]">
                              {testResult.provider}/{testResult.model}
                            </span>
                          </div>
                          {testResult.status === "success" ? (
                            <div className="max-h-44 overflow-auto whitespace-pre-wrap">{testResult.text}</div>
                          ) : (
                            <div>{testResult.error}</div>
                          )}
                          {testResult.includedFiles.length ? (
                            <div className="mt-2 text-[11px] text-muted-foreground">
                              include: {testResult.includedFiles.join(", ")}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </section>

          <aside className="min-h-0 overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">配置与版本</div>
            <div className="flex max-h-full min-h-0 flex-col gap-3 overflow-y-auto p-4">
              <div className="text-sm font-semibold">当前工作空间启用</div>
              {selected ? (
                <Button
                  variant={enabledIds.has(selected.id) ? "secondary" : "outline"}
                  onClick={() => toggleEnabled(selected.id)}
                  disabled={!workspace}
                  data-toggle-skill-enabled
                >
                  {enabledIds.has(selected.id) ? "已启用，点击停用" : "启用到当前工作空间"}
                </Button>
              ) : null}
              <div className="text-xs leading-5 text-muted-foreground">
                标题工作区和后续 AI 工作流只会显示当前工作空间已启用且类型匹配的 Skill。
              </div>
              <div className="mt-2 border-t border-border pt-3">
                <div className="mb-2 text-sm font-semibold">官方版本</div>
                {selected?.sourceType === "official" ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => void createOfficialCopy()}
                    disabled={loading}
                    data-create-official-skill-copy
                  >
                    <Copy />
                    创建可编辑副本
                  </Button>
                ) : selected?.sourceType === "copy" ? (
                  <div className="flex flex-col gap-2">
                    <div className="rounded-md border border-border bg-background p-2 text-xs leading-5 text-muted-foreground">
                      来源：{selected.origin?.skillId ?? "-"} v{selected.origin?.version ?? "-"}
                    </div>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => void restoreOfficialCopy()}
                      disabled={loading}
                      data-restore-official-skill-copy
                    >
                      <RotateCcw />
                      复原到复制版本
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => void upgradeOfficialCopy()}
                      disabled={loading}
                      data-upgrade-official-skill-copy
                    >
                      <UploadCloud />
                      升级到最新官方版
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                    自建 Skill 不接收官方更新。
                  </div>
                )}
              </div>
              <div className="rounded-md border border-border">
                {(activation?.enabledSkillIds ?? []).length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">当前工作空间尚未启用 Skill</div>
                ) : (
                  activation?.enabledSkillIds.map((skillId) => (
                    <div key={skillId} className="border-b border-border px-3 py-2 text-xs last:border-b-0" data-enabled-skill={skillId}>
                      {skills.find((skill) => skill.id === skillId)?.displayName ?? skillId}
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2 border-t border-border pt-3">
                <div className="mb-2 text-sm font-semibold">历史快照</div>
                {snapshots.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">尚无保存快照</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {snapshots.map((snapshot) => (
                      <div key={snapshot.snapshotId} className="rounded-md border border-border p-2" data-skill-snapshot={snapshot.snapshotId}>
                        <div className="truncate font-mono text-[11px] text-muted-foreground">{snapshot.snapshotId}</div>
                        <div className="mt-1 line-clamp-2 text-xs leading-5">{snapshot.contentPreview || "空内容"}</div>
                        <Button
                          className="mt-2 w-full"
                          variant="outline"
                          size="sm"
                          onClick={() => restoreSnapshot(snapshot.snapshotId)}
                          data-restore-skill-snapshot={snapshot.snapshotId}
                        >
                          还原
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {message ? <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">{message}</div> : null}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
