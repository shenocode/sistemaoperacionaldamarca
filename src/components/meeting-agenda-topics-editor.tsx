import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MeetingAgendaTopic } from "@/lib/api";

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

  const updateTopic = (index: number, patch: Partial<MeetingAgendaTopic>) => {
    onChange(
      topics.map((topic, i) => (i === index ? { ...topic, ...patch } : topic)),
    );
  };

  const removeTopic = (index: number) => {
    onChange(topics.filter((_, i) => i !== index));
  };

  const addTopic = () => {
    onChange([...topics, { title: "", description: null }]);
  };

  return (
    <div className="space-y-4">
      {topics.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("project.meeting.topicsEmpty")}</p>
      ) : (
        <div className="space-y-4">
          {topics.map((topic, index) => (
            <div key={index} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <Label className="text-xs text-muted-foreground">
                  {t("project.meeting.topicLabel", { number: index + 1 })}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground"
                  disabled={disabled}
                  aria-label={t("project.meeting.removeTopic")}
                  onClick={() => removeTopic(index)}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <Input
                value={topic.title}
                disabled={disabled}
                placeholder={t("project.meeting.topicTitlePlaceholder")}
                onChange={(e) => updateTopic(index, { title: e.target.value })}
              />
              <Textarea
                value={topic.description ?? ""}
                disabled={disabled}
                placeholder={t("project.meeting.topicDescriptionPlaceholder")}
                rows={2}
                onChange={(e) =>
                  updateTopic(index, { description: e.target.value || null })
                }
              />
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addTopic}>
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        {t("project.meeting.addTopic")}
      </Button>
    </div>
  );
}
