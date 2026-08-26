/**
 * CSS custom-property references for JS/TSX (MUI `sx`, Recharts, inline styles).
 * Values live in `src/styles/tokens/` and swap with `[data-theme]`.
 */
export const color = {
  bgPage: 'var(--color-bg-page)',
  bgSurface: 'var(--color-bg-surface)',
  bgMuted: 'var(--color-bg-muted)',
  bgHover: 'var(--color-bg-hover)',
  bgInput: 'var(--color-bg-input)',
  bgInverse: 'var(--color-bg-inverse)',
  bgAccentSoft: 'var(--color-bg-accent-soft)',
  bgProgressTrack: 'var(--color-bg-progress-track)',
  bgOverlay: 'var(--color-bg-overlay)',
  bgNeutral: 'var(--color-bg-neutral)',
  bgLogo: 'var(--color-bg-logo)',

  textPrimary: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  textMuted: 'var(--color-text-muted)',
  textSubtle: 'var(--color-text-subtle)',
  textStrong: 'var(--color-text-strong)',
  textTertiary: 'var(--color-text-tertiary)',
  textInverse: 'var(--color-text-inverse)',

  border: 'var(--color-border)',
  borderSubtle: 'var(--color-border-subtle)',
  borderMuted: 'var(--color-border-muted)',
  borderLogo: 'var(--color-border-logo)',
  borderStrong: 'var(--color-border-strong)',
  borderInput: 'var(--color-border-input)',
  borderInverse: 'var(--color-border-inverse)',
  borderChart: 'var(--color-border-chart)',
  borderAxis: 'var(--color-border-axis)',

  gain: 'var(--color-gain)',
  loss: 'var(--color-loss)',
  lossBright: 'var(--color-loss-bright)',
  gainBg: 'var(--color-gain-bg)',
  gainBorder: 'var(--color-gain-border)',
  gainFg: 'var(--color-gain-fg)',
  lossBg: 'var(--color-loss-bg)',
  lossBorder: 'var(--color-loss-border)',
  lossFg: 'var(--color-loss-fg)',
  buyBg: 'var(--color-buy-bg)',
  sellBg: 'var(--color-sell-bg)',
  goalRemaining: 'var(--color-goal-remaining)',
  danger: 'var(--color-danger)',
  error: 'var(--color-error)',

  plan: 'var(--color-plan)',
  planMuted: 'var(--color-plan-muted)',
  planBg: 'var(--color-plan-bg)',
  planBorder: 'var(--color-plan-border)',
  planSoft: 'var(--color-plan-soft)',
  planLine: 'var(--color-plan-line)',
  planProgress: 'var(--color-plan-progress)',

  navActiveBg: 'var(--color-nav-active-bg)',
  navActiveFg: 'var(--color-nav-active-fg)',
  navInactiveFg: 'var(--color-nav-inactive-fg)',
  navGlass: 'var(--color-nav-glass)',
  navBorder: 'var(--color-nav-border)',

  selectedBg: 'var(--color-selected-bg)',
  selectedBorder: 'var(--color-selected-border)',
  selectedIconBg: 'var(--color-selected-icon-bg)',
  selectedFg: 'var(--color-selected-fg)',

  intervalActiveBg: 'var(--color-interval-active-bg)',
  intervalActiveText: 'var(--color-interval-active-text)',
  intervalDefaultBg: 'var(--color-interval-default-bg)',
  intervalDefaultText: 'var(--color-interval-default-text)',
  intervalSelectedBg: 'var(--color-interval-selected-bg)',

  button: 'var(--color-button)',
  buttonHover: 'var(--color-button-hover)',
  buttonDisabled: 'var(--color-button-disabled)',
  chartCursor: 'var(--color-chart-cursor)',
  chartBase: 'var(--color-chart-base)',
  chartGrid: 'var(--color-chart-grid)',
  chartSeries: 'var(--color-chart-series)',
  chartSeriesFill: 'var(--color-chart-series-fill)',
} as const;

export const shadow = {
  card: 'var(--shadow-card)',
  cardSoft: 'var(--shadow-card-soft)',
  cardRaised: 'var(--shadow-card-raised)',
  tooltip: 'var(--shadow-tooltip)',
  nav: 'var(--shadow-nav)',
  selected: 'var(--shadow-selected)',
  idle: 'var(--shadow-idle)',
} as const;

export const radius = {
  card: 'var(--radius-card)',
  control: 'var(--radius-control)',
} as const;

export const font = {
  sans: '"Open Sans", sans-serif',
} as const;

export const textSx = {
  primary: { color: color.textPrimary, fontFamily: font.sans },
  secondary: { color: color.textSecondary, fontFamily: font.sans },
  muted: { color: color.textMuted, fontFamily: font.sans },
} as const;

/** MUI ThemeProvider `modeStorageKey` — keep in sync with `index.html`. */
export const COLOR_SCHEME_STORAGE_KEY = 'portfolio-color-scheme';
