import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { BriefingCoachSheet } from "@/components/briefing-coach-sheet";
import { BrandGuideView } from "@/components/brand-guide-view";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  completeBrandBriefing,
  upsertBrandBriefingAnswers,
  type BrandBriefingView,
} from "@/lib/api";
import {
  buildLocalizedFieldFromSource,
  ensureAnswersTranslated,
  answersNeedLocaleBackfill,
  getCanonicalText,
  getLocalizedAnswer,
  getLocalizedText,
  normalizeAppLocale,
  parseRowI18n,
  setLocalizedAnswer,
  translateTextField,
  type RowI18n,
} from "@/lib/i18n-content";

type BrandBriefingFormProps = {
  clientId: string;
  briefing: BrandBriefingView;
};

function localizedAnswersFromI18n(
  answers: Record<string, string>,
  i18n: RowI18n,
  locale: string,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [questionId, fallback] of Object.entries(answers)) {
    next[questionId] = getLocalizedAnswer(i18n, questionId, fallback, locale);
  }
  return next;
}

function canonicalAnswersFromI18n(
  answers: Record<string, string>,
  i18n: RowI18n,
): Record<string, string> {
  const answersI18n = parseRowI18n(i18n).answers;
  const blocks =
    answersI18n && typeof answersI18n === "object" && !Array.isArray(answersI18n)
      ? (answersI18n as Record<string, unknown>)
      : {};
  const next: Record<string, string> = { ...answers };
  for (const [questionId, fallback] of Object.entries(answers)) {
    next[questionId] = getCanonicalText({ [questionId]: blocks[questionId] }, questionId, fallback);
  }
  return next;
}

