import { useCallback, useRef, useState } from 'react';
import {
  AppBar,
  Box,
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
import GoalIcon from '@mui/icons-material/PieChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SettingsIcon from '@mui/icons-material/Settings';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CallMadeIcon from '@mui/icons-material/CallMade';
import { NavLink, Outlet } from 'react-router-dom';
import { usePortfolioContext } from '../contexts/PortfolioContext';
import { useValuesVisibility } from '../contexts/ValuesVisibilityContext';
import { PortfolioManagerModal } from '../components/PortfolioManagerModal';
import { ALL_PORTFOLIOS_ID } from '../contexts/PortfolioContext';
import { PullToRefreshProvider } from '../contexts/PullToRefreshContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

type RefreshHandler = () => void | Promise<void>;

const drawerWidthOpen = 240;
const drawerWidthClosed = 72;
const PULL_THRESHOLD = 72;
const MOBILE_BOTTOM_NAV_HEIGHT = 72;

const menuItems = [
  { label: 'Home', path: '/dashboard', icon: <DashboardIcon fontSize="small" /> },
  { label: 'Trades', path: '/transactions', icon: <AccountBalanceWalletIcon fontSize="small" /> },
  { label: 'Growth', path: '/performance', icon: <ShowChartIcon fontSize="small" /> },
  { label: 'Goals', path: '/goal', icon: <GoalIcon fontSize="small" /> },
  { label: 'Plans', path: '/plan', icon: <CallMadeIcon fontSize="small" /> },
];

const AppShell = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);
  const { selectedPortfolioId, setSelectedPortfolioId, portfolios, isLoading: portfoliosLoading } = usePortfolioContext();
  const { valuesHidden, toggleValuesHidden } = useValuesVisibility();

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

  const drawerContent = (
    <List>
      {menuItems.map((item) => (
        <ListItemButton
          key={item.path}
          component={NavLink}
          to={item.path}
          sx={{
            minHeight: 48,
            px: 2.5,
            justifyContent: !isMenuOpen ? 'center' : 'initial',
            '&.active': { bgcolor: 'action.selected' },
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 0,
              mr: !isMenuOpen ? 0 : 2,
              justifyContent: 'center',
              color: 'text.primary',
            }}
          >
            {item.icon}
          </ListItemIcon>
          <ListItemText
            primary={item.label}
            sx={{ opacity: !isMenuOpen ? 0 : 1 }}
            primaryTypographyProps={{ color: 'text.primary' }}
          />
        </ListItemButton>
      ))}
    </List>
  );

  // Floating nav sits 12px above the home indicator; keep page content clear of it.
  const mobileBottomClearance = `calc(${MOBILE_BOTTOM_NAV_HEIGHT + 12 + 24}px + env(safe-area-inset-bottom, 0px))`;

  return (
    <Box
      sx={{
        // Pin to the visual viewport — 100dvh is unreliable in iOS standalone/PWA.
        position: 'fixed',
        inset: 0,
        display: 'flex',
        overflow: 'hidden',
      }}
    >
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
            {!isMobile && (
              <IconButton color="inherit" edge="start" onClick={() => setIsMenuOpen((prev) => !prev)}>
                <MenuIcon />
              </IconButton>
            )}

            {portfoliosLoading ? (
              <Skeleton width={140} height={36} sx={{ borderRadius: 1 }} />
            ) : portfolios.length > 1 ? (
              <Select
                size="small"
                value={selectedPortfolioId ?? ''}
                onChange={(e) => setSelectedPortfolioId(e.target.value)}
                sx={{
                  minWidth: 140,
                  fontSize: 14,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'divider',
                    borderWidth: 1,
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'divider',
                    borderWidth: 1,
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'divider',
                    borderWidth: 1,
                  },
                }}
              >
                <MenuItem value={ALL_PORTFOLIOS_ID}>All Portfolios</MenuItem>
                {portfolios.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                ))}
              </Select>
            ) : null}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={toggleValuesHidden}
              title={valuesHidden ? 'Show total value' : 'Hide total value'}
              aria-label={valuesHidden ? 'Show total value' : 'Hide total value'}
              color="inherit"
            >
              {valuesHidden ? (
                <VisibilityOffIcon fontSize="small" />
              ) : (
                <VisibilityIcon fontSize="small" />
              )}
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setManageOpen(true)}
              title="Manage portfolios"
              color="inherit"
              edge="end"
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

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
          {drawerContent}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'grey.100',
        }}
      >
        <Toolbar sx={{ flexShrink: 0 }} />

        {/* Scrollport: keep this a plain overflow box (no flex). iOS/WebKit drops
            padding-bottom from scrollHeight when the scroller itself is a flex column. */}
        <Box
          ref={setScrollEl}
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehaviorY: 'contain',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          }}
        >
          <Box
            sx={{
              boxSizing: 'border-box',
              minHeight: '100%',
              display: 'flex',
              flexDirection: 'column',
              p: { xs: 2, sm: 3 },
              pb: {
                xs: mobileBottomClearance,
                md: 3,
              },
            }}
          >
            <Box
              aria-hidden={!showIndicator}
              sx={{
                flexShrink: 0,
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

            <PullToRefreshProvider onHandlerChange={handleHandlerChange}>
              <Outlet />
            </PullToRefreshProvider>
          </Box>
        </Box>
      </Box>

      {isMobile && (
        <Box
          component="nav"
          aria-label="Primary"
          sx={{
            position: 'fixed',
            left: 12,
            right: 12,
            bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            zIndex: (t) => t.zIndex.appBar,
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'space-between',
            gap: 0.25,
            minHeight: MOBILE_BOTTOM_NAV_HEIGHT,
            px: 0.75,
            py: 0.75,
            bgcolor: 'background.paper',
            borderRadius: 999,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 8px 28px rgba(15, 23, 42, 0.12)',
          }}
        >
          {menuItems.map((item) => (
            <Box
              key={item.path}
              component={NavLink}
              to={item.path}
              sx={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.25,
                px: 0.5,
                py: 0.75,
                borderRadius: 999,
                textDecoration: 'none',
                color: 'text.secondary',
                transition: 'background-color 0.15s ease, color 0.15s ease',
                '&.active': {
                  color: 'text.primary',
                  bgcolor: 'grey.100',
                },
              }}
            >
              {item.icon}
              <Typography
                component="span"
                sx={{
                  fontSize: 10,
                  lineHeight: 1.2,
                  fontWeight: 500,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <PortfolioManagerModal open={manageOpen} onClose={() => setManageOpen(false)} />
    </Box>
  );
};

export default AppShell;
