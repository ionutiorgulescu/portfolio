import { Box, CircularProgress, Container, Paper } from '@mui/material';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import { useAuthSession } from './hooks/useAuthSession';
import AppShell from './layouts/AppShell';
import Dashboard from './pages/Dashboard';
import Markets from './pages/Markets';
import Goal from './pages/Goal';
import PortfolioPerformance from './pages/PortfolioPerformance';
import Transactions from './pages/Transactions';
import { PortfolioProvider } from './contexts/PortfolioContext';
import Plan from './pages/Plan';

function App() {
  const { user, loading } = useAuthSession();

  if (loading) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ my: 6 }}>
          <Paper elevation={3} sx={{ p: 4 }}>
            <LoginForm />
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <PortfolioProvider>
      <Routes>
        <Route
          path="/"
          element={<AppShell />}
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="performance" element={<PortfolioPerformance />} />
          <Route path="markets" element={<Markets />} />
          <Route path="goal" element={<Goal />} />
          <Route path="plan" element={<Plan />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </PortfolioProvider>
  );
}

export default App;