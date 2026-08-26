import { formatNumber } from '../stockMarket.types';
import type { StockBarWithDate } from '../../hooks/useStockData';
import { color } from '../../theme/cssVars';

type Props = {
  latestBar: StockBarWithDate | null;
  totalDays: number;
};

export function StockStats({ latestBar, totalDays }: Props) {
  return (
    <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
      <div
        className="rounded-md p-3"
        style={{ backgroundColor: color.bgMuted }}
      >
        <p
          className="m-0 text-xs font-medium uppercase tracking-wider"
          style={{ color: color.textMuted }}
        >
          Most Recent Close
        </p>
        <p
          className="m-0 text-xl font-semibold leading-snug"
          style={{ color: color.textStrong }}
        >
          {latestBar ? `$${formatNumber(latestBar.c)}` : 'N/A'}
        </p>
      </div>
      <div
        className="rounded-md p-3"
        style={{ backgroundColor: color.bgMuted }}
      >
        <p
          className="m-0 text-xs font-medium uppercase tracking-wider"
          style={{ color: color.textMuted }}
        >
          Days Retrieved
        </p>
        <p
          className="m-0 text-xl font-semibold leading-snug"
          style={{ color: color.textStrong }}
        >
          {totalDays}
        </p>
      </div>
    </div>
  );
}
