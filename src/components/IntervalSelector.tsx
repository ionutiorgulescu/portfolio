import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { intervalOptions } from './stockDashboard.types';
import type { ChartInterval } from './stockDashboard.types';

type Props = {
  interval: ChartInterval;
  onChange: (interval: ChartInterval) => void;
};

export function IntervalSelector({ interval, onChange }: Props) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
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
              borderRadius: '8px',
              padding: '4px 12px',
              backgroundColor: selected ? 'white' : 'transparent',
              boxShadow: selected ? 1 : 'none',
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
                color: selected ? 'text.primary' : 'text.secondary',
                lineHeight: 1,
                userSelect: 'none',
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
