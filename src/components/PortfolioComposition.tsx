import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { usePortfolioComposition } from '../hooks/usePortfolioComposition';
import { useStockLogos } from '../hooks/useStockLogos';
import type { CompositionFilter } from './FilterControl';
import { PortfolioCompositionRow } from './PortfolioCompositionRaw';

function RowSkeleton() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr 48px 88px', sm: '1fr 80px 110px' },
        alignItems: 'center',
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        gap: { xs: 1, sm: 2 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Skeleton variant="circular" width={40} height={40} />
        <Skeleton width={160} height={20} />
      </Box>
      <Skeleton width={50} height={20} />
      <Skeleton width={80} height={20} />
    </Box>
  );
}

type PortfolioCompositionProps = {
  filter: CompositionFilter;
  portfolioId: string;
};

const primaryTextSx = {
  color: '#393a36',
  fontFamily: '"Open Sans", sans-serif',
};

const secondaryTextSx = {
  color: '#61615e',
  fontFamily: '"Open Sans", sans-serif',
};

export function PortfolioComposition({ filter, portfolioId }: PortfolioCompositionProps) {
  const { composition, tickers, loading, error } = usePortfolioComposition(filter, portfolioId);
  const { logosByTicker } = useStockLogos(tickers);
  const currency = filter === 'bvb' ? 'RON' : 'USD';
  const [showPercent, setShowPercent] = useState(false);

  if (error) return <Alert severity="error">{error.message}</Alert>;

  const maxWeight = composition[0]?.weight ?? 100;

  return (
    <Box sx={{ bgcolor: 'white', borderRadius: '16px', p: 3, boxShadow: '0 2px 4px rgba(0,0,0,0.10)' }}>
      <Typography
        sx={{
          ...primaryTextSx,
          fontSize: 20,
          lineHeight: '28px',
          fontWeight: 600,
          mb: 2,
        }}
      >
        Composition
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 48px 88px', sm: '1fr 80px 110px' },
          gap: { xs: 1, sm: 2 },
          pb: 1,
          borderBottom: '2px solid',
          borderColor: 'divider',
          mb: 0.5,
        }}
      >
        {/* Mirrors row layout: ticker/price | qty/avg */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, minWidth: 0 }}>
          <Box
            sx={{
              width: 40,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.25,
            }}
          >
            <Typography
              sx={{
                ...secondaryTextSx,
                fontSize: { xs: 11, sm: 16 },
                lineHeight: { xs: '14px', sm: '20px' },
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                textAlign: 'center',
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Stock
              </Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                Ticker
              </Box>
            </Typography>
            <Typography
              sx={{
                ...secondaryTextSx,
                fontSize: 10,
                lineHeight: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.3,
                display: { xs: 'block', sm: 'none' },
              }}
            >
              Price
            </Typography>
          </Box>

          <Box
            sx={{
              px: 1,
              display: { xs: 'flex', sm: 'none' },
              flexDirection: 'column',
              gap: 0.25,
            }}
          >
            <Typography
              sx={{
                ...secondaryTextSx,
                fontSize: 11,
                lineHeight: '14px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              Qty
            </Typography>
            <Typography
              sx={{
                ...secondaryTextSx,
                fontSize: 10,
                lineHeight: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
            >
              Avg
            </Typography>
          </Box>
        </Box>

        <Typography
          sx={{
            ...secondaryTextSx,
            fontSize: { xs: 11, sm: 16 },
            lineHeight: { xs: '14px', sm: '20px' },
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            textAlign: 'right',
          }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Weight
          </Box>
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
            Wt
          </Box>
        </Typography>
        <Typography
          onClick={() => setShowPercent(prev => !prev)}
          sx={{
            ...secondaryTextSx,
            fontSize: { xs: 11, sm: 16 },
            lineHeight: { xs: '14px', sm: '20px' },
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            textAlign: 'right',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          P/L
        </Typography>
      </Box>

      {loading ? (
        [...Array(8)].map((_, i) => <RowSkeleton key={i} />)
      ) : composition.length === 0 ? (
        <Typography
          sx={{
            ...secondaryTextSx,
            fontSize: 16,
            lineHeight: '20px',
            py: 4,
            textAlign: 'center',
          }}
        >
          No positions found.
        </Typography>
      ) : (
        composition.map(row => (
          <PortfolioCompositionRow
            key={row.ticker}
            row={row}
            maxWeight={maxWeight}
            currency={currency}
            showPercent={showPercent}
            onTogglePercent={() => setShowPercent(prev => !prev)}
            logoUrl={logosByTicker.get(row.ticker)}
          />
        ))
      )}
    </Box>
  );
}