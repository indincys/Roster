import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
  fingerprint: string;
}

const KEY_FILE = "local-secret.key";

async function loadOrCreateKey(vaultDir: string): Promise<Buffer> {
  await mkdir(vaultDir, { recursive: true, mode: 0o700 });
  const keyPath = path.join(vaultDir, KEY_FILE);
  try {
    const encoded = await readFile(keyPath, "utf8");
    return Buffer.from(encoded.trim(), "base64");
  } catch {
    const key = crypto.randomBytes(32);
    await writeFile(keyPath, key.toString("base64"), { encoding: "utf8", mode: 0o600 });
    return key;
  }
}

export async function encryptSecret(vaultDir: string, plaintext: string): Promise<EncryptedSecret> {
  const key = await loadOrCreateKey(vaultDir);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const fingerprint = crypto.createHmac("sha256", key).update(plaintext).digest("hex").slice(0, 16);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    fingerprint
  };
}

export async function decryptSecret(vaultDir: string, encrypted: EncryptedSecret): Promise<string> {
  const key = await loadOrCreateKey(vaultDir);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(encrypted.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final()
  ]);
  return plaintext.toString("utf8");
}
