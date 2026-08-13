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
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import GoalIcon from '@mui/icons-material/PieChart';
import PieChartOutlineIcon from '@mui/icons-material/PieChartOutline';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SettingsIcon from '@mui/icons-material/Settings';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CallMadeIcon from '@mui/icons-material/CallMade';
import CallMadeOutlinedIcon from '@mui/icons-material/CallMadeOutlined';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { usePortfolioContext } from '../contexts/PortfolioContext';
import { useValuesVisibility } from '../contexts/ValuesVisibilityContext';
import { PortfolioManagerModal } from '../components/PortfolioManagerModal';
import { ValuesPinModal } from '../components/ValuesPinModal';
import { ALL_PORTFOLIOS_ID } from '../contexts/PortfolioContext';
import { PullToRefreshProvider } from '../contexts/PullToRefreshContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

type RefreshHandler = () => void | Promise<void>;

const drawerWidthOpen = 240;
const drawerWidthClosed = 72;
const PULL_THRESHOLD = 72;
const MOBILE_BOTTOM_NAV_HEIGHT = 76;
const MOBILE_NAV_ACTIVE_BG = '#E6F4F1';
const MOBILE_NAV_ACTIVE_FG = '#0A4F46';
const MOBILE_NAV_INACTIVE_FG = '#8B909A';
const PORTFOLIO_SELECT_SELECTED_BG = 'rgb(230, 244, 241)';
const portfolioSelectMenuItemSx = {
  '&.Mui-selected': {
    backgroundColor: `${PORTFOLIO_SELECT_SELECTED_BG} !important`,
  },
  '&.Mui-selected:hover': {
    backgroundColor: `${PORTFOLIO_SELECT_SELECTED_BG} !important`,
  },
  '&.Mui-selected.Mui-focusVisible': {
    backgroundColor: `${PORTFOLIO_SELECT_SELECTED_BG} !important`,
  },
};

const menuItems = [
  {
    label: 'Home',
    path: '/dashboard',
    icon: <DashboardIcon fontSize="small" />,
    mobileIcon: <GridViewOutlinedIcon sx={{ fontSize: 22 }} />,
  },
  {
    label: 'Trades',
    path: '/transactions',
    icon: <AccountBalanceWalletIcon fontSize="small" />,
    mobileIcon: <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 22 }} />,
  },
  {
    label: 'Growth',
    path: '/performance',
    icon: <ShowChartIcon fontSize="small" />,
    mobileIcon: <ShowChartOutlinedIcon sx={{ fontSize: 22 }} />,
  },
  {
    label: 'Goals',
    path: '/goal',
    icon: <GoalIcon fontSize="small" />,
    mobileIcon: <PieChartOutlineIcon sx={{ fontSize: 22 }} />,
  },
  {
    label: 'Plans',
    path: '/plan',
    icon: <CallMadeIcon fontSize="small" />,
    mobileIcon: <CallMadeOutlinedIcon sx={{ fontSize: 22 }} />,
  },
];

const AppShell = () => {
  const theme = useTheme();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);
  const { selectedPortfolioId, setSelectedPortfolioId, portfolios, isLoading: portfoliosLoading } = usePortfolioContext();
  const { valuesHidden, hasPin, lockWithPin, unlockWithPin } = useValuesVisibility();
  const [pinModalMode, setPinModalMode] = useState<'set' | 'unlock' | null>(null);

  // Growth page owns its own nested scroll (chart fixed, metrics scroll).
  // Lock the shell scroller so that page gets a definite height again.
  const lockShellScroll = location.pathname.startsWith('/performance');

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
              <Skeleton width={140} height={36} sx={{ borderRadius: '12px' }} />
            ) : portfolios.length > 1 ? (
              <Select
                size="small"
                value={selectedPortfolioId ?? ''}
                onChange={(e) => setSelectedPortfolioId(e.target.value)}
                IconComponent={KeyboardArrowDownIcon}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      borderRadius: '12px',
                      overflow: 'hidden',
                    },
                  },
                  MenuListProps: {
                    sx: {
                      borderRadius: '12px',
                    },
                  },
                }}
                sx={{
                  minWidth: 140,
                  borderRadius: '12px',
                  bgcolor: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  '& .MuiSelect-select': {
                    py: 0.875,
                    pl: 2,
                    pr: 4,
                  },
                  '& .MuiSelect-icon': {
                    color: 'text.primary',
                    fontSize: 20,
                    right: 8,
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'divider',
                    borderWidth: 1,
                    borderRadius: '12px',
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
                <MenuItem value={ALL_PORTFOLIOS_ID} sx={portfolioSelectMenuItemSx}>
                  All Portfolios
                </MenuItem>
                {portfolios.map((p) => (
                  <MenuItem key={p.id} value={p.id} sx={portfolioSelectMenuItemSx}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            ) : null}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => {
                if (valuesHidden) {
                  if (hasPin) {
                    setPinModalMode('unlock');
                    return;
                  }
                  unlockWithPin('');
                  return;
                }
                setPinModalMode('set');
              }}
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

        {/* Default: plain overflow scroller (Dashboard etc).
            Growth (/performance): lock height so only its metrics section scrolls. */}
        <Box
          ref={setScrollEl}
          sx={{
            flex: 1,
            minHeight: 0,
            display: lockShellScroll ? 'flex' : 'block',
            flexDirection: 'column',
            overflowY: lockShellScroll ? 'hidden' : 'auto',
            overscrollBehaviorY: 'contain',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          }}
        >
          <Box
            sx={{
              boxSizing: 'border-box',
              minHeight: '100%',
              ...(lockShellScroll
                ? { flex: 1, minHeight: 0, height: '100%' }
                : null),
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
            left: 16,
            right: 16,
            bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            zIndex: (t) => t.zIndex.appBar,
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'space-between',
            gap: 0.5,
            minHeight: MOBILE_BOTTOM_NAV_HEIGHT,
            px: 1,
            py: 1,
            bgcolor: 'rgba(255, 255, 255, 0.82)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            border: '1px solid rgba(15, 23, 42, 0.08)',
            borderRadius: '26px',
            boxShadow: '0 12px 40px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.08)',
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
                borderRadius: '20px',
                textDecoration: 'none',
                color: MOBILE_NAV_INACTIVE_FG,
                transition: 'background-color 0.15s ease, color 0.15s ease',
                '& .MuiSvgIcon-root': { color: 'inherit' },
                '&.active': {
                  color: MOBILE_NAV_ACTIVE_FG,
                  bgcolor: MOBILE_NAV_ACTIVE_BG,
                },
              }}
            >
              {item.mobileIcon}
              <Typography
                component="span"
                sx={{
                  fontSize: 11,
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
      <ValuesPinModal
        open={pinModalMode != null}
        mode={pinModalMode ?? 'set'}
        onClose={() => setPinModalMode(null)}
        onSubmit={(pin) => {
          if (pinModalMode === 'unlock') {
            const matched = unlockWithPin(pin);
            if (matched) setPinModalMode(null);
            return matched;
          }
          lockWithPin(pin);
          setPinModalMode(null);
        }}
      />
    </Box>
  );
};

export default AppShell;
