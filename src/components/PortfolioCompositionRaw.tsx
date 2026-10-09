import { Box, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CompositionFilter } from "./FilterControl";
import type { PriceSession, TickerComposition } from "../hooks/usePortfolioComposition";
import { useValuesVisibility } from "../contexts/ValuesVisibilityContext";
import type { Currency } from "../types/positions";
import { bvbFaviconUrls, isBvbListing } from "../utils/bvbFavicon";
import chartPieIcon from "../assets/chart-pie.svg";
import sunriseIcon from "../assets/sunrise.svg";
import sunsetIcon from "../assets/sunset.svg";
import { color, shadow, textSx } from "../theme/cssVars";

const primaryTextSx = textSx.primary;
const secondaryTextSx = textSx.secondary;
const mutedTextSx = textSx.muted;

/** Light/white logos that disappear on the white avatar — invert to make them visible. */
const INVERT_LOGO_TICKERS = new Set(['V', 'UBER', 'AMZN', 'UNH', 'ABBV', 'ABR']);

const CURRENCY_LOCALES: Record<Currency, string> = {
    USD: 'en-US',
    RON: 'ro-RO',
    EUR: 'de-DE',
};

function formatCurrency(value: number, currency: Currency = 'USD'): string {
    return new Intl.NumberFormat(CURRENCY_LOCALES[currency], {
        style: 'currency',
        currency,
    }).format(value);
}

function formatPercent(value: number): string {
    return `${value.toFixed(2)}%`;
}

function formatQuantity(value: number): string {
    return value % 1 === 0
        ? String(value)
        : value.toFixed(4).replace(/\.?0+$/, '');
}

function LivePulseDot({
    positive,
    changePercent,
}: {
    positive: boolean;
    changePercent: number | null;
}) {
    const pulseColor = positive ? color.gain : color.loss;
    const pct =
        changePercent != null && Number.isFinite(Number(changePercent))
            ? Number(changePercent)
            : null;

    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                columnGap: 0.5,
                ml: 0.75,
                verticalAlign: 'middle',
            }}
        >
            <Box
                component="span"
                aria-hidden
                title={positive ? 'Up today' : 'Down today'}
                sx={{
                    position: 'relative',
                    display: 'inline-block',
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: pulseColor,
                    flexShrink: 0,
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        bgcolor: pulseColor,
                        animation: 'compositionLivePulse 1.6s ease-out infinite',
                    },
                    '@keyframes compositionLivePulse': {
                        '0%': { transform: 'scale(1)', opacity: 0.55 },
                        '70%': { transform: 'scale(2.4)', opacity: 0 },
                        '100%': { transform: 'scale(2.4)', opacity: 0 },
                    },
                }}
            />
            {pct != null ? (
                <Box
                    component="span"
                    sx={{
                        fontSize: 11,
                        fontWeight: 600,
                        lineHeight: '14px',
                        fontVariantNumeric: 'tabular-nums',
                        color: pulseColor,
                    }}
                >
                    {positive ? '+' : ''}
                    {pct.toFixed(2)}%
                </Box>
            ) : null}
        </Box>
    );
}

function SessionBadge({
    session,
    changePercent,
}: {
    session: PriceSession;
    changePercent: number | null;
}) {
    const isPre = session === 'PRE';
    const label = isPre ? 'Pre-market' : 'Post-market';
    const pct =
        changePercent != null && Number.isFinite(Number(changePercent))
            ? Number(changePercent)
            : null;
    const positive = (pct ?? 0) >= 0;

    return (
        <Box
            component="span"
            title={label}
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                columnGap: 0.5,
                ml: 0.75,
                pl: '8px',
                pr: '8px',
                py: '4px',
                borderRadius: '4px',
                bgcolor: color.bgAccentSoft,
                verticalAlign: 'middle',
            }}
        >
            <Box
                component="span"
                sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    bgcolor: color.bgSurface,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}
            >
                <Box
                    component="img"
                    src={isPre ? sunriseIcon : sunsetIcon}
                    alt={label}
                    sx={{
                        width: 12,
                        height: 12,
                        opacity: 0.7,
                        '[data-theme="dark"] &': {
                            filter: 'invert(1)',
                            opacity: 0.9,
                        },
                    }}
                />
            </Box>
            {pct != null ? (
                <Box
                    component="span"
                    sx={{
                        fontSize: 11,
                        fontWeight: 600,
                        lineHeight: '14px',
                        fontVariantNumeric: 'tabular-nums',
                        color: positive ? color.gain : color.loss,
                    }}
                >
                    {positive ? '+' : ''}
                    {pct.toFixed(2)}%
                </Box>
            ) : null}
        </Box>
    );
}

