import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import SouthEastIcon from '@mui/icons-material/SouthEast';
import { IntervalSelector } from '../IntervalSelector';
import { intervalOptions, parseIsoDate } from '../stockMarket.types';
import type { ChartInterval } from '../stockMarket.types';
import type { PortfolioChartPoint } from '../PortfolioChart';
import {
  useStockData,
  useStockIntradayData,
  type StockBarWithDate,
} from '../../hooks/useStockData';
import {
  resolveTradingSession,
  resolveUsPriceSession,
  type SessionMarket,
} from '../../services/tradingSession';
import { resolveQuotePrice, type PriceSession, type QuoteResult } from '../../utils/resolveQuotePrice';
import sunriseIcon from '../../assets/sunrise.svg';
import sunsetIcon from '../../assets/sunset.svg';

const PortfolioChart = lazy(() => import('../PortfolioChart'));

const GAIN_COLOR = '#27a69a';
const LOSS_COLOR = '#d92673';
const MUTED = '#9a9a96';
const PRIMARY = '#393a36';
const FONT = '"Open Sans", sans-serif';

const primaryTextSx = {
  color: PRIMARY,
  fontFamily: FONT,
};

type Props = {
  ticker: string;
  currency: string;
  livePrice: number | null;
  previousClose: number | null;
  quoteChangePercent: number | null;
  marketState?: string | null;
  preMarketPrice?: number | null;
  postMarketPrice?: number | null;
  extendedMarketPrice?: number | null;
  preMarketChangePercent?: number | null;
  postMarketChangePercent?: number | null;
  extendedMarketChangePercent?: number | null;
};

function sessionMarketForTicker(ticker: string, currency: string): SessionMarket {
  const normalized = ticker.trim().toUpperCase();
  if (normalized.endsWith('-USD')) return 'crypto';
  if (currency === 'RON' || normalized.endsWith('.RO')) return 'bvb';
  return 'us';
}

function currencySymbol(currency: string): string {
  if (currency === 'RON') return 'RON';
  if (currency === 'USD') return '$';
  try {
    const part = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    })
      .formatToParts(0)
      .find((item) => item.type === 'currency');
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}

function splitAmount(value: number): { integer: string; decimal: string } {
  const [integer, decimal = '00'] = Math.abs(value).toFixed(2).split('.');
  return {
    integer: Number(integer).toLocaleString('en-US'),
    decimal,
  };
}

function formatChangeAmount(value: number, currency: string): string {
  const symbol = currencySymbol(currency);
  const amount = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const signed = value < 0 ? '-' : '';
  return symbol === '$' ? `${signed}${symbol}${amount}` : `${signed}${symbol} ${amount}`;
}

function LiveDot({ positive, pulse }: { positive: boolean; pulse: boolean }) {
  const color = positive ? GAIN_COLOR : LOSS_COLOR;
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        position: 'relative',
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        bgcolor: color,
        flexShrink: 0,
        ...(pulse
          ? {
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                bgcolor: color,
                animation: 'tickerLivePulse 1.6s ease-out infinite',
              },
              '@keyframes tickerLivePulse': {
                '0%': { transform: 'scale(1)', opacity: 0.55 },
                '70%': { transform: 'scale(2.4)', opacity: 0 },
                '100%': { transform: 'scale(2.4)', opacity: 0 },
              },
            }
          : null),
      }}
    />
  );
}

function sessionPrintPrice(quote: QuoteResult, session: PriceSession | null): number | null {
  if (session === 'PRE') {
    return quote.preMarketPrice ?? quote.extendedMarketPrice ?? null;
  }
  if (session === 'POST') {
    return quote.postMarketPrice ?? quote.extendedMarketPrice ?? null;
  }
  return null;
}

function SessionLabel({ session }: { session: PriceSession }) {
  const isPre = session === 'PRE';
  const label = isPre ? 'Pre-market' : 'Post-market';
  return (
    <Box
      component="span"
      title={label}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        columnGap: 0.5,
        mt: 0.75,
        px: 0.75,
        py: 0.25,
        borderRadius: '4px',
        bgcolor: '#e9eef6',
      }}
    >
      <Box
        component="img"
        src={isPre ? sunriseIcon : sunsetIcon}
        alt=""
        sx={{ width: 12, height: 12, opacity: 0.7 }}
      />
      <Typography
        component="span"
        sx={{
          color: MUTED,
          fontFamily: FONT,
          fontSize: 11,
          fontWeight: 600,
          lineHeight: '14px',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function latestPositiveCloseBefore(bars: StockBarWithDate[], beforeT: number): number | null {
  let close: number | null = null;
  let latestT = -Infinity;
  for (const bar of bars) {
    if (bar.t >= beforeT || bar.t < latestT || !Number.isFinite(bar.c) || bar.c <= 0) continue;
    latestT = bar.t;
    close = bar.c;
  }
  return close;
}

function firstPositiveClose(bars: StockBarWithDate[]): number | null {
  for (const bar of bars) {
    if (Number.isFinite(bar.c) && bar.c > 0) return bar.c;
  }
  return null;
}

function closeRange(bars: StockBarWithDate[]): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const bar of bars) {
    if (!Number.isFinite(bar.c) || bar.c <= 0) continue;
    if (bar.c < min) min = bar.c;
    if (bar.c > max) max = bar.c;
  }
  return min === Infinity ? null : { min, max };
}

