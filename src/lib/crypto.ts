import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_HEX = process.env.ENCRYPTION_KEY!;

if (!KEY_HEX || KEY_HEX.length !== 64) {
  throw new Error(
    "ENCRYPTION_KEY must be set in .env.local as a 64-char hex string (32 bytes)"
  );
}

const KEY = Buffer.from(KEY_HEX, "hex");

export interface EncryptedPayload {
  encryptedData: string; // hex
  iv: string;            // hex
  authTag: string;       // hex
}

/**
 * Encrypt any JSON-serialisable value.
 * Returns three hex strings to store in the vault table.
 */
export function encrypt(plaintext: unknown): EncryptedPayload {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  const json = JSON.stringify(plaintext);
  const encrypted = Buffer.concat([
    cipher.update(json, "utf8"),
    cipher.final(),
  ]);

  return {
    encryptedData: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex"),
  };
}

/**
 * Decrypt a stored vault entry back to its original value.
 */
export function decrypt<T = unknown>(payload: EncryptedPayload): T {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(payload.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.encryptedData, "hex")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8")) as T;
}
