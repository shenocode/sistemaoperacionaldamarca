import { useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type PresetCreateConfig = {
  onCreate: (value: string) => void | Promise<void>;
  label: string;
  title: string;
  hint: string;
  placeholder: string;
  saveLabel: string;
  cancelLabel: string;
};

type PresetFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  presets: string[];
  disabled?: boolean;
  selectLabel: string;
  emptyPresetsLabel: string;
  /** When true, presets can be toggled on/off and combined in the value. */
  multiple?: boolean;
  labelVariant?: "default" | "highlight";
  create?: PresetCreateConfig;
};

function normalizeSpaces(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function tokensOf(text: string) {
  return normalizeSpaces(text).split(" ").filter(Boolean);
}

function isPresetSelected(value: string, preset: string) {
  const normalizedPreset = normalizeSpaces(preset);
  if (!normalizedPreset) return false;
  if (!normalizedPreset.includes(" ")) {
    return tokensOf(value).includes(normalizedPreset);
  }
  return ` ${normalizeSpaces(value)} `.includes(` ${normalizedPreset} `);
}

function togglePreset(value: string, preset: string, checked: boolean) {
  const normalizedValue = normalizeSpaces(value);
  const normalizedPreset = normalizeSpaces(preset);
  if (!normalizedPreset) return normalizedValue;

  if (!normalizedPreset.includes(" ")) {
    const tokens = tokensOf(normalizedValue);
    const has = tokens.includes(normalizedPreset);
    if (checked) {
      return has ? normalizedValue : [...tokens, normalizedPreset].join(" ");
    }
    return tokens.filter((token) => token !== normalizedPreset).join(" ");
  }

  if (checked) {
    if (isPresetSelected(normalizedValue, normalizedPreset)) return normalizedValue;
    return [normalizedValue, normalizedPreset].filter(Boolean).join(" ");
  }

  const padded = ` ${normalizedValue} `;
  const target = ` ${normalizedPreset} `;
  const idx = padded.indexOf(target);
  if (idx === -1) return normalizedValue;
  return normalizeSpaces(
    `${padded.slice(0, idx)} ${padded.slice(idx + target.length)}`,
  );
}

function isExistingPreset(presets: string[], value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return presets.some((preset) => preset.trim().toLowerCase() === normalized);
}

export function PresetField({
  id,
  label,
  value,
  onChange,
  onBlur,
  presets,
  disabled,
  selectLabel,
  emptyPresetsLabel,
  multiple = false,
  labelVariant = "default",
  create,
}: PresetFieldProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const canCreate = Boolean(create) && !disabled;
  const showMenu = presets.length > 0 || canCreate;

  const applyValue = (next: string) => {
    valueRef.current = next;
    onChange(next);
  };

  const openCreate = () => {
    const trimmed = value.trim();
    setDraft(trimmed && !isExistingPreset(presets, trimmed) ? trimmed : "");
    setDialogOpen(true);
  };

  const closeCreate = () => {
    if (creating) return;
    setDialogOpen(false);
    setDraft("");
  };

  const submitCreate = async () => {
    const next = draft.trim();
    if (!next || !create) return;
    setCreating(true);
    try {
      await create.onCreate(next);
      applyValue(multiple ? togglePreset(valueRef.current, next, true) : next);
      setDialogOpen(false);
      setDraft("");
    } catch {
      // Parent surfaces the error; keep the dialog open to retry.
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} variant={labelVariant}>
        {label}
      </Label>
      <div className="flex">
        <Input
          id={id}
          value={value}
          onChange={(e) => applyValue(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          className={cn(showMenu && "rounded-r-none")}
        />
        {showMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-l-none border-l-0"
                disabled={disabled}
                aria-label={selectLabel}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-w-sm">
              {multiple
                ? presets.map((preset) => (
                    <DropdownMenuCheckboxItem
                      key={preset}
                      className="whitespace-normal break-words"
                      checked={isPresetSelected(value, preset)}
                      onCheckedChange={(checked) =>
                        applyValue(
                          togglePreset(valueRef.current, preset, checked === true),
                        )
                      }
                      onSelect={(event) => event.preventDefault()}
                    >
                      {preset}
                    </DropdownMenuCheckboxItem>
                  ))
                : presets.map((preset) => (
                    <DropdownMenuItem
                      key={preset}
                      className="whitespace-normal break-words"
                      onSelect={() => applyValue(preset)}
                    >
                      {preset}
                    </DropdownMenuItem>
                  ))}
              {canCreate && create ? (
                <>
                  {presets.length > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem onSelect={openCreate}>
                    <Plus className="h-4 w-4" />
                    {create.label}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {presets.length === 0 && !disabled ? (
        <p className="text-xs text-muted-foreground">{emptyPresetsLabel}</p>
      ) : null}

      {create ? (
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open) closeCreate();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{create.title}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitCreate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-new-preset`}>{label}</Label>
                <Input
                  id={`${id}-new-preset`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={create.placeholder}
                  autoFocus
                  required
                  disabled={creating}
                />
                <p className="text-xs text-muted-foreground">{create.hint}</p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={creating}
                  onClick={closeCreate}
                >
                  {create.cancelLabel}
                </Button>
                <Button type="submit" disabled={creating || !draft.trim()}>
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  {create.saveLabel}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
