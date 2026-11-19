export function currencyDigits(currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function minorAmount(raw: string, currency: string): { value: number | null; error?: string } {
  const text = raw.trim();
  if (!text) return { value: null };
  if (!currency) return { value: null, error: "Choose a currency before entering an amount." };
  if (!/^\d+(?:\.\d+)?$/.test(text) || text.length > 32) return { value: null, error: "Use a non-negative amount without commas or currency symbols." };
  let digits: number;
  try { digits = currencyDigits(currency); } catch { return { value: null, error: "Choose a supported currency." }; }
  const [whole = "0", fraction = ""] = text.split(".");
  if (fraction.length > digits) return { value: null, error: `This currency supports ${digits} decimal places.` };
  const value = BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, "0") || "0");
  if (value > 2147483647n) return { value: null, error: "This amount exceeds the supported maximum. Use a smaller amount." };
  return { value: Number(value) };
}

export function displayMoney(value: number | null, currency: string) {
  if (value === null) return "Not recorded";
  return new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "code" }).format(value / 10 ** currencyDigits(currency));
}

/** Exact editable decimal text; no floating-point rounding or currency symbols. */
export function moneyInput(value: number | null, currency: string) {
  if (value === null) return "";
  const digits = currencyDigits(currency);
  const text = BigInt(value).toString().padStart(digits + 1, "0");
  return digits ? `${text.slice(0, -digits)}.${text.slice(-digits)}` : text;
}
