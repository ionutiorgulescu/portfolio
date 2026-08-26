import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useStockData, useStockIntradayData } from '../../hooks/useStockData';
import { takeLatestSessionBars } from '../../services/intradayPortfolioValue';
import { IntervalSelector } from '../IntervalSelector';
import { StockStats } from './StockStats';
import { StockTickerForm } from './StockTickerForm';
import {
  getNiceTickStep,
  intervalOptions,
  parseIsoDate,
  formatTimestamp,
  formatChartCursorTime,
} from '../stockMarket.types';
import type { ChartInterval, ChartPoint } from '../stockMarket.types';
import { Box } from '@mui/material';
import { color, shadow } from '../../theme/cssVars';

const StockChart = lazy(() => import('./StockChart'));

const Market = () => {
  const [inputTicker, setInputTicker] = useState<string>('AAPL');
  const [ticker, setTicker] = useState<string>('AAPL');
  const [interval, setInterval] = useState<ChartInterval>('YTD');
  const isIntraday = interval === '1D';
  const { data, error, isLoading } = useStockData(ticker);
  const {
    data: intradayData,
    error: intradayError,
    isLoading: isLoadingIntraday,
  } = useStockIntradayData(ticker, '5m', isIntraday);

  const sortedData = useMemo(
    () => [...data].sort((left, right) => left.t - right.t),
    [data],
  );

  const filteredBars = useMemo(() => {
    if (isIntraday) {
      const normalized = ticker.trim().toUpperCase();
      const session = takeLatestSessionBars(new Map([[normalized, intradayData]]));
      return [...(session.get(normalized) ?? [])].sort((left, right) => left.t - right.t);
    }

    if (sortedData.length === 0) {
      return [];
    }

    const latestBar = sortedData[sortedData.length - 1];
    const latestDate = parseIsoDate(latestBar.date);

    let startDate: Date | null = null;

    if (interval === 'MAX') {
      return sortedData;
    }

    if (interval === 'YTD') {
      startDate = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    } else {
      const selected = intervalOptions.find((option) => option.key === interval);
      if (selected?.days) {
        startDate = new Date(latestDate);
        startDate.setUTCDate(startDate.getUTCDate() - selected.days);
      }
    }

    if (!startDate) {
      return sortedData;
    }

    const sliced = sortedData.filter((bar) => parseIsoDate(bar.date) >= startDate);
    return sliced.length > 0 ? sliced : sortedData;
  }, [interval, sortedData, isIntraday, intradayData, ticker]);

  const chartData = useMemo<ChartPoint[]>(
    () =>
      filteredBars.map((bar) => ({
        t: bar.t,
        close: bar.c,
      })),
    [filteredBars],
  );

  const latestBar = useMemo(
    () => (filteredBars.length > 0 ? filteredBars[filteredBars.length - 1] : null),
    [filteredBars],
  );

  const percentChange = useMemo(() => {
    if (filteredBars.length < 2) {
      return 0;
    }

    const firstClose = filteredBars[0].c;
    const lastClose = filteredBars[filteredBars.length - 1].c;
    if (firstClose === 0) {
      return 0;
    }

    return ((lastClose - firstClose) / firstClose) * 100;
  }, [filteredBars]);

  const xAxisTickFormatter = useMemo(() => {
    if (interval === '1D') {
      return (value: number) => formatChartCursorTime(value);
    }

    const options: Intl.DateTimeFormatOptions =
      interval === '1W' || interval === '1M'
        ? { month: 'short', day: 'numeric' }
        : interval === 'MAX'
          ? { month: 'short', year: '2-digit' }
          : { month: 'short', day: 'numeric', year: '2-digit' };

    return (value: number) => formatTimestamp(value, options);
  }, [interval]);

  const yAxisScale = useMemo(() => {
    if (chartData.length === 0) {
      return {
        ticks: [0, 25, 50, 75, 100],
        domain: [0, 100] as [number, number],
      };
    }

    const closes = chartData.map((point) => point.close);
    const minClose = Math.min(...closes);
    const maxClose = Math.max(...closes);

    const spread = maxClose - minClose;
    const padding = Math.max(spread * 0.12, maxClose * 0.01, 1);
    const paddedMin = Math.max(0, minClose - padding);
    const paddedMax = maxClose + padding;
    const step = getNiceTickStep((paddedMax - paddedMin) / 5);

    const minTick = Math.floor(paddedMin / step) * step;
    const maxTick = Math.ceil(paddedMax / step) * step;

    const ticks: number[] = [];
    for (let tick = minTick; tick <= maxTick + step / 2; tick += step) {
      ticks.push(tick);
    }

    return {
      ticks,
      domain: [minTick, maxTick] as [number, number],
    };
  }, [chartData]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextTicker = inputTicker.trim().toUpperCase();
      setTicker(nextTicker || 'AAPL');
    },
    [inputTicker],
  );

  const activeError = isIntraday ? intradayError : error;
  const activeLoading = isIntraday ? isLoadingIntraday : isLoading;

  return (
    <Box
      component="section"
      sx={{
        width: '100%',
        borderRadius: '12px',
        bgcolor: color.bgSurface,
        p: 3,
        boxShadow: shadow.cardSoft,
      }}
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <StockTickerForm
          inputTicker={inputTicker}
          onTickerChange={setInputTicker}
          onSubmit={handleSubmit}
        />
      </div>

      {activeLoading ? (
        <Box
          sx={{
            borderRadius: '6px',
            border: '1px solid',
            borderColor: color.border,
            bgcolor: color.bgMuted,
            p: 1.5,
            fontSize: 14,
            color: color.textSecondary,
          }}
        >
          Loading stock history...
        </Box>
      ) : null}

      {!activeLoading && activeError ? (
        <Box
          component="p"
          sx={{
            borderRadius: '6px',
            border: '1px solid',
            borderColor: color.lossBorder,
            bgcolor: color.lossBg,
            p: 1.5,
            fontSize: 14,
            color: color.lossFg,
            m: 0,
          }}
        >
          Failed to load stock history: {activeError}
        </Box>
      ) : null}

      {!activeLoading && !activeError ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Box
              component="h2"
              sx={{ m: 0, fontSize: 18, fontWeight: 600, lineHeight: 1.4, color: color.textStrong }}
            >
              Price - {ticker}
            </Box>
            <Box
              component="span"
              sx={{
                borderRadius: 999,
                px: 1.5,
                py: 0.5,
                fontSize: 14,
                fontWeight: 600,
                color: color.textInverse,
                bgcolor: percentChange < 0 ? color.loss : color.gain,
              }}
            >
              {`${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%`}
            </Box>
          </div>

          <Box
            sx={{
              display: 'inline-flex',
              borderRadius: '12px',
              backgroundColor: color.chartBase,
              padding: '4px',
              gap: '2px',
              width: 'fit-content',
              alignSelf: 'flex-start',
            }}
          >
            <IntervalSelector interval={interval} onChange={setInterval} />
          </Box>

          <Box
            sx={{
              height: 380,
              minHeight: 380,
              width: '100%',
              borderRadius: '12px',
              bgcolor: color.bgSurface,
              p: 1,
            }}
          >
            {chartData.length > 0 ? (
              <Suspense
                fallback={
                  <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: color.textMuted }}>
                    Loading chart...
                  </Box>
                }
              >
                <StockChart
                  chartData={chartData}
                  xAxisTickFormatter={xAxisTickFormatter}
                  yAxisScale={yAxisScale}
                />
              </Suspense>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  border: '1px dashed',
                  borderColor: color.border,
                  bgcolor: color.bgHover,
                  px: 2,
                  textAlign: 'center',
                  fontSize: 14,
                  color: color.textMuted,
                }}
              >
                No stock history available for {ticker}. Try another ticker symbol.
              </Box>
            )}
          </Box>

          <StockStats latestBar={latestBar} totalDays={sortedData.length} />
        </div>
      ) : null}
    </Box>
  );
};

export default Market;
