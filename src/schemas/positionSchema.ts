import { z } from 'zod';
import { Currency, PositionStatus, TransactionType } from '../types/positions';

const buyDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const parseIsoLocalDate = (value: string): Date | null => {
  if (!buyDateRegex.test(value)) return null;

  const [yearString, monthString, dayString] = value.split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);
  const parsedDate = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) return null;

  return parsedDate;
};

const positiveStringNumber = (fieldName: string) =>
  z
    .string()
    .min(1, `${fieldName} is required`)
    .refine((val) => !isNaN(Number(val)), {
      message: `${fieldName} must be a valid number`,
    })
    .refine((val) => Number(val) > 0, {
      message: `${fieldName} must be positive`,
    });

export const positionSchema = z.object({
  ticker_symbol: z.string().min(1, 'Ticker symbol is required'),
  asset_name: z.string().min(1, 'Asset name is required'),
  quantity: positiveStringNumber('Quantity'),
  price: positiveStringNumber('Buy price'),
  buy_date: z
    .string()
    .regex(buyDateRegex, 'Buy date must be in YYYY-MM-DD format')
    .refine((value) => parseIsoLocalDate(value) !== null, {
      message: 'Buy date must be a valid calendar date',
    })
    .refine((value) => {
      const parsedDate = parseIsoLocalDate(value);
      if (!parsedDate) return false;
      const dayOfWeek = parsedDate.getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6;
    }, {
      message: 'Buy date must be a weekday (Monday to Friday)',
    })
    .refine((value) => {
      const parsedDate = parseIsoLocalDate(value);
      if (!parsedDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return parsedDate <= today;
    }, {
      message: 'Buy date cannot be in the future',
    }),
  currency: z.enum(Currency, {
    message: 'Currency must be USD, RON or EUR',
  }),
  status: z.enum([PositionStatus.Buy, PositionStatus.Sell]),
  transaction_type: z.enum([TransactionType.Stock, TransactionType.Crypto]),
  portfolio_id: z.string().uuid('Invalid portfolio ID'),
});

/** Caps sell quantity to current holdings. `getMaxSellQuantity` is read at validate time. */
export const createPositionSchema = (getMaxSellQuantity: () => number) =>
  positionSchema.superRefine((data, ctx) => {
    if (data.status !== PositionStatus.Sell) return;
    if (!data.ticker_symbol.trim()) return;

    const quantity = Number(data.quantity);
    if (!Number.isFinite(quantity)) return;

    const maxSellQuantity = getMaxSellQuantity();
    if (quantity <= maxSellQuantity + 1e-8) return;

    ctx.addIssue({
      code: 'custom',
      path: ['quantity'],
      message:
        maxSellQuantity <= 0
          ? 'You have no shares of this ticker to sell'
          : `Quantity cannot exceed your holding of ${maxSellQuantity}`,
    });
  });

export type NewPosition = z.infer<typeof positionSchema>;
