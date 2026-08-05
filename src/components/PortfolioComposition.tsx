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
        display: 'flex',
        alignItems: 'flex-start',
        columnGap: 1.5,
        py: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Skeleton variant="rounded" width={44} height={44} sx={{ borderRadius: '10px', flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', columnGap: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <Skeleton width={64} height={18} sx={{ mb: 0.5 }} />
            <Skeleton width="55%" height={16} />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Skeleton width={110} height={18} sx={{ mb: 0.5 }} />
            <Skeleton width={56} height={14} />
          </Box>
        </Box>
        <Skeleton width="70%" height={14} sx={{ mt: 1 }} />
      </Box>
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

const TitleSx = {
  fontSize: { xs: 16, sm: 18, md: 20 },
  lineHeight: { xs: '24px', sm: '26px', md: '28px' },
  color: '#393a36',
  fontWeight: 600,
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

  // Wait for logo URLs (React Query cache or edge function) before painting rows.
  const showRowsLoading = loading || logosLoading;

  return (
    <Box sx={{ bgcolor: 'white', borderRadius: '16px', p: 3, boxShadow: '0 2px 4px rgba(0,0,0,0.10)' }}>
      <Typography
        sx={{
          ...primaryTextSx,
          ...TitleSx,
          mb: 1,
        }}
      >
        Composition
      </Typography>

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
