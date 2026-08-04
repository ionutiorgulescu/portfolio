import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Skeleton,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MenuIcon from '@mui/icons-material/Menu';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import GoalIcon from '@mui/icons-material/PieChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import SettingsIcon from '@mui/icons-material/Settings';
import CallMadeIcon from '@mui/icons-material/CallMade';
import { NavLink, Outlet } from 'react-router-dom';
import { usePortfolioContext } from '../contexts/PortfolioContext';
import { PortfolioManagerModal } from '../components/PortfolioManagerModal';
import { ALL_PORTFOLIOS_ID } from '../contexts/PortfolioContext';
import { PullToRefreshProvider } from '../contexts/PullToRefreshContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

type AppShellProps = {
  userEmail?: string;
  signOutError?: string | null;
  onSignOut: () => void;
};

type RefreshHandler = () => void | Promise<void>;

const drawerWidthOpen = 240;
const drawerWidthClosed = 72;
const PULL_THRESHOLD = 72;

const menuItems = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Transactions', path: '/transactions', icon: <AccountBalanceWalletIcon /> },
  { label: 'Performance', path: '/performance', icon: <AttachMoneyIcon /> },
  { label: 'Goal', path: '/goal', icon: <GoalIcon /> },
  { label: 'Plan', path: '/plan', icon: <CallMadeIcon /> },
];

const AppShell = ({ userEmail, signOutError, onSignOut }: AppShellProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const { selectedPortfolioId, setSelectedPortfolioId, portfolios, isLoading: portfoliosLoading } = usePortfolioContext();

  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const refreshHandlerRef = useRef<RefreshHandler | null>(null);
  const [hasRefreshHandler, setHasRefreshHandler] = useState(false);

  const handleHandlerChange = useCallback((handler: RefreshHandler | null) => {
    refreshHandlerRef.current = handler;
    setHasRefreshHandler(handler !== null);
  }, []);

  const handleRefresh = useCallback(async () => {
    await refreshHandlerRef.current?.();
  }, []);

  const { pullDistance, isRefreshing, isPulling } = usePullToRefresh(
    scrollEl,
    handleRefresh,
    { disabled: !hasRefreshHandler, threshold: PULL_THRESHOLD },
  );

  const showIndicator = hasRefreshHandler && (isPulling || isRefreshing || pullDistance > 0);
  const drawerWidth = isMenuOpen ? drawerWidthOpen : drawerWidthClosed;

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(prev => !prev);
    } else {
      setIsMenuOpen(prev => !prev);
    }
  };

  const drawerContent = (mobile: boolean) => (
    <List>
      {menuItems.map((item) => (
        <ListItemButton
          key={item.path}
          component={NavLink}
          to={item.path}
          onClick={mobile ? () => setMobileOpen(false) : undefined}
          sx={{
            minHeight: 48,
            px: 2.5,
            justifyContent: (!mobile && !isMenuOpen) ? 'center' : 'initial',
            '&.active': { bgcolor: 'action.selected' },
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 0,
              mr: (!mobile && !isMenuOpen) ? 0 : 2,
              justifyContent: 'center',
              color: 'text.primary',
            }}
          >
            {item.icon}
          </ListItemIcon>
          <ListItemText
            primary={item.label}
            sx={{ opacity: (!mobile && !isMenuOpen) ? 0 : 1 }}
            primaryTypographyProps={{ color: 'text.primary' }}
          />
        </ListItemButton>
      ))}
    </List>
  );

  return (
    <Box sx={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
      <AppBar
        position="fixed"
        color="default"
        elevation={0}
        sx={(theme) => ({
          zIndex: theme.zIndex.drawer + 1,
          ml: isMobile ? 0 : `${drawerWidth}px`,
          width: isMobile ? '100%' : `calc(100% - ${drawerWidth}px)`,
          transition: theme.transitions.create(['margin', 'width'], {
            duration: theme.transitions.duration.standard,
          }),
          backgroundColor: 'white',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
        })}
      >
        <Toolbar sx={{ justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <IconButton color="inherit" edge="start" onClick={handleDrawerToggle}>
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" component="h1" noWrap>
              Portfolio App
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, flexShrink: 0 }}>
            {/* Portfolio switcher + manage */}
            {portfoliosLoading ? (
              <Skeleton width={140} height={36} sx={{ borderRadius: 1 }} />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {portfolios.length > 1 && (
                  <Select
                    size="small"
                    value={selectedPortfolioId ?? ''}
                    onChange={(e) => setSelectedPortfolioId(e.target.value)}
                    sx={{
                      minWidth: 140,
                      fontSize: 14,
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                    }}
                  >
                    <MenuItem value={ALL_PORTFOLIOS_ID}>All Portfolios</MenuItem>
                    {portfolios.map((p) => (
                      <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                    ))}
                  </Select>
                )}
                <IconButton
                  size="small"
                  onClick={() => setManageOpen(true)}
                  title="Manage portfolios"
                  color="inherit"
                >
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Box>
            )}

            <Typography
              variant="body2"
              noWrap
              sx={{ display: { xs: 'none', sm: 'block' }, maxWidth: 200 }}
            >
              Signed in as {userEmail ?? 'unknown user'}
            </Typography>
            <Button variant="outlined" color="inherit" onClick={onSignOut} size="small">
              Sign out
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: drawerWidthOpen, boxSizing: 'border-box' } }}
        >
          <Toolbar />
          {drawerContent(true)}
        </Drawer>
      )}

      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={(theme) => ({
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              overflowX: 'hidden',
              transition: theme.transitions.create('width', {
                duration: theme.transitions.duration.standard,
              }),
            },
          })}
        >
          <Toolbar />
          {drawerContent(false)}
        </Drawer>
      )}

      <Box
        component="main"
        ref={setScrollEl}
        sx={{
          flexGrow: 1,
          height: '100dvh',
          minWidth: 0,
          overflowY: 'auto',
          overscrollBehaviorY: 'contain',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          p: { xs: 2, sm: 3 },
          backgroundColor: 'grey.100',
        }}
      >
        <Toolbar />

        <Box
          aria-hidden={!showIndicator}
          sx={{
            height: showIndicator ? Math.max(pullDistance, isRefreshing ? 40 : 0) : 0,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            overflow: 'hidden',
            pointerEvents: 'none',
            transition: isPulling ? 'none' : 'height 0.2s ease',
            opacity: showIndicator
              ? (isRefreshing ? 1 : Math.min(1, pullDistance / PULL_THRESHOLD))
              : 0,
          }}
        >
          <CircularProgress size={22} thickness={4} sx={{ mb: 1 }} />
        </Box>

        {signOutError && (
          <Alert sx={{ mb: 2 }} severity="error">{signOutError}</Alert>
        )}

        <PullToRefreshProvider onHandlerChange={handleHandlerChange}>
          <Outlet />
        </PullToRefreshProvider>
      </Box>

      <PortfolioManagerModal open={manageOpen} onClose={() => setManageOpen(false)} />
    </Box>
  );
};

export default AppShell;
