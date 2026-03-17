import { useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MenuIcon from '@mui/icons-material/Menu';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { NavLink, Outlet } from 'react-router-dom';

interface AppShellProps {
  userEmail?: string;
  signOutError?: string | null;
  onSignOut: () => void;
}

const drawerWidthOpen = 240;
const drawerWidthClosed = 72;

const menuItems = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Transactions', path: '/transactions', icon: <AccountBalanceWalletIcon /> },
  { label: 'Performance', path: '/performance', icon: <AttachMoneyIcon /> },
  { label: 'Markets', path: '/markets', icon: <ShowChartIcon /> },
];

const AppShell = ({ userEmail, signOutError, onSignOut }: AppShellProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

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
            '&.active': {
              bgcolor: 'action.selected',
            },
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
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* AppBar */}
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
            <Typography
              variant="body2"
              noWrap
              sx={{ display: { xs: 'none', sm: 'block' }, maxWidth: 200 }}
            >
              Signed in as {userEmail ?? 'unknown user'}
            </Typography>
            <Button
              variant="outlined"
              color="inherit"
              onClick={onSignOut}
              size="small"
            >
              Sign out
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer — temporary overlay */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidthOpen,
              boxSizing: 'border-box',
            },
          }}
        >
          <Toolbar />
          {drawerContent(true)}
        </Drawer>
      )}

      {/* Desktop Drawer — permanent collapsible */}
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

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          backgroundColor: 'grey.100',
          minHeight: '100vh',
          minWidth: 0,
        }}
      >
        <Toolbar />
        {signOutError && (
          <Alert sx={{ mb: 2 }} severity="error">
            {signOutError}
          </Alert>
        )}
        <Outlet />
      </Box>
    </Box>
  );
};

export default AppShell;