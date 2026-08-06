import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import SouthEastIcon from '@mui/icons-material/SouthEast';
import { IntervalSelector } from './IntervalSelector';
import type { CompositionFilter } from './FilterControl';
import { usePortfolioPerformance } from '../hooks/usePortfolioPerformance';
import {
  formatNumber,
  intervalOptions,
  parseIsoDate,
} from './stockMarket.types';
import type { ChartInterval } from './stockMarket.types';
import type { PortfolioChartPoint } from './PortfolioChart';

const PortfolioChart = lazy(() => import('./PortfolioChart'));

const FILTER_LABELS: Record<CompositionFilter, string> = {
  all: 'all assets',
  stock: 'stocks',
  crypto: 'crypto',
  bvb: 'BVB',
};

const GAIN_COLOR = '#27a69a';
const LOSS_COLOR = '#d92673';

const cardSx = {
  borderRadius: { xs: '16px', sm: '20px' },
  boxShadow: '0 2px 8px rgba(15, 38, 32, 0.06)',
  bgcolor: 'background.paper',
  p: { xs: 2, sm: 2.5, md: 3 },
  width: '100%',
  minWidth: 0,
} as const;

function computePerformance(
  start: { value: number; costBasis: number },
  end: { value: number; costBasis: number },
) {
  const netInvested = end.costBasis - start.costBasis;
  const gain = end.value - start.value - netInvested;
  const capitalBase = start.costBasis + Math.max(netInvested, 0);
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
  const [interval, setInterval] = useState<ChartInterval>('YTD');
  const [scrubbedPoint, setScrubbedPoint] = useState<PortfolioChartPoint | null>(null);
  const { data: allData, isLoading, isError, error } = usePortfolioPerformance(filter, portfolioId);

  const filteredData = useMemo(() => {
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
  }, [allData, interval]);

  const chartData = useMemo<PortfolioChartPoint[]>(
    () => filteredData.map((p) => ({
      t: parseIsoDate(p.date).getTime(),
      close: p.value,
      costBasis: p.costBasis,
    })),
    [filteredData],
  );

  useEffect(() => {
    setScrubbedPoint(null);
  }, [interval, filter, portfolioId]);

  const handleScrub = useCallback((point: PortfolioChartPoint | null) => {
    setScrubbedPoint((prev) => {
      if (prev?.t === point?.t) return prev;
      return point;
    });
  }, []);

  const currencyPrefix = filter === 'bvb' ? 'RON' : '$';

  const latestPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const startPoint = chartData.length > 0 ? chartData[0] : null;
  const activePoint = scrubbedPoint ?? latestPoint;

  const displayValue = activePoint?.close ?? 0;

  const periodEndPerformance = useMemo(() => {
    if (!startPoint || !latestPoint) {
      return { gain: 0, gainPercent: 0, positive: true };
    }
    return computePerformance(
      { value: startPoint.close, costBasis: startPoint.costBasis },
      { value: latestPoint.close, costBasis: latestPoint.costBasis },
    );
  }, [startPoint, latestPoint]);

  const displayPerformance = useMemo(() => {
    if (!startPoint || !activePoint) {
      return { gain: 0, gainPercent: 0, positive: true };
    }
    return computePerformance(
      { value: startPoint.close, costBasis: startPoint.costBasis },
      { value: activePoint.close, costBasis: activePoint.costBasis },
    );
  }, [startPoint, activePoint]);

  const chartDomain = useMemo((): [number, number] => {
    if (chartData.length === 0) return [0, 1];

    const values = chartData.map((p) => p.close);
    const baseline = values[0];
    const minVal = Math.min(...values, baseline);
    const maxVal = Math.max(...values, baseline);
    const spread = maxVal - minVal;
    const padding = Math.max(spread * 0.12, maxVal * 0.02, 1);

    return [minVal - padding, maxVal + padding];
  }, [chartData]);

  const performanceColor = displayPerformance.positive ? GAIN_COLOR : LOSS_COLOR;
  const chartHeight = { xs: 220, sm: 280, md: 320 };

  const intervalSelector = (
    <Box
      sx={{
        width: '100%',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        pt: { xs: 1, sm: 1.25 },
        mt: { xs: 0.5, sm: 1 },
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

  if (allData.length === 0) {
    return (
      <Alert severity="info">
        No transactions found. Add open or closed positions to see portfolio performance.
      </Alert>
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

            <Typography
              sx={{
                fontSize: { xs: 28, sm: 34, md: 40 },
                lineHeight: { xs: '34px', sm: '40px', md: '44px' },
                fontWeight: 700,
                color: '#1f2937',
                wordBreak: 'break-word',
              }}
            >
              {currencyPrefix}{formatNumber(displayValue)}
            </Typography>
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
              {Math.abs(displayPerformance.gainPercent).toFixed(2)}%
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: 13, sm: 14 },
                fontWeight: 600,
                lineHeight: 1.3,
                color: performanceColor,
              }}
            >
              {displayPerformance.gain >= 0 ? '' : '-'}
              {currencyPrefix}
              {formatNumber(Math.abs(displayPerformance.gain))}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            height: chartHeight,
            width: '100%',
            minWidth: 0,
            mt: { xs: 1.5, sm: 2 },
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
                chartData={chartData}
                positive={periodEndPerformance.positive}
                domain={chartDomain}
                onScrub={handleScrub}
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
              <Typography variant="body2" color="text.secondary" textAlign="center">
                No data available for the selected period.
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
