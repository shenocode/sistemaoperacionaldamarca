import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CONTACT_LEAD_SESSION_KEY,
  ContactForm,
} from "@/components/contact-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EXIT_INTENT_SESSION_KEY = "som-exit-intent-seen";
const MIN_DWELL_MS = 10_000;
const MOBILE_FALLBACK_MS = 45_000;
const MOBILE_SCROLL_RATIO = 0.5;

function hasSessionFlag(key: string) {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function setSessionFlag(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

function isContactSectionVisible() {
  const el = document.getElementById("contato");
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.top < window.innerHeight * 0.85 && rect.bottom > 0;
}

type ExitIntentDialogProps = {
  enabled?: boolean;
};

export function ExitIntentDialog({ enabled = true }: ExitIntentDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const armedRef = useRef(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (hasSessionFlag(EXIT_INTENT_SESSION_KEY) || hasSessionFlag(CONTACT_LEAD_SESSION_KEY)) {
      shownRef.current = true;
      return;
    }

    const armTimer = window.setTimeout(() => {
      armedRef.current = true;
    }, MIN_DWELL_MS);

    const markSeenAndOpen = () => {
      if (shownRef.current || !armedRef.current) return;
      if (isContactSectionVisible()) return;
      if (hasSessionFlag(CONTACT_LEAD_SESSION_KEY)) return;
      shownRef.current = true;
      setSessionFlag(EXIT_INTENT_SESSION_KEY);
      setOpen(true);
    };

    const finePointer = window.matchMedia("(pointer: fine)").matches;

    const onMouseLeave = (event: MouseEvent) => {
      if (!finePointer) return;
      if (event.clientY > 0) return;
      markSeenAndOpen();
    };

    let mobileFallback: number | undefined;
    const onScroll = () => {
      if (finePointer) return;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      if (window.scrollY / scrollable >= MOBILE_SCROLL_RATIO) {
        markSeenAndOpen();
      }
    };

    if (!finePointer) {
      mobileFallback = window.setTimeout(markSeenAndOpen, MOBILE_FALLBACK_MS);
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    document.documentElement.addEventListener("mouseleave", onMouseLeave);

    return () => {
      window.clearTimeout(armTimer);
      if (mobileFallback != null) window.clearTimeout(mobileFallback);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, [enabled]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSessionFlag(EXIT_INTENT_SESSION_KEY);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="theme-mono max-h-[min(90dvh,calc(100vh-2rem))] max-w-lg overflow-y-auto border-neutral-900/10 bg-[hsl(40_20%_97%)] sm:rounded-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl font-semibold tracking-tight text-neutral-900">
            {t("landing.exitIntentTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-neutral-600">
            {t("landing.exitIntentBody")}
          </DialogDescription>
        </DialogHeader>
        <ContactForm
          idPrefix="exit-contact"
          className="mt-2"
          onSubmitted={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
