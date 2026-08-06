import { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import { useQueryClient } from '@tanstack/react-query';
import { PortfolioPerformanceCard } from '../components/PortfolioPerformanceCard';
import { PortfolioComposition } from '../components/PortfolioComposition';
import { FilterControl } from '../components/FilterControl';
import type { CompositionFilter } from '../components/FilterControl';
import { usePortfolioContext } from '../contexts/PortfolioContext';
import { useRegisterPullToRefresh } from '../contexts/PullToRefreshContext';

const Dashboard = () => {
  const [filter, setFilter] = useState<CompositionFilter>('stock');
  const { selectedPortfolioId } = usePortfolioContext();
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['positions'] }),
      queryClient.invalidateQueries({ queryKey: ['portfolioQuotes'] }),
      queryClient.invalidateQueries({ queryKey: ['compositionQuotes'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-logos'] }),
      queryClient.invalidateQueries({ queryKey: ['portfolio-performance-transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-history'] }),
    ]);
  }, [queryClient]);

  useRegisterPullToRefresh(handleRefresh);

  if (!selectedPortfolioId) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 1, sm: 0 },
      }}>
        <FilterControl value={filter} onChange={setFilter} />
      </Box>
      <PortfolioPerformanceCard
        filter={filter}
        portfolioId={selectedPortfolioId}
        showFooter={false}
      />
      <PortfolioComposition filter={filter} portfolioId={selectedPortfolioId} />
    </Box>
  );
};

export default Dashboard;
