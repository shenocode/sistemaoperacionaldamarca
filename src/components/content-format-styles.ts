import type { ContentFormat } from "@/lib/api";

/** Visual styles for content format chips (calendar / lists). */
export const contentFormatStyles: Record<ContentFormat, string> = {
  static_feed: "border-sky-300 !bg-sky-100 text-sky-900 hover:!bg-sky-100",
  carousel: "border-violet-300 !bg-violet-100 text-violet-900 hover:!bg-violet-100",
  reels: "border-fuchsia-300 !bg-fuchsia-100 text-fuchsia-900 hover:!bg-fuchsia-100",
  stories: "border-teal-300 !bg-teal-100 text-teal-900 hover:!bg-teal-100",
  recorded_video: "border-indigo-300 !bg-indigo-100 text-indigo-900 hover:!bg-indigo-100",
};

/** Subtle row tint so format distribution is scannable in the calendar. */
export const contentFormatRowStyles: Record<ContentFormat, string> = {
  static_feed: "bg-sky-50/70",
  carousel: "bg-violet-50/70",
  reels: "bg-fuchsia-50/70",
  stories: "bg-teal-50/70",
  recorded_video: "bg-indigo-50/70",
};
