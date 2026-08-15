import { Mic, Send, Square, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRecordingTime, useAudioRecorder } from "@/hooks/use-audio-recorder";
import { cn } from "@/lib/utils";

type CommentComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmitText: () => void | Promise<unknown>;
  onSubmitAudio: (blob: Blob) => void | Promise<unknown>;
  disabled?: boolean;
  isPending?: boolean;
  className?: string;
  inputClassName?: string;
};

export function CommentComposer({
  value,
  onChange,
  onSubmitText,
  onSubmitAudio,
  disabled = false,
  isPending = false,
  className,
  inputClassName,
}: CommentComposerProps) {
  const { t } = useTranslation();
  const recorder = useAudioRecorder();
  const busy = disabled || isPending;

  const errorMessage =
    recorder.error === "permission"
      ? t("project.detail.micPermissionDenied")
      : recorder.error === "unsupported" || recorder.error === "insecure"
        ? t("project.detail.recordingUnsupported")
        : recorder.error === "empty" || recorder.error === "failed"
          ? t("project.detail.recordingFailed")
          : null;

  const canSendText = value.trim().length > 0 && recorder.status === "idle";
  const canSendAudio = recorder.status === "recorded" && Boolean(recorder.audioBlob);

  return (
    <div className={cn("space-y-2", className)}>
      {recorder.status === "recording" ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
          <span
            className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-destructive"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1 text-sm font-medium tabular-nums text-foreground">
            {t("project.detail.recording", {
              time: formatRecordingTime(recorder.elapsedMs),
            })}
          </p>
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="shrink-0"
            aria-label={t("project.detail.stopRecording")}
            disabled={busy}
            onClick={() => recorder.stop()}
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          </Button>
        </div>
      ) : recorder.status === "recorded" && recorder.previewUrl ? (
        <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-background px-2 py-1.5">
          <audio
            key={recorder.previewUrl}
            controls
            preload="metadata"
            src={recorder.previewUrl}
            className="h-9 min-w-0 flex-1"
            aria-label={t("project.detail.audioComment")}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={t("project.detail.discardRecording")}
            disabled={busy}
            onClick={() => recorder.reset()}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon"
            className="shrink-0"
            aria-label={t("project.detail.send")}
            disabled={busy || !canSendAudio}
            onClick={() => {
              const blob = recorder.audioBlob;
              if (!blob) return;
              void (async () => {
                try {
                  await onSubmitAudio(blob);
                  recorder.reset();
                } catch {
                  /* parent shows toast */
                }
              })();
            }}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSendText || busy) return;
            onSubmitText();
          }}
        >
          <Input
            className={cn("min-w-0 flex-1 bg-background", inputClassName)}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t("project.detail.leaveComment")}
            aria-label={t("project.detail.leaveComment")}
            disabled={busy}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="shrink-0"
            aria-label={t("project.detail.recordComment")}
            disabled={busy || !recorder.supported}
            onClick={() => void recorder.start()}
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="submit"
            size="icon"
            className="shrink-0"
            aria-label={t("project.detail.send")}
            disabled={busy || !canSendText}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
      )}
      {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
    </div>
  );
}

type CommentBodyProps = {
  body: string;
  audioUrl?: string | null;
  className?: string;
};

export function CommentBody({ body, audioUrl, className }: CommentBodyProps) {
  const { t } = useTranslation();
  const text = body.trim();
  const audio = audioUrl?.trim();

  if (!text && !audio) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {audio ? (
        <audio
          key={audio}
          controls
          preload="metadata"
          src={audio}
          className="h-9 w-full max-w-full"
          aria-label={t("project.detail.audioComment")}
        />
      ) : null}
      {text ? <p className="whitespace-pre-wrap text-muted-foreground">{text}</p> : null}
    </div>
  );
}
