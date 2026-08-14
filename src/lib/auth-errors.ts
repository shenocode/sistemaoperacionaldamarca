export type PasswordPolicyIssue = "weak" | "short";

export function isWeakPasswordError(message: string | undefined | null): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("weak") ||
    normalized.includes("easy to guess") ||
    normalized.includes("pwned") ||
    normalized.includes("leaked password") ||
    normalized.includes("data breach") ||
    normalized.includes("compromised") ||
    normalized.includes("too common")
  );
}

export function isShortPasswordError(message: string | undefined | null): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("senha muito curta") ||
    normalized.includes("too short") ||
    normalized.includes("at least 6") ||
    normalized.includes("minimum 6")
  );
}

export function passwordPolicyIssue(
  message: string | undefined | null,
): PasswordPolicyIssue | null {
  if (isWeakPasswordError(message)) return "weak";
  if (isShortPasswordError(message)) return "short";
  return null;
}
