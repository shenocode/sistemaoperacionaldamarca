import { useCallback, useEffect, useRef, useState } from "react";

export type AudioRecorderStatus = "idle" | "recording" | "recorded";

type UseAudioRecorderOptions = {
  maxMs?: number;
};

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function formatRecordingTime(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}) {
  const maxMs = options.maxMs ?? 3 * 60 * 1000;
  const [status, setStatus] = useState<AudioRecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (maxTimerRef.current != null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const revokePreview = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    stopStream();
    chunksRef.current = [];
    revokePreview();
    setAudioBlob(null);
    setElapsedMs(0);
    setStatus("idle");
    setError(null);
  }, [clearTimers, revokePreview, stopStream]);

  const finishRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
      setError("unsupported");
      return;
    }
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setError("insecure");
      return;
    }

    reset();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        clearTimers();
        stopStream();
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        if (blob.size === 0) {
          setStatus("idle");
          setAudioBlob(null);
          setError("empty");
          return;
        }
        const url = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setAudioBlob(blob);
        setStatus("recorded");
      };

      recorder.start(250);
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setStatus("recording");

      tickRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 200);

      maxTimerRef.current = window.setTimeout(() => {
        finishRecording();
      }, maxMs);
    } catch (err) {
      stopStream();
      setStatus("idle");
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("permission");
      } else {
        setError("failed");
      }
    }
  }, [clearTimers, finishRecording, maxMs, reset, stopStream]);

  useEffect(() => () => reset(), [reset]);

  return {
    status,
    elapsedMs,
    audioBlob,
    previewUrl,
    error,
    supported: typeof MediaRecorder !== "undefined",
    start,
    stop: finishRecording,
    reset,
  };
}
