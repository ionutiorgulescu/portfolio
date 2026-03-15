import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DashboardStats } from '../components/DashboardStats';

const Dashboard = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4" fontWeight={700}>Dashboard</Typography>
      <DashboardStats />
    </Box>
  );
};

export default Dashboard;