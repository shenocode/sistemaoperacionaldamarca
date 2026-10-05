/** Canvas ratios used by the design assistant and template library. */

export const DESIGN_ASPECT_RATIOS = ["4:5", "9:16", "16:9", "1:1", "3:4"] as const;

export type DesignAspectRatio = (typeof DESIGN_ASPECT_RATIOS)[number];

export type DesignCanvasSpec = {
  aspect: DesignAspectRatio;
  pixels: string;
  width: number;
  height: number;
  orientation: "retrato" | "paisagem" | "quadrado";
  openaiSize: "1024x1024" | "1024x1536" | "1536x1024";
  forbidden: string;
  uses: string;
};

const CANVAS: Record<DesignAspectRatio, Omit<DesignCanvasSpec, "aspect">> = {
  "4:5": {
    pixels: "1080×1350",
    width: 1080,
    height: 1350,
    orientation: "retrato",
    openaiSize: "1024x1536",
    forbidden: "Proibido 1:1, 16:9 e 9:16.",
    uses: "feed Instagram e carrossel",
  },
  "9:16": {
    pixels: "1080×1920",
    width: 1080,
    height: 1920,
    orientation: "retrato",
    openaiSize: "1024x1536",
    forbidden: "Proibido 4:5, 1:1 e 16:9.",
    uses: "stories, reels e shorts",
  },
  "16:9": {
    pixels: "1920×1080",
    width: 1920,
    height: 1080,
    orientation: "paisagem",
    openaiSize: "1536x1024",
    forbidden: "Proibido 9:16, 4:5 e 1:1.",
    uses: "YouTube, vídeo horizontal e thumbnail",
  },
  "1:1": {
    pixels: "1080×1080",
    width: 1080,
    height: 1080,
    orientation: "quadrado",
    openaiSize: "1024x1024",
    forbidden: "Proibido 4:5, 9:16 e 16:9.",
    uses: "quadrado (ads, perfil, carrossel)",
  },
  "3:4": {
    pixels: "1080×1440",
    width: 1080,
    height: 1440,
    orientation: "retrato",
    openaiSize: "1024x1536",
    forbidden: "Proibido 16:9 e 1:1.",
    uses: "retrato / peça impressa",
  },
};

const FORMAT_DEFAULT_ASPECT: Record<string, DesignAspectRatio> = {
  static_feed: "4:5",
  carousel: "4:5",
  stories: "9:16",
  reels: "9:16",
  youtube_short: "9:16",
  recorded_video: "16:9",
  print_material: "3:4",
};

export function isDesignAspectRatio(value: unknown): value is DesignAspectRatio {
  return typeof value === "string" && (DESIGN_ASPECT_RATIOS as readonly string[]).includes(value);
}

export function parseDesignAspectRatio(
  value: unknown,
  fallback: DesignAspectRatio = "4:5",
): DesignAspectRatio {
  return isDesignAspectRatio(value) ? value : fallback;
}

export function defaultAspectForFormat(format?: string | null): DesignAspectRatio {
  if (!format) return "4:5";
  return FORMAT_DEFAULT_ASPECT[format] ?? "4:5";
}

export function designCanvasSpec(aspect: DesignAspectRatio): DesignCanvasSpec {
  return { aspect, ...CANVAS[aspect] };
}

export function designAspectCss(aspect: DesignAspectRatio): string {
  switch (aspect) {
    case "9:16":
      return "aspect-[9/16]";
    case "16:9":
      return "aspect-video";
    case "1:1":
      return "aspect-square";
    case "3:4":
      return "aspect-[3/4]";
    default:
      return "aspect-[4/5]";
  }
}

export function designAspectPreviewClass(
  aspect: DesignAspectRatio,
  size: "sm" | "md" = "md",
): string {
  const ratio = designAspectCss(aspect);
  if (size === "sm") {
    if (aspect === "16:9") return `w-44 ${ratio}`;
    if (aspect === "9:16") return `w-28 ${ratio}`;
    if (aspect === "1:1") return `w-32 ${ratio}`;
    return `w-40 ${ratio}`;
  }
  if (aspect === "16:9") return `mx-auto w-full max-w-2xl ${ratio}`;
  if (aspect === "9:16") return `mx-auto w-full max-w-[320px] ${ratio}`;
  if (aspect === "1:1") return `mx-auto w-full max-w-[420px] ${ratio}`;
  return `mx-auto w-full max-w-[420px] ${ratio}`;
}

export function designAspectI18nKey(aspect: DesignAspectRatio): string {
  return aspect.replace(":", "x");
}

export function designAspectThumbClass(aspect: DesignAspectRatio): string {
  switch (aspect) {
    case "9:16":
      return "h-14 w-8";
    case "16:9":
      return "h-9 w-16";
    case "1:1":
      return "h-12 w-12";
    case "3:4":
      return "h-14 w-10";
    default:
      return "h-12 w-9";
  }
}
