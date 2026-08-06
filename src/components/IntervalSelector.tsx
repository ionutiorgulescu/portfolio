import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { intervalOptions } from './stockMarket.types';
import type { ChartInterval } from './stockMarket.types';

type Props = {
  interval: ChartInterval;
  onChange: (interval: ChartInterval) => void;
  fullWidth?: boolean;
  variant?: 'pill' | 'underline';
};

export function IntervalSelector({
  interval,
  onChange,
  fullWidth,
  variant = 'pill',
}: Props) {
  if (variant === 'underline') {
    return (
      <Box
        sx={{
          display: 'flex',
          minWidth: 'max-content',
          width: fullWidth ? '100%' : 'auto',
          justifyContent: 'space-between',
          gap: { xs: 0.5, sm: 1 },
        }}
      >
        {intervalOptions.map((option) => {
          const selected = interval === option.key;
          return (
            <ButtonBase
              key={option.key}
              onClick={() => onChange(option.key)}
              sx={{
                flex: fullWidth ? 1 : '0 0 auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.75,
                px: { xs: 0.5, sm: 1 },
                py: 0.5,
                minWidth: 0,
                borderRadius: 0,
                transition: 'color 0.15s ease',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: selected ? 700 : 500,
                  fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                  color: selected ? '#1f2937' : '#9ca3af',
                  lineHeight: 1,
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {option.key}
              </Typography>
              <Box
                sx={{
                  width: 18,
                  height: 3,
                  borderRadius: 999,
                  bgcolor: selected ? 'var(--color-portfolio-value)' : 'transparent',
                  transition: 'background-color 0.15s ease',
                }}
              />
            </ButtonBase>
          );
        })}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        minWidth: 'max-content',
        width: fullWidth ? '100%' : 'auto',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: { xs: 0.25, sm: 0.5 },
      }}
    >
      {intervalOptions.map((option) => {
        const selected = interval === option.key;
        return (
          <ButtonBase
            key={option.key}
            onClick={() => onChange(option.key)}
            sx={{
              flex: fullWidth ? 1 : '0 0 auto',
              borderRadius: '10px',
              px: { xs: 1, sm: 1.25 },
              py: { xs: 0.75, sm: 0.85 },
              minWidth: 0,
              backgroundColor: selected ? '#eceff1' : 'transparent',
              transition: 'background-color 0.15s ease',
              '&:hover': {
                backgroundColor: selected ? '#eceff1' : 'rgba(0,0,0,0.04)',
              },
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: selected ? 700 : 500,
                fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                color: selected ? '#111827' : '#6b7280',
                lineHeight: 1,
                userSelect: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {option.key}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}
