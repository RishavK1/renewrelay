import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { verifyPassword as verifyLegacy } from "better-auth/crypto";

const prefix = "rr-scrypt-v1";
function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => scrypt(password.normalize("NFKC"), salt, 64,
    { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
    (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${prefix}$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(input: { hash: string; password: string }) {
  if (!input.hash.startsWith(prefix + "$")) {
    if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(input.hash)) return false;
    return verifyLegacy(input);
  }
  const [tag, salt, hex, extra] = input.hash.split("$");
  if (tag !== prefix || !salt || !hex || extra !== undefined || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hex)) return false;
  return timingSafeEqual(await derive(input.password, salt), Buffer.from(hex, "hex"));
}
