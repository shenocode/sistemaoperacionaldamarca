import { useCallback, useEffect, useRef, useState } from "react";

export type AudioRecorderStatus = "idle" | "recording" | "recorded";

type UseAudioRecorderOptions = {
  maxMs?: number;
};

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const isSafari =
    typeof navigator !== "undefined" &&
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const candidates = isSafari
    ? ["audio/mp4", "audio/aac", "audio/webm;codecs=opus", "audio/webm"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function detachRecorder(recorder: MediaRecorder | null) {
  if (!recorder) return;
  recorder.ondataavailable = null;
  recorder.onerror = null;
  recorder.onstop = null;
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
  const sessionRef = useRef(0);
  const startingRef = useRef(false);

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

  const discardRecorder = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    // Detach first so a late onstop/ondataavailable cannot restore the previous blob.
    detachRecorder(recorder);
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const reset = useCallback(() => {
    sessionRef.current += 1;
    startingRef.current = false;
    clearTimers();
    discardRecorder();
    stopStream();
    chunksRef.current = [];
    revokePreview();
    setAudioBlob(null);
    setElapsedMs(0);
    setStatus("idle");
    setError(null);
  }, [clearTimers, discardRecorder, revokePreview, stopStream]);

  const finishRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    try {
      recorder.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
      setError("unsupported");
      return;
    }
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setError("insecure");
      return;
    }

    startingRef.current = true;
    const session = sessionRef.current + 1;
    sessionRef.current = session;

    clearTimers();
    discardRecorder();
    stopStream();
    chunksRef.current = [];
    revokePreview();
    setAudioBlob(null);
    setElapsedMs(0);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (session !== sessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (session !== sessionRef.current) return;
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        if (session !== sessionRef.current) return;
        clearTimers();
        stopStream();
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        startingRef.current = false;
        setAudioBlob(null);
        setStatus("idle");
        setError("failed");
      };

      recorder.onstop = () => {
        if (session !== sessionRef.current) return;
        clearTimers();
        stopStream();
        const type = recorder.mimeType || mimeType || "audio/webm";
        const parts = chunksRef.current.slice();
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        startingRef.current = false;
        detachRecorder(recorder);
        if (parts.length === 0) {
          setStatus("idle");
          setAudioBlob(null);
          setError("empty");
          return;
        }
        // Copy so the next MediaRecorder session cannot reuse this buffer.
        const blob = new Blob(parts, { type });
        if (blob.size === 0) {
          setStatus("idle");
          setAudioBlob(null);
          setError("empty");
          return;
        }
        const detached = new Blob([blob], { type });
        const url = URL.createObjectURL(detached);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setAudioBlob(detached);
        setStatus("recorded");
      };

      // No timeslice: leftover ondataavailable events from a previous take
      // were being appended to the next recording (same first audio forever).
      recorder.start();
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setStatus("recording");
      startingRef.current = false;

      tickRef.current = window.setInterval(() => {
        if (session !== sessionRef.current) return;
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 200);

      maxTimerRef.current = window.setTimeout(() => {
        if (session !== sessionRef.current) return;
        finishRecording();
      }, maxMs);
    } catch (err) {
      if (session !== sessionRef.current) return;
      startingRef.current = false;
      stopStream();
      setStatus("idle");
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("permission");
      } else {
        setError("failed");
      }
    }
  }, [clearTimers, discardRecorder, finishRecording, maxMs, revokePreview, stopStream]);

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
