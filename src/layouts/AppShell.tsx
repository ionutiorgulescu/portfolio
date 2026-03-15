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
  const [isMenuOpen, setIsMenuOpen] = useState(true);

  const drawerWidth = isMenuOpen ? drawerWidthOpen : drawerWidthClosed;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        color="default"
        elevation={0}
        sx={(theme) => ({
          zIndex: theme.zIndex.drawer + 1,
          ml: `${drawerWidth}px`,
          width: `calc(100% - ${drawerWidth}px)`,
          transition: theme.transitions.create(['margin', 'width'], {
            duration: theme.transitions.duration.standard,
          }),
          backgroundColor: 'white',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
        })}
      >
        <Toolbar sx={{ justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton color="inherit" edge="start" onClick={() => setIsMenuOpen((prev) => !prev)}>
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" component="h1">
              Portfolio App
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2">Signed in as {userEmail ?? 'unknown user'}</Typography>
            <Button variant="outlined" color="inherit" onClick={onSignOut}>
              Sign out
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

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
        <List>
          {menuItems.map((item) => (
            <ListItemButton
              key={item.path}
              component={NavLink}
              to={item.path}
              sx={{
                minHeight: 48,
                px: 2.5,
                justifyContent: isMenuOpen ? 'initial' : 'center',
                '&.active': {
                  bgcolor: 'action.selected',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: isMenuOpen ? 2 : 0,
                  justifyContent: 'center',
                  color: 'text.primary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} sx={{ opacity: isMenuOpen ? 1 : 0 }} primaryTypographyProps={{ color: 'text.primary' }} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, backgroundColor: 'grey.100', minHeight: '100vh' }}>
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
