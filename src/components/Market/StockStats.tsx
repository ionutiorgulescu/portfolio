import { formatNumber } from '../stockMarket.types';
import type { StockBarWithDate } from '../../hooks/useStockData';

type Props = {
  latestBar: StockBarWithDate | null;
  totalDays: number;
};

export function StockStats({ latestBar, totalDays }: Props) {
  return (
    <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
      <div className="rounded-md bg-gray-50 p-3">
        <p className="m-0 text-xs font-medium uppercase tracking-wider text-gray-500">
          Most Recent Close
        </p>
        <p className="m-0 text-xl font-semibold leading-snug text-gray-900">
          {latestBar ? `$${formatNumber(latestBar.c)}` : 'N/A'}
        </p>
      </div>
      <div className="rounded-md bg-gray-50 p-3">
        <p className="m-0 text-xs font-medium uppercase tracking-wider text-gray-500">
          Days Retrieved
        </p>
        <p className="m-0 text-xl font-semibold leading-snug text-gray-900">{totalDays}</p>
      </div>
    </div>
  );
}
