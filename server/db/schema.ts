import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export const refreshTokens = sqliteTable(
  'refresh_tokens',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index('idx_refresh_tokens_user_id').on(table.userId),
    index('idx_refresh_tokens_expires_at').on(table.expiresAt),
  ],
)

// Pending sign-ups. The account is only created once the emailed code is confirmed.
export const emailVerificationCodes = sqliteTable(
  'email_verification_codes',
  {
    email: text('email').primaryKey(),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index('idx_email_verification_codes_expires_at').on(table.expiresAt)],
)

export const portfolios = sqliteTable(
  'portfolios',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index('idx_portfolios_user_id').on(table.userId)],
)

export const positions = sqliteTable(
  'positions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tickerSymbol: text('ticker_symbol').notNull(),
    assetName: text('asset_name').notNull(),
    quantity: real('quantity').notNull(),
    price: real('price').notNull(),
    buyDate: text('buy_date').notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull(),
    transactionType: text('transaction_type').notNull(),
    portfolioId: text('portfolio_id')
      .notNull()
      .references(() => portfolios.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index('idx_positions_user_id').on(table.userId),
    index('idx_positions_portfolio_id').on(table.portfolioId),
  ],
)
