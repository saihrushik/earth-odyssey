/** Live FX via the ECB-backed Frankfurter API — no key required. */

export interface CurrencyConversion {
  amount: number;
  from: string;
  to: string;
  converted: number;
  rate: number;
}

export async function convertCurrency(amount: number, from: string, to: string): Promise<CurrencyConversion> {
  if (from.toUpperCase() === to.toUpperCase()) {
    return { amount, from: from.toUpperCase(), to: to.toUpperCase(), converted: amount, rate: 1 };
  }
  const url = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(from.toUpperCase())}&symbols=${encodeURIComponent(to.toUpperCase())}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`frankfurter failed: ${res.status}`);
  const json = (await res.json()) as { rates: Record<string, number> };
  const rate = json.rates[to.toUpperCase()];
  if (!rate) throw new Error(`No rate for ${to}`);
  return {
    amount,
    from: from.toUpperCase(),
    to: to.toUpperCase(),
    converted: Math.round(amount * rate * 100) / 100,
    rate,
  };
}
