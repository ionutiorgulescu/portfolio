import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import { Currency, TransactionType, PositionStatus, type Position } from '../types/positions';
import { ALL_PORTFOLIOS_ID } from '../contexts/PortfolioContext';
import type { CompositionFilter } from '../components/FilterControl';

export type RangeOption = 'alltime' | 'last5' | '2022' | '2023' | '2024' | '2025' | '2026';

export interface MonthlyData {
  key: string;      // 'YYYY-MM'
  label: string;    // 'Jan '25' or 'Jan'
  invested: number;
  shortfall: number;
  metGoal: boolean;
  hasData: boolean;
}

export interface GoalStats {
  totalBuys: number;
  totalSells: number;
  avgMonthly: number;
  monthsMet: number;
  monthsMissed: number;
}

const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

function toMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function monthLabel(key: string, range: RangeOption): string {
  const [yr, mo] = key.split('-');
  const name = MONTH_NAMES[parseInt(mo) - 1];
  return ['2022','2023','2024','2025','2026'].includes(range)
    ? name
    : `${name} '${yr.slice(2)}`;
}

function buildMonthKeys(range: RangeOption, firstKey?: string): string[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  if (['2022','2023','2024','2025','2026'].includes(range)) {
    const yr = parseInt(range);
    const maxMonth = yr === currentYear ? currentMonth : 11;
    return Array.from({ length: maxMonth + 1 }, (_, i) =>
      `${yr}-${String(i + 1).padStart(2, '0')}`
    );
  }

  let startYear = range === 'last5' ? currentYear - 4 : 2021;
  if (range === 'alltime' && firstKey) {
    startYear = parseInt(firstKey.slice(0, 4));
  }

  const keys: string[] = [];
  for (let yr = startYear; yr <= currentYear; yr++) {
    const maxMonth = yr === currentYear ? currentMonth : 11;
    for (let mo = 0; mo <= maxMonth; mo++) {
      keys.push(`${yr}-${String(mo + 1).padStart(2, '0')}`);
    }
  }
  return keys;
}

function getRangeDates(range: RangeOption): { from: string; to: string } | null {
  const now = new Date();
  const yr = now.getFullYear();
  if (['2022','2023','2024','2025','2026'].includes(range)) {
    return { from: `${range}-01-01`, to: `${range}-12-31` };
  }
  if (range === 'last5') {
    return { from: `${yr - 4}-01-01`, to: `${yr}-12-31` };
  }
  return null;
}

const fetchMonthlyPositions = async (
  portfolioId: string,
  range: RangeOption,
  filter: CompositionFilter,
): Promise<Position[]> => {
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
    .order('buy_date', { ascending: true });

  if (filter === 'bvb') {
    query = query.eq('transaction_type', TransactionType.Stock).eq('currency', Currency.RON);
  } else if (filter === 'crypto') {
    query = query.eq('transaction_type', TransactionType.Crypto).eq('currency', Currency.USD);
  } else {
    // 'stock' — USD stocks (default, matches Performance › Stocks)
    query = query.eq('transaction_type', TransactionType.Stock).eq('currency', Currency.USD);
  }

  if (portfolioId !== ALL_PORTFOLIOS_ID) {
    query = query.eq('portfolio_id', portfolioId);
  }

  const dates = getRangeDates(range);
  if (dates) {
    query = query.gte('buy_date', dates.from).lte('buy_date', dates.to);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Position[];
};

export function aggregateMonthlyData(
  positions: Position[],
  goal: number,
  range: RangeOption,
): { months: MonthlyData[]; stats: GoalStats } {
  const buyPositions = positions.filter(p => p.status === PositionStatus.Buy);
  const sellPositions = positions.filter(p => p.status === PositionStatus.Sell);

  const monthlyMap = new Map<string, number>();
  for (const pos of buyPositions) {
    const key = toMonthKey(pos.buy_date);
    const qty = Number(pos.quantity);
    const px = Number(pos.price);
    if (!Number.isFinite(qty) || !Number.isFinite(px)) continue;
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + qty * px);
  }

  const sortedKeys = Array.from(monthlyMap.keys()).sort();
  const allKeys = buildMonthKeys(range, sortedKeys[0]);

  const months: MonthlyData[] = allKeys.map(key => {
    const invested = Math.round(monthlyMap.get(key) ?? 0);
    const hasData = monthlyMap.has(key);
    const metGoal = hasData && invested >= goal;
    const shortfall = hasData && !metGoal ? Math.round(goal - invested) : 0;
    return { key, label: monthLabel(key, range), invested, shortfall, metGoal, hasData };
  });

  const activeMonths = months.filter(m => m.hasData);
  const totalBuys = activeMonths.reduce((sum, m) => sum + m.invested, 0);
  const avgMonthly = activeMonths.length
    ? Math.round(totalBuys / activeMonths.length)
    : 0;
  const monthsMet = activeMonths.filter(m => m.metGoal).length;
  const monthsMissed = activeMonths.filter(m => !m.metGoal).length;

  const totalSells = sellPositions.reduce((sum, pos) => {
    const qty = Number(pos.quantity);
    const px = Number(pos.price);
    return Number.isFinite(qty) && Number.isFinite(px) ? sum + qty * px : sum;
  }, 0);

  return {
    months,
    stats: { totalBuys: Math.round(totalBuys), totalSells: Math.round(totalSells), avgMonthly, monthsMet, monthsMissed },
  };
}

// portfolioId is string | null — query is disabled while null (portfolio still loading)
export function useMonthlyGoal(
  portfolioId: string | null,
  range: RangeOption,
  filter: CompositionFilter,
) {
  return useQuery({
    queryKey: ['monthly-goal', portfolioId, range, filter],
    queryFn: () => fetchMonthlyPositions(portfolioId!, range, filter),
    enabled: !!portfolioId,
  });
}