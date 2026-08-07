import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      {children}
    </label>
  );
}

export function TextInput(props: React.ComponentProps<"input">) {
  return <Input {...props} />;
}

export function TextArea(props: React.ComponentProps<"textarea">) {
  return <Textarea rows={3} {...props} />;
}

export function SelectInput({
  value,
  onChange,
  children,
  className,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  placeholder?: string;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

export function SelectOption({ value, children }: { value: string; children: ReactNode }) {
  return <SelectItem value={value}>{children}</SelectItem>;
}

export function ChipGroup({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: string[];
  value: string | string[];
  onChange: (next: string | string[]) => void;
  multi?: boolean;
}) {
  const selected = Array.isArray(value) ? value : [value];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              if (multi) {
                const list = selected.filter(Boolean);
                const next = active ? list.filter((v) => v !== opt) : [...list, opt];
                onChange(next);
              } else {
                onChange(active ? "" : opt);
              }
            }}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