export function BrandBriefingForm({ clientId, briefing }: BrandBriefingFormProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const [rowI18n, setRowI18n] = useState<RowI18n>(() => parseRowI18n(briefing.i18n));
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    localizedAnswersFromI18n(briefing.answersParsed, parseRowI18n(briefing.i18n), uiLocale),
  );
  const [coachQuestion, setCoachQuestion] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [tab, setTab] = useState("form");
  const [translatingId, setTranslatingId] = useState<string | null>(null);

  useEffect(() => {
    const nextI18n = parseRowI18n(briefing.i18n);
    setRowI18n(nextI18n);
    setAnswers(localizedAnswersFromI18n(briefing.answersParsed, nextI18n, uiLocale));
  }, [briefing.id, briefing.updated_at, briefing.i18n, briefing.answersParsed, uiLocale]);

  useEffect(() => {
    if (!answersNeedLocaleBackfill(briefing.i18n, briefing.answersParsed, uiLocale)) return;
    let cancelled = false;
    void (async () => {
      try {
        const current = parseRowI18n(briefing.i18n);
        const nextI18n = await ensureAnswersTranslated(current, briefing.answersParsed);
        if (cancelled) return;
        if (answersNeedLocaleBackfill(nextI18n, briefing.answersParsed, uiLocale)) return;
        if (JSON.stringify(nextI18n) === JSON.stringify(current)) return;
        const display = localizedAnswersFromI18n(briefing.answersParsed, nextI18n, uiLocale);
        setRowI18n(nextI18n);
        setAnswers(display);
        await upsertBrandBriefingAnswers({
          clientId,
          answers: canonicalAnswersFromI18n(display, nextI18n),
          i18n: nextI18n,
        });
        if (cancelled) return;
        void queryClient.invalidateQueries({ queryKey: ["brand-briefing", clientId] });
      } catch {
        // Keep canonical answers if translation is unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [briefing.id, briefing.updated_at, briefing.i18n, briefing.answersParsed, uiLocale, clientId, queryClient]);

  const answeredCount = useMemo(() => {
    let count = 0;
    for (const section of briefing.templateParsed.sections) {
      for (const q of section.questions) {
        if (answers[q.id]?.trim()) count += 1;
      }
    }
    return count;
  }, [answers, briefing.templateParsed.sections]);

  const saveMutation = useMutation({
    mutationFn: ({
      nextAnswers,
      nextI18n,
    }: {
      nextAnswers: Record<string, string>;
      nextI18n: RowI18n;
    }) =>
      upsertBrandBriefingAnswers({
        clientId,
        answers: canonicalAnswersFromI18n(nextAnswers, nextI18n),
        i18n: nextI18n,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["brand-briefing", clientId], data);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await upsertBrandBriefingAnswers({
        clientId,
        answers: canonicalAnswersFromI18n(answers, rowI18n),
        i18n: rowI18n,
      });
      return completeBrandBriefing(clientId, i18n.resolvedLanguage ?? i18n.language);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["brand-briefing", clientId], data);
      setTab("guide");
      toast.success(t("briefing.guideGenerated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const persistAnswer = async (questionId: string, value: string) => {
    const trimmed = value.trimEnd();
    setTranslatingId(questionId);
    try {
      let block;
      try {
        block = await translateTextField({ text: trimmed });
      } catch {
        block = buildLocalizedFieldFromSource(trimmed, uiLocale);
      }
      const nextI18n = setLocalizedAnswer(rowI18n, questionId, block);
      const display = getLocalizedAnswer(nextI18n, questionId, trimmed, uiLocale);
      const nextAnswers = { ...answers, [questionId]: display };
      setRowI18n(nextI18n);
      setAnswers(nextAnswers);
      saveMutation.mutate({ nextAnswers, nextI18n });
    } finally {
      setTranslatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("briefing.progress", {
            answered: answeredCount,
            total: briefing.totalCount,
          })}
          {saveMutation.isPending || translatingId ? (
            <span className="ml-2 inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              {translatingId ? t("common.translating") : t("briefing.saving")}
            </span>
          ) : null}
        </p>
        <Button
          type="button"
          onClick={() => completeMutation.mutate()}
          disabled={completeMutation.isPending || answeredCount === 0}
        >
          {completeMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {briefing.guide_markdown
            ? t("briefing.updateGuide")
            : t("briefing.completeGuide")}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="form">{t("briefing.tabs.form")}</TabsTrigger>
          <TabsTrigger value="guide">{t("briefing.tabs.guide")}</TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-4 pt-4">
          {briefing.templateParsed.objective ? (
            <p className="text-sm text-muted-foreground">{briefing.templateParsed.objective}</p>
          ) : null}

          <Accordion type="multiple" defaultValue={briefing.templateParsed.sections.map((s) => s.id)}>
            {briefing.templateParsed.sections.map((section) => (
              <AccordionItem key={section.id} value={section.id}>
                <AccordionTrigger>{section.title}</AccordionTrigger>
                <AccordionContent className="space-y-5">
                  {section.questions.map((question) => (
                    <div key={question.id} className="space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <Label htmlFor={question.id} className="text-sm leading-snug">
                          {question.label}
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0 gap-1.5 text-xs"
                          onClick={() =>
                            setCoachQuestion({ id: question.id, label: question.label })
                          }
                        >
                          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("briefing.talkAbout")}
                        </Button>
                      </div>
                      {question.helper ? (
                        <p className="text-xs text-muted-foreground">{question.helper}</p>
                      ) : null}
                      <div className="relative">
                        <Textarea
                          id={question.id}
                          value={answers[question.id] ?? ""}
                          rows={3}
                          disabled={translatingId === question.id}
                          onChange={(e) => setAnswer(question.id, e.target.value)}
                          onBlur={(e) => void persistAnswer(question.id, e.target.value)}
                          placeholder={t("briefing.answerPlaceholder")}
                        />
                        {translatingId === question.id ? (
                          <span className="pointer-events-none absolute bottom-2 right-2 text-[10px] text-muted-foreground">
                            {t("common.translating")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        <TabsContent value="guide" className="pt-4">
          <BrandGuideView
            markdown={getLocalizedText(
              briefing.i18n,
              "guide_markdown",
              briefing.guide_markdown,
              uiLocale,
            )}
            updatedAt={briefing.completed_at ?? briefing.updated_at}
          />
        </TabsContent>
      </Tabs>

      {coachQuestion ? (
        <BriefingCoachSheet
          open={Boolean(coachQuestion)}
          onOpenChange={(open) => {
            if (!open) setCoachQuestion(null);
          }}
          clientId={clientId}
          questionId={coachQuestion.id}
          questionLabel={coachQuestion.label}
          currentAnswer={answers[coachQuestion.id] ?? ""}
          onApply={(suggestion) => {
            void persistAnswer(coachQuestion.id, suggestion);
            toast.success(t("briefing.coach.applied"));
          }}
        />
      ) : null}
    </div>
  );
}
