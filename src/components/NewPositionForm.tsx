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
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { positionSchema } from '../schemas/positionSchema';
import type { NewPosition } from '../schemas/positionSchema';
import { PositionStatus, TransactionType } from '../types/positions';

type NewPositionFormProps = {
  onSubmit: (data: NewPosition) => void;
  isSubmitting?: boolean;
};

const NewPositionForm = ({ onSubmit, isSubmitting = false }: NewPositionFormProps) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPosition>({
    resolver: zodResolver(positionSchema),
    defaultValues: {
      ticker_symbol: '',
      asset_name: '',
      quantity: 1,
      price: 1,
      buy_date: '',
      currency: 'USD',
      status: PositionStatus.Buy,
      transaction_type: TransactionType.Stock,
    },
  });

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 3, p: 3, border: '1px solid #ccc', borderRadius: '8px' }}>
      <Typography variant="h5" gutterBottom>
        Create New Position
      </Typography>
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
                onChange={(e) => field.onChange(Number(e.target.value))}
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
                onChange={(e) => field.onChange(Number(e.target.value))}
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
                InputLabelProps={{
                  shrink: true,
                }}
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
                <MenuItem value="USD">USD</MenuItem>
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
                <Select
                  {...field}
                  labelId="status-label"
                  label="Status"
                  fullWidth
                >
                  {Object.values(PositionStatus).map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
            {errors.status && <Typography color="error" variant="caption">{errors.status.message}</Typography>}
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <FormControl fullWidth margin="normal" error={!!errors.status}>
            <InputLabel id="status-label">Type</InputLabel>
            <Controller
              name="transaction_type"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="status-label"
                  label="Type"
                  fullWidth
                >
                  {Object.values(TransactionType).map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
            {errors.status && <Typography color="error" variant="caption">{errors.status.message}</Typography>}
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Button type="submit" variant="contained" color="primary" fullWidth sx={{ bgcolor: 'text.primary', '&:hover': { bgcolor: 'grey.800' },  mt: 2}} disabled={isSubmitting}>
            Add Position
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default NewPositionForm;
