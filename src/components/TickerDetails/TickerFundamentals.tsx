import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import type { TickerFundamentals as TickerFundamentalsData } from '../../hooks/useTickerFundamentals';

const primaryTextSx = {
  color: '#393a36',
  fontFamily: '"Open Sans", sans-serif',
};

const mutedTextSx = {
  color: '#9a9a96',
  fontFamily: '"Open Sans", sans-serif',
};

function formatPrice(value: number | null | undefined, currency = 'USD'): string {
  if (value == null || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function formatCompactMoney(value: number | null | undefined, currency = 'USD'): string {
  if (value == null || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return formatPrice(value, currency);
  }
}

function formatCompactNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRatio(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(2);
}

function PriceSpan({
  label,
  low,
  high,
  current,
  currency,
}: {
  label: string;
  low: number | null;
  high: number | null;
  current: number | null;
  currency: string;
}) {
  const hasRange = low != null && high != null && high > low;
  const pct =
    hasRange && current != null
      ? Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100))
      : 50;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', rowGap: 1 }}>
      <Typography sx={{ ...mutedTextSx, fontSize: 13, lineHeight: '16px', fontWeight: 500 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', columnGap: 1.5 }}>
        <Typography
          sx={{
            ...primaryTextSx,
            fontSize: 13,
            lineHeight: '16px',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            minWidth: 64,
          }}
        >
          {formatPrice(low, currency)}
        </Typography>
        <Box
          sx={{
            flex: 1,
            position: 'relative',
            height: 18,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Box
            sx={{
              width: '100%',
              height: 3,
              bgcolor: '#e6e6e3',
              borderRadius: 999,
            }}
          />
          {hasRange && current != null ? (
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                left: `${pct}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 36,
                height: 7,
                bgcolor: '#1c1c1a',
                borderRadius: 999,
              }}
            />
          ) : null}
        </Box>
        <Typography
          sx={{
            ...primaryTextSx,
            fontSize: 13,
            lineHeight: '16px',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            minWidth: 64,
            textAlign: 'right',
          }}
        >
          {formatPrice(high, currency)}
        </Typography>
      </Box>
    </Box>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', rowGap: 0.5, minWidth: 0 }}>
      <Typography sx={{ ...mutedTextSx, fontSize: 13, lineHeight: '16px', fontWeight: 500 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          ...primaryTextSx,
          fontSize: 18,
          lineHeight: '24px',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function FundamentalsSkeleton() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', rowGap: 3 }}>
      <Skeleton width={140} height={32} sx={{ mt: 1 }} />
      <Skeleton width="100%" height={40} />
      <Skeleton width="100%" height={40} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          columnGap: 3,
          rowGap: 3,
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <Box key={i}>
            <Skeleton width={80} height={16} sx={{ mb: 0.75 }} />
            <Skeleton width={110} height={24} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function metricsFromData(data: TickerFundamentalsData) {
  const currency = data.currency || 'USD';
  const isRegularHours = (data.marketState ?? '').toUpperCase() === 'REGULAR';
  return [
    { label: 'Open', value: formatPrice(data.open, currency) },
    {
      label: isRegularHours ? 'Prev Close' : 'Close',
      value: formatPrice(isRegularHours ? data.previousClose : data.price, currency),
    },
    { label: 'Market Cap', value: formatCompactMoney(data.marketCap, currency) },
    { label: 'EPS (TTM)', value: formatPrice(data.epsTtm, currency) },
    { label: 'Free Float', value: formatCompactNumber(data.floatShares) },
    { label: 'P/E ratio (TTM)', value: formatRatio(data.peRatioTtm) },
    { label: 'Revenue (TTM)', value: formatCompactMoney(data.revenueTtm, currency) },
    { label: 'EBITDA (TTM)', value: formatCompactMoney(data.ebitdaTtm, currency) },
    { label: 'Free Cashflow (TTM)', value: formatCompactMoney(data.freeCashflowTtm, currency) },
  ];
}

type TickerFundamentalsProps = {
  data: TickerFundamentalsData | undefined;
  isLoading: boolean;
  error: Error | null;
  currency: string;
};

export function TickerFundamentals({
  data,
  isLoading,
  error,
  currency,
}: TickerFundamentalsProps) {
  if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }

  if (isLoading && !data) {
    return <FundamentalsSkeleton />;
  }

  if (!data) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', rowGap: 3 }}>
      <Typography
        sx={{
          ...primaryTextSx,
          fontSize: { xs: 28, sm: 32 },
          lineHeight: 1.15,
          fontWeight: 800,
          letterSpacing: '-0.02em',
        }}
      >
        Financials
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', rowGap: 2.5 }}>
        <PriceSpan
          label="1D span"
          low={data.dayLow}
          high={data.dayHigh}
          current={data.price}
          currency={currency}
        />
        <PriceSpan
          label="52W span"
          low={data.fiftyTwoWeekLow}
          high={data.fiftyTwoWeekHigh}
          current={data.price}
          currency={currency}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          columnGap: { xs: 3, sm: 6 },
          rowGap: 3,
          pt: 0.5,
        }}
      >
        {metricsFromData(data).map((metric) => (
          <MetricCell key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </Box>
    </Box>
  );
}
