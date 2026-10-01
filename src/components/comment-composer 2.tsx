import { useState } from "react";
import { Mic, Pencil, Send, Square, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

  const submitText = () => {
    if (!canSendText || busy) return;
    void onSubmitText();
  };

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
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitText();
          }}
        >
          <Textarea
            className={cn(
              "min-h-[4.5rem] min-w-0 flex-1 resize-y bg-background whitespace-pre-wrap",
              inputClassName,
            )}
            rows={3}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submitText();
              }
            }}
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
      {text ? (
        <div className="whitespace-pre-wrap break-words text-muted-foreground">{text}</div>
      ) : null}
    </div>
  );
}

type CommentThreadItemProps = {
  authorName: string;
  createdAtLabel: string;
  body: string;
  audioUrl?: string | null;
  canEdit?: boolean;
  canDelete?: boolean;
  isSaving?: boolean;
  isDeleting?: boolean;
  onSave?: (body: string) => void | Promise<unknown>;
  onDelete?: () => void;
  className?: string;
};

export function CommentThreadItem({
  authorName,
  createdAtLabel,
  body,
  audioUrl,
  canEdit = false,
  canDelete = false,
  isSaving = false,
  isDeleting = false,
  onSave,
  onDelete,
  className,
}: CommentThreadItemProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(body);
  const hasAudio = Boolean(audioUrl?.trim());
  const canSave = (editValue.trim().length > 0 || hasAudio) && !isSaving;

  const startEdit = () => {
    setEditValue(body);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditValue(body);
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!onSave || !canSave) return;
    try {
      await onSave(editValue);
      setEditing(false);
    } catch {
      /* parent shows toast */
    }
  };

  return (
    <li className={cn("rounded-md border p-3 text-sm", className)}>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
        <span className="min-w-0 flex-1 truncate font-medium">{authorName}</span>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <span className="text-xs text-muted-foreground">{createdAtLabel}</span>
          {canEdit && !editing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground"
              disabled={isSaving || isDeleting}
              onClick={startEdit}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              {t("project.detail.editComment")}
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              aria-label={t("project.detail.deleteComment")}
              disabled={isDeleting || isSaving}
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
      {editing ? (
        <div className="space-y-2">
          {hasAudio ? (
            <audio
              key={audioUrl}
              controls
              preload="metadata"
              src={audioUrl ?? undefined}
              className="h-9 w-full max-w-full"
              aria-label={t("project.detail.audioComment")}
            />
          ) : null}
          <Textarea
            className="min-h-[4.5rem] resize-y whitespace-pre-wrap bg-background"
            rows={4}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void saveEdit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelEdit();
              }
            }}
            disabled={isSaving}
            aria-label={t("project.detail.editComment")}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={isSaving} onClick={cancelEdit}>
              {t("common.cancel")}
            </Button>
            <Button type="button" size="sm" disabled={!canSave} loading={isSaving} onClick={() => void saveEdit()}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      ) : (
        <CommentBody body={body} audioUrl={audioUrl} />
      )}
    </li>
  );
}
