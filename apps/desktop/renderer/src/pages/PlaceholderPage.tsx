import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppPage } from "@/stores/app-store";

interface PlaceholderPageProps {
  title: string;
  page: AppPage;
}

export function PlaceholderPage({ title, page }: PlaceholderPageProps): JSX.Element {
  return (
    <div className="p-5">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-80 flex-col items-center justify-center gap-3">
          <p className="max-w-lg text-center text-sm leading-6 text-muted-foreground">
            `{page}` 的完整功能会在后续 milestone 中接入。M1 先保证桌面应用、工作空间、设置和进程边界可运行。
          </p>
          <Button variant="outline">
            查看计划
            <ArrowRight />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
