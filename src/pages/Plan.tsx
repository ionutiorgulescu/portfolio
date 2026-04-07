import Box from '@mui/material/Box';
import { usePortfolioContext } from '../contexts/PortfolioContext';
import PlanSetup from '../components/Plan/PlanSetup';

const Plan = () => {
  const { selectedPortfolioId } = usePortfolioContext();

  if (!selectedPortfolioId) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PlanSetup portfolioId={selectedPortfolioId} />
    </Box>
  );
};

export default Plan;