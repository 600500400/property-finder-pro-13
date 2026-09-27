/** Only same-site relative paths. Reject encoded separators and control characters too. */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || value !== value.trim()) return "/";
  let decoded = value;
  try {
    for (let i = 0; i < 5; i++) {
      if (
        !decoded.startsWith("/") ||
        decoded.startsWith("//") ||
        [...decoded].some(
          (char) => char === "\\" || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
        )
      )
        return "/";
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      if (i === 4) return "/";
      decoded = next;
    }
    if (new URL(value, "https://return.invalid").origin !== "https://return.invalid") return "/";
    const normalized = new URL(decoded, "https://return.invalid");
    if (
      normalized.origin !== "https://return.invalid" ||
      /^\/auth(?:\/|$)/.test(normalized.pathname)
    )
      return "/";
    return value;
  } catch {
    return "/";
  }
}

/** Keep the intent in a query parameter: Supabase uses the fragment for auth tokens. */
export function signupConfirmationUrl(origin: string, next: unknown): string {
  return origin + "/auth?confirmed=1&next=" + encodeURIComponent(safeReturnPath(next));
}
