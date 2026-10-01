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

const CONTENT_FORMATS = new Set(Object.keys(FORMAT_DEFAULT_ASPECT));

export function isContentFormat(value: unknown): value is string {
  return typeof value === "string" && CONTENT_FORMATS.has(value);
}

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
