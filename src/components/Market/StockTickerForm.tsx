import type { FormEvent } from 'react';
import { color } from '../../theme/cssVars';

type Props = {
  inputTicker: string;
  onTickerChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function StockTickerForm({ inputTicker, onTickerChange, onSubmit }: Props) {
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
      <label
        className="flex flex-col gap-1 text-sm font-medium"
        style={{ color: color.textSecondary }}
      >
        Ticker
        <input
          className="w-32 rounded-md border px-3 py-2 text-sm uppercase outline-none"
          style={{
            borderColor: color.borderStrong,
            backgroundColor: color.bgSurface,
            color: color.textStrong,
          }}
          value={inputTicker}
          onChange={(e) => onTickerChange(e.target.value.toUpperCase())}
          placeholder="AAPL"
        />
      </label>
      <button
        type="submit"
        className="cursor-pointer rounded-md border-none px-4 py-2 text-sm font-medium"
        style={{
          backgroundColor: color.intervalActiveBg,
          color: color.intervalActiveText,
        }}
      >
        Load
      </button>
    </form>
  );
}
