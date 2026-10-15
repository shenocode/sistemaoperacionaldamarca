import { useCallback, useEffect, useRef, useState } from "react";

export type AudioRecorderStatus = "idle" | "recording" | "paused" | "recorded";

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
  const elapsedBaseRef = useRef(0);
  const blobRef = useRef<Blob | null>(null);
  const pendingFinishRef = useRef<((blob: Blob | null) => void) | null>(null);
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
    elapsedBaseRef.current = 0;
    blobRef.current = null;
    const pending = pendingFinishRef.current;
    pendingFinishRef.current = null;
    pending?.(null);
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

  const readElapsed = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    const running = recorder?.state === "recording";
    const extra = running ? Date.now() - startedAtRef.current : 0;
    return elapsedBaseRef.current + extra;
  }, []);

  const startTick = useCallback(
    (session: number) => {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
      }
      tickRef.current = window.setInterval(() => {
        if (session !== sessionRef.current) return;
        const elapsed = readElapsed();
        setElapsedMs(elapsed);
        if (elapsed >= maxMs) finishRecording();
      }, 200);
    },
    [finishRecording, maxMs, readElapsed],
  );

  const pause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    const elapsed = readElapsed();
    try {
      recorder.pause();
    } catch {
      return;
    }
    elapsedBaseRef.current = elapsed;
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setElapsedMs(elapsed);
    setStatus("paused");
  }, [readElapsed]);

  const resume = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") return false;
    try {
      recorder.resume();
    } catch {
      return false;
    }
    startedAtRef.current = Date.now();
    setStatus("recording");
    startTick(sessionRef.current);
    return true;
  }, [startTick]);

  const requestStream = useCallback(async (session: number) => {
    const current = streamRef.current;
    if (current?.getAudioTracks().some((track) => track.readyState === "live")) {
      return current;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    if (session !== sessionRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return null;
    }
    stopStream();
    streamRef.current = stream;
    return stream;
  }, [stopStream]);

  const canRecord = useCallback(() => {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
      setError("unsupported");
      return false;
    }
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setError("insecure");
      return false;
    }
    return true;
  }, []);

  const prime = useCallback(async () => {
    if (!canRecord()) return false;
    try {
      const stream = await requestStream(sessionRef.current);
      if (!stream) return false;
      setError(null);
      return true;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("permission");
      } else {
        setError("failed");
      }
      return false;
    }
  }, [canRecord, requestStream]);

  const start = useCallback(async () => {
    if (mediaRecorderRef.current?.state === "recording") return true;
    if (mediaRecorderRef.current?.state === "paused") return resume();
    if (startingRef.current) return false;
    if (!canRecord()) return false;

    startingRef.current = true;
    const session = sessionRef.current + 1;
    sessionRef.current = session;

    clearTimers();
    discardRecorder();
    chunksRef.current = [];
    elapsedBaseRef.current = 0;
    blobRef.current = null;
    revokePreview();
    setAudioBlob(null);
    setElapsedMs(0);
    setError(null);

    try {
      const stream = await requestStream(session);
      if (!stream || session !== sessionRef.current) {
        startingRef.current = false;
        return false;
      }

      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      const settle = (blob: Blob | null, failed: "empty" | "failed" | null) => {
        const pending = pendingFinishRef.current;
        pendingFinishRef.current = null;
        if (failed) {
          setStatus("idle");
          setAudioBlob(null);
          blobRef.current = null;
          setError(failed);
        }
        pending?.(blob);
      };

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
        detachRecorder(recorder);
        settle(null, "failed");
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
          settle(null, "empty");
          return;
        }
        // Copy so the next MediaRecorder session cannot reuse this buffer.
        const blob = new Blob(parts, { type });
        if (blob.size === 0) {
          settle(null, "empty");
          return;
        }
        const detached = new Blob([blob], { type });
        const url = URL.createObjectURL(detached);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        blobRef.current = detached;
        setAudioBlob(detached);
        setStatus("recorded");
        settle(detached, null);
      };

      // No timeslice: leftover ondataavailable events from a previous take
      // were being appended to the next recording (same first audio forever).
      recorder.start();
      startedAtRef.current = Date.now();
      elapsedBaseRef.current = 0;
      setElapsedMs(0);
      setStatus("recording");
      startingRef.current = false;
      startTick(session);
      return true;
    } catch (err) {
      if (session !== sessionRef.current) return false;
      startingRef.current = false;
      stopStream();
      setStatus("idle");
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("permission");
      } else {
        setError("failed");
      }
      return false;
    }
  }, [
    canRecord,
    clearTimers,
    discardRecorder,
    requestStream,
    resume,
    revokePreview,
    startTick,
    stopStream,
  ]);

  const finish = useCallback(() => {
    return new Promise<Blob | null>((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(blobRef.current);
        return;
      }
      pendingFinishRef.current = resolve;
      try {
        recorder.stop();
      } catch {
        pendingFinishRef.current = null;
        resolve(blobRef.current);
      }
    });
  }, []);

  useEffect(() => () => reset(), [reset]);

  return {
    status,
    elapsedMs,
    audioBlob,
    previewUrl,
    error,
    supported: typeof MediaRecorder !== "undefined",
    prime,
    start,
    pause,
    resume,
    finish,
    stop: finishRecording,
    reset,
  };
}