/** Zero for the visible window: prior close if price traded through it, else first print. */
function seriesBaseline(
  visible: StockBarWithDate[],
  history: StockBarWithDate[],
  quotePreviousClose: number | null,
): number {
  const first = firstPositiveClose(visible);
  if (first == null) {
    return quotePreviousClose != null && quotePreviousClose > 0 ? quotePreviousClose : 0;
  }

  const range = closeRange(visible);
  if (!range) return first;

  const priorFromBars = latestPositiveCloseBefore(history, visible[0].t);
  const prior =
    priorFromBars ??
    (quotePreviousClose != null && quotePreviousClose > 0 ? quotePreviousClose : null);

  if (prior != null && prior >= range.min && prior <= range.max) return prior;
  return first;
}

function withLiveTip(
  bars: StockBarWithDate[],
  livePrice: number | null,
  now: number,
  sessionEnd: number,
): StockBarWithDate[] {
  if (livePrice == null || !Number.isFinite(livePrice) || livePrice <= 0) return bars;
  if (now > sessionEnd) return bars;

  const tipT = Math.min(now, sessionEnd);
  const last = bars[bars.length - 1];
  const tip: StockBarWithDate = {
    t: tipT,
    o: livePrice,
    h: livePrice,
    l: livePrice,
    c: livePrice,
    v: 0,
    date: last?.date ?? new Date(tipT).toISOString().slice(0, 10),
  };

  if (!last) return [tip];
  if (Math.abs(last.t - tipT) < 2000) {
    return [...bars.slice(0, -1), { ...last, t: tipT, c: livePrice }];
  }
  if (tipT > last.t) return [...bars, tip];
  return bars;
}

