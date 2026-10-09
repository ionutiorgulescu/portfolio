import { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import { useQueryClient } from '@tanstack/react-query';
import { PortfolioPerformanceCard } from '../components/PortfolioPerformanceCard';
import { PortfolioComposition } from '../components/PortfolioComposition';
import {
  FilterControl,
  getRememberedCompositionFilter,
  isCompositionFilter,
  rememberCompositionFilter,
  type CompositionFilter,
} from '../components/FilterControl';
import { usePortfolioContext } from '../contexts/PortfolioContext';
import { useRegisterPullToRefresh } from '../contexts/PullToRefreshContext';
import { useLocation } from 'react-router-dom';

const Dashboard = () => {
  const location = useLocation();
  const [filter, setFilter] = useState<CompositionFilter>(() => {
    const fromTicker = (location.state as { compositionFilter?: unknown } | null)?.compositionFilter;
    if (isCompositionFilter(fromTicker)) {
      rememberCompositionFilter(fromTicker);
      return fromTicker;
    }
    return getRememberedCompositionFilter();
  });

  const handleFilterChange = (next: CompositionFilter) => {
    rememberCompositionFilter(next);
    setFilter(next);
  };
  const { selectedPortfolioId } = usePortfolioContext();
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['positions'] }),
      queryClient.invalidateQueries({ queryKey: ['portfolioQuotes'] }),
      queryClient.invalidateQueries({ queryKey: ['compositionQuotes'] }),
      queryClient.invalidateQueries({ queryKey: ['performanceQuotes'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-logos'] }),
      queryClient.invalidateQueries({ queryKey: ['portfolio-performance-transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-history'] }),
    ]);
  }, [queryClient]);

  useRegisterPullToRefresh(handleRefresh);

  if (!selectedPortfolioId) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        flex: '0 0 auto',
        width: '100%',
        minHeight: 0,
      }}
    >
      <Box sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 1, sm: 0 },
      }}>
        <FilterControl value={filter} onChange={handleFilterChange} />
      </Box>
      <PortfolioPerformanceCard
        filter={filter}
        portfolioId={selectedPortfolioId}
        showFooter={false}
      />
      <PortfolioComposition
        filter={filter}
        portfolioId={selectedPortfolioId}
        onFilterChange={handleFilterChange}
      />
    </Box>
  );
};

export default Dashboard;
