import { useQuery } from '@tanstack/react-query';
import { backend } from '../api/backend';
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
  const positions = await backend.listPositions(
    portfolioId === ALL_PORTFOLIOS_ID ? undefined : portfolioId,
  );

  return positions.filter(
    (pos) =>
      pos.transaction_type === TransactionType.Stock &&
      pos.currency === Currency.USD &&
      pos.buy_date >= startDate,
  );
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

  // Sort chronologically, buys before sells on the same date (mirrors usePortfolioStats)
  const sortedPositions = [...positions].sort((a, b) => {
    if (a.buy_date !== b.buy_date) return a.buy_date < b.buy_date ? -1 : 1;
    if (a.status === PositionStatus.Buy && b.status === PositionStatus.Sell) return -1;
    if (a.status === PositionStatus.Sell && b.status === PositionStatus.Buy) return 1;
    return 0;
  });

  // Group positions by month
  const positionsByMonth = new Map<string, Position[]>();
  for (const pos of sortedPositions) {
    const key = toMonthKey(pos.buy_date);
    const list = positionsByMonth.get(key) ?? [];
    list.push(pos);
    positionsByMonth.set(key, list);
  }

  const allKeys = buildAllMonthKeys(startKey, targetYears);

  // FIFO lot queues per ticker — same approach as usePortfolioStats so that
  // sells remove cost basis at original buy price, not at sell price.
  const lotQueues = new Map<string, Array<{ quantity: number; price: number }>>();

  const getTotalCostBasis = (): number => {
    let total = 0;
    for (const queue of lotQueues.values()) {
      for (const lot of queue) total += lot.quantity * lot.price;
    }
    return total;
  };

  // Build trajectory: each past month's "actual" = cost basis of open lots at month-end
  const trajectory: TrajectoryPoint[] = allKeys.map((key, index) => {
    const monthIndex = index + 1;
    const target = Math.round(targetPerMonth * monthIndex);
    const isPast = key <= currentKey;

    if (isPast) {
      for (const pos of positionsByMonth.get(key) ?? []) {
        const qty = Number(pos.quantity);
        const px = Number(pos.price);
        if (!Number.isFinite(qty) || !Number.isFinite(px)) continue;

        if (pos.status === PositionStatus.Buy) {
          const queue = lotQueues.get(pos.ticker_symbol) ?? [];
          queue.push({ quantity: qty, price: px });
          lotQueues.set(pos.ticker_symbol, queue);
        } else if (pos.status === PositionStatus.Sell) {
          const queue = lotQueues.get(pos.ticker_symbol) ?? [];
          let remaining = qty;
          while (remaining > 0 && queue.length > 0) {
            const front = queue[0];
            if (front.quantity <= remaining) {
              remaining -= front.quantity;
              queue.shift();
            } else {
              front.quantity -= remaining;
              remaining = 0;
            }
          }
          lotQueues.set(pos.ticker_symbol, queue);
        }
      }

      const costBasis = getTotalCostBasis();
      return {
        key,
        label: monthLabel(key),
        actual: Math.round(costBasis),
        target,
        isAhead: costBasis >= target,
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

  // Monthly delta of cost basis (how much the invested amount grew each month)
  const monthlyContributions = pastPoints.map((p, i) => {
    const prev = i > 0 ? (pastPoints[i - 1].actual ?? 0) : 0;
    return Math.max(0, (p.actual ?? 0) - prev);
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