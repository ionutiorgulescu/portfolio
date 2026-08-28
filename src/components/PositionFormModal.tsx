import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import { useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
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
  IconButton,
  InputAdornment,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Grid from '@mui/material/Grid';
import { createPositionSchema } from '../schemas/positionSchema';
import type { NewPosition } from '../schemas/positionSchema';
import { PositionStatus, TransactionType, Currency } from '../types/positions';
import type { Position } from '../types/positions';
import { usePositions } from '../hooks/usePositions';
import { color } from '../theme/cssVars';

const QUANTITY_SCALE = 1e8;

function roundQuantity(value: number): number {
  return Math.round(value * QUANTITY_SCALE) / QUANTITY_SCALE;
}

function formatHoldingQuantity(value: number): string {
  const rounded = roundQuantity(value);
  if (!Number.isFinite(rounded) || rounded <= 0) return '0';
  return String(rounded);
}

function getAvailableSellQuantity(
  positions: Position[],
  tickerSymbol: string,
  excludePositionId?: string,
): number {
  const ticker = tickerSymbol.trim().toUpperCase();
  if (!ticker) return 0;

  let quantity = 0;
  for (const held of positions) {
    if (excludePositionId && held.id === excludePositionId) continue;
    if (held.ticker_symbol.trim().toUpperCase() !== ticker) continue;
    quantity += held.status === PositionStatus.Buy ? held.quantity : -held.quantity;
  }

  return Math.max(0, roundQuantity(quantity));
}

type PositionDefaults = Partial<
  Pick<NewPosition, 'ticker_symbol' | 'asset_name' | 'price' | 'currency' | 'transaction_type'>
>;

type PositionFormModalProps = {
  open: boolean;
  portfolioId: string;
  /** When provided the form is in edit mode and fields are pre-filled */
  position?: Position;
  /** Prefill values for create mode (e.g. from composition row) */
  defaults?: PositionDefaults;
  /** Keep currency & transaction_type in form data but hide their inputs */
  hideCurrencyAndType?: boolean;
  isSubmitting: boolean;
  onSubmit: (data: NewPosition) => void;
  onClose: () => void;
};

const emptyDefaults = (portfolioId: string): NewPosition => ({
  ticker_symbol: '',
  asset_name: '',
  quantity: '1',
  price: '1',
  buy_date: new Date().toISOString().split('T')[0],
  currency: Currency.USD,
  status: PositionStatus.Buy,
  transaction_type: TransactionType.Stock,
  portfolio_id: portfolioId,
});

const PositionFormModal = ({
  open,
  portfolioId,
  position,
  defaults,
  hideCurrencyAndType = false,
  isSubmitting,
  onSubmit,
  onClose,
}: PositionFormModalProps) => {
  const isEditMode = Boolean(position);
  const { data: positions = [] } = usePositions(portfolioId);
  const availableQuantityRef = useRef(0);
  const resolver = useMemo(
    () => zodResolver(createPositionSchema(() => availableQuantityRef.current)),
    [],
  );

  const {
    control,
    handleSubmit,
    reset,
    trigger,
    formState: { errors },
  } = useForm<NewPosition>({
    resolver,
    // Re-initialise whenever the dialog opens with a different position / defaults
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
          ...emptyDefaults(portfolioId),
          ...defaults,
          portfolio_id: portfolioId,
        },
  });

  const status = useWatch({ control, name: 'status' });
  const tickerSymbol = useWatch({ control, name: 'ticker_symbol' });
  const isSell = status === PositionStatus.Sell;
  const availableQuantity = useMemo(
    () => getAvailableSellQuantity(positions, tickerSymbol ?? '', position?.id),
    [positions, tickerSymbol, position?.id],
  );
  availableQuantityRef.current = availableQuantity;

  useEffect(() => {
    if (!open || !isSell) return;
    void trigger('quantity');
  }, [open, isSell, availableQuantity, trigger]);

  // Clear form state whenever the modal closes
  useEffect(() => {
    if (!open) {
      reset(emptyDefaults(portfolioId));
    }
  }, [open, portfolioId, reset]);

  const handleClose = () => {
    if (isSubmitting) return;
    reset(emptyDefaults(portfolioId));
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {isEditMode ? 'Edit Position' : 'Add New Position'}
          <IconButton
            size="small"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
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
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
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
                    helperText={
                      errors.quantity?.message ??
                      (isSell && tickerSymbol
                        ? `Available: ${formatHoldingQuantity(availableQuantity)}`
                        : undefined)
                    }
                    margin="normal"
                    onChange={(event) => {
                      field.onChange(event);
                      if (isSell) void trigger('quantity');
                    }}
                    InputProps={
                      isSell
                        ? {
                            endAdornment: (
                              <InputAdornment position="end">
                                <Button
                                  type="button"
                                  size="small"
                                  onClick={() => {
                                    field.onChange(formatHoldingQuantity(availableQuantity));
                                    void trigger('quantity');
                                  }}
                                  disabled={availableQuantity <= 0 || isSubmitting}
                                  aria-label="Use all available quantity"
                                  sx={{
                                    minWidth: 'auto',
                                    px: 0.75,
                                    py: 0.25,
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    lineHeight: 1.2,
                                  }}
                                >
                                  All
                                </Button>
                              </InputAdornment>
                            ),
                          }
                        : undefined
                    }
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
            <Grid size={{ xs: 12, sm: hideCurrencyAndType ? 12 : 6 }}>
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
            {hideCurrencyAndType ? (
              <>
                <Controller
                  name="currency"
                  control={control}
                  render={({ field }) => <input type="hidden" {...field} />}
                />
                <Controller
                  name="transaction_type"
                  control={control}
                  render={({ field }) => <input type="hidden" {...field} />}
                />
              </>
            ) : (
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
            )}
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
            {!hideCurrencyAndType && (
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
            )}
            <Grid size={{ xs: 12 }}>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                sx={{ bgcolor: 'text.primary', '&:hover': { bgcolor: color.buttonHover }, mt: 2 }}
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
