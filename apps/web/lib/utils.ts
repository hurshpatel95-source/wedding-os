import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMoney(amount: number, currency: "EUR" | "USD"): string {
  return currency === "EUR" ? formatEUR(amount) : formatUSD(amount);
}

// Currency-aware formatters keyed off workspace.base_currency.
//
// Most B2C couples are in the US; their workspaces should be USD. Some are in
// Europe (Hursh's Barcelona test workspace, Astia's planner-side data); those
// stay EUR. Pages that render currency should accept the workspace's
// base_currency string and call formatCurrency / currencySymbol below rather
// than calling formatEUR directly.
//
// Inputs are typed as a permissive `string` because the column comes back as
// `text` from Postgres — we normalize unknown values to USD as the safe
// US-default fallback.
export type SupportedCurrency = "USD" | "EUR";

export function normalizeCurrency(input: string | null | undefined): SupportedCurrency {
  const v = (input ?? "").toUpperCase().trim();
  if (v === "EUR") return "EUR";
  return "USD";
}

export function formatCurrency(
  amount: number,
  currency: string | null | undefined,
): string {
  return formatMoney(amount, normalizeCurrency(currency));
}

export function currencySymbol(currency: string | null | undefined): string {
  return normalizeCurrency(currency) === "EUR" ? "€" : "$";
}
