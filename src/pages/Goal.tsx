import { useState, useId, useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import { useMonthlyGoal, aggregateMonthlyData, type RangeOption } from '../hooks/useMonthlyGoal';
import { MonthlyGoalChart } from '../components/GoalTracker/MonthlyGoalChart';
import { GoalMetrics } from '../components/GoalTracker/GoalMetrics';
import { usePortfolioContext } from '../contexts/PortfolioContext';

const _currentYear = new Date().getFullYear();
const RANGES: { label: string; value: RangeOption }[] = Array.from(
  { length: 4 },
  (_, i) => {
    const yr = String(_currentYear - 3 + i);
    return { label: yr, value: yr };
  }
);

const EMPTY_STATS = { totalBuys: 0, totalSells: 0, totalInvested: 0, avgMonthly: 0, monthsMet: 0, monthsMissed: 0 };

const Goal = () => {
  const { selectedPortfolioId, isLoading: portfolioLoading } = usePortfolioContext();
  const [goal, setGoal] = useState(1000);
  const [range, setRange] = useState<RangeOption>(String(_currentYear));
  const goalInputId = useId();

  const {
    data: positions = [],
    isLoading: positionsLoading,
    error,
  } = useMonthlyGoal(selectedPortfolioId, range);

  const isLoading = portfolioLoading || positionsLoading;

  const { months, stats } = useMemo(
    () =>
      positions.length > 0
        ? aggregateMonthlyData(positions, goal, range)
        : { months: [], stats: EMPTY_STATS },
    [positions, goal, range],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* Header row */}
      <Box sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 2, sm: 0 },
      }}>
        {/* Range tabs */}
        <Box sx={{
          display: 'inline-flex',
          borderRadius: '12px',
          backgroundColor: 'grey.200',
          padding: '4px',
          gap: '2px',
          width: 'fit-content',
        }}>
          {RANGES.map(r => {
            const selected = range === r.value;
            return (
              <ButtonBase
                key={r.value}
                onClick={() => setRange(r.value)}
                sx={{
                  borderRadius: '8px',
                  px: 2,
                  py: 0.5,
                  backgroundColor: selected ? 'white' : 'transparent',
                  boxShadow: selected ? 1 : 'none',
                  transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                  '&:hover': { backgroundColor: selected ? 'white' : 'rgba(0,0,0,0.04)' },
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
                  {r.label}
                </Typography>
              </ButtonBase>
            );
          })}
        </Box>

        {/* Goal input */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, paddingLeft: 1 }}>
          <Typography
            component="label"
            htmlFor={goalInputId}
            variant="body2"
            color="text.secondary"
            sx={{ whiteSpace: 'nowrap' }}
          >
            Monthly goal
          </Typography>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: 'grey.100',
            border: '1px solid',
            borderColor: 'grey.300',
            borderRadius: '10px',
            px: 1.5,
            py: 0.5,
          }}>
            <Typography variant="body2" color="text.secondary" sx={{ userSelect: 'none' }}>$</Typography>
            <InputBase
              id={goalInputId}
              inputProps={{ type: 'number', min: 0, step: 100 }}
              value={goal}
              onChange={e => setGoal(Math.max(0, Number(e.target.value)))}
              sx={{ width: 72, fontSize: 14, fontWeight: 500, '& input': { p: 0, textAlign: 'right' } }}
            />
          </Box>
        </Box>
      </Box>


      {/* Error */}
      {error && (
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Failed to load data'}
        </Alert>
      )}

      {/* Metrics */}
      <GoalMetrics stats={stats} loading={isLoading} currencySymbol={"$"} goal={goal} range={range} />

      {/* Chart */}
      <MonthlyGoalChart months={months} goal={goal} loading={isLoading} currencySymbol={"$"} />

    </Box>
  );
};

export default Goal;
