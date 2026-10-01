export type BrandFontOption = {
  id: string;
  family: string;
  category: "sans" | "serif" | "display";
};

/** Curated Google Fonts used in the brand kit and on-image text editor. */
export const BRAND_FONT_OPTIONS: BrandFontOption[] = [
  { id: "Montserrat", family: "Montserrat", category: "sans" },
  { id: "Inter", family: "Inter", category: "sans" },
  { id: "Poppins", family: "Poppins", category: "sans" },
  { id: "Nunito", family: "Nunito", category: "sans" },
  { id: "Lato", family: "Lato", category: "sans" },
  { id: "Open Sans", family: "Open Sans", category: "sans" },
  { id: "Roboto", family: "Roboto", category: "sans" },
  { id: "Work Sans", family: "Work Sans", category: "sans" },
  { id: "DM Sans", family: "DM Sans", category: "sans" },
  { id: "Manrope", family: "Manrope", category: "sans" },
  { id: "Outfit", family: "Outfit", category: "sans" },
  { id: "Raleway", family: "Raleway", category: "sans" },
  { id: "Barlow", family: "Barlow", category: "sans" },
  { id: "Archivo", family: "Archivo", category: "sans" },
  { id: "Space Grotesk", family: "Space Grotesk", category: "sans" },
  { id: "Oswald", family: "Oswald", category: "sans" },
  { id: "Playfair Display", family: "Playfair Display", category: "serif" },
  { id: "Lora", family: "Lora", category: "serif" },
  { id: "Merriweather", family: "Merriweather", category: "serif" },
  { id: "Libre Baskerville", family: "Libre Baskerville", category: "serif" },
  { id: "PT Serif", family: "PT Serif", category: "serif" },
  { id: "Cormorant Garamond", family: "Cormorant Garamond", category: "serif" },
  { id: "Source Serif 4", family: "Source Serif 4", category: "serif" },
  { id: "Cinzel", family: "Cinzel", category: "display" },
  { id: "Bebas Neue", family: "Bebas Neue", category: "display" },
];

const FONT_LINK_ID = "som-brand-google-fonts";
/** Families whose Google stylesheet request finished successfully. */
const loadedGoogleFamilies = new Set<string>();
/** In-flight Google stylesheet loads (family list key → promise). */
const pendingGoogleLoads = new Map<string, Promise<void>>();
/** family::url → loaded */
const loadedFileFonts = new Set<string>();

export type BrandFontFileMap = Record<string, string>;

export function brandFontFamilyCss(family: string) {
  const trimmed = family.trim();
  return trimmed ? `"${trimmed}", system-ui, sans-serif` : "system-ui, sans-serif";
}

export function isGoogleBrandFont(value: string | undefined | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return false;
  return BRAND_FONT_OPTIONS.some((font) => font.family.toLowerCase() === trimmed.toLowerCase());
}

export function resolveBrandFont(value: string | undefined | null, fallback = "Montserrat") {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return fallback;
  const match = BRAND_FONT_OPTIONS.find(
    (font) => font.family.toLowerCase() === trimmed.toLowerCase(),
  );
  return match?.family ?? trimmed;
}

export function fontOptionsForSelect(stored?: string | null): BrandFontOption[] {
  const trimmed = (stored ?? "").trim();
  if (!trimmed) return BRAND_FONT_OPTIONS;
  if (BRAND_FONT_OPTIONS.some((font) => font.family.toLowerCase() === trimmed.toLowerCase())) {
    return BRAND_FONT_OPTIONS;
  }
  return [{ id: trimmed, family: trimmed, category: "sans" }, ...BRAND_FONT_OPTIONS];
}

/** Build family → file URL map from brand kit fonts. */
export function brandFontsToFileMap(fonts: {
  primary?: string | null;
  secondary?: string | null;
  primaryFileUrl?: string | null;
  secondaryFileUrl?: string | null;
}): BrandFontFileMap {
  const map: BrandFontFileMap = {};
  const primary = (fonts.primary ?? "").trim();
  const secondary = (fonts.secondary ?? "").trim();
  const primaryUrl = (fonts.primaryFileUrl ?? "").trim();
  const secondaryUrl = (fonts.secondaryFileUrl ?? "").trim();
  if (primary && primaryUrl) map[primary] = primaryUrl;
  if (secondary && secondaryUrl) map[secondary] = secondaryUrl;
  return map;
}

