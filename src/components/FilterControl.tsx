import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AppsIcon from '@mui/icons-material/Apps';
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import { color, shadow } from '../theme/cssVars';

export type CompositionFilter = 'all' | 'stock' | 'etf' | 'crypto' | 'bvb';

const COMPOSITION_FILTERS: readonly CompositionFilter[] = ['all', 'stock', 'etf', 'crypto', 'bvb'];

let rememberedCompositionFilter: CompositionFilter = 'stock';

export function isCompositionFilter(value: unknown): value is CompositionFilter {
  return COMPOSITION_FILTERS.includes(value as CompositionFilter);
}

export function getRememberedCompositionFilter(): CompositionFilter {
  return rememberedCompositionFilter;
}

export function rememberCompositionFilter(filter: CompositionFilter): void {
  rememberedCompositionFilter = filter;
}

const SELECTED_BG = color.selectedBg;
const SELECTED_BORDER = color.selectedBorder;
const SELECTED_ICON_BG = color.selectedIconBg;
const SELECTED_TEXT = color.selectedFg;
const IDLE_BORDER = color.borderMuted;
const IDLE_ICON_BORDER = color.border;
const IDLE_ICON_COLOR = color.textSubtle;

const FILTER_OPTIONS: {
  label: string;
  value: CompositionFilter;
  icon: ReactNode;
}[] = [
  { label: 'Stocks', value: 'stock', icon: <ShowChartIcon fontSize="small" /> },
  { label: 'ETF', value: 'etf', icon: <StackedLineChartIcon fontSize="small" /> },
  { label: 'Crypto', value: 'crypto', icon: <CurrencyBitcoinIcon fontSize="small" /> },
  { label: 'BVB', value: 'bvb', icon: <AccountBalanceIcon fontSize="small" /> },
  { label: 'All', value: 'all', icon: <AppsIcon fontSize="small" /> },
];

interface FilterControlProps {
  value: CompositionFilter;
  onChange: (v: CompositionFilter) => void;
  exclude?: CompositionFilter[];
}

export function FilterControl({ value, onChange, exclude }: FilterControlProps) {
  const visibleOptions = exclude
    ? FILTER_OPTIONS.filter((o) => !exclude.includes(o.value))
    : FILTER_OPTIONS;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          gap: { xs: 0.75, sm: 1.25 },
          width: '100%',
        }}
      >
        {visibleOptions.map((option) => {
          const selected = value === option.value;
          return (
            <ButtonBase
              key={option.value}
              onClick={() => onChange(option.value)}
              sx={{
                flex: '1 1 0',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: { xs: 0.75, sm: 1.25 },
                px: { xs: 1.25, sm: 1.75 },
                py: { xs: 1.25, sm: 1.75 },
                borderRadius: { xs: '12px', sm: '16px' },
                backgroundColor: selected ? SELECTED_BG : 'background.paper',
                border: '1px solid',
                borderColor: selected ? SELECTED_BORDER : IDLE_BORDER,
                boxShadow: selected ? shadow.selected : shadow.idle,
                transform: selected ? 'translateY(-2px)' : 'none',
                transition: 'all 220ms cubic-bezier(0.65,0,0.35,1)',
                '&:hover': {
                  backgroundColor: selected ? SELECTED_BG : color.bgHover,
                },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: { xs: 26, sm: 32 },
                  height: { xs: 26, sm: 32 },
                  borderRadius: { xs: '6px', sm: '8px' },
                  backgroundColor: selected ? SELECTED_ICON_BG : 'background.paper',
                  border: selected ? 'none' : `1px solid ${IDLE_ICON_BORDER}`,
                  color: selected ? SELECTED_TEXT : IDLE_ICON_COLOR,
                  '& .MuiSvgIcon-root': { fontSize: { xs: 15, sm: 18 } },
                }}
              >
                {option.icon}
              </Box>

              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                  color: selected ? SELECTED_TEXT : 'text.primary',
                  lineHeight: 1.2,
                  userSelect: 'none',
                }}
              >
                {option.label}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}
