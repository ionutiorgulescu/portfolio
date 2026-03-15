import * as XLSX from 'xlsx';
import type { TransactionType } from '../types/positions';

export interface ImportRow {
  asset_name: string;
  ticker_symbol: string;
  buy_date: string;
  transaction_type: TransactionType;
  quantity: number;
  price: number;
  currency: 'USD';
  status: 'open';
}

export interface RowError {
  row: number;
  message: string;
}

export interface ParseResult {
  valid: ImportRow[];
  errors: RowError[];
}

interface RawRow {
  Name?: unknown;
  Ticker?: unknown;
  Date?: unknown;
  Type?: unknown;
  Amount?: unknown;
  Price?: unknown;
}

const extractDate = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();

  // Handle "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD" formats
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }

  // SheetJS may parse dates as JS Date serial numbers; handle Date objects too
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const month = String(date.m).padStart(2, '0');
      const day = String(date.d).padStart(2, '0');
      return `${date.y}-${month}-${day}`;
    }
  }

  return null;
};

const isValidDate = (dateStr: string): boolean => {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed <= today;
};

const validateRow = (raw: RawRow, rowIndex: number): ImportRow | RowError => {
  const rowNum = rowIndex + 2; // +1 for 0-index, +1 for header row

  const assetName = raw.Name !== undefined && raw.Name !== null ? String(raw.Name).trim() : '';
  if (!assetName) {
    return { row: rowNum, message: 'Name is required' };
  }

  const ticker = raw.Ticker !== undefined && raw.Ticker !== null ? String(raw.Ticker).trim() : '';
  if (!ticker) {
    return { row: rowNum, message: 'Ticker is required' };
  }

  const dateStr = extractDate(raw.Date);
  if (!dateStr) {
    return { row: rowNum, message: `Invalid Date format — expected "YYYY-MM-DD", got "${raw.Date}"` };
  }
  if (!isValidDate(dateStr)) {
    return { row: rowNum, message: `Date "${dateStr}" is not a valid calendar date or is in the future` };
  }

  const typeRaw = raw.Type !== undefined && raw.Type !== null ? String(raw.Type).trim().toLowerCase() : '';
  if (typeRaw !== 'buy' && typeRaw !== 'sell') {
    return { row: rowNum, message: `Type must be "buy" or "sell", got "${raw.Type}"` };
  }

  const quantity = Number(raw.Amount);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { row: rowNum, message: `Amount must be a positive number, got "${raw.Amount}"` };
  }

  const price = Number(raw.Price);
  if (!Number.isFinite(price) || price <= 0) {
    return { row: rowNum, message: `Price must be a positive number, got "${raw.Price}"` };
  }

  return {
    asset_name: assetName,
    ticker_symbol: ticker,
    buy_date: dateStr,
    transaction_type: typeRaw as TransactionType,
    quantity,
    price,
    currency: 'USD',
    status: 'open',
  };
};

export const parseXlsxFile = (buffer: ArrayBuffer): ParseResult => {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return { valid: [], errors: [{ row: 0, message: 'The file contains no sheets' }] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null });

  if (rows.length === 0) {
    return { valid: [], errors: [{ row: 0, message: 'The file contains no data rows' }] };
  }

  const valid: ImportRow[] = [];
  const errors: RowError[] = [];

  rows.forEach((row, index) => {
    const result = validateRow(row, index);
    if ('message' in result) {
      errors.push(result);
    } else {
      valid.push(result);
    }
  });

  return { valid, errors };
};
