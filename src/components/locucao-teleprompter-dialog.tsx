import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2, Minimize2, Pause, Play, Save, Square } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { formatRecordingTime, useAudioRecorder } from "@/hooks/use-audio-recorder";
import { cn } from "@/lib/utils";

const SPEED_MIN = 1;
const SPEED_MAX = 10;
const SPEED_DEFAULT = 4;
const FONT_MIN = 20;
const FONT_MAX = 56;
const FONT_STEP = 4;
const FONT_DEFAULT = 28;
const COUNTDOWN_FROM = 3;
const PREFS_KEY = "som_teleprompter_prefs_v1";

type TeleprompterPrefs = {
  speed: number;
  fontSize: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function speedToPxPerSec(speed: number) {
  return 14 + speed * 10;
}

function readPrefs(): TeleprompterPrefs {
  if (typeof window === "undefined") {
    return { speed: SPEED_DEFAULT, fontSize: FONT_DEFAULT };
  }
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { speed: SPEED_DEFAULT, fontSize: FONT_DEFAULT };
    const parsed = JSON.parse(raw) as Partial<TeleprompterPrefs>;
    return {
      speed:
        typeof parsed.speed === "number"
          ? clamp(Math.round(parsed.speed), SPEED_MIN, SPEED_MAX)
          : SPEED_DEFAULT,
      fontSize:
        typeof parsed.fontSize === "number"
          ? clamp(Math.round(parsed.fontSize), FONT_MIN, FONT_MAX)
          : FONT_DEFAULT,
    };
  } catch {
    return { speed: SPEED_DEFAULT, fontSize: FONT_DEFAULT };
  }
}

function writePrefs(prefs: TeleprompterPrefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota / private mode */
  }
}

function requestElementFullscreen(el: HTMLElement) {
  const req =
    el.requestFullscreen?.bind(el) ??
    (
      el as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      }
    ).webkitRequestFullscreen?.bind(el);
  return req ? req() : Promise.reject(new Error("fullscreen unsupported"));
}

type LocucaoTeleprompterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  onSaveAudio: (blob: Blob) => Promise<void>;
};

