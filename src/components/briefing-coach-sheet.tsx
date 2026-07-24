import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  briefingCoach,
  type BriefingCoachMessage,
  type BriefingCoachResult,
} from "@/lib/api";

type BriefingCoachSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  questionId: string;
  questionLabel: string;
  currentAnswer: string;
  onApply: (suggestion: string) => void;
};

type ChatItem = BriefingCoachMessage & {
  kind?: BriefingCoachResult["type"];
};

export function BriefingCoachSheet({
  open,
  onOpenChange,
  clientId,
  questionId,
  questionLabel,
  currentAnswer,
  onApply,
}: BriefingCoachSheetProps) {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const startedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const reset = () => {
    setMessages([]);
    setInput("");
    setSuggestion(null);
    startedRef.current = false;
  };

  const coachMutation = useMutation({
    mutationFn: (history: BriefingCoachMessage[]) =>
      briefingCoach({
        clientId,
        questionId,
        questionLabel,
        currentAnswer,
        messages: history,
        locale: i18n.resolvedLanguage ?? i18n.language,
      }),
    onSuccess: (result) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.content, kind: result.type },
      ]);
      if (result.type === "suggestion") {
        setSuggestion(result.content);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    coachMutation.mutate([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once per open
  }, [open, questionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, coachMutation.isPending]);

  const send = () => {
    const text = input.trim();
    if (!text || coachMutation.isPending) return;
    const next: BriefingCoachMessage[] = [
      ...messages.map(({ role, content }) => ({ role, content })),
      { role: "user", content: text },
    ];
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    coachMutation.mutate(next);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b pb-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {t("briefing.coach.title")}
          </SheetTitle>
          <SheetDescription className="text-sm text-foreground/80">
            {questionLabel}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto py-4">
          {messages.map((msg, index) => (
            <div
              key={`${msg.role}-${index}`}
              className={
                msg.role === "user"
                  ? "ml-6 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "mr-6 rounded-lg bg-muted px-3 py-2 text-sm"
              }
            >
              {msg.kind === "suggestion" ? (
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {t("briefing.coach.suggestionLabel")}
                </p>
              ) : null}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}
          {coachMutation.isPending ? (
            <div className="mr-6 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("briefing.coach.thinking")}
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("briefing.coach.placeholder")}
              rows={2}
              className="min-h-[60px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              className="shrink-0"
              disabled={!input.trim() || coachMutation.isPending}
              onClick={send}
              aria-label={t("briefing.coach.send")}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <SheetFooter className="flex-col gap-2 sm:flex-col">
            {suggestion ? (
              <Button
                type="button"
                onClick={() => {
                  onApply(suggestion);
                  onOpenChange(false);
                  reset();
                }}
              >
                {t("briefing.coach.useAnswer")}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("briefing.coach.dismiss")}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