function TickerAvatar({
    ticker,
    assetName,
    currency,
    logoUrl,
    onClick,
}: {
    ticker: string;
    assetName?: string;
    currency?: string;
    logoUrl?: string | null;
    onClick?: () => void;
}) {
    const candidates = isBvbListing(ticker, currency)
        ? bvbFaviconUrls(assetName ?? '', ticker)
        : (logoUrl ? [logoUrl] : []);
    const sourcesKey = candidates.join('|');
    const [attempt, setAttempt] = useState(0);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        setAttempt(0);
        setLoaded(false);
    }, [ticker, sourcesKey]);

    const src = candidates[attempt] ?? null;
    const exhausted = attempt >= candidates.length;
    const invertLogo = INVERT_LOGO_TICKERS.has(ticker.toUpperCase());

    return (
        <Box
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick}
            onKeyDown={
                onClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onClick();
                        }
                    }
                    : undefined
            }
            aria-label={onClick ? `Add position for ${ticker}` : undefined}
            sx={{
                position: 'relative',
                width: 44,
                height: 44,
                borderRadius: '10px',
                bgcolor: color.bgLogo,
                border: '1px solid',
                borderColor: color.borderLogo,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                ...(onClick
                    ? {
                        '&:hover': {
                            bgcolor: color.bgNeutral,
                            boxShadow: shadow.idle,
                        },
                    }
                    : null),
            }}
        >
            {/* Initials render underneath immediately so a slow network never shows a blank square. */}
            {(!src || !loaded) && (
                <Typography
                    fontWeight={600}
                    sx={{
                        ...secondaryTextSx,
                        fontSize: 11,
                        lineHeight: '14px',
                        letterSpacing: 0.2,
                        textTransform: 'uppercase',
                    }}
                >
                    {ticker.slice(0, 4)}
                </Typography>
            )}
            {src && !exhausted && (
                <Box
                    component="img"
                    key={src}
                    src={src}
                    alt={`${ticker} logo`}
                    referrerPolicy="no-referrer"
                    onLoad={(event) => {
                        if (event.currentTarget.naturalWidth <= 16) {
                            setLoaded(false);
                            setAttempt((current) => current + 1);
                            return;
                        }
                        setLoaded(true);
                    }}
                    onError={() => {
                        setLoaded(false);
                        setAttempt((current) => current + 1);
                    }}
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        p: '6px',
                        opacity: loaded ? 1 : 0,
                        transition: 'opacity 0.15s ease',
                        ...(invertLogo ? { filter: 'invert(1)' } : null),
                    }}
                />
            )}
        </Box>
    );
}