export function LocucaoTeleprompterDialog({
  open,
  onOpenChange,
  text,
  onSaveAudio,
}: LocucaoTeleprompterDialogProps) {
  const { t } = useTranslation();
  const trimmed = text.trim();
  const hasText = Boolean(trimmed);

  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const playingRef = useRef(false);
  openRef.current = open;

  const recorder = useAudioRecorder({ maxMs: 30 * 60 * 1000 });
  const {
    finish: finishRecording,
    pause: pauseRecording,
    prime,
    reset: resetRecording,
    start: startRecording,
  } = recorder;

  const [speed, setSpeed] = useState(() => readPrefs().speed);
  const [fontSize, setFontSize] = useState(() => readPrefs().fontSize);
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cssExpanded, setCssExpanded] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  playingRef.current = playing;

  const expanded = cssExpanded || nativeFullscreen;

  const resetPlayback = useCallback(() => {
    setPlaying(false);
    setCountdown(null);
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, []);

  const exitExpanded = useCallback(() => {
    setCssExpanded(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    writePrefs({ speed, fontSize });
  }, [speed, fontSize]);

  useEffect(() => {
    if (!open) return;
    resetPlayback();
  }, [open, text, resetPlayback]);

  useEffect(() => {
    if (open) return;
    resetRecording();
    setUnsaved(false);
    setSavedNotice(false);
    setConfirmClose(false);
    setSaving(false);
  }, [open, resetRecording]);

  useEffect(() => {
    if (recorder.status === "recording" || recorder.status === "paused") {
      setUnsaved(true);
      setSavedNotice(false);
    }
  }, [recorder.status]);

  useEffect(() => {
    if (!open) return;
    if (!playing) {
      pauseRecording();
      return;
    }
    let cancelled = false;
    void startRecording().then((ok) => {
      if (!playingRef.current) {
        pauseRecording();
        return;
      }
      if (cancelled || !ok) return;
      setUnsaved(true);
      setSavedNotice(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, pauseRecording, playing, startRecording]);

  useEffect(() => {
    const onChange = () => {
      const active = Boolean(document.fullscreenElement);
      setNativeFullscreen(active);
      if (active) setCssExpanded(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (countdown == null) return;
    if (countdown <= 0) {
      setCountdown(null);
      setPlaying(true);
      return;
    }
    const id = window.setTimeout(() => {
      setCountdown((current) => (current == null ? null : current - 1));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [countdown]);

  useEffect(() => {
    if (!playing || countdown != null) return;
    const el = scrollRef.current;
    if (!el) return;

    let frame = 0;
    let last = performance.now();
    const pxPerSec = speedToPxPerSec(speed);

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 0) {
        setPlaying(false);
        return;
      }
      const next = el.scrollTop + pxPerSec * dt;
      if (next >= maxScroll) {
        el.scrollTop = maxScroll;
        setPlaying(false);
        return;
      }
      el.scrollTop = next;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, countdown, speed]);

  const handleStop = useCallback(() => {
    resetPlayback();
  }, [resetPlayback]);

  const handlePlayPause = useCallback(() => {
    if (!hasText || saving) return;
    if (countdown != null) {
      setCountdown(null);
      return;
    }
    if (playing) {
      setPlaying(false);
      return;
    }
    const el = scrollRef.current;
    const atStart = !el || el.scrollTop <= 2;
    if (atStart) {
      void prime().finally(() => {
        if (!openRef.current) return;
        setCountdown(COUNTDOWN_FROM);
      });
      return;
    }
    setPlaying(true);
  }, [countdown, hasText, playing, prime, saving]);

  const handleSave = useCallback(async () => {
    if (saving) return false;
    setPlaying(false);
    setCountdown(null);
    setSaving(true);
    try {
      const blob = await finishRecording();
      if (!blob || blob.size === 0) {
        toast.error(t("project.detail.teleprompterEmptyRecording"));
        return false;
      }
      await onSaveAudio(blob);
      setUnsaved(false);
      setSavedNotice(true);
      toast.success(t("project.detail.teleprompterSaved"));
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("project.detail.teleprompterSaveError"));
      return false;
    } finally {
      setSaving(false);
    }
  }, [finishRecording, onSaveAudio, saving, t]);

  const bumpFont = useCallback((delta: number) => {
    setFontSize((current) => clamp(current + delta, FONT_MIN, FONT_MAX));
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (cssExpanded) {
      setCssExpanded(false);
      return;
    }
    const el = contentRef.current;
    if (!el) {
      setCssExpanded(true);
      return;
    }
    try {
      await requestElementFullscreen(el);
    } catch {
      setCssExpanded(true);
    }
  }, [cssExpanded]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        if (saving) return;
        if (unsaved) {
          setConfirmClose(true);
          return;
        }
        resetPlayback();
        exitExpanded();
      }
      onOpenChange(next);
    },
    [exitExpanded, onOpenChange, resetPlayback, saving, unsaved],
  );

  const discardAndClose = useCallback(() => {
    setConfirmClose(false);
    setUnsaved(false);
    resetPlayback();
    exitExpanded();
    onOpenChange(false);
  }, [exitExpanded, onOpenChange, resetPlayback]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (
          target.closest('[role="slider"]') &&
          (event.key === "ArrowLeft" ||
            event.key === "ArrowRight" ||
            event.key === "ArrowUp" ||
            event.key === "ArrowDown")
        ) {
          return;
        }
      }

      if (event.code === "Space") {
        event.preventDefault();
        handlePlayPause();
        return;
      }
      if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        handleStop();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        bumpFont(FONT_STEP);
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        bumpFont(-FONT_STEP);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSpeed((current) => clamp(current + 1, SPEED_MIN, SPEED_MAX));
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSpeed((current) => clamp(current - 1, SPEED_MIN, SPEED_MAX));
        return;
      }
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        void toggleFullscreen();
      }
    },
    [bumpFont, handlePlayPause, handleStop, toggleFullscreen],
  );

  const playLabel =
    countdown != null
      ? t("project.detail.teleprompterPause")
      : playing
        ? t("project.detail.teleprompterPause")
        : t("project.detail.teleprompterPlay");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        ref={contentRef}
        onKeyDown={handleKeyDown}
        className={cn(
          "dark flex flex-col gap-3 overflow-hidden overflow-y-hidden border-neutral-800 bg-black p-4 text-neutral-50 sm:p-6",
          "[--background:oklch(0_0_0)] [--foreground:oklch(0.98_0_0)] [--muted-foreground:oklch(0.72_0_0)] [--border:oklch(1_0_0/0.16)] [--input:oklch(1_0_0/0.22)] [--accent:oklch(0.22_0_0)] [--ring:oklch(0.72_0.11_175)]",
          "[&>button]:text-neutral-300 [&>button]:hover:text-white [&>button]:ring-offset-black",
          "[&>button]:text-neutral-300 [&>button]:hover:text-white [&>button]:ring-offset-black",
          expanded
            ? "left-0 top-0 h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 rounded-none"
            : "h-[min(36rem,92dvh)] max-h-[min(92dvh,calc(100vh-1.5rem))] w-[min(100vw-2rem,48rem)] max-w-3xl",
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-neutral-50">{t("project.detail.teleprompterTitle")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("project.detail.teleprompterTitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto overscroll-contain px-1 sm:px-2"
          >
            {hasText ? (
              <p
                className="whitespace-pre-wrap leading-relaxed text-neutral-50"
                style={{
                  fontSize,
                  lineHeight: 1.55,
                  paddingTop: "42%",
                  paddingBottom: "50%",
                }}
              >
                {text}
              </p>
            ) : (
              <p className="py-8 text-neutral-400">
                {t("project.detail.teleprompterEmpty")}
              </p>
            )}
          </div>

          {hasText ? (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2">
              <div className="h-10 -translate-y-1/2 border-y border-[oklch(0.78_0.13_175)]/55 bg-[oklch(0.78_0.13_175)]/12" />
              <div className="absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-[oklch(0.82_0.13_175)]" />
            </div>
          ) : null}

          {countdown != null && countdown > 0 ? (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 px-6 text-center"
              aria-live="assertive"
            >
              <span className="text-7xl font-semibold tabular-nums tracking-tight text-white sm:text-8xl">
                {countdown}
              </span>
              <p className="max-w-sm text-lg font-medium text-white sm:text-xl">
                {t("project.detail.teleprompterWait")}
              </p>
            </div>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-neutral-800 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 flex-1 text-xs text-neutral-300">
              {recorder.status === "recording" ? (
                <span className="inline-flex items-center gap-2 font-medium text-white">
                  <span
                    className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500"
                    aria-hidden="true"
                  />
                  {t("project.detail.teleprompterRecording", {
                    time: formatRecordingTime(recorder.elapsedMs),
                  })}
                </span>
              ) : recorder.status === "paused" || (unsaved && recorder.status === "recorded") ? (
                t("project.detail.teleprompterPausedRecording", {
                  time: formatRecordingTime(recorder.elapsedMs),
                })
              ) : savedNotice ? (
                t("project.detail.teleprompterSaved")
              ) : (
                t("project.detail.teleprompterWaitHint")
              )}
            </p>
            <Button
              type="button"
              variant="mint"
              size="sm"
              disabled={!hasText || !unsaved || saving}
              loading={saving}
              loadingLabel={t("project.detail.teleprompterSaving")}
              onClick={() => void handleSave()}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {t("project.detail.teleprompterSave")}
            </Button>
          </div>
          {recorder.error ? (
            <p className="text-xs text-red-300" role="alert">
              {recorder.error === "permission"
                ? t("project.detail.micPermissionDenied")
                : recorder.error === "unsupported" || recorder.error === "insecure"
                  ? t("project.detail.recordingUnsupported")
                  : t("project.detail.recordingFailed")}
            </p>
          ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="mint"
            disabled={!hasText || saving}
            aria-label={playLabel}
            title={playLabel}
            onClick={handlePlayPause}
          >
            {playing || countdown != null ? (
              <Pause className="h-4 w-4 fill-current" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            )}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={!hasText || saving}
            aria-label={t("project.detail.teleprompterStop")}
            title={t("project.detail.teleprompterStop")}
            onClick={handleStop}
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          </Button>

          <div className="flex min-w-[10rem] flex-1 items-center gap-2 sm:min-w-[12rem]">
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("project.detail.teleprompterSpeed")}
            </span>
            <Slider
              min={SPEED_MIN}
              max={SPEED_MAX}
              step={1}
              value={[speed]}
              disabled={!hasText}
              aria-label={t("project.detail.teleprompterSpeed")}
              className="[&>span:last-child]:border-neutral-200 [&>span:last-child]:bg-neutral-50"
              onValueChange={([value]) => {
                if (value != null) setSpeed(value);
              }}
            />
            <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
              {speed}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={fontSize <= FONT_MIN}
              aria-label={t("project.detail.teleprompterFontDecrease")}
              title={t("project.detail.teleprompterFontDecrease")}
              onClick={() => bumpFont(-FONT_STEP)}
            >
              <span className="text-[11px] font-semibold leading-none">A</span>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={fontSize >= FONT_MAX}
              aria-label={t("project.detail.teleprompterFontIncrease")}
              title={t("project.detail.teleprompterFontIncrease")}
              onClick={() => bumpFont(FONT_STEP)}
            >
              <span className="text-base font-semibold leading-none">A</span>
            </Button>
          </div>

          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={
              expanded
                ? t("project.detail.teleprompterExitFullscreen")
                : t("project.detail.teleprompterFullscreen")
            }
            title={
              expanded
                ? t("project.detail.teleprompterExitFullscreen")
                : t("project.detail.teleprompterFullscreen")
            }
            onClick={() => void toggleFullscreen()}
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
        </div>
      </DialogContent>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("project.detail.teleprompterUnsavedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("project.detail.teleprompterUnsavedDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("project.detail.teleprompterKeepOpen")}</AlertDialogCancel>
            <Button type="button" variant="outline" onClick={discardAndClose}>
              {t("project.detail.teleprompterDiscardClose")}
            </Button>
            <Button
              type="button"
              variant="mint"
              loading={saving}
              loadingLabel={t("project.detail.teleprompterSaving")}
              onClick={() => {
                void handleSave().then((ok) => {
                  if (!ok) return;
                  setConfirmClose(false);
                  resetPlayback();
                  exitExpanded();
                  onOpenChange(false);
                });
              }}
            >
              {t("project.detail.teleprompterSave")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
