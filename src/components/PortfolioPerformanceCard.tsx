import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import SouthEastIcon from '@mui/icons-material/SouthEast';
import { IntervalSelector } from './IntervalSelector';
import type { CompositionFilter } from './FilterControl';
import { usePortfolioPerformance } from '../hooks/usePortfolioPerformance';
import { usePortfolioIntradayPerformance } from '../hooks/usePortfolioIntradayPerformance';
import { useValuesVisibility } from '../contexts/ValuesVisibilityContext';
import {
  formatNumber,
  intervalOptions,
  parseIsoDate,
} from './stockMarket.types';
import type { ChartInterval } from './stockMarket.types';
import type { PortfolioChartPoint } from './PortfolioChart';
import {
  buildTimeWeightedSeries,
  returnOnCostPercent,
  toCumulativeReturnPercent,
} from '../services/performanceSeries';
import { color, shadow } from '../theme/cssVars';

const PortfolioChart = lazy(() => import('./PortfolioChart'));

const FILTER_LABELS: Record<CompositionFilter, string> = {
  all: 'all assets',
  stock: 'stocks',
  etf: 'ETFs',
  crypto: 'crypto',
  bvb: 'BVB',
};

const GAIN_COLOR = color.gain;
const LOSS_COLOR = color.loss;
const MUTED = color.textSubtle;

const cardSx = {
  borderRadius: { xs: '16px', sm: '20px' },
  boxShadow: shadow.cardRaised,
  bgcolor: 'background.paper',
  p: { xs: 2, sm: 2.5, md: 3 },
  width: '100%',
  minWidth: 0,
} as const;

/** Cash-flow-adjusted period P&L on starting market value (header % / $). */
function computePerformance(
  start: { value: number; costBasis: number },
  end: { value: number; costBasis: number },
) {
  const netInvested = end.costBasis - start.costBasis;
  const gain = end.value - start.value - netInvested;
  const capitalBase = start.value + Math.max(netInvested, 0);
  const gainPercent = capitalBase > 0 ? (gain / capitalBase) * 100 : 0;

  return { gain, gainPercent, positive: gain >= 0 };
}

type Props = {
  filter: CompositionFilter;
  portfolioId: string;
  showFooter?: boolean;
};

