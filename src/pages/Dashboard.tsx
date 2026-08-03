import { useCallback, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useQueryClient } from '@tanstack/react-query';
import { DashboardStats } from '../components/DashboardStats';
import { PortfolioComposition } from '../components/PortfolioComposition';
import { FilterControl } from '../components/FilterControl';
import type { CompositionFilter } from '../components/FilterControl';
import { usePortfolioContext } from '../contexts/PortfolioContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

const Dashboard = () => {
  const [filter, setFilter] = useState<CompositionFilter>('stock');
  const { selectedPortfolioId } = usePortfolioContext();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['positions'] }),
      queryClient.invalidateQueries({ queryKey: ['portfolioQuotes'] }),
      queryClient.invalidateQueries({ queryKey: ['compositionQuotes'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-logos'] }),
    ]);
  }, [queryClient]);

  const { pullDistance, isRefreshing, isPulling } = usePullToRefresh(
    containerRef,
    handleRefresh,
  );

  if (!selectedPortfolioId) return null;

  const showIndicator = isPulling || isRefreshing || pullDistance > 0;

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        position: 'relative',
        // Create room for the pull indicator without shifting layout abruptly.
        pt: showIndicator ? `${Math.max(pullDistance, isRefreshing ? 40 : 0)}px` : 0,
        transition: isPulling ? 'none' : 'padding-top 0.2s ease',
        overscrollBehaviorY: 'contain',
      }}
    >
      {showIndicator && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
            opacity: isRefreshing ? 1 : Math.min(1, pullDistance / 72),
          }}
        >
          <CircularProgress size={22} thickness={4} />
        </Box>
      )}

      <Box sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 1, sm: 0 },
      }}>
        <FilterControl value={filter} onChange={setFilter} />
      </Box>
      <DashboardStats filter={filter} portfolioId={selectedPortfolioId} />
      <PortfolioComposition filter={filter} portfolioId={selectedPortfolioId} />
    </Box>
  );
};

export default Dashboard;
