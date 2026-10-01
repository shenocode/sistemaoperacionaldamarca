export type BrandFontOption = {
  id: string;
  family: string;
  category: "sans" | "serif" | "display";
  /** google = CDN; kit = nome curado que exige arquivo da marca (licença comercial). */
  source: "google" | "kit";
};

/** Free Google Fonts — load without upload. */
export const BRAND_GOOGLE_FONT_OPTIONS: BrandFontOption[] = [
  { id: "Montserrat", family: "Montserrat", category: "sans", source: "google" },
  { id: "Inter", family: "Inter", category: "sans", source: "google" },
  { id: "Poppins", family: "Poppins", category: "sans", source: "google" },
  { id: "Nunito", family: "Nunito", category: "sans", source: "google" },
  { id: "Lato", family: "Lato", category: "sans", source: "google" },
  { id: "Open Sans", family: "Open Sans", category: "sans", source: "google" },
  { id: "Roboto", family: "Roboto", category: "sans", source: "google" },
  { id: "Work Sans", family: "Work Sans", category: "sans", source: "google" },
  { id: "DM Sans", family: "DM Sans", category: "sans", source: "google" },
  { id: "Manrope", family: "Manrope", category: "sans", source: "google" },
  { id: "Outfit", family: "Outfit", category: "sans", source: "google" },
  { id: "Raleway", family: "Raleway", category: "sans", source: "google" },
  { id: "Barlow", family: "Barlow", category: "sans", source: "google" },
  { id: "Archivo", family: "Archivo", category: "sans", source: "google" },
  { id: "Space Grotesk", family: "Space Grotesk", category: "sans", source: "google" },
  { id: "Oswald", family: "Oswald", category: "sans", source: "google" },
  { id: "Playfair Display", family: "Playfair Display", category: "serif", source: "google" },
  { id: "Lora", family: "Lora", category: "serif", source: "google" },
  { id: "Merriweather", family: "Merriweather", category: "serif", source: "google" },
  { id: "Libre Baskerville", family: "Libre Baskerville", category: "serif", source: "google" },
  { id: "PT Serif", family: "PT Serif", category: "serif", source: "google" },
  { id: "Cormorant Garamond", family: "Cormorant Garamond", category: "serif", source: "google" },
  { id: "Source Serif 4", family: "Source Serif 4", category: "serif", source: "google" },
  { id: "Cinzel", family: "Cinzel", category: "display", source: "google" },
  { id: "Bebas Neue", family: "Bebas Neue", category: "display", source: "google" },
];

/**
 * Commercial / licensed names shown in the kit picker.
 * Cannot be bundled or loaded from Google — the brand must upload its licensed file.
 */
export const BRAND_KIT_FONT_OPTIONS: BrandFontOption[] = [
  { id: "The Seasons", family: "The Seasons", category: "serif", source: "kit" },
  { id: "Gill Sans", family: "Gill Sans", category: "sans", source: "kit" },
  { id: "Gotham", family: "Gotham", category: "sans", source: "kit" },
  { id: "Futura", family: "Futura", category: "sans", source: "kit" },
  { id: "Proxima Nova", family: "Proxima Nova", category: "sans", source: "kit" },
  { id: "Avenir", family: "Avenir", category: "sans", source: "kit" },
  { id: "Helvetica Neue", family: "Helvetica Neue", category: "sans", source: "kit" },
  { id: "Didot", family: "Didot", category: "serif", source: "kit" },
  { id: "Bodoni", family: "Bodoni", category: "serif", source: "kit" },
  { id: "Garamond", family: "Garamond", category: "serif", source: "kit" },
];

/** Full catalog for selects (kit commercial first, then Google). */
export const BRAND_FONT_OPTIONS: BrandFontOption[] = [
  ...BRAND_KIT_FONT_OPTIONS,
  ...BRAND_GOOGLE_FONT_OPTIONS,
];

const FONT_LINK_ID = "som-brand-google-fonts";
/** Families whose Google stylesheet request finished successfully. */
const loadedGoogleFamilies = new Set<string>();
/** In-flight Google stylesheet loads (family list key → promise). */
const pendingGoogleLoads = new Map<string, Promise<void>>();
/** family::url → loaded */
const loadedFileFonts = new Set<string>();

/** family → preferred file URL (legacy single-url consumers). */
export type BrandFontFileMap = Record<string, string>;
/** family → all uploaded weight/style faces. */
export type BrandFontFaceMap = Record<
  string,
  Array<{ fileUrl: string; weight: string; style: "normal" | "italic"; label: string }>
>;

export function brandFontFamilyCss(family: string) {
  const trimmed = family.trim();
  return trimmed ? `"${trimmed}", system-ui, sans-serif` : "system-ui, sans-serif";
}

export function isGoogleBrandFont(value: string | undefined | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return false;
  return BRAND_GOOGLE_FONT_OPTIONS.some(
    (font) => font.family.toLowerCase() === trimmed.toLowerCase(),
  );
}

/** True when the face cannot be loaded from Google and needs a kit file upload. */
export function brandFontNeedsFile(value: string | undefined | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return false;
  return !isGoogleBrandFont(trimmed);
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
  return [
    { id: trimmed, family: trimmed, category: "sans", source: "kit" },
    ...BRAND_FONT_OPTIONS,
  ];
}

