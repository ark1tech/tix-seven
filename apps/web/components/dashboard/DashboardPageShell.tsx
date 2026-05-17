import { cn } from "@/lib/utils";

type DashboardPageShellProps = {
  header: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
};

export function DashboardPageShell({
  header,
  children,
  contentClassName,
}: DashboardPageShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 bg-background z-10">{header}</div>
      <div
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-1 custom-scrollbar-subtle",
          contentClassName,
        )}>
        {children}
      </div>
    </div>
  );
}
