import type { ContentFormat } from "@/lib/api";

/** Visual styles for content format chips (calendar / lists). */
export const contentFormatStyles: Record<ContentFormat, string> = {
  static_feed: "border-sky-200 bg-sky-100 text-sky-900 hover:bg-sky-100/90",
  carousel: "border-violet-200 bg-violet-100 text-violet-900 hover:bg-violet-100/90",
  reels: "border-fuchsia-200 bg-fuchsia-100 text-fuchsia-900 hover:bg-fuchsia-100/90",
  stories: "border-teal-200 bg-teal-100 text-teal-900 hover:bg-teal-100/90",
  recorded_video: "border-indigo-200 bg-indigo-100 text-indigo-900 hover:bg-indigo-100/90",
};

/** Subtle row tint so format distribution is scannable in the calendar. */
export const contentFormatRowStyles: Record<ContentFormat, string> = {
  static_feed: "bg-sky-50/70",
  carousel: "bg-violet-50/70",
  reels: "bg-fuchsia-50/70",
  stories: "bg-teal-50/70",
  recorded_video: "bg-indigo-50/70",
};
