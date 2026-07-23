import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
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
};

export function PresetField({
  id,
  label,
  value,
  onChange,
  presets,
  disabled,
  selectLabel,
  emptyPresetsLabel,
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
              {presets.map((preset) => (
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