export function PortfolioCompositionRow({
    row,
    currency,
    showPercent,
    onTogglePercent,
    onLogoClick,
    logoUrl,
    compositionFilter,
}: {
    row: TickerComposition;
    currency: Currency;
    showPercent: boolean;
    onTogglePercent: () => void;
    onLogoClick?: (row: TickerComposition) => void;
    logoUrl?: string | null;
    compositionFilter?: CompositionFilter;
}) {
    const { valuesHidden } = useValuesVisibility();
    const gainPositive = row.gainLoss >= 0;
    const gainLossPercent = row.costBasis !== 0 ? (row.gainLoss / row.costBasis) * 100 : 0;
    const dayChangePositive = (row.dayChangePercent ?? 0) >= 0;
    const showLiveDot =
        row.isMarketOpen &&
        row.dayChangePercent != null &&
        Number.isFinite(row.dayChangePercent);

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                columnGap: 1.5,
                py: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': { borderBottom: 'none' },
                WebkitTapHighlightColor: 'transparent',
            }}
        >
            <TickerAvatar
                ticker={row.ticker}
                assetName={row.assetName}
                currency={row.currency}
                logoUrl={logoUrl}
                onClick={onLogoClick ? () => onLogoClick(row) : undefined}
            />

            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    columnGap: 1.5,
                }}
            >
                <Box
                    sx={{
                        minWidth: 0,
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        rowGap: '2px',
                    }}
                >
                    <Typography
                        component={Link}
                        to={`/ticker/${encodeURIComponent(row.ticker)}`}
                        state={{
                            name: row.assetName,
                            currency: row.currency,
                            compositionFilter,
                        }}
                        aria-label={`View details for ${row.assetName}`}
                        onMouseEnter={() => {
                            void import('../pages/TickerDetails');
                        }}
                        onFocus={() => {
                            void import('../pages/TickerDetails');
                        }}
                        fontWeight={700}
                        sx={{
                            ...primaryTextSx,
                            fontSize: 15,
                            lineHeight: '18px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            textDecoration: 'none',
                            display: 'block',
                            width: 'fit-content',
                            maxWidth: '100%',
                            cursor: 'pointer',
                            '&:visited': { color: color.textPrimary },
                            '&:hover': {
                                textDecoration: 'underline',
                                textUnderlineOffset: '3px',
                            },
                        }}
                    >
                        {row.assetName}
                    </Typography>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            columnGap: 0,
                            rowGap: 0.5,
                            minWidth: 0,
                        }}
                    >
                        <Typography
                            component="span"
                            sx={{
                                ...secondaryTextSx,
                                fontSize: 13,
                                fontWeight: 600,
                                lineHeight: '18px',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {formatCurrency(row.currentPrice, row.currency)}
                        </Typography>
                        {showLiveDot ? (
                            <LivePulseDot
                                positive={dayChangePositive}
                                changePercent={valuesHidden ? null : row.dayChangePercent}
                            />
                        ) : null}
                        {row.priceSession ? (
                            <SessionBadge
                                session={row.priceSession}
                                changePercent={valuesHidden ? null : row.sessionChangePercent}
                            />
                        ) : null}
                    </Box>
                    <Typography
                        sx={{
                            ...mutedTextSx,
                            fontSize: 12,
                            lineHeight: '14px',
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {formatQuantity(row.quantity)} @ {formatCurrency(row.avgCost, row.currency)}
                    </Typography>
                </Box>

                <Box
                    onClick={onTogglePercent}
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        rowGap: '2px',
                        flexShrink: 0,
                        cursor: 'pointer',
                        userSelect: 'none',
                    }}
                >
                    {valuesHidden ? (
                        <LockOutlinedIcon sx={{ fontSize: 18, color: color.textSubtle }} />
                    ) : (
                        <Typography
                            fontWeight={600}
                            sx={{
                                fontFamily: '"Open Sans", sans-serif',
                                fontSize: 14,
                                lineHeight: '18px',
                                color: gainPositive ? color.gain : color.loss,
                                whiteSpace: 'nowrap',
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            {gainPositive ? '↑' : '↓'}{' '}
                            {showPercent
                                ? `${gainPositive ? '+' : ''}${gainLossPercent.toFixed(2)}%`
                                : `${gainPositive ? '+' : ''}${formatCurrency(row.gainLoss, currency)}`}
                        </Typography>
                    )}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            columnGap: 0.5,
                        }}
                    >
                        <Box
                            component="img"
                            src={chartPieIcon}
                            alt=""
                            aria-hidden
                            sx={{
                                width: 12,
                                height: 12,
                                opacity: 0.55,
                                flexShrink: 0,
                                '[data-theme="dark"] &': {
                                    filter: 'invert(1)',
                                    opacity: 0.7,
                                },
                            }}
                        />
                        <Typography
                            sx={{
                                ...secondaryTextSx,
                                fontSize: 12,
                                lineHeight: '14px',
                                fontVariantNumeric: 'tabular-nums',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {formatPercent(row.weight)}
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
