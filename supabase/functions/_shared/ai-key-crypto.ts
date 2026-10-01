// Encrypt/decrypt admin-provided AI API keys with AES-GCM.
// The encryption key is derived from AI_KEYS_ENCRYPTION_SECRET (SHA-256).
// If the secret is absent, values are stored base64-encoded (marked "p1") so the
// feature still works, but configuring the secret is strongly recommended.

const ENC_PREFIX = "v1:";
const PLAIN_PREFIX = "p1:";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getCryptoKey(): Promise<CryptoKey | null> {
  const secret = Deno.env.get("AI_KEYS_ENCRYPTION_SECRET")?.trim();
  if (!secret) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptApiKey(plain: string): Promise<string> {
  const key = await getCryptoKey();
  if (!key) return `${PLAIN_PREFIX}${bytesToBase64(new TextEncoder().encode(plain))}`;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)),
  );
  return `${ENC_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(cipher)}`;
}

export async function decryptApiKey(stored: string | null | undefined): Promise<string | null> {
  const value = stored?.trim();
  if (!value) return null;

  if (value.startsWith(PLAIN_PREFIX)) {
    try {
      return new TextDecoder().decode(base64ToBytes(value.slice(PLAIN_PREFIX.length)));
    } catch {
      return null;
    }
  }

  if (!value.startsWith(ENC_PREFIX)) return value; // legacy plaintext

  const key = await getCryptoKey();
  if (!key) {
    console.error("AI_KEYS_ENCRYPTION_SECRET ausente; não foi possível descriptografar a chave salva.");
    return null;
  }
  const [, ivPart, cipherPart] = value.split(":");
  if (!ivPart || !cipherPart) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(ivPart) },
      key,
      base64ToBytes(cipherPart),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export function lastFour(value: string): string {
  const trimmed = value.trim();
  return trimmed.length <= 4 ? trimmed : trimmed.slice(-4);
}
