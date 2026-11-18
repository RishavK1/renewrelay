import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export function generateInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function inviteDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export class InviteCredentials {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32) throw new Error("INVITE_ENCRYPTION_KEY must encode 32 bytes.");
  }

  encrypt(token: string, inviteId: string) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, nonce);
    cipher.setAAD(Buffer.from(inviteId));
    const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString("base64url");
  }

  decrypt(envelope: string, inviteId: string) {
    const bytes = Buffer.from(envelope, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", this.key, bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(inviteId));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
  }
}
