import { useState } from 'react';
import Box from '@mui/material/Box';
import { DashboardStats } from '../components/DashboardStats';
import { PortfolioComposition } from '../components/PortfolioComposition';
import { FilterControl } from '../components/FilterControl';
import type { CompositionFilter } from '../components/FilterControl';
import { usePortfolioContext } from '../contexts/PortfolioContext';

const Dashboard = () => {
  const [filter, setFilter] = useState<CompositionFilter>('stock');
  const { selectedPortfolioId } = usePortfolioContext();

  if (!selectedPortfolioId) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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