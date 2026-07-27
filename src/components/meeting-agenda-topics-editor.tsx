import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Flag, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MeetingAgendaTopic } from "@/lib/api";
import { cn } from "@/lib/utils";

type MeetingAgendaTopicsEditorProps = {
  topics: MeetingAgendaTopic[];
  onChange: (topics: MeetingAgendaTopic[]) => void;
  disabled?: boolean;
};

export function MeetingAgendaTopicsEditor({
  topics,
  onChange,
  disabled,
}: MeetingAgendaTopicsEditorProps) {
  const { t } = useTranslation();
  /** Indices with description panel open. Default collapsed; stays open after typing until user closes. */
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setExpanded((prev) => {
      const next: Record<number, boolean> = {};
      for (let i = 0; i < topics.length; i += 1) {
        if (prev[i]) next[i] = true;
      }
      return next;
    });
  }, [topics.length]);

  const updateTopic = (index: number, patch: Partial<MeetingAgendaTopic>) => {
    onChange(
      topics.map((topic, i) => (i === index ? { ...topic, ...patch } : topic)),
    );
  };

  const removeTopic = (index: number) => {
    onChange(topics.filter((_, i) => i !== index));
    setExpanded((prev) => {
      const next: Record<number, boolean> = {};
      for (const [key, value] of Object.entries(prev)) {
        const i = Number(key);
        if (i < index) next[i] = value;
        else if (i > index) next[i - 1] = value;
      }
      return next;
    });
  };

  const addTopic = () => {
    onChange([...topics, { title: "", description: null, needsAction: false }]);
  };

  const setDescriptionOpen = (index: number, open: boolean) => {
    setExpanded((prev) => ({ ...prev, [index]: open }));
  };

  return (
    <div className="space-y-4">
      {topics.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("project.meeting.topicsEmpty")}</p>
      ) : (
        <div className="space-y-4">
          {topics.map((topic, index) => {
            const descriptionOpen = expanded[index] === true;
            const hasDescription = Boolean(topic.description?.trim());

            return (
              <div
                key={index}
                className={cn(
                  "space-y-2 rounded-lg border p-3 transition-colors",
                  topic.needsAction && "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">
                    {t("project.meeting.topicLabel", { number: index + 1 })}
                  </Label>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7 text-muted-foreground",
                        topic.needsAction && "text-amber-700 hover:text-amber-800 dark:text-amber-400",
                      )}
                      disabled={disabled}
                      aria-label={t("project.meeting.provideTopic")}
                      aria-pressed={topic.needsAction === true}
                      title={t("project.meeting.provideTopic")}
                      onClick={() =>
                        updateTopic(index, { needsAction: !topic.needsAction })
                      }
                    >
                      <Flag
                        className={cn("h-4 w-4", topic.needsAction && "fill-current")}
                        aria-hidden="true"
                      />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={disabled}
                      aria-label={t("project.meeting.removeTopic")}
                      title={t("project.meeting.removeTopic")}
                      onClick={() => removeTopic(index)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <Input
                  value={topic.title}
                  disabled={disabled}
                  placeholder={t("project.meeting.topicTitlePlaceholder")}
                  onChange={(e) => updateTopic(index, { title: e.target.value })}
                />
                <Collapsible
                  open={descriptionOpen}
                  onOpenChange={(open) => setDescriptionOpen(index, open)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full justify-between px-2 text-muted-foreground hover:text-foreground"
                      disabled={disabled}
                    >
                      <span className="text-xs">
                        {hasDescription && !descriptionOpen
                          ? t("project.meeting.topicDescriptionCollapsed")
                          : t("project.meeting.topicDescriptionToggle")}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform",
                          descriptionOpen && "rotate-180",
                        )}
                        aria-hidden="true"
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Textarea
                      value={topic.description ?? ""}
                      disabled={disabled}
                      placeholder={t("project.meeting.topicDescriptionPlaceholder")}
                      rows={2}
                      className="mt-1"
                      onChange={(e) => {
                        const value = e.target.value;
                        updateTopic(index, { description: value || null });
                        if (value.trim()) {
                          setDescriptionOpen(index, true);
                        }
                      }}
                    />
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}
        </div>
      )}
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addTopic}>
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        {t("project.meeting.addTopic")}
      </Button>
    </div>
  );
}
