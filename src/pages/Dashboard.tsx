import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DashboardStats } from '../components/DashboardStats';
import { PortfolioComposition } from '../components/PortfolioComposition';
import { FilterControl } from '../components/FilterControl';
import type { CompositionFilter } from '../components/FilterControl';

const Dashboard = () => {
  const [filter, setFilter] = useState<CompositionFilter>('all');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" fontWeight={700}>Dashboard</Typography>
        <FilterControl value={filter} onChange={setFilter} />
      </Box>
      <DashboardStats filter={filter} />
      <PortfolioComposition filter={filter} />
    </Box>
  );
};

export default Dashboard;