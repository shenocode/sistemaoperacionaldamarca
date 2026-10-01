import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** Full mark — black artwork (light surfaces). */
const LOGO_SRC = "/brand/som-logo.png";
/** Full mark — white artwork (dark surfaces). */
const LOGO_ON_DARK_SRC = "/brand/som-logo-on-dark.png";
/** Symbol — black artwork (light surfaces). */
const MARK_SRC = "/brand/som-mark.png";
/** Symbol — white artwork (dark surfaces). */
const MARK_ON_DARK_SRC = "/brand/som-mark-on-dark.png";

type Size = "sm" | "md" | "lg" | "hero";

type SomLogoProps = {
  className?: string;
  size?: Size;
  /** Icon-only mark (no wordmark). */
  variant?: "full" | "mark";
  title?: string;
  alt?: string;
  priority?: boolean;
  /** Use official white artwork for dark surfaces. */
  onDark?: boolean;
  /** Wrap in a link to home. Defaults to true. */
  asLink?: boolean;
  linkClassName?: string;
  onClick?: () => void;
};

const FULL_SIZE: Record<Size, string> = {
  sm: "h-14 w-auto",
  md: "h-20 w-auto sm:h-24",
  lg: "h-28 w-auto sm:h-32",
  hero: "h-[9.5rem] w-auto sm:h-[11.5rem] lg:h-[13.5rem]",
};

const MARK_SIZE: Record<Size, string> = {
  sm: "h-8 w-auto",
  md: "h-10 w-auto",
  lg: "h-12 w-auto",
  hero: "h-16 w-auto sm:h-20",
};

function HomeLink({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to="/"
      onClick={onClick}
      className={cn(
        "inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      aria-label={label}
    >
      {children}
    </Link>
  );
}

/** Official SOM wordmark (organic symbol + stacked wordmark). */
export function SomLogo({
  className,
  size = "md",
  variant = "full",
  title,
  alt,
  priority = false,
  onDark = false,
  asLink = true,
  linkClassName,
  onClick,
}: SomLogoProps) {
  const label = alt ?? title ?? "SOM — Sistema Operacional da Marca";

  const image =
    variant === "mark" ? (
      <img
        src={onDark ? MARK_ON_DARK_SRC : MARK_SRC}
        alt={asLink ? "" : label}
        title={title}
        width={308}
        height={397}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        className={cn("shrink-0 object-contain", MARK_SIZE[size], className)}
      />
    ) : (
      <img
        src={onDark ? LOGO_ON_DARK_SRC : LOGO_SRC}
        alt={asLink ? "" : label}
        title={title}
        width={onDark ? 760 : 1024}
        height={onDark ? 533 : 1024}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        className={cn(
          "shrink-0 object-contain object-left",
          FULL_SIZE[size],
          className,
        )}
      />
    );

  if (!asLink) return image;

  return (
    <HomeLink label={label} className={linkClassName} onClick={onClick}>
      {image}
    </HomeLink>
  );
}

type SomMarkProps = {
  className?: string;
  title?: string;
  /** Use white artwork for dark backgrounds. */
  onDark?: boolean;
  /** Wrap in a link to home. Defaults to true. */
  asLink?: boolean;
  linkClassName?: string;
  onClick?: () => void;
  "aria-hidden"?: boolean | "true" | "false";
};

/** Official SOM symbol (organic mark). */
export function SomMark({
  className,
  title,
  onDark = false,
  asLink = true,
  linkClassName,
  onClick,
  ...rest
}: SomMarkProps) {
  const hidden = Boolean(rest["aria-hidden"]);
  const label = title ?? "SOM";
  const shouldLink = asLink && !hidden;

  const image = (
    <img
      src={onDark ? MARK_ON_DARK_SRC : MARK_SRC}
      alt={shouldLink || hidden ? "" : label}
      title={title}
      width={308}
      height={397}
      decoding="async"
      className={cn("shrink-0 object-contain", className)}
      {...rest}
    />
  );

  if (!shouldLink) return image;

  return (
    <HomeLink label={label} className={linkClassName} onClick={onClick}>
      {image}
    </HomeLink>
  );
}
