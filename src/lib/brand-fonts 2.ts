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
const loadedFamilies = new Set<string>();

export function brandFontFamilyCss(family: string) {
  const trimmed = family.trim();
  return trimmed ? `"${trimmed}", system-ui, sans-serif` : "system-ui, sans-serif";
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

function googleFontsCssUrl(families: string[]) {
  const unique = [...new Set(families.map((name) => name.trim()).filter(Boolean))];
  if (unique.length === 0) return "";
  const query = unique
    .map((family) => `family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

export async function loadBrandFonts(families: string[]) {
  if (typeof document === "undefined") return;
  const wanted = [...new Set(families.map((name) => name.trim()).filter(Boolean))].filter(
    (family) => !loadedFamilies.has(family),
  );
  if (wanted.length === 0) {
    await document.fonts.ready;
    return;
  }

  const href = googleFontsCssUrl(wanted);
  if (href) {
    let link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = FONT_LINK_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    const all = [...loadedFamilies, ...wanted];
    link.href = googleFontsCssUrl(all);
  }

  await Promise.all(
    wanted.map(async (family) => {
      try {
        await Promise.all([
          document.fonts.load(`400 48px "${family}"`),
          document.fonts.load(`700 48px "${family}"`),
        ]);
        loadedFamilies.add(family);
      } catch {
        loadedFamilies.add(family);
      }
    }),
  );
  await document.fonts.ready;
}
