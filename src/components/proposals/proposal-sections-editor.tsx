import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  renumberSections,
  type ProposalBlock,
  type ProposalSection,
} from "@/lib/proposal-template";
import { DragHandle, useListReorder } from "@/components/proposals/reorderable";

function updateBlock(
  sections: ProposalSection[],
  sectionId: string,
  blockId: string,
  next: ProposalBlock,
): ProposalSection[] {
  return sections.map((section) =>
    section.id !== sectionId
      ? section
      : {
          ...section,
          blocks: section.blocks.map((b) => (b.id === blockId ? next : b)),
        },
  );
}

export function ProposalSectionsEditor({
  sections,
  onChange,
}: {
  sections: ProposalSection[];
  onChange: (sections: ProposalSection[]) => void;
}) {
  const { t } = useTranslation();
  const {
    dragIndex,
    dropIndex,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  } = useListReorder(sections, (next) => onChange(renumberSections(next)));

  return (
    <div className="space-y-3">
      <Label>{t("proposals.sections")}</Label>
      <p className="text-xs text-muted-foreground">{t("proposals.reorderHint")}</p>
      <Accordion type="multiple" className="w-full rounded-lg border px-3">
        {sections.map((section, index) => (
          <AccordionItem
            key={section.id}
            value={section.id}
            className={cn(
              dragIndex === index && "opacity-50",
              dropIndex === index &&
                dragIndex !== null &&
                dragIndex !== index &&
                "border-t-2 border-t-primary",
            )}
            onDragOver={onDragOver(index)}
            onDrop={onDrop(index)}
          >
            <AccordionTrigger className="hover:no-underline">
              <span className="flex flex-1 items-center justify-between gap-3 pr-2 text-left">
                <span className="flex min-w-0 items-center gap-2">
                  <DragHandle
                    index={index}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                  <span className="font-medium">
                    {section.number}. {section.title}
                  </span>
                </span>
                <span
                  className="flex items-center gap-2 text-xs font-normal text-muted-foreground"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <span>{t("proposals.sectionVisible")}</span>
                  <Switch
                    checked={section.visible}
                    onCheckedChange={(checked) =>
                      onChange(
                        sections.map((s) =>
                          s.id === section.id ? { ...s, visible: checked } : s,
                        ),
                      )
                    }
                  />
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="space-y-1.5">
                <Label>{t("proposals.titleField")}</Label>
                <Input
                  value={section.title}
                  onChange={(e) =>
                    onChange(
                      sections.map((s) =>
                        s.id === section.id ? { ...s, title: e.target.value } : s,
                      ),
                    )
                  }
                />
              </div>
              {section.blocks.map((block) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  onChange={(next) =>
                    onChange(updateBlock(sections, section.id, block.id, next))
                  }
                />
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
}: {
  block: ProposalBlock;
  onChange: (block: ProposalBlock) => void;
}) {
  const { t } = useTranslation();

  if (block.type === "paragraph") {
    return (
      <div className="space-y-1.5">
        <Label className="text-muted-foreground">{t("proposals.blockParagraph")}</Label>
        <Textarea
          value={block.text}
          rows={3}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      </div>
    );
  }

  if (block.type === "callout") {
    return (
      <div className="space-y-2 rounded-md border bg-muted/30 p-3">
        <Label className="text-muted-foreground">{t("proposals.blockCallout")}</Label>
        <Input
          value={block.label}
          placeholder={t("proposals.calloutLabel")}
          onChange={(e) => onChange({ ...block, label: e.target.value })}
        />
        <Textarea
          value={block.text}
          rows={2}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      </div>
    );
  }

  if (block.type === "bullets" || block.type === "steps") {
    return (
      <ListBlockEditor
        block={block}
        onChange={onChange}
      />
    );
  }

  if (block.type === "table") {
    return (
      <div className="space-y-2">
        <Label className="text-muted-foreground">{t("proposals.blockTable")}</Label>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${block.headers.length}, minmax(0, 1fr))` }}>
          {block.headers.map((header, hi) => (
            <Input
              key={`h-${hi}`}
              value={header}
              className="font-medium"
              onChange={(e) => {
                const headers = [...block.headers];
                headers[hi] = e.target.value;
                onChange({ ...block, headers });
              }}
            />
          ))}
        </div>
        {block.rows.map((row, ri) => (
          <div key={`r-${ri}`} className="flex gap-2">
            <div
              className="grid flex-1 gap-2"
              style={{ gridTemplateColumns: `repeat(${block.headers.length}, minmax(0, 1fr))` }}
            >
              {block.headers.map((_, ci) => (
                <Input
                  key={`c-${ri}-${ci}`}
                  value={row[ci] ?? ""}
                  onChange={(e) => {
                    const rows = block.rows.map((r) => [...r]);
                    rows[ri][ci] = e.target.value;
                    onChange({ ...block, rows });
                  }}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                onChange({
                  ...block,
                  rows: block.rows.filter((_, i) => i !== ri),
                })
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            onChange({
              ...block,
              rows: [...block.rows, block.headers.map(() => "")],
            })
          }
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("proposals.addTableRow")}
        </Button>
      </div>
    );
  }

  return null;
}

function ListBlockEditor({
  block,
  onChange,
}: {
  block: Extract<ProposalBlock, { type: "bullets" | "steps" }>;
  onChange: (block: ProposalBlock) => void;
}) {
  const { t } = useTranslation();
  const {
    dragIndex,
    dropIndex,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  } = useListReorder(block.items, (items) => onChange({ ...block, items }));

  const label =
    block.type === "bullets" ? t("proposals.blockBullets") : t("proposals.blockSteps");

  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground">{label}</Label>
      {block.items.map((item, idx) => (
        <div
          key={`${block.id}-${idx}`}
          className={cn(
            "flex items-center gap-2 rounded-md",
            dragIndex === idx && "opacity-50",
            dropIndex === idx &&
              dragIndex !== null &&
              dragIndex !== idx &&
              "border-t-2 border-t-primary",
          )}
          onDragOver={onDragOver(idx)}
          onDrop={onDrop(idx)}
        >
          <DragHandle index={idx} onDragStart={onDragStart} onDragEnd={onDragEnd} />
          <Input
            value={item}
            onChange={(e) => {
              const items = [...block.items];
              items[idx] = e.target.value;
              onChange({ ...block, items });
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() =>
              onChange({
                ...block,
                items: block.items.filter((_, i) => i !== idx),
              })
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onChange({ ...block, items: [...block.items, ""] })}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {t("proposals.addBullet")}
      </Button>
    </div>
  );
}
