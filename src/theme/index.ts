import { createTheme } from '@mui/material/styles';
import { color } from './cssVars';

/**
 * MUI palette needs parseable colors (it lightens/darkens `main`).
 * Keep these hex values in sync with `src/styles/tokens/`.
 * Components should prefer CSS vars from `./cssVars` so they track `[data-theme]`.
 */
const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: '[data-theme="%s"]',
  },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#1976d2' },
        secondary: { main: '#9c27b0' },
        success: { main: '#27a69a' },
        error: { main: '#d92673' },
        background: {
          default: '#f5f5f5',
          paper: '#ffffff',
        },
        text: {
          primary: '#393a36',
          secondary: '#61615e',
        },
        divider: '#e5e7eb',
      },
    },
    dark: {
      palette: {
        primary: { main: '#5b9cf0' },
        secondary: { main: '#b794f6' },
        success: { main: '#3dccc0' },
        error: { main: '#f04890' },
        background: {
          default: '#141413',
          paper: '#1e1e1c',
        },
        text: {
          primary: '#f2f2ef',
          secondary: '#b0b0aa',
        },
        divider: '#3a3a36',
      },
    },
  },
  typography: {
    fontFamily: [
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: color.bgPage,
          color: color.textPrimary,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

export default theme;

export { useColorScheme } from '@mui/material/styles';
