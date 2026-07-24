/** AES-GCM helpers for admin AI API keys (Deno edge functions). */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encryptionSecret(): string {
  const secret =
    Deno.env.get("AI_KEYS_ENCRYPTION_SECRET") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "";
  if (!secret) {
    throw new Error("AI_KEYS_ENCRYPTION_SECRET não configurada");
  }
  return secret;
}

async function getAesKey(): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(encryptionSecret()));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Returns `ivBase64:cipherBase64` */
export async function encryptSecret(plain: string): Promise<string> {
  const key = await getAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(plain),
  );
  return `${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(payload: string): Promise<string> {
  const [ivB64, dataB64] = payload.split(":");
  if (!ivB64 || !dataB64) throw new Error("Credencial criptografada inválida");
  const key = await getAesKey();
  const iv = base64ToBytes(ivB64);
  const data = base64ToBytes(dataB64);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return textDecoder.decode(decrypted);
}

export function last4(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return trimmed;
  return trimmed.slice(-4);
}
