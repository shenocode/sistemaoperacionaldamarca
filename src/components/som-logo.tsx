import { cn } from "@/lib/utils";

const LOGO_SRC = "/brand/som-logo.png";
/** Official mark from the provided icon (transparent PNG). */
const MARK_SRC = "/brand/som-mark.png";

type Size = "sm" | "md" | "lg" | "hero";

type SomLogoProps = {
  className?: string;
  size?: Size;
  /** Icon-only mark (no wordmark). */
  variant?: "full" | "mark";
  title?: string;
  alt?: string;
  priority?: boolean;
};

const FULL_SIZE: Record<Size, string> = {
  sm: "h-8 w-auto",
  md: "h-10 w-auto sm:h-11",
  lg: "h-14 w-auto sm:h-16",
  hero: "h-[4.75rem] w-auto sm:h-24 lg:h-[7.25rem]",
};

const MARK_SIZE: Record<Size, string> = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
  hero: "h-16 w-16 sm:h-20",
};

/** Official SOM wordmark (image includes tagline). */
export function SomLogo({
  className,
  size = "md",
  variant = "full",
  title,
  alt,
  priority = false,
}: SomLogoProps) {
  const label = alt ?? title ?? "SOM — Sistema Operacional da Marca";

  if (variant === "mark") {
    return (
      <img
        src={MARK_SRC}
        alt={label}
        title={title}
        width={272}
        height={269}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        className={cn("shrink-0 object-contain", MARK_SIZE[size], className)}
      />
    );
  }

  return (
    <img
      src={LOGO_SRC}
      alt={label}
      title={title}
      width={794}
      height={425}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      className={cn("shrink-0 object-contain object-left", FULL_SIZE[size], className)}
    />
  );
}

type SomMarkProps = {
  className?: string;
  title?: string;
  "aria-hidden"?: boolean | "true" | "false";
};

/** Official SOM mark (concentric O). */
export function SomMark({ className, title, ...rest }: SomMarkProps) {
  return (
    <img
      src={MARK_SRC}
      alt={rest["aria-hidden"] ? "" : (title ?? "SOM")}
      title={title}
      width={272}
      height={269}
      decoding="async"
      className={cn("shrink-0 object-contain", className)}
      {...rest}
    />
  );
}
