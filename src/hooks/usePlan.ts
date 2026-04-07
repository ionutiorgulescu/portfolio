import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import { Currency, TransactionType, PositionStatus, type Position } from '../types/positions';
import { ALL_PORTFOLIOS_ID } from '../contexts/PortfolioContext';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlanParams {
  startDate: string;   // 'YYYY-MM-DD'
  targetValue: number; // e.g. 100000
  targetYears: number; // e.g. 5
}

export interface TrajectoryPoint {
  key: string;         // 'YYYY-MM'
  label: string;       // 'Jan '25'
  actual: number | null;       // cumulative invested up to this month (null = future)
  target: number;      // linear target at this month
  isAhead: boolean;    // only meaningful for past months
}

export interface PlanStats {
  totalInvested: number;
  monthsTracked: number;
  monthsTotal: number;
  targetPerMonth: number;
  avgMonthly: number;
  currentProgress: number; // percentage 0-100
  scheduleStatus: 'ahead' | 'behind' | 'on-track';
  projectedFinishMonth: string | null; // 'YYYY-MM' if calculable
}

export interface PlanData {
  trajectory: TrajectoryPoint[];
  stats: PlanStats;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function monthLabel(key: string): string {
  const [yr, mo] = key.split('-');
  return `${MONTH_NAMES[parseInt(mo) - 1]} '${yr.slice(2)}`;
}

function addMonths(dateStr: string, months: number): string {
  const date = new Date(`${dateStr}-01`);
  date.setMonth(date.getMonth() + months);
  const yr = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  return `${yr}-${mo}`;
}

function buildAllMonthKeys(startDate: string, targetYears: number): string[] {
  const totalMonths = targetYears * 12;
  return Array.from({ length: totalMonths }, (_, i) => addMonths(startDate, i));
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Fetcher ─────────────────────────────────────────────────────────────────

async function fetchPositionsFromStart(
  portfolioId: string,
  startDate: string,
): Promise<Position[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    if (userError.message === 'Auth session missing!') {
      throw new Error('Your session has expired. Please sign in again.');
    }
    throw userError;
  }

  if (!user) {
    throw new Error('You must be signed in to view your positions.');
  }

  let query = supabase
    .from('positions')
    .select('*')
    .eq('user_id', user.id)
    .eq('transaction_type', TransactionType.Stock)
    .eq('currency', Currency.USD)
    .gte('buy_date', startDate)
    .order('buy_date', { ascending: true });

  if (portfolioId !== ALL_PORTFOLIOS_ID) {
    query = query.eq('portfolio_id', portfolioId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Position[];
}

// ─── Aggregator ──────────────────────────────────────────────────────────────

function computePlanData(
  positions: Position[],
  params: PlanParams,
): PlanData {
  const { startDate, targetValue, targetYears } = params;
  const totalMonths = targetYears * 12;
  const targetPerMonth = targetValue / totalMonths;
  const currentKey = getCurrentMonthKey();
  const startKey = toMonthKey(startDate);

  // Build monthly net invested map from positions
  const buyMap = new Map<string, number>();
  const sellMap = new Map<string, number>();

  for (const pos of positions) {
    const key = toMonthKey(pos.buy_date);
    const qty = Number(pos.quantity);
    const px = Number(pos.price);
    if (!Number.isFinite(qty) || !Number.isFinite(px)) continue;

    if (pos.status === PositionStatus.Buy) {
      buyMap.set(key, (buyMap.get(key) ?? 0) + qty * px);
    } else if (pos.status === PositionStatus.Sell) {
      sellMap.set(key, (sellMap.get(key) ?? 0) + qty * px);
    }
  }

  const allKeys = buildAllMonthKeys(startKey, targetYears);

  // Build trajectory with cumulative actual
  let cumulativeActual = 0;
  const trajectory: TrajectoryPoint[] = allKeys.map((key, index) => {
    const monthIndex = index + 1; // 1-based
    const target = Math.round(targetPerMonth * monthIndex);
    const isPast = key <= currentKey;

    if (isPast) {
      const buys = buyMap.get(key) ?? 0;
      const sells = sellMap.get(key) ?? 0;
      const net = Math.max(0, buys - sells);
      cumulativeActual += net;
      return {
        key,
        label: monthLabel(key),
        actual: Math.round(cumulativeActual),
        target,
        isAhead: cumulativeActual >= target,
      };
    }

    return {
      key,
      label: monthLabel(key),
      actual: null,
      target,
      isAhead: false,
    };
  });

  // Stats
  const pastPoints = trajectory.filter(p => p.actual !== null);
  const monthsTracked = pastPoints.length;
  const totalInvested = monthsTracked > 0
    ? (pastPoints[pastPoints.length - 1].actual ?? 0)
    : 0;

  const monthlyContributions = allKeys
    .filter(key => key <= currentKey)
    .map(key => {
      const buys = buyMap.get(key) ?? 0;
      const sells = sellMap.get(key) ?? 0;
      return Math.max(0, buys - sells);
    });

  const avgMonthly = monthsTracked > 0
    ? Math.round(monthlyContributions.reduce((s, v) => s + v, 0) / monthsTracked)
    : 0;

  const currentProgress = Math.min(100, Math.round((totalInvested / targetValue) * 100));

  const expectedAtNow = targetPerMonth * monthsTracked;
  const diff = totalInvested - expectedAtNow;
  const scheduleStatus: PlanStats['scheduleStatus'] =
    Math.abs(diff) < targetPerMonth * 0.05
      ? 'on-track'
      : diff > 0
        ? 'ahead'
        : 'behind';

  // Projected finish: based on avg monthly pace, how many more months needed
  let projectedFinishMonth: string | null = null;
  if (avgMonthly > 0) {
    const remaining = targetValue - totalInvested;
    const monthsNeeded = Math.ceil(remaining / avgMonthly);
    projectedFinishMonth = addMonths(currentKey, monthsNeeded);
  }

  return {
    trajectory,
    stats: {
      totalInvested,
      monthsTracked,
      monthsTotal: totalMonths,
      targetPerMonth: Math.round(targetPerMonth),
      avgMonthly,
      currentProgress,
      scheduleStatus,
      projectedFinishMonth,
    },
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePlan(
  portfolioId: string | null,
  params: PlanParams | null, // null = not yet submitted
) {
  return useQuery({
    queryKey: ['plan', portfolioId, params],
    queryFn: async (): Promise<PlanData> => {
      const positions = await fetchPositionsFromStart(portfolioId!, params!.startDate);
      return computePlanData(positions, params!);
    },
    enabled: !!portfolioId && !!params,
  });
}