import type { FormEvent } from 'react';

type Props = {
  inputTicker: string;
  onTickerChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function StockTickerForm({ inputTicker, onTickerChange, onSubmit }: Props) {
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Ticker
        <input
          className="w-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm uppercase text-gray-900 outline-none"
          value={inputTicker}
          onChange={(e) => onTickerChange(e.target.value.toUpperCase())}
          placeholder="AAPL"
        />
      </label>
      <button
        type="submit"
        className="cursor-pointer rounded-md border-none bg-blue-600 px-4 py-2 text-sm font-medium text-white"
      >
        Load
      </button>
    </form>
  );
}
