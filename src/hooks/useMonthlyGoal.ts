import { useQuery } from '@tanstack/react-query';
import { backend } from '../api/backend';
import { Currency, TransactionType, PositionStatus, type Position } from '../types/positions';
import { ALL_PORTFOLIOS_ID } from '../contexts/PortfolioContext';
import { convertPositionsToUsd } from '../services/positionsToUsd';

export type RangeOption = string;

const _currentYear = new Date().getFullYear();
const rangeOptions: string[] = Array.from({ length: 4 }, (_, i) =>
    String(_currentYear - 3 + i)
);

export interface MonthlyData {
    key: string;      // 'YYYY-MM'
    label: string;    // 'Jan '25' or 'Jan'
    invested: number;
    buys: number;
    sells: number;
    shortfall: number;
    metGoal: boolean;
    hasData: boolean;
}

export interface GoalStats {
    totalBuys: number;
    totalSells: number;
    totalInvested: number;
    avgMonthly: number;
    monthsMet: number;
    monthsMissed: number;
}

const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function toMonthKey(dateStr: string): string {
    return dateStr.slice(0, 7);
}

function monthLabel(key: string, range: RangeOption): string {
    const [yr, mo] = key.split('-');
    const name = MONTH_NAMES[parseInt(mo) - 1];
    return rangeOptions.includes(range)
        ? name
        : `${name} '${yr.slice(2)}`;
}

function buildMonthKeys(range: RangeOption): string[] {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    if (rangeOptions.includes(range)) {
        // Always Jan–Dec so future months render as empty stubs (performance chart style).
        return Array.from({ length: 12 }, (_, i) =>
            `${range}-${String(i + 1).padStart(2, '0')}`
        );
    }

    let startYear = 2023;

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
    if (rangeOptions.includes(range)) {
        return { from: `${range}-01-01`, to: `${range}-12-31` };
    }

    return null;
}

const fetchMonthlyPositions = async (
    portfolioId: string,
    range: RangeOption,
): Promise<Position[]> => {
    const positions = await backend.listPositions(
        portfolioId === ALL_PORTFOLIOS_ID ? undefined : portfolioId,
    );

    const dates = getRangeDates(range);
    // USD and EUR stocks count towards the goal; EUR trades are restated in USD.
    return convertPositionsToUsd(positions.filter((pos) => {
        if (pos.transaction_type !== TransactionType.Stock) return false;
        if (pos.currency !== Currency.USD && pos.currency !== Currency.EUR) return false;
        if (dates && (pos.buy_date < dates.from || pos.buy_date > dates.to)) return false;
        return true;
    }));
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

    const monthlySellMap = new Map<string, number>();
    for (const pos of sellPositions) {
        const key = toMonthKey(pos.buy_date);
        const qty = Number(pos.quantity);
        const px = Number(pos.price);
        if (!Number.isFinite(qty) || !Number.isFinite(px)) continue;
        monthlySellMap.set(key, (monthlySellMap.get(key) ?? 0) + qty * px);
    }

    const allKeys = buildMonthKeys(range);

    const months: MonthlyData[] = allKeys.map(key => {
        const buys = Math.round(monthlyMap.get(key) ?? 0);
        const sells = Math.round(monthlySellMap.get(key) ?? 0);
        const invested = (buys - sells) > 0 ? buys - sells : 0;
        const hasData = monthlyMap.has(key) || monthlySellMap.has(key);
        const metGoal = hasData && invested >= goal;
        const shortfall = hasData && !metGoal ? Math.round(goal - invested) : 0;
        return { key, label: monthLabel(key, range), buys, sells, invested, shortfall, metGoal, hasData };
    });

    const activeMonths = months.filter(m => m.hasData);
    const totalBuys = activeMonths.reduce((sum, m) => sum + m.buys, 0);
    const totalInvested = activeMonths.reduce((sum, m) => sum + m.invested, 0);
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
        stats: { totalBuys: Math.round(totalBuys), totalSells: Math.round(totalSells), totalInvested: Math.round(totalInvested), avgMonthly, monthsMet, monthsMissed },
    };
}

// portfolioId is string | null — query is disabled while null (portfolio still loading)
export function useMonthlyGoal(
    portfolioId: string | null,
    range: RangeOption,
) {
    return useQuery({
        queryKey: ['monthly-goal', portfolioId, range],
        queryFn: () => fetchMonthlyPositions(portfolioId!, range),
        enabled: !!portfolioId,
    });
}