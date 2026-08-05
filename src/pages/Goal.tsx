import { useState, useId, useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import { useMonthlyGoal, aggregateMonthlyData, type RangeOption } from '../hooks/useMonthlyGoal';
import { MonthlyGoalChart } from '../components/GoalTracker/MonthlyGoalChart';
import { GoalMetrics } from '../components/GoalTracker/GoalMetrics';
import { usePortfolioContext } from '../contexts/PortfolioContext';

const SELECTED_BG = '#E8F7F3';
const SELECTED_BORDER = '#C5EDE3';
const SELECTED_TEXT = '#1A5C4A';
const IDLE_BORDER = '#E0E0E0';
const IDLE_ICON_COLOR = '#6B7280';

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

      {/* Year selector + monthly goal */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            gap: { xs: 0.75, sm: 1.25 },
            width: '100%',
          }}
        >
          {RANGES.map(r => {
            const selected = range === r.value;
            return (
              <ButtonBase
                key={r.value}
                onClick={() => setRange(r.value)}
                sx={{
                  flex: '1 1 0',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.75,
                  px: { xs: 1, sm: 1.5 },
                  py: { xs: 1.25, sm: 1.5 },
                  borderRadius: { xs: '12px', sm: '14px' },
                  backgroundColor: selected ? SELECTED_BG : 'background.paper',
                  border: '1.5px solid',
                  borderColor: selected ? SELECTED_BORDER : IDLE_BORDER,
                  transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                  '&:hover': {
                    backgroundColor: selected ? SELECTED_BG : 'grey.50',
                  },
                }}
              >
                <CalendarTodayOutlinedIcon
                  sx={{
                    fontSize: { xs: 18, sm: 20 },
                    color: selected ? SELECTED_TEXT : IDLE_ICON_COLOR,
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: selected ? 700 : 500,
                    fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                    color: selected ? SELECTED_TEXT : 'text.secondary',
                    lineHeight: 1.2,
                    userSelect: 'none',
                  }}
                >
                  {r.label}
                </Typography>
              </ButtonBase>
            );
          })}
        </Box>

        <Box
          component="label"
          htmlFor={goalInputId}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            width: '100%',
            px: { xs: 1.75, sm: 2.25 },
            py: { xs: 1.5, sm: 1.75 },
            borderRadius: { xs: '12px', sm: '14px' },
            backgroundColor: 'background.paper',
            border: '1.5px solid',
            borderColor: IDLE_BORDER,
            cursor: 'text',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GpsFixedIcon sx={{ fontSize: 20, color: IDLE_ICON_COLOR }} />
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                userSelect: 'none',
              }}
            >
              Monthly goal
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', fontWeight: 500, userSelect: 'none' }}
            >
              $
            </Typography>
            <InputBase
              id={goalInputId}
              inputProps={{ type: 'number', min: 0, step: 100 }}
              value={goal}
              onChange={e => setGoal(Math.max(0, Number(e.target.value)))}
              sx={{
                width: 80,
                fontSize: { xs: 18, sm: 20 },
                fontWeight: 700,
                color: 'text.primary',
                '& input': {
                  p: 0,
                  textAlign: 'right',
                  // Hide number spinners
                  '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                    WebkitAppearance: 'none',
                    margin: 0,
                  },
                  MozAppearance: 'textfield',
                },
              }}
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
