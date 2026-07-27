/** Mounts caption + CTA + hashtags ready to paste into Instagram. */
export function composePublishCaption(input: {
  caption?: string | null;
  cta?: string | null;
  hashtags?: string | null;
}): string {
  return [input.caption, input.cta, input.hashtags]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

export function isApprovedContentStatus(status: string | null | undefined): boolean {
  return status === "approved";
}
