import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type PresetFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  presets: string[];
  disabled?: boolean;
  selectLabel: string;
  emptyPresetsLabel: string;
  /** When true, presets can be toggled on/off and combined in the value. */
  multiple?: boolean;
};

function normalizeSpaces(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function isPresetSelected(value: string, preset: string) {
  const normalizedPreset = normalizeSpaces(preset);
  if (!normalizedPreset) return false;
  return ` ${normalizeSpaces(value)} `.includes(` ${normalizedPreset} `);
}

function togglePreset(value: string, preset: string, checked: boolean) {
  const normalizedValue = normalizeSpaces(value);
  const normalizedPreset = normalizeSpaces(preset);
  if (!normalizedPreset) return normalizedValue;

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

export function PresetField({
  id,
  label,
  value,
  onChange,
  presets,
  disabled,
  selectLabel,
  emptyPresetsLabel,
  multiple = false,
}: PresetFieldProps) {
  const hasPresets = presets.length > 0;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(hasPresets && "rounded-r-none")}
        />
        {hasPresets ? (
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
                        onChange(togglePreset(value, preset, checked === true))
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
                      onSelect={() => onChange(preset)}
                    >
                      {preset}
                    </DropdownMenuItem>
                  ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {!hasPresets && !disabled ? (
        <p className="text-xs text-muted-foreground">{emptyPresetsLabel}</p>
      ) : null}
    </div>
  );
}
