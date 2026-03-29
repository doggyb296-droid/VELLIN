// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/g;
const UNSAFE_TEXT_CHARS_REGEX = /[<>`]/g;

export const sanitizePlainText = (value: string, maxLength = 120) =>
  value
    .replace(CONTROL_CHARS_REGEX, "")
    .replace(UNSAFE_TEXT_CHARS_REGEX, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

export const sanitizeMultilineText = (value: string, maxLength = 500) =>
  value
    .replace(CONTROL_CHARS_REGEX, "")
    .replace(UNSAFE_TEXT_CHARS_REGEX, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);

export const normalizeEmail = (value: string) =>
  value
    .replace(CONTROL_CHARS_REGEX, "")
    .trim()
    .toLowerCase()
    .slice(0, 254);

export const containsControlChars = (value: string) => CONTROL_CHARS_REGEX.test(value);

export const sanitizeRedirectPath = (value: string | null | undefined, fallback = "/") => {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;

  try {
    const parsed = new URL(trimmed, "https://vellin.local");
    if (parsed.origin !== "https://vellin.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
};
