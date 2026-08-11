import type { CashFlowPoint } from '../types/performance';

function daysBetween(a: string, b: string): number {
  const ms =
    Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return ms / (1000 * 60 * 60 * 24);
}

function npv(rate: number, flows: CashFlowPoint[], baseDate: string): number {
  let sum = 0;
  for (const cf of flows) {
    const years = daysBetween(baseDate, cf.date) / 365;
    sum += cf.amount / (1 + rate) ** years;
  }
  return sum;
}

function dNpv(rate: number, flows: CashFlowPoint[], baseDate: string): number {
  let sum = 0;
  for (const cf of flows) {
    const years = daysBetween(baseDate, cf.date) / 365;
    if (years === 0) continue;
    sum -= (years * cf.amount) / (1 + rate) ** (years + 1);
  }
  return sum;
}

/**
 * Annualized money-weighted return (XIRR) as a percent.
 * Returns null when cash flows cannot produce a meaningful rate.
 */
export function computeXirrPercent(flows: CashFlowPoint[]): number | null {
  const meaningful = flows.filter((f) => Math.abs(f.amount) > 1e-9);
  if (meaningful.length < 2) return null;

  const hasPos = meaningful.some((f) => f.amount > 0);
  const hasNeg = meaningful.some((f) => f.amount < 0);
  if (!hasPos || !hasNeg) return null;

  const sorted = [...meaningful].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  const baseDate = sorted[0].date;

  let rate = 0.1;
  for (let i = 0; i < 80; i++) {
    const f = npv(rate, sorted, baseDate);
    const df = dNpv(rate, sorted, baseDate);
    if (Math.abs(df) < 1e-14) break;

    const next = rate - f / df;
    if (!Number.isFinite(next)) break;

    const clamped = Math.min(Math.max(next, -0.999999), 1e6);
    if (Math.abs(clamped - rate) < 1e-7) {
      return clamped * 100;
    }
    rate = clamped;
  }

  // Bisection fallback when Newton fails to converge.
  let lo = -0.999999;
  let hi = 10;
  let fLo = npv(lo, sorted, baseDate);
  const fHi = npv(hi, sorted, baseDate);
  if (fLo * fHi > 0) return null;

  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, sorted, baseDate);
    if (Math.abs(fMid) < 1e-8) return mid * 100;
    if (fLo * fMid <= 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }

  return ((lo + hi) / 2) * 100;
}