function googleFontsCssUrl(families: string[]) {
  const unique = [...new Set(families.map((name) => name.trim()).filter(Boolean))];
  if (unique.length === 0) return "";
  const query = unique
    .map((family) => `family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

function waitForStylesheet(link: HTMLLinkElement): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      link.removeEventListener("load", finish);
      link.removeEventListener("error", finish);
      resolve();
    };
    // Already parsed (cached / synchronous).
    if (link.sheet) {
      finish();
      return;
    }
    link.addEventListener("load", finish);
    link.addEventListener("error", finish);
    window.setTimeout(finish, 5000);
  });
}

async function ensureGoogleFontsStylesheet(families: string[]) {
  const needed = families.filter((family) => !loadedGoogleFamilies.has(family));
  if (needed.length === 0) return;

  const key = needed.slice().sort().join("|");
  const existing = pendingGoogleLoads.get(key);
  if (existing) {
    await existing;
    return;
  }

  const task = (async () => {
    const all = [...new Set([...loadedGoogleFamilies, ...needed])].sort();
    const href = googleFontsCssUrl(all);
    if (!href) return;

    let link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
    const hrefChanged = !link || link.href !== href;
    if (!link) {
      link = document.createElement("link");
      link.id = FONT_LINK_ID;
      link.rel = "stylesheet";
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }
    if (hrefChanged) {
      link.href = href;
      await waitForStylesheet(link);
    }

    await Promise.all(
      needed.map(async (family) => {
        try {
          await Promise.all([
            document.fonts.load(`400 48px "${family}"`),
            document.fonts.load(`700 48px "${family}"`),
          ]);
        } catch {
          // ignore individual failures
        }
        // Only mark loaded when the face is actually available.
        if (
          document.fonts.check(`400 48px "${family}"`) ||
          document.fonts.check(`700 48px "${family}"`)
        ) {
          loadedGoogleFamilies.add(family);
        }
      }),
    );
  })().finally(() => {
    pendingGoogleLoads.delete(key);
  });

  pendingGoogleLoads.set(key, task);
  await task;
}

async function loadCustomFontFace(family: string, fileUrl: string) {
  const key = `${family}::${fileUrl}`;
  if (loadedFileFonts.has(key)) return;
  try {
    const face = new FontFace(family, `url(${JSON.stringify(fileUrl)})`, {
      style: "normal",
      weight: "100 900",
      display: "swap",
    });
    const loaded = await face.load();
    document.fonts.add(loaded);
    loadedFileFonts.add(key);
  } catch {
    // Fallback: fetch as blob (helps when url() hits CORS quirks).
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) return;
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const face = new FontFace(family, `url(${JSON.stringify(objectUrl)})`, {
        style: "normal",
        weight: "100 900",
        display: "swap",
      });
      const loaded = await face.load();
      document.fonts.add(loaded);
      loadedFileFonts.add(key);
    } catch {
      // Leave unloaded; CSS will fall back to system-ui.
    }
  }
}

/**
 * Load brand fonts for preview/canvas.
 * - Names in BRAND_FONT_OPTIONS → Google Fonts stylesheet (waits for load)
 * - Other names → only via FontFace when a file URL is provided in fileUrls
 */
export async function loadBrandFonts(families: string[], fileUrls?: BrandFontFileMap) {
  if (typeof document === "undefined") return;

  const wanted = [...new Set(families.map((name) => name.trim()).filter(Boolean))];
  if (wanted.length === 0) {
    await document.fonts.ready;
    return;
  }

  const googleWanted = wanted.filter((family) => isGoogleBrandFont(family));
  const customWanted = wanted.filter((family) => !isGoogleBrandFont(family));

  if (googleWanted.length > 0) {
    await ensureGoogleFontsStylesheet(googleWanted);
  }

  await Promise.all(
    customWanted.map(async (family) => {
      const url = fileUrls?.[family]?.trim() || "";
      if (!url) return;
      await loadCustomFontFace(family, url);
      try {
        await Promise.all([
          document.fonts.load(`400 48px "${family}"`),
          document.fonts.load(`700 48px "${family}"`),
        ]);
      } catch {
        // ignore
      }
    }),
  );

  await document.fonts.ready;
}
