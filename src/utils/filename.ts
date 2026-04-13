const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;

export function sanitizeFilenameStem(input: string, fallback = "diagram"): string {
  const cleaned = input
    .trim()
    .replace(INVALID_FILENAME_CHARS, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .replace(/\.+$/, "")
    .trim();

  const meaningful = cleaned.replace(/[_\-\s]/g, "");
  return meaningful ? cleaned : fallback;
}
