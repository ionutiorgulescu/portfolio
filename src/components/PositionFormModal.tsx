import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  TextField,
  Button,
  MenuItem,
  Box,
  Select,
  InputLabel,
  FormControl,
  Typography,
  CircularProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { positionSchema } from '../schemas/positionSchema';
import type { NewPosition } from '../schemas/positionSchema';
import { PositionStatus, TransactionType, Currency } from '../types/positions';
import type { Position } from '../types/positions';

type PositionFormModalProps = {
  open: boolean;
  portfolioId: string;
  /** When provided the form is in edit mode and fields are pre-filled */
  position?: Position;
  isSubmitting: boolean;
  onSubmit: (data: NewPosition) => void;
  onClose: () => void;
};

const PositionFormModal = ({
  open,
  portfolioId,
  position,
  isSubmitting,
  onSubmit,
  onClose,
}: PositionFormModalProps) => {
  const isEditMode = Boolean(position);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPosition>({
    resolver: zodResolver(positionSchema),
    // Re-initialise whenever the dialog opens with a different position
    values: position
      ? {
          ticker_symbol: position.ticker_symbol,
          asset_name: position.asset_name,
          // Schema stores these as strings
          quantity: String(position.quantity),
          price: String(position.price),
          buy_date: position.buy_date,
          currency: position.currency,
          status: position.status,
          transaction_type: position.transaction_type,
          portfolio_id: position.portfolio_id,
        }
      : {
          ticker_symbol: '',
          asset_name: '',
          quantity: '1',
          price: '1',
          buy_date: new Date().toISOString().split('T')[0],
          currency: Currency.USD,
          status: PositionStatus.Buy,
          transaction_type: TransactionType.Stock,
          portfolio_id: portfolioId,
        },
  });

  return (
    <Dialog open={open} onClose={!isSubmitting ? onClose : undefined} maxWidth="md" fullWidth>
      <DialogTitle>{isEditMode ? 'Edit Position' : 'Add New Position'}</DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 1 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="ticker_symbol"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Ticker Symbol"
                    fullWidth
                    error={!!errors.ticker_symbol}
                    helperText={errors.ticker_symbol?.message}
                    margin="normal"
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="asset_name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Asset Name"
                    fullWidth
                    error={!!errors.asset_name}
                    helperText={errors.asset_name?.message}
                    margin="normal"
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="quantity"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Quantity"
                    type="number"
                    fullWidth
                    error={!!errors.quantity}
                    helperText={errors.quantity?.message}
                    margin="normal"
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="price"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Price"
                    type="number"
                    fullWidth
                    error={!!errors.price}
                    helperText={errors.price?.message}
                    margin="normal"
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="buy_date"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Buy Date"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    error={!!errors.buy_date}
                    helperText={errors.buy_date?.message}
                    margin="normal"
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Currency"
                    select
                    fullWidth
                    error={!!errors.currency}
                    helperText={errors.currency?.message}
                    margin="normal"
                  >
                    {Object.values(Currency).map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth margin="normal" error={!!errors.status}>
                <InputLabel id="status-label">Status</InputLabel>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} labelId="status-label" label="Status">
                      {Object.values(PositionStatus).map((s) => (
                        <MenuItem key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
                {errors.status && (
                  <Typography color="error" variant="caption">
                    {errors.status.message}
                  </Typography>
                )}
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth margin="normal" error={!!errors.transaction_type}>
                <InputLabel id="type-label">Type</InputLabel>
                <Controller
                  name="transaction_type"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} labelId="type-label" label="Type">
                      {Object.values(TransactionType).map((t) => (
                        <MenuItem key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
                {errors.transaction_type && (
                  <Typography color="error" variant="caption">
                    {errors.transaction_type.message}
                  </Typography>
                )}
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                sx={{ bgcolor: 'text.primary', '&:hover': { bgcolor: 'grey.800' }, mt: 2 }}
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {isSubmitting
                  ? isEditMode
                    ? 'Saving…'
                    : 'Adding…'
                  : isEditMode
                    ? 'Save Changes'
                    : 'Add Position'}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default PositionFormModal;
