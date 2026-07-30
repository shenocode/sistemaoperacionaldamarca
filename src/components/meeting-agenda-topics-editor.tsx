import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import { AlignLeft, Flag, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { MeetingAgendaTopic } from "@/lib/api";
import { cn } from "@/lib/utils";

type MeetingAgendaTopicsEditorProps = {
  topics: MeetingAgendaTopic[];
  onChange: Dispatch<SetStateAction<MeetingAgendaTopic[]>>;
  disabled?: boolean;
};

export type MeetingAgendaTopicsEditorHandle = {
  addTopic: () => void;
};

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function remapExpandedAfterMove(
  prev: Record<number, boolean>,
  from: number,
  to: number,
): Record<number, boolean> {
  if (from === to) return prev;
  const next: Record<number, boolean> = {};
  for (const [key, value] of Object.entries(prev)) {
    if (!value) continue;
    const i = Number(key);
    let ni = i;
    if (i === from) ni = to;
    else if (from < to && i > from && i <= to) ni = i - 1;
    else if (from > to && i >= to && i < from) ni = i + 1;
    next[ni] = true;
  }
  return next;
}

export const MeetingAgendaTopicsEditor = forwardRef<
  MeetingAgendaTopicsEditorHandle,
  MeetingAgendaTopicsEditorProps
>(function MeetingAgendaTopicsEditor({ topics, onChange, disabled }, ref) {
  const { t } = useTranslation();
  /** Indices with description panel open. Default collapsed; stays open after typing until user closes. */
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

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
    onChange((prev) =>
      prev.map((topic, i) => (i === index ? { ...topic, ...patch } : topic)),
    );
  };

  const removeTopic = (index: number) => {
    onChange((prev) => prev.filter((_, i) => i !== index));
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
    onChange((prev) => [{ title: "", description: null, needsAction: false }, ...prev]);
    setExpanded((prev) => {
      const next: Record<number, boolean> = {};
      for (const [key, value] of Object.entries(prev)) {
        next[Number(key) + 1] = value;
      }
      return next;
    });
  };

  useImperativeHandle(ref, () => ({ addTopic }), [onChange]);

  const setDescriptionOpen = (index: number, open: boolean) => {
    setExpanded((prev) => ({ ...prev, [index]: open }));
  };

  const applyReorder = (from: number, to: number) => {
    if (from === to) return;
    onChange((prev) => moveItem(prev, from, to));
    setExpanded((prev) => remapExpandedAfterMove(prev, from, to));
  };

  const onDragStart = (index: number) => (event: DragEvent<HTMLSpanElement>) => {
    if (disabled) return;
    setDragIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const onDragOver = (index: number) => (event: DragEvent<HTMLElement>) => {
    if (disabled || dragIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropIndex !== index) setDropIndex(index);
  };

  const onDrop = (index: number) => (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (disabled) return;
    const from = dragIndex ?? Number(event.dataTransfer.getData("text/plain"));
    setDragIndex(null);
    setDropIndex(null);
    if (!Number.isFinite(from)) return;
    applyReorder(from, index);
  };

  const onDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  return (
    <div className="space-y-3">
      {topics.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("project.meeting.topicsEmpty")}</p>
      ) : (
        topics.map((topic, index) => {
          const descriptionOpen = expanded[index] === true;
          const hasDescription = Boolean(topic.description?.trim());

          return (
            <div
              key={index}
              onDragOver={onDragOver(index)}
              onDrop={onDrop(index)}
              className={cn(
                "space-y-2 rounded-lg border p-3 transition-colors",
                topic.needsAction &&
                  "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40",
                dragIndex === index && "opacity-50",
                dropIndex === index &&
                  dragIndex !== null &&
                  dragIndex !== index &&
                  "bg-muted",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span
                  draggable={!disabled}
                  onDragStart={onDragStart(index)}
                  onDragEnd={onDragEnd}
                  className={cn(
                    "inline-flex shrink-0 touch-none text-muted-foreground",
                    disabled
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-grab active:cursor-grabbing",
                  )}
                  aria-label={t("project.meeting.dragHandle")}
                  title={t("project.meeting.dragHandle")}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                >
                  <GripVertical className="h-4 w-4" aria-hidden="true" />
                </span>

                <Input
                  value={topic.title}
                  disabled={disabled}
                  placeholder={t("project.meeting.topicTitlePlaceholder")}
                  className="min-w-0 flex-1"
                  onChange={(e) => updateTopic(index, { title: e.target.value })}
                />

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 text-muted-foreground",
                      (descriptionOpen || hasDescription) && "text-foreground",
                    )}
                    disabled={disabled}
                    aria-label={t("project.meeting.topicDescriptionToggle")}
                    aria-pressed={descriptionOpen}
                    title={t("project.meeting.topicDescriptionToggle")}
                    onClick={() => setDescriptionOpen(index, !descriptionOpen)}
                  >
                    <AlignLeft className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 text-muted-foreground",
                      topic.needsAction &&
                        "text-amber-700 hover:text-amber-800 dark:text-amber-400",
                    )}
                    disabled={disabled}
                    aria-label={t("project.meeting.provideTopic")}
                    aria-pressed={topic.needsAction === true}
                    title={t("project.meeting.provideTopic")}
                    onClick={() =>
                      onChange((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, needsAction: !item.needsAction } : item,
                        ),
                      )
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
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    disabled={disabled}
                    aria-label={t("project.meeting.removeTopic")}
                    title={t("project.meeting.removeTopic")}
                    onClick={() => removeTopic(index)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <Collapsible
                open={descriptionOpen}
                onOpenChange={(open) => setDescriptionOpen(index, open)}
              >
                <CollapsibleContent>
                  <Textarea
                    value={topic.description ?? ""}
                    disabled={disabled}
                    placeholder={t("project.meeting.topicDescriptionPlaceholder")}
                    rows={2}
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
        })
      )}
    </div>
  );
});
