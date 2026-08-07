import { NotebookChrome } from "@/components/youtube-notebook-mockup";
import { cn } from "@/lib/utils";

type SitePrototypeMockupProps = {
  url: string | null;
  refreshKey?: number;
  emptyLabel: string;
  iframeTitle: string;
  className?: string;
};

function withCacheBust(url: string, refreshKey: number) {
  try {
    const parsed = new URL(url);
    if (refreshKey > 0) {
      parsed.searchParams.set("_som_preview", String(refreshKey));
    }
    return parsed.toString();
  } catch {
    if (refreshKey <= 0) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}_som_preview=${refreshKey}`;
  }
}

export function SitePrototypeMockup({
  url,
  refreshKey = 0,
  emptyLabel,
  iframeTitle,
  className,
}: SitePrototypeMockupProps) {
  const src = url?.trim() ? withCacheBust(url.trim(), refreshKey) : null;

  return (
    <NotebookChrome size="lg" aspect="wide" className={cn(className)}>
      {src ? (
        <iframe
          key={src}
          title={iframeTitle}
          src={src}
          className="h-full min-h-0 w-full flex-1 border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center bg-neutral-100 px-6 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      )}
    </NotebookChrome>
  );
}
