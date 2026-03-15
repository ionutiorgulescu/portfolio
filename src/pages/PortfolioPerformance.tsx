import { lazy, Suspense, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { IntervalSelector } from '../components/IntervalSelector';
import { usePortfolioPerformance } from '../hooks/usePortfolioPerformance';
import {
  formatNumber,
  formatTimestamp,
  getNiceTickStep,
  intervalOptions,
  parseIsoDate,
} from '../components/stockDashboard.types';
import type { ChartInterval } from '../components/stockDashboard.types';
import type { PortfolioChartPoint } from '../components/PortfolioChart';

const PortfolioChart = lazy(() => import('../components/PortfolioChart'));


const PortfolioPerformance = () => {
  const [interval, setInterval] = useState<ChartInterval>('1Y');
  const { data: allData, isLoading, isError, error } = usePortfolioPerformance();

  // Slice the full series by the selected interval without re-running computation
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

  // Convert PortfolioDataPoint[] → PortfolioChartPoint[]
  const chartData = useMemo<PortfolioChartPoint[]>(
    () =>
      filteredData.map((p) => ({
        t: parseIsoDate(p.date).getTime(),
        close: p.value,
        costBasis: p.costBasis,
      })),
    [filteredData],
  );

  const lastAllPoint = allData.length > 0 ? allData[allData.length - 1] : null;
  const currentValue = lastAllPoint?.value ?? 0;
  const allTimeGain = lastAllPoint ? lastAllPoint.value - lastAllPoint.costBasis : 0;

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

  return (
    <Stack spacing={3}>

      {isLoading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress aria-label="Loading portfolio performance" />
        </Box>
      )}

      {isError && (
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Failed to load portfolio performance.'}
        </Alert>
      )}

      {!isLoading && !isError && allData.length === 0 && (
        <Alert severity="info">
          No transactions found. Add open or closed positions to see portfolio performance.
        </Alert>
      )}

      {!isLoading && !isError && allData.length > 0 && (
        <Paper elevation={1} sx={{ p: 3 }}>
          <Stack spacing={3}>
            <Stack direction="row" alignItems="flex-start" gap={6}>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Total Value
                </Typography>
                <Typography variant="h5" fontWeight={700} color="text.primary">
                  ${formatNumber(currentValue)}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  All-Time Gain
                </Typography>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  color={
                    allTimeGain > 0
                      ? 'success.main'
                      : allTimeGain < 0
                        ? 'error.main'
                        : 'text.primary'
                  }
                >
                  {allTimeGain >= 0 ? '+' : '-'}${formatNumber(Math.abs(allTimeGain))}
                </Typography>
              </Box>
            </Stack>

            <Box
              sx={{
                display: 'inline-flex',
                borderRadius: '12px',
                backgroundColor: 'grey.200',
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
                width: '100%',
                borderRadius: 3,
                bgcolor: 'background.paper',
                p: 1,
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
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    No data available for the selected period.
                  </Typography>
                </Box>
              )}
            </Box>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};

export default PortfolioPerformance;
