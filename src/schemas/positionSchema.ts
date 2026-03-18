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

export const positionSchema = z.object({
  ticker_symbol: z.string().min(1, 'Ticker symbol is required'),
  asset_name: z.string().min(1, 'Asset name is required'),
  quantity: z.number().positive('Quantity must be positive'),
  price: z.number().positive('Buy price must be positive'),
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
    message: 'Currency must be USD or RON',
  }),
  status: z.enum([PositionStatus.Buy, PositionStatus.Sell]),
  transaction_type: z.enum([TransactionType.Stock, TransactionType.Crypto]),
  portfolio_id: z.string().uuid('Invalid portfolio ID'),
});

export type NewPosition = z.infer<typeof positionSchema>;