import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useCreatePosition } from '../hooks/useCreatePosition';
import {
  usePortfolioComposition,
  type TickerComposition,
} from '../hooks/usePortfolioComposition';
import { useStockLogos } from '../hooks/useStockLogos';
import type { NewPosition } from '../schemas/positionSchema';
import type { CompositionFilter } from './FilterControl';
import PositionFormModal from './PositionFormModal';
import { PortfolioCompositionRow } from './PortfolioCompositionRaw';

function RowSkeleton() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '56px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
          sm: '1fr 80px 110px',
        },
        alignItems: 'center',
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        columnGap: { xs: 1.5, sm: 3 },
      }}
    >
      <Skeleton variant="circular" width={40} height={40} sx={{ justifySelf: 'center' }} />
      <Skeleton width="70%" height={20} sx={{ justifySelf: 'center', display: { xs: 'block', sm: 'none' } }} />
      <Skeleton width={40} height={20} sx={{ justifySelf: 'center' }} />
      <Skeleton width={70} height={20} sx={{ justifySelf: { xs: 'center', sm: 'end' } }} />
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
  const queryClient = useQueryClient();
  const { composition, tickers, loading, error } = usePortfolioComposition(filter, portfolioId);
  const { logosByTicker, loading: logosLoading } = useStockLogos(tickers);
  const createPositionMutation = useCreatePosition(portfolioId);
  const currency = filter === 'bvb' ? 'RON' : 'USD';
  const [showPercent, setShowPercent] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<TickerComposition | null>(null);

  const handleLogoClick = (row: TickerComposition) => {
    setSelectedRow(row);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedRow(null);
  };

  const handleFormSubmit = async (data: NewPosition) => {
    await createPositionMutation.mutateAsync(data);
    handleCloseForm();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['positions', portfolioId] }),
      queryClient.invalidateQueries({ queryKey: ['compositionQuotes'] }),
      queryClient.invalidateQueries({ queryKey: ['portfolioQuotes'] }),
    ]);
  };

  if (error) return <Alert severity="error">{error.message}</Alert>;

  const maxWeight = composition[0]?.weight ?? 100;
  // Wait for logo URLs (React Query cache or edge function) before painting rows.
  const showRowsLoading = loading || logosLoading;

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
          gridTemplateColumns: {
            xs: '56px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
            sm: '1fr 80px 110px',
          },
          columnGap: { xs: 1.5, sm: 3 },
          pb: 1,
          borderBottom: '2px solid',
          borderColor: 'divider',
          mb: 0.5,
        }}
      >
        {/* Ticker / Price */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: { xs: 'center', sm: 'flex-start' },
            gap: 0.25,
            minWidth: 0,
            pl: { xs: 0, sm: 0.5 },
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
              textAlign: { xs: 'center', sm: 'left' },
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

        {/* Qty / Avg — mobile only */}
        <Box
          sx={{
            display: { xs: 'flex', sm: 'none' },
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.25,
            minWidth: 0,
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
              textAlign: 'center',
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
              textAlign: 'center',
            }}
          >
            Avg
          </Typography>
        </Box>

        {/* Weight */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 0,
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
              Weight
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              Wt
            </Box>
          </Typography>
        </Box>

        {/* P/L */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: { xs: 'center', sm: 'flex-end' },
            justifyContent: 'center',
            minWidth: 0,
          }}
        >
          <Typography
            onClick={() => setShowPercent(prev => !prev)}
            sx={{
              ...secondaryTextSx,
              fontSize: { xs: 11, sm: 16 },
              lineHeight: { xs: '14px', sm: '20px' },
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              textAlign: { xs: 'center', sm: 'right' },
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            P/L
          </Typography>
        </Box>
      </Box>

      {showRowsLoading ? (
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
            onLogoClick={handleLogoClick}
            logoUrl={logosByTicker.get(row.ticker)}
          />
        ))
      )}

      <PositionFormModal
        open={isFormOpen}
        portfolioId={portfolioId}
        defaults={
          selectedRow
            ? {
                ticker_symbol: selectedRow.ticker,
                asset_name: selectedRow.assetName,
                price: String(selectedRow.currentPrice),
                currency: selectedRow.currency,
                transaction_type: selectedRow.transactionType,
              }
            : undefined
        }
        hideCurrencyAndType
        isSubmitting={createPositionMutation.isPending}
        onSubmit={handleFormSubmit}
        onClose={handleCloseForm}
      />
    </Box>
  );
}