import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AppsIcon from '@mui/icons-material/Apps';

export type CompositionFilter = 'all' | 'stock' | 'crypto' | 'bvb';

const SELECTED_BG = '#E8F7F3';
const SELECTED_BORDER = '#C5EDE3';
const SELECTED_ICON_BG = '#D4F0E8';
const SELECTED_TEXT = '#1A5C4A';
const IDLE_BORDER = '#EDEDED';
const IDLE_ICON_BORDER = '#E8E8E8';
const IDLE_ICON_COLOR = '#9CA3AF';

const FILTER_OPTIONS: {
  label: string;
  value: CompositionFilter;
  icon: ReactNode;
}[] = [
  { label: 'Stocks', value: 'stock', icon: <ShowChartIcon fontSize="small" /> },
  { label: 'Crypto', value: 'crypto', icon: <CurrencyBitcoinIcon fontSize="small" /> },
  { label: 'BVB', value: 'bvb', icon: <AccountBalanceIcon fontSize="small" /> },
  { label: 'All', value: 'all', icon: <AppsIcon fontSize="small" /> },
];

interface FilterControlProps {
  value: CompositionFilter;
  onChange: (v: CompositionFilter) => void;
  exclude?: CompositionFilter[];
  hideName?: boolean;
}

export function FilterControl({ value, onChange, exclude, hideName }: FilterControlProps) {
  const visibleOptions = exclude
    ? FILTER_OPTIONS.filter((o) => !exclude.includes(o.value))
    : FILTER_OPTIONS;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, width: '100%' }}>
      {!hideName && (
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: 'text.secondary',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        Portfolio View
      </Typography>
      )}
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
                boxShadow: selected
                  ? '0 6px 16px rgba(18,165,148,0.14)'
                  : '0 1px 2px rgba(15,38,32,0.04)',
                transform: selected ? 'translateY(-2px)' : 'none',
                transition: 'all 220ms cubic-bezier(0.65,0,0.35,1)',
                '&:hover': {
                  backgroundColor: selected ? SELECTED_BG : 'grey.50',
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
