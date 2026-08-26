import type { ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '../theme';
import { COLOR_SCHEME_STORAGE_KEY } from '../theme/cssVars';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  return (
    <MuiThemeProvider
      theme={theme}
      defaultMode="light"
      modeStorageKey={COLOR_SCHEME_STORAGE_KEY}
      noSsr
    >
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
};