/** All family names declared in the brand kit (primary + secondaries + extras). */
export function listBrandFontFamilies(fonts: {
  primary?: string | null;
  secondary?: string | null;
  extras?: Array<{ family?: string | null }> | null;
}): string[] {
  const names = [
    (fonts.primary ?? "").trim(),
    (fonts.secondary ?? "").trim(),
    ...(fonts.extras ?? []).map((entry) => (entry?.family ?? "").trim()),
  ];
  return [...new Set(names.filter(Boolean))];
}

type FontsWithFaces = {
  primary?: string | null;
  secondary?: string | null;
  primaryFileUrl?: string | null;
  secondaryFileUrl?: string | null;
  primaryFaces?: Array<{
    fileUrl?: string | null;
    weight?: string | null;
    style?: string | null;
    label?: string | null;
  }> | null;
  secondaryFaces?: Array<{
    fileUrl?: string | null;
    weight?: string | null;
    style?: string | null;
    label?: string | null;
  }> | null;
  extras?: Array<{
    family?: string | null;
    fileUrl?: string | null;
    faces?: Array<{
      fileUrl?: string | null;
      weight?: string | null;
      style?: string | null;
      label?: string | null;
    }> | null;
  }> | null;
};

function normalizeFaceList(
  faces:
    | Array<{
        fileUrl?: string | null;
        weight?: string | null;
        style?: string | null;
        label?: string | null;
      }>
    | null
    | undefined,
  fallbackUrl?: string | null,
): BrandFontFaceMap[string] {
  const list = (faces ?? [])
    .map((face) => {
      const fileUrl = (face?.fileUrl ?? "").trim();
      if (!fileUrl) return null;
      const weight = String(face?.weight || "400").trim() || "400";
      const style = face?.style === "italic" ? ("italic" as const) : ("normal" as const);
      const label =
        (face?.label ?? "").trim() || (style === "italic" ? "Italic" : "Regular");
      return { fileUrl, weight, style, label };
    })
    .filter(Boolean) as BrandFontFaceMap[string];
  if (list.length > 0) return list;
  const url = (fallbackUrl ?? "").trim();
  if (!url) return [];
  return [{ fileUrl: url, weight: "400", style: "normal", label: "Regular" }];
}

/** Build family → faces map from brand kit fonts. */
export function brandFontsToFaceMap(fonts: FontsWithFaces): BrandFontFaceMap {
  const map: BrandFontFaceMap = {};
  const primary = (fonts.primary ?? "").trim();
  const secondary = (fonts.secondary ?? "").trim();
  if (primary) {
    const faces = normalizeFaceList(fonts.primaryFaces, fonts.primaryFileUrl);
    if (faces.length) map[primary] = faces;
  }
  if (secondary) {
    const faces = normalizeFaceList(fonts.secondaryFaces, fonts.secondaryFileUrl);
    if (faces.length) map[secondary] = faces;
  }
  for (const entry of fonts.extras ?? []) {
    const family = (entry?.family ?? "").trim();
    if (!family) continue;
    const faces = normalizeFaceList(entry?.faces, entry?.fileUrl);
    if (faces.length) map[family] = faces;
  }
  return map;
}

/** Build family → preferred file URL map from brand kit fonts. */
export function brandFontsToFileMap(fonts: FontsWithFaces): BrandFontFileMap {
  const faceMap = brandFontsToFaceMap(fonts);
  const map: BrandFontFileMap = {};
  for (const [family, faces] of Object.entries(faceMap)) {
    const preferred =
      faces.find((face) => face.weight === "400" && face.style === "normal") ||
      faces.find((face) => face.style === "normal") ||
      faces[0];
    if (preferred?.fileUrl) map[family] = preferred.fileUrl;
  }
  return map;
}

export function facesForBrandFamily(fonts: FontsWithFaces, family: string | undefined | null) {
  const trimmed = (family ?? "").trim();
  if (!trimmed) return [];
  return brandFontsToFaceMap(fonts)[trimmed] ?? [];
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

async function loadCustomFontFace(
  family: string,
  fileUrl: string,
  weight = "100 900",
  style: "normal" | "italic" = "normal",
) {
  const key = `${family}::${style}::${weight}::${fileUrl}`;
  if (loadedFileFonts.has(key)) return;
  try {
    const face = new FontFace(family, `url(${JSON.stringify(fileUrl)})`, {
      style,
      weight,
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
        style,
        weight,
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
 * - Other names → FontFace via fileUrls and/or per-weight faces
 */
export async function loadBrandFonts(
  families: string[],
  fileUrls?: BrandFontFileMap,
  faces?: BrandFontFaceMap,
) {
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
      const faceList = faces?.[family] ?? [];
      if (faceList.length > 0) {
        await Promise.all(
          faceList.map(async (face) => {
            await loadCustomFontFace(family, face.fileUrl, face.weight, face.style);
            try {
              const stylePrefix = face.style === "italic" ? "italic " : "";
              await document.fonts.load(`${stylePrefix}${face.weight} 48px "${family}"`);
            } catch {
              // ignore
            }
          }),
        );
        return;
      }
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