export function TickerChart({
  ticker,
  currency,
  livePrice,
  previousClose,
  quoteChangePercent,
  marketState,
  preMarketPrice,
  postMarketPrice,
  extendedMarketPrice,
  preMarketChangePercent,
  postMarketChangePercent,
  extendedMarketChangePercent,
}: Props) {
  const [interval, setInterval] = useState<ChartInterval>('1D');
  const [scrubbedPoint, setScrubbedPoint] = useState<PortfolioChartPoint | null>(null);
  const isIntraday = interval === '1D';
  const market = sessionMarketForTicker(ticker, currency);

  const { data: dailyData, error: dailyError, isLoading: isLoadingDaily } = useStockData(ticker);
  const {
    data: intradayData,
    error: intradayError,
    isLoading: isLoadingIntraday,
  } = useStockIntradayData(ticker, '5m', isIntraday);

  const isLoading = isIntraday ? isLoadingIntraday : isLoadingDaily;
  const error = isIntraday ? intradayError : dailyError;

  const sortedDaily = useMemo(
    () => [...dailyData].sort((left, right) => left.t - right.t),
    [dailyData],
  );

  const quote = useMemo(
    () =>
      resolveQuotePrice({
        symbol: ticker,
        regularMarketPrice: livePrice ?? undefined,
        regularMarketPreviousClose: previousClose,
        regularMarketChangePercent: quoteChangePercent,
        marketState: marketState ?? undefined,
        preMarketPrice,
        postMarketPrice,
        extendedMarketPrice,
        preMarketChangePercent,
        postMarketChangePercent,
        extendedMarketChangePercent,
      }),
    [
      ticker,
      livePrice,
      previousClose,
      quoteChangePercent,
      marketState,
      preMarketPrice,
      postMarketPrice,
      extendedMarketPrice,
      preMarketChangePercent,
      postMarketChangePercent,
      extendedMarketChangePercent,
    ],
  );

  const session = useMemo(() => {
    let latestBarT: number | undefined;
    for (const bar of intradayData) {
      if (bar.t > (latestBarT ?? 0)) latestBarT = bar.t;
    }
    return resolveTradingSession(market, Date.now(), latestBarT, {
      includeExtendedHours: market === 'us',
    });
  }, [intradayData, market]);

  const priceSession = quote.session ?? (market === 'us' ? resolveUsPriceSession(Date.now()) : null);

  const sessionLivePrice = useMemo(() => {
    const print = sessionPrintPrice(
      {
        symbol: ticker,
        preMarketPrice,
        postMarketPrice,
        extendedMarketPrice,
      },
      priceSession,
    );
    if (print != null && print > 0) return print;
    if (priceSession) {
      let latest: StockBarWithDate | undefined;
      for (const bar of intradayData) {
        if (bar.t >= session.start && bar.t <= session.end && Number.isFinite(bar.c)) {
          if (!latest || bar.t > latest.t) latest = bar;
        }
      }
      if (latest && latest.c > 0) return latest.c;
    }
    return livePrice ?? (quote.price > 0 ? quote.price : null);
  }, [
    ticker,
    preMarketPrice,
    postMarketPrice,
    extendedMarketPrice,
    priceSession,
    quote.price,
    intradayData,
    session.start,
    session.end,
    livePrice,
  ]);

  const filteredBars = useMemo(() => {
    if (isIntraday) {
      const inSession = [...intradayData]
        .filter((bar) => bar.t >= session.start && bar.t <= session.end && Number.isFinite(bar.c))
        .sort((left, right) => left.t - right.t);
      return withLiveTip(inSession, sessionLivePrice, Date.now(), session.end);
    }

    if (sortedDaily.length === 0) return [];

    const latestDate = parseIsoDate(sortedDaily[sortedDaily.length - 1].date);
    let startDate: Date | null = null;

    if (interval === 'MAX') return sortedDaily;

    if (interval === 'YTD') {
      startDate = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    } else {
      const selected = intervalOptions.find((option) => option.key === interval);
      if (selected?.days) {
        startDate = new Date(latestDate);
        startDate.setUTCDate(startDate.getUTCDate() - selected.days);
      }
    }

    if (!startDate) return sortedDaily;
    const sliced = sortedDaily.filter((bar) => parseIsoDate(bar.date) >= startDate);
    return sliced.length > 0 ? sliced : sortedDaily;
  }, [interval, isIntraday, sortedDaily, intradayData, sessionLivePrice, session]);

  const baseline = useMemo(
    () =>
      seriesBaseline(
        filteredBars,
        isIntraday ? intradayData : sortedDaily,
        previousClose,
      ),
    [filteredBars, isIntraday, intradayData, sortedDaily, previousClose],
  );

  const chartData = useMemo<PortfolioChartPoint[]>(
    () =>
      filteredBars.map((bar) => ({
        t: bar.t,
        close: bar.c,
        rawValue: bar.c,
        costBasis: baseline,
      })),
    [filteredBars, baseline],
  );

  useEffect(() => {
    setScrubbedPoint(null);
  }, [interval, ticker]);

  const handleScrub = useCallback((point: PortfolioChartPoint | null) => {
    setScrubbedPoint((prev) => (prev?.t === point?.t ? prev : point));
  }, []);

  const latestPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const displayPrice =
    scrubbedPoint?.rawValue ?? sessionLivePrice ?? latestPoint?.rawValue ?? null;

  const periodEndPrice = latestPoint?.rawValue ?? sessionLivePrice;
  const periodPositive =
    baseline > 0 && periodEndPrice != null ? periodEndPrice >= baseline : (quoteChangePercent ?? 0) >= 0;

  const changeAmount =
    displayPrice != null && baseline > 0 ? displayPrice - baseline : null;
  const changePercent =
    changeAmount != null && baseline > 0
      ? (changeAmount / baseline) * 100
      : isIntraday && !scrubbedPoint
        ? quoteChangePercent
        : null;
  const displayPositive = (changePercent ?? 0) >= 0;
  const performanceColor = displayPositive ? GAIN_COLOR : LOSS_COLOR;

  const chartDomain = useMemo((): [number, number] => {
    if (chartData.length === 0) {
      const fallback = baseline > 0 ? baseline : 1;
      return [fallback * 0.99, fallback * 1.01];
    }

    const values = chartData.map((point) => point.close);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const spread = maxVal - minVal;
    const padding = Math.max(spread * 0.18, maxVal * 0.002, 0.01);
    return [minVal - padding, maxVal + padding];
  }, [chartData, baseline]);

  const xDomain = useMemo((): [number, number] | undefined => {
    if (!isIntraday) return undefined;
    return [session.start, session.end];
  }, [isIntraday, session.start, session.end]);

  const liveAt = isIntraday && latestPoint ? latestPoint.t : undefined;
  const symbol = currencySymbol(currency);
  const priceParts = displayPrice != null && Number.isFinite(displayPrice) ? splitAmount(displayPrice) : null;
  const chartHeight = { xs: 200, sm: 240 };

  const intervalSelector = (
    <Box
      sx={{
        width: '100%',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        pt: 0.5,
      }}
    >
      <IntervalSelector interval={interval} onChange={setInterval} fullWidth variant="pill" />
    </Box>
  );

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', rowGap: 1.5 }}>
        <Typography sx={{ ...primaryTextSx, fontSize: 14, color: LOSS_COLOR }}>
          {error}
        </Typography>
        {intervalSelector}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            columnGap: 1,
            minWidth: 0,
          }}
        >
          {priceParts ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  columnGap: 1,
                  minWidth: 0,
                }}
              >
                <LiveDot positive={displayPositive} pulse={isIntraday && !scrubbedPoint} />
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    columnGap: 0.75,
                    minWidth: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <Typography
                    component="span"
                    sx={{
                      ...primaryTextSx,
                      fontSize: { xs: 22, sm: 26 },
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {symbol}
                  </Typography>
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline' }}>
                    <Typography
                      component="span"
                      sx={{
                        ...primaryTextSx,
                        fontSize: { xs: 36, sm: 44 },
                        fontWeight: 800,
                        lineHeight: 1,
                        letterSpacing: '-0.03em',
                      }}
                    >
                      {priceParts.integer}
                    </Typography>
                    <Typography
                      component="span"
                      sx={{
                        ...primaryTextSx,
                        fontSize: { xs: 22, sm: 26 },
                        fontWeight: 700,
                        lineHeight: 1,
                      }}
                    >
                      .{priceParts.decimal}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              {isIntraday && !scrubbedPoint && priceSession ? (
                <Box sx={{ ml: 2 }}>
                  <SessionLabel session={priceSession} />
                </Box>
              ) : null}
            </Box>
          ) : isLoading ? (
            <Skeleton height={48} sx={{ width: { xs: 180, sm: 220 } }} />
          ) : (
            <Typography sx={{ ...primaryTextSx, fontSize: 36, fontWeight: 800 }}>—</Typography>
          )}
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            pt: { xs: 0.75, sm: 1.25 },
            flexShrink: 0,
          }}
        >
          {changePercent != null ? (
            <>
              <Typography
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.25,
                  fontSize: { xs: 15, sm: 17 },
                  fontWeight: 700,
                  lineHeight: 1.25,
                  color: performanceColor,
                  fontFamily: FONT,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {displayPositive ? (
                  <NorthEastIcon sx={{ fontSize: '1em' }} />
                ) : (
                  <SouthEastIcon sx={{ fontSize: '1em' }} />
                )}
                {`${Math.abs(changePercent).toFixed(2)}%`}
              </Typography>
              {changeAmount != null ? (
                <Typography
                  sx={{
                    fontSize: { xs: 13, sm: 14 },
                    fontWeight: 600,
                    lineHeight: 1.3,
                    color: performanceColor,
                    fontFamily: FONT,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatChangeAmount(changeAmount, currency)}
                </Typography>
              ) : null}
            </>
          ) : isLoading ? (
            <>
              <Skeleton width={72} height={22} />
              <Skeleton width={64} height={18} />
            </>
          ) : null}
        </Box>
      </Box>

      <Box
        data-no-pull-refresh
        sx={{
          height: chartHeight,
          width: '100%',
          minWidth: 0,
          mt: { xs: 1.5, sm: 2 },
          touchAction: 'none',
        }}
      >
        {isLoading && chartData.length === 0 ? (
          <Skeleton variant="rectangular" width="100%" height="100%" sx={{ borderRadius: 2 }} />
        ) : chartData.length > 0 ? (
          <Suspense
            fallback={
              <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                <CircularProgress size={32} />
              </Box>
            }
          >
            <PortfolioChart
              key={`${ticker}-${interval}`}
              chartData={chartData}
              positive={periodPositive}
              domain={chartDomain}
              xDomain={xDomain}
              liveAt={liveAt}
              baseline={baseline}
              showBaseline
              onScrub={handleScrub}
              cursorFormat={isIntraday ? 'time' : 'date'}
              lineType={isIntraday ? 'linear' : 'monotone'}
            />
          </Suspense>
        ) : (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            height="100%"
            sx={{
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'grey.50',
              px: 2,
            }}
          >
            <Typography sx={{ color: MUTED, fontSize: 14, fontFamily: FONT, textAlign: 'center' }}>
              {isIntraday
                ? 'No data available for this session.'
                : 'No data available for the selected period.'}
            </Typography>
          </Box>
        )}
      </Box>

      {intervalSelector}
    </Box>
  );
}
