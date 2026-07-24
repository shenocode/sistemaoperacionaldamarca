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

type BrandBriefingFormProps = {
  clientId: string;
  briefing: BrandBriefingView;
};

export function BrandBriefingForm({ clientId, briefing }: BrandBriefingFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>(briefing.answersParsed);
  const [coachQuestion, setCoachQuestion] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [tab, setTab] = useState("form");

  useEffect(() => {
    setAnswers(briefing.answersParsed);
  }, [briefing.id, briefing.updated_at]);

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
    mutationFn: (next: Record<string, string>) =>
      upsertBrandBriefingAnswers({ clientId, answers: next }),
    onSuccess: (data) => {
      queryClient.setQueryData(["brand-briefing", clientId], data);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await upsertBrandBriefingAnswers({ clientId, answers });
      return completeBrandBriefing(clientId);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["brand-briefing", clientId], data);
      setTab("guide");
      toast.success(t("briefing.guideGenerated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      return next;
    });
  };

  const persistAnswer = (questionId: string, value: string) => {
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    saveMutation.mutate(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("briefing.progress", {
            answered: answeredCount,
            total: briefing.totalCount,
          })}
          {saveMutation.isPending ? (
            <span className="ml-2 inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              {t("briefing.saving")}
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
                      <Textarea
                        id={question.id}
                        value={answers[question.id] ?? ""}
                        rows={3}
                        onChange={(e) => setAnswer(question.id, e.target.value)}
                        onBlur={(e) => persistAnswer(question.id, e.target.value)}
                        placeholder={t("briefing.answerPlaceholder")}
                      />
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        <TabsContent value="guide" className="pt-4">
          <BrandGuideView
            markdown={briefing.guide_markdown}
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
            persistAnswer(coachQuestion.id, suggestion);
            toast.success(t("briefing.coach.applied"));
          }}
        />
      ) : null}
    </div>
  );
}
