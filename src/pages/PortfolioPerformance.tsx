import { useState } from 'react';
import { Stack } from '@mui/material';
import { FilterControl } from '../components/FilterControl';
import type { CompositionFilter } from '../components/FilterControl';
import { PortfolioPerformanceCard } from '../components/PortfolioPerformanceCard';
import { usePortfolioContext } from '../contexts/PortfolioContext';

const PortfolioPerformance = () => {
  const [filter, setFilter] = useState<CompositionFilter>('stock');
  const { selectedPortfolioId } = usePortfolioContext();

  if (!selectedPortfolioId) return null;

  return (
    <Stack spacing={2} sx={{ width: '100%', minWidth: 0 }}>
      <FilterControl value={filter} onChange={setFilter} exclude={['all']} />
      <PortfolioPerformanceCard filter={filter} portfolioId={selectedPortfolioId} />
    </Stack>
  );
};

export default PortfolioPerformance;
