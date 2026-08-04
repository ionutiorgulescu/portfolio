import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { intervalOptions } from './stockMarket.types';
import type { ChartInterval } from './stockMarket.types';

type Props = {
  interval: ChartInterval;
  onChange: (interval: ChartInterval) => void;
  fullWidth?: boolean;
};

export function IntervalSelector({ interval, onChange, fullWidth }: Props) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        minWidth: 'max-content',
        width: fullWidth ? '100%' : 'auto',
        borderRadius: '12px',
        backgroundColor: 'grey.200',
        padding: '4px',
        gap: '2px',
      }}
    >
      {intervalOptions.map((option) => {
        const selected = interval === option.key;
        return (
          <ButtonBase
            key={option.key}
            onClick={() => onChange(option.key)}
            sx={{
              flex: fullWidth ? '1 0 auto' : '0 0 auto',
              borderRadius: '8px',
              padding: { xs: '6px 10px', sm: '6px 12px' },
              backgroundColor: selected ? 'white' : 'transparent',
              boxShadow: selected ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
              '&:hover': {
                backgroundColor: selected ? 'white' : 'rgba(0,0,0,0.04)',
              },
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: selected ? 700 : 400,
                fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                color: selected ? 'text.primary' : 'text.secondary',
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