export function PortfolioPerformanceCard({
  filter,
  portfolioId,
  showFooter = true,
}: Props) {
  const [interval, setInterval] = useState<ChartInterval>('1D');
  const [scrubbedPoint, setScrubbedPoint] = useState<PortfolioChartPoint | null>(null);
  const isIntraday = interval === '1D';
  const {
    data: allData,
    cashFlows,
    isLoading: isLoadingDaily,
    isError: isErrorDaily,
    error: dailyError,
  } = usePortfolioPerformance(filter, portfolioId);
  const {
    data: intradayData,
    sessionStart,
    sessionEnd,
    isLoading: isLoadingIntraday,
    isError: isErrorIntraday,
    error: intradayError,
  } = usePortfolioIntradayPerformance(filter, portfolioId, isIntraday);
  const { valuesHidden } = useValuesVisibility();

  // 1D still needs the daily series so the headline Total Value matches 1W+.
  // Wait for quotes to patch that last daily point — otherwise the number flashes.
  const isLoading = isIntraday
    ? isLoadingIntraday || isLoadingDaily
    : isLoadingDaily;
  const isError = isIntraday ? isErrorIntraday : isErrorDaily;
  const error = isIntraday ? intradayError : dailyError;

  const filteredData = useMemo(() => {
    if (isIntraday) return [];
    if (allData.length === 0) return [];

    const latestDate = parseIsoDate(allData[allData.length - 1].date);
    let startDate: Date | null = null;

    if (interval === 'MAX') {
      return allData;
    }

    if (interval === 'YTD') {
      startDate = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    } else {
      const selected = intervalOptions.find((o) => o.key === interval);
      if (selected?.days) {
        startDate = new Date(latestDate);
        startDate.setUTCDate(startDate.getUTCDate() - selected.days);
      }
    }

    if (!startDate) return allData;
    const sliced = allData.filter((p) => parseIsoDate(p.date) >= startDate!);
    return sliced.length > 0 ? sliced : allData;
  }, [allData, interval, isIntraday]);

  const chartData = useMemo<PortfolioChartPoint[]>(() => {
    if (isIntraday) {
      if (intradayData.length === 0) return [];
      const startValue = intradayData[0].value;
      return intradayData.map((p) => ({
        t: p.t,
        close: startValue > 0 ? ((p.value / startValue) - 1) * 100 : 0,
        rawValue: p.value,
        costBasis: p.costBasis,
      }));
    }

    // MAX: return on cost (0% = money invested).
    // YTD/1W/1M/1Y: period TWR % (0% = interval start) so the chart matches header P&L.
    if (interval === 'MAX') {
      return filteredData.map((p) => ({
        t: parseIsoDate(p.date).getTime(),
        close: returnOnCostPercent(p.value, p.costBasis),
        rawValue: p.value,
        costBasis: p.costBasis,
      }));
    }

    const externalFlows = cashFlows
      .filter(
        (cf) =>
          filteredData.length > 0 &&
          cf.date > filteredData[0].date &&
          cf.date <= filteredData[filteredData.length - 1].date,
      )
      .map((cf) => ({ date: cf.date, amount: -cf.amount }));

    const twr = toCumulativeReturnPercent(
      buildTimeWeightedSeries(filteredData, externalFlows),
    );
    return twr.map((p) => ({
      t: parseIsoDate(p.date).getTime(),
      close: p.returnPercent,
      rawValue: p.value,
      costBasis: p.costBasis,
    }));
  }, [filteredData, interval, cashFlows, isIntraday, intradayData]);

  useEffect(() => {
    setScrubbedPoint(null);
  }, [interval, filter, portfolioId]);

  const handleScrub = useCallback((point: PortfolioChartPoint | null) => {
    setScrubbedPoint((prev) => {
      if (prev?.t === point?.t) return prev;
      return point;
    });
  }, []);

  const currencyPrefix = filter === 'bvb' ? 'RON' : filter === 'etf' ? '€' : '$';

  const latestPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const startPoint = chartData.length > 0 ? chartData[0] : null;
  const activePoint = scrubbedPoint ?? latestPoint;

  // Always show the live daily mark so 1D matches 1W/1M/… after hours.
  // The 1D series last print can still be the prior session close.
  const liveTotalValue =
    allData.length > 0 ? allData[allData.length - 1].value : undefined;
  const displayValue =
    scrubbedPoint?.rawValue ?? liveTotalValue ?? activePoint?.rawValue ?? 0;

  const periodEndPerformance = useMemo(() => {
    if (!startPoint || !latestPoint) {
      return { gain: 0, gainPercent: 0, positive: true };
    }
    return computePerformance(
      { value: startPoint.rawValue, costBasis: startPoint.costBasis },
      { value: latestPoint.rawValue, costBasis: latestPoint.costBasis },
    );
  }, [startPoint, latestPoint]);

  const displayPerformance = useMemo(() => {
    if (!startPoint || !activePoint) {
      return { gain: 0, gainPercent: 0, positive: true };
    }
    return computePerformance(
      { value: startPoint.rawValue, costBasis: startPoint.costBasis },
      { value: activePoint.rawValue, costBasis: activePoint.costBasis },
    );
  }, [startPoint, activePoint]);

  const chartDomain = useMemo((): [number, number] => {
    if (chartData.length === 0) return [-1, 1];

    const values = chartData.map((p) => p.close);

    if (isIntraday) {
      const minVal = Math.min(...values, 0);
      const maxVal = Math.max(...values, 0);
      const spread = maxVal - minVal;
      const padding = Math.max(spread * 0.18, 0.02);
      return [minVal - padding, maxVal + padding];
    }

    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 0);
    const spread = maxVal - minVal;
    const padding = Math.max(spread * 0.12, 0.5);

    return [minVal - padding, maxVal + padding];
  }, [chartData, isIntraday]);

  const liveAt = isIntraday && latestPoint ? latestPoint.t : undefined;
  const xDomain = useMemo((): [number, number] | undefined => {
    if (!isIntraday || sessionStart == null || sessionEnd == null) return undefined;
    return [sessionStart, sessionEnd];
  }, [isIntraday, sessionStart, sessionEnd]);

  const performanceColor = displayPerformance.positive ? GAIN_COLOR : LOSS_COLOR;
  const chartHeight = { xs: 220, sm: 280, md: 320 };

  const intervalSelector = (
    <Box
      sx={{
        width: '100%',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        pt: { xs: 1.25, sm: 1.5 },
        mt: { xs: 0.5, sm: 0.75 },
        borderTop: '1px dotted',
        borderColor: color.border,
      }}
    >
      <IntervalSelector
        interval={interval}
        onChange={setInterval}
        fullWidth
        variant="pill"
      />
    </Box>
  );

  const footer = showFooter ? (
    <Typography
      sx={{
        textAlign: 'center',
        color: 'text.secondary',
        fontSize: { xs: 12, sm: 13 },
        pt: 0.5,
      }}
    >
      Showing {FILTER_LABELS[filter]} · {interval} range
    </Typography>
  ) : null;

  if (isError) {
    return (
      <Alert severity="error">
        {error instanceof Error ? error.message : 'Failed to load portfolio performance.'}
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Stack spacing={1.5} sx={{ width: '100%', minWidth: 0 }}>
        <Box sx={cardSx}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 2,
              mb: 2,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Skeleton width={90} height={18} sx={{ mb: 1 }} />
              <Skeleton height={40} sx={{ width: { xs: '80%', sm: 200 } }} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
              <Skeleton width={72} height={22} />
              <Skeleton width={88} height={20} />
            </Box>
          </Box>
          <Skeleton
            variant="rectangular"
            width="100%"
            sx={{ borderRadius: 2, height: chartHeight }}
          />
          {intervalSelector}
        </Box>
        {footer}
      </Stack>
    );
  }

  if (!isIntraday && allData.length === 0) {
    return (
      <Box sx={{ bgcolor: color.bgSurface, borderRadius: '16px', p: 3, boxShadow: shadow.card }}>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          No transactions found to show performance.
        </Typography>
      </Box>
    );
  }

  if (isIntraday && allData.length === 0 && intradayData.length === 0 && !isLoadingDaily) {
    return (
      <Box sx={{ bgcolor: color.bgSurface, borderRadius: '16px', p: 3, boxShadow: shadow.card }}>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          No data available for this session.
        </Typography>
      </Box>
    );
  }
  
  return (
    <Stack spacing={1.5} sx={{ width: '100%', minWidth: 0 }}>
      <Box sx={cardSx}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{
                fontSize: { xs: 13, sm: 14 },
                color: 'text.secondary',
                fontWeight: 500,
                mb: 0.5,
              }}
            >
              Total Value
            </Typography>

            {valuesHidden ? (
              <LockOutlinedIcon sx={{ fontSize: { xs: 28, sm: 34, md: 40 }, color: MUTED }} />
            ) : (
              <Typography
                sx={{
                  fontSize: { xs: 28, sm: 34, md: 40 },
                  lineHeight: { xs: '34px', sm: '40px', md: '44px' },
                  fontWeight: 700,
                  color: color.textStrong,
                  wordBreak: 'break-word',
                }}
              >
                {`${currencyPrefix}${formatNumber(displayValue)}`}
              </Typography>
            )}
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              pt: { xs: 2.5, sm: 3 },
              flexShrink: 0,
            }}
          >
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
              }}
            >
              {displayPerformance.positive ? (
                <NorthEastIcon sx={{ fontSize: '1em' }} />
              ) : (
                <SouthEastIcon sx={{ fontSize: '1em' }} />
              )}
              {`${Math.abs(displayPerformance.gainPercent).toFixed(2)}%`}
            </Typography>
            {valuesHidden ? (
              <LockOutlinedIcon sx={{ fontSize: 18, color: MUTED }} />
            ) : (
              <Typography
                sx={{
                  fontSize: { xs: 13, sm: 14 },
                  fontWeight: 600,
                  lineHeight: 1.3,
                  color: performanceColor,
                }}
              >
                {`${displayPerformance.gain >= 0 ? '' : '-'}${currencyPrefix}${formatNumber(Math.abs(displayPerformance.gain))}`}
              </Typography>
            )}
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
          {chartData.length > 0 ? (
            <Suspense
              fallback={
                <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                  <CircularProgress size={32} />
                </Box>
              }
            >
              <PortfolioChart
                key={`${portfolioId}-${filter}-${interval}`}
                chartData={chartData}
                positive={periodEndPerformance.positive}
                domain={chartDomain}
                xDomain={xDomain}
                liveAt={liveAt}
                onScrub={handleScrub}
                cursorFormat={isIntraday ? 'time' : 'date'}
                showBaseline
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
                bgcolor: color.bgHover,
                px: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary" textAlign="center">
                {isIntraday
                  ? 'No data available for this session.'
                  : 'No data available for the selected period.'}
              </Typography>
            </Box>
          )}
        </Box>

        {intervalSelector}
      </Box>

      {footer}
    </Stack>
  );
}
