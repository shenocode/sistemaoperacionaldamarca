import type { DragEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { moveItem } from "@/lib/proposal-template";

export function useListReorder<T>(items: T[], onReorder: (next: T[]) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const onDragStart = (index: number) => (event: DragEvent<HTMLElement>) => {
    setDragIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const onDragOver = (index: number) => (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropIndex !== index) setDropIndex(index);
  };

  const onDrop = (index: number) => (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const from = dragIndex ?? Number(event.dataTransfer.getData("text/plain"));
    setDragIndex(null);
    setDropIndex(null);
    if (!Number.isFinite(from)) return;
    const next = moveItem(items, from, index);
    if (next !== items) onReorder(next);
  };

  const onDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  return { dragIndex, dropIndex, onDragStart, onDragOver, onDrop, onDragEnd };
}

export function DragHandle({
  index,
  onDragStart,
  onDragEnd,
  className,
}: {
  index: number;
  onDragStart: (index: number) => (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <span
      draggable
      onDragStart={onDragStart(index)}
      onDragEnd={onDragEnd}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing",
        className,
      )}
      aria-label={t("proposals.dragHandle")}
      title={t("proposals.dragHandle")}
      role="button"
      tabIndex={0}
    >
      <GripVertical className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}
