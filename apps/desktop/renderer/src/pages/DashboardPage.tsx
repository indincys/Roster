import { ArrowRight, Clapperboard, FileText, Images, LayoutList, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { activeWorkspace, useAppStore } from "@/stores/app-store";

export function DashboardPage(): JSX.Element {
  const { bootstrap, setPage } = useAppStore();
  const workspace = activeWorkspace(bootstrap);

  if (!workspace) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>创建第一个品牌工作空间</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm leading-6 text-muted-foreground">
              工作空间等同于品牌。创建后会在磁盘生成 `videos`、`covers`、`images`、`tasks`、
              `skills_config` 和 `_backup` 等目录，并初始化独立的 `workspace.db`。
            </p>
            <div>
              <Button variant="primary" onClick={() => setPage("settings")}>
                <Plus />
                去设置中创建
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = [
    { label: "今日任务", value: "0", hint: "等待生成任务单", icon: LayoutList, page: "tasks" as const },
    { label: "视频素材", value: "0", hint: "扫描 videos 后显示", icon: Clapperboard, page: "lib_videos" as const },
    { label: "标题库", value: "0", hint: "生成标题后入库", icon: Sparkles, page: "lib_titles" as const },
    { label: "图片素材", value: "0", hint: "图片工作室产物", icon: Images, page: "lib_images" as const }
  ];

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{workspace.name} / 首页</h1>
          <p className="mt-1 text-sm text-muted-foreground">上次打开：{workspace.lastOpenedAt ?? "刚刚创建"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPage("titles")}>
            <Sparkles />
            生成新标题
          </Button>
          <Button variant="primary" onClick={() => setPage("tasks")}>
            <LayoutList />
            生成今日任务单
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button key={stat.label} className="rounded-lg border border-border bg-card p-4 text-left hover:bg-muted/50" onClick={() => setPage(stat.page)}>
              <div className="mb-3 flex items-center justify-between">
                <Icon className="size-4 text-primary" />
                <ArrowRight className="size-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-semibold">{stat.value}</div>
              <div className="mt-1 text-sm font-medium">{stat.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{stat.hint}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-4">
        <Card>
          <CardHeader>
            <CardTitle>今日任务队列</CardTitle>
            <Badge variant="neutral">空数据</Badge>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-muted/30">
              <LayoutList className="size-9 text-muted-foreground" />
              <div className="text-sm font-medium">今天还没有任务单</div>
              <Button variant="primary" size="sm" onClick={() => setPage("tasks")}>
                <Plus />
                创建任务单
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>路径映射</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <PathRow label="当前设备路径" value={workspace.macRootPath} />
            <PathRow label="RPA 执行路径" value={workspace.winRootPath} />
            <p className="text-xs leading-5 text-muted-foreground">业务数据仅保存相对路径；界面展示与任务单导出时再按目标平台拼接。</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>快捷操作</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-4 gap-3">
          {[
            { label: "扫描视频库", icon: Clapperboard, page: "lib_videos" as const },
            { label: "编辑 Skill", icon: FileText, page: "skills" as const },
            { label: "批量生成图片", icon: Images, page: "images" as const },
            { label: "处理封面", icon: Clapperboard, page: "covers" as const }
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Button key={action.label} variant="outline" className="h-12 justify-start" onClick={() => setPage(action.page)}>
                <Icon />
                {action.label}
              </Button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function PathRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-xs">{value}</div>
    </div>
  );
}
