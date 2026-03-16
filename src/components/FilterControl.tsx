import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

export type CompositionFilter = 'all' | 'stock' | 'crypto';

const FILTER_OPTIONS: { label: string; value: CompositionFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Stocks', value: 'stock' },
  { label: 'Crypto', value: 'crypto' },
];

interface FilterControlProps {
  value: CompositionFilter;
  onChange: (v: CompositionFilter) => void;
}

export function FilterControl({ value, onChange }: FilterControlProps) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        borderRadius: '12px',
        backgroundColor: 'grey.200',
        padding: '4px',
        gap: '2px',
        width: 'fit-content',
      }}
    >
      {FILTER_OPTIONS.map(option => {
        const selected = value === option.value;
        return (
          <ButtonBase
            key={option.value}
            onClick={() => onChange(option.value)}
            sx={{
              borderRadius: '8px',
              padding: '4px 16px',
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
              {option.label}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}