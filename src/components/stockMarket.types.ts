export type ChartInterval = '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'MAX';

export type IntervalOption = {
  key: ChartInterval;
  label: string;
  days?: number;
};

export type ChartPoint = {
  t: number;
  close: number;
};

export const intervalOptions: IntervalOption[] = [
  { key: '1D', label: '1 Day' },
  { key: '1W', label: '1 Week', days: 7 },
  { key: '1M', label: '1 Month', days: 30 },
  { key: 'YTD', label: 'YTD' },
  { key: '1Y', label: '1 Year', days: 365 },
  { key: 'MAX', label: 'Max' },
];

export const formatNumber = (value: number): string =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const parseIsoDate = (isoDate: string): Date => new Date(`${isoDate}T00:00:00Z`);

export const formatTimestamp = (timestamp: number, options: Intl.DateTimeFormatOptions): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-US', options);
};

/** getquin-style cursor date, e.g. "30. Mar 2026" */
export const formatChartCursorDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const year = date.getUTCFullYear();
  return `${day}. ${month} ${year}`;
};

/** Intraday cursor, e.g. "14:35" (local time). */
export const formatChartCursorTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

export const getNiceTickStep = (value: number): number => {
  if (value <= 0 || !Number.isFinite(value)) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;

  if (normalized <= 1) return 1 * magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
};
