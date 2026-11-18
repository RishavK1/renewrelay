import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
export const totp = secret => createOTP(base32.decode(secret)).totp();
export function authCookies(response) {
  return response.headers.getSetCookie().map(value => value.split(";")[0]).filter(value => !value.endsWith("=")).join("; ");
}
export async function enrollMfa(api, expect, person, password) {
  const enrollment = await expect(await api("/api/auth/two-factor/enable", {
    method: "POST", cookie: person.cookie, headers: person.headers, body: { password },
  }), 200);
  const secret = new URL(enrollment.totpURI).searchParams.get("secret");
  const verified = await api("/api/auth/two-factor/verify-totp", {
    method: "POST", cookie: person.cookie, headers: person.headers, body: { code: await totp(secret) },
  });
  await expect(verified, 200);
  return { ...person, cookie: authCookies(verified) || person.cookie, totpSecret: secret, backupCodes: enrollment.backupCodes };
}
export async function completeMfaLogin(api, expect, response, person) {
  const pending = await expect(response, 200);
  if (!pending.twoFactorRedirect) return response;
  const verified = await api("/api/auth/two-factor/verify-totp", {
    method: "POST", cookie: authCookies(response), headers: person.headers, body: { code: await totp(person.totpSecret) },
  });
  await expect(verified, 200);
  return verified;
}
