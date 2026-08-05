import { lazy, Suspense, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { IntervalSelector } from '../components/IntervalSelector';
import { FilterControl } from '../components/FilterControl';
import type { CompositionFilter } from '../components/FilterControl';
import { usePortfolioPerformance } from '../hooks/usePortfolioPerformance';
import { usePortfolioContext } from '../contexts/PortfolioContext';
import {
  formatNumber,
  formatTimestamp,
  getNiceTickStep,
  intervalOptions,
  parseIsoDate,
} from '../components/stockMarket.types';
import type { ChartInterval } from '../components/stockMarket.types';
import type { PortfolioChartPoint } from '../components/PortfolioChart';

const PortfolioChart = lazy(() => import('../components/PortfolioChart'));

const FILTER_LABELS: Record<CompositionFilter, string> = {
  all: 'all assets',
  stock: 'stocks',
  crypto: 'crypto',
  bvb: 'BVB',
};

const cardSx = {
  borderRadius: { xs: '16px', sm: '20px' },
  boxShadow: '0 2px 8px rgba(15, 38, 32, 0.06)',
  bgcolor: 'background.paper',
  p: { xs: 2, sm: 2.5, md: 3 },
  width: '100%',
  minWidth: 0,
} as const;

const PortfolioPerformance = () => {
  const [interval, setInterval] = useState<ChartInterval>('1Y');
  const [filter, setFilter] = useState<CompositionFilter>('stock');
  const { selectedPortfolioId } = usePortfolioContext();
  const { data: allData, isLoading, isError, error } = usePortfolioPerformance(filter, selectedPortfolioId ?? '');

  const filteredData = useMemo(() => {
    if (allData.length === 0) return [];

    const latestDate = parseIsoDate(allData[allData.length - 1].date);
    let startDate: Date | null = null;

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

  const lastAllPoint = allData.length > 0 ? allData[allData.length - 1] : null;
  const currentValue = lastAllPoint?.value ?? 0;
  const allTimeGain = lastAllPoint ? lastAllPoint.value - lastAllPoint.costBasis : 0;
  const allTimeGainPercent =
    lastAllPoint && lastAllPoint.costBasis > 0
      ? (allTimeGain / lastAllPoint.costBasis) * 100
      : 0;
  const gainPositive = allTimeGain >= 0;
  const currencyPrefix = filter === 'bvb' ? 'RON' : '$';

  const xAxisTickFormatter = useMemo(() => {
    const options: Intl.DateTimeFormatOptions =
      interval === '1W' || interval === '1M' || interval === '3M'
        ? { month: 'short', day: 'numeric' }
        : interval === '5Y' || interval === '10Y'
          ? { month: 'short', year: '2-digit' }
          : { month: 'short', day: 'numeric', year: '2-digit' };
    return (value: number) => formatTimestamp(value, options);
  }, [interval]);

  const yAxisScale = useMemo(() => {
    if (chartData.length === 0) {
      return { ticks: [0, 25000, 50000, 75000, 100000], domain: [0, 100000] as [number, number] };
    }

    const values = chartData.flatMap((p) => [p.close, p.costBasis]);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const spread = maxVal - minVal;
    const padding = Math.max(spread * 0.12, maxVal * 0.01, 1);
    const paddedMin = Math.max(0, minVal - padding);
    const paddedMax = maxVal + padding;
    const step = getNiceTickStep((paddedMax - paddedMin) / 5);
    const minTick = Math.floor(paddedMin / step) * step;
    const maxTick = Math.ceil(paddedMax / step) * step;

    const ticks: number[] = [];
    for (let tick = minTick; tick <= maxTick + step / 2; tick += step) {
      ticks.push(tick);
    }
    return { ticks, domain: [minTick, maxTick] as [number, number] };
  }, [chartData]);

  if (!selectedPortfolioId) return null;

  const filterControl = (
    <FilterControl value={filter} onChange={setFilter} exclude={['all']} />
  );

  const intervalSelector = (
    <Box
      sx={{
        width: '100%',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        pt: { xs: 1.25, sm: 1.5 },
        mt: { xs: 1.25, sm: 1.5 },
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <IntervalSelector
        interval={interval}
        onChange={setInterval}
        fullWidth
        variant="underline"
      />
    </Box>
  );

  const legend = (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: { xs: 1.5, sm: 2.5 },
        mt: { xs: 2, sm: 2.5 },
        mb: { xs: 1, sm: 1.5 },
      }}
    >
      {[
        { label: 'Portfolio value', color: 'var(--color-portfolio-value)' },
        { label: 'Cost basis', color: 'var(--color-portfolio-cost)' },
      ].map((item) => (
        <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '3px',
              bgcolor: item.color,
              flexShrink: 0,
            }}
          />
          <Typography
            sx={{
              fontSize: { xs: 12, sm: 13 },
              color: 'text.secondary',
              lineHeight: 1.2,
            }}
          >
            {item.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );

  const chartHeight = { xs: 240, sm: 300, md: 360 };

  const chartArea = (
    <Box
      sx={{
        height: chartHeight,
        width: '100%',
        minWidth: 0,
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
            xAxisTickFormatter={xAxisTickFormatter}
            yAxisScale={yAxisScale}
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
  );

  const footer = (
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
  );

  return (
    <Stack spacing={2} sx={{ width: '100%', minWidth: 0 }}>
      {isError && (
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Failed to load portfolio performance.'}
        </Alert>
      )}

      {isLoading && (
        <Stack spacing={1.5} sx={{ width: '100%', minWidth: 0 }}>
          {filterControl}
          <Box sx={cardSx}>
            <Skeleton width={90} height={18} sx={{ mb: 1 }} />
            <Skeleton height={40} sx={{ mb: 1.5, width: { xs: '70%', sm: 200 } }} />
            <Skeleton height={24} sx={{ mb: 2, width: { xs: '85%', sm: 260 } }} />
            <Skeleton
              variant="rectangular"
              width="100%"
              sx={{ borderRadius: 2, height: chartHeight }}
            />
            {intervalSelector}
          </Box>
          {footer}
        </Stack>
      )}

      {!isLoading && !isError && allData.length === 0 && (
        <>
          {filterControl}
          <Alert severity="info">
            No transactions found. Add open or closed positions to see portfolio performance.
          </Alert>
        </>
      )}

      {!isLoading && !isError && allData.length > 0 && (
        <Stack spacing={1.5} sx={{ width: '100%', minWidth: 0 }}>
          {filterControl}

          <Box sx={cardSx}>
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
              {currencyPrefix}{formatNumber(currentValue)}
            </Typography>

            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: { xs: 1, sm: 1.25 },
                mt: 1,
              }}
            >
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: '999px',
                  px: 1.25,
                  py: 0.4,
                  fontSize: { xs: 12, sm: 13 },
                  fontWeight: 700,
                  lineHeight: 1.2,
                  bgcolor: gainPositive ? '#edf9f8' : '#fdf2f7',
                  color: gainPositive ? '#27a69a' : '#d92673',
                }}
              >
                {gainPositive ? '▲' : '▼'} {Math.abs(allTimeGainPercent).toFixed(2)}%
              </Box>

              <Typography
                sx={{
                  fontSize: { xs: 13, sm: 14 },
                  color: 'text.secondary',
                  lineHeight: 1.3,
                }}
              >
                {allTimeGain >= 0 ? '+' : '-'}
                {currencyPrefix}
                {formatNumber(Math.abs(allTimeGain))} all-time
              </Typography>
            </Box>

            {legend}
            {chartArea}
            {intervalSelector}
          </Box>

          {footer}
        </Stack>
      )}
    </Stack>
  );
};

export default PortfolioPerformance;
