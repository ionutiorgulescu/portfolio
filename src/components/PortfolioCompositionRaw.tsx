import { Box, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import type { PriceSession, TickerComposition } from "../hooks/usePortfolioComposition";
import chartPieIcon from "../assets/chart-pie.svg";
import sunriseIcon from "../assets/sunrise.svg";
import sunsetIcon from "../assets/sunset.svg";

const primaryTextSx = {
    color: "#393a36",
    fontFamily: '"Open Sans", sans-serif',
};

const secondaryTextSx = {
    color: "#61615e",
    fontFamily: '"Open Sans", sans-serif',
};

const mutedTextSx = {
    color: "#9a9a96",
    fontFamily: '"Open Sans", sans-serif',
};

function buildLogoCandidates(logoUrl?: string | null): string[] {
    return logoUrl ? [logoUrl] : [];
}

/** Light/white logos that disappear on the white avatar — invert to make them visible. */
const INVERT_LOGO_TICKERS = new Set(['V', 'UBER', 'AMZN', 'UNH', 'ABBV', 'ABR']);

function formatCurrency(value: number, currency: 'USD' | 'RON' = 'USD'): string {
    return new Intl.NumberFormat(currency === 'RON' ? 'ro-RO' : 'en-US', {
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

function SessionBadge({
    session,
    changePercent,
}: {
    session: PriceSession;
    changePercent: number | null;
}) {
    const isPre = session === 'PRE';
    const label = isPre ? 'Pre-market' : 'Post-market';
    const hasChange = changePercent != null;
    const positive = (changePercent ?? 0) >= 0;

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
                bgcolor: '#e9eef6',
                verticalAlign: 'middle',
            }}
        >
            <Box
                component="span"
                sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    bgcolor: 'white',
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
                    }}
                />
            </Box>
            {hasChange ? (
                <Box
                    component="span"
                    sx={{
                        fontSize: 11,
                        fontWeight: 600,
                        lineHeight: '14px',
                        fontVariantNumeric: 'tabular-nums',
                        color: positive ? '#27a69a' : '#d92673',
                    }}
                >
                    {positive ? '+' : ''}
                    {changePercent.toFixed(2)}%
                </Box>
            ) : null}
        </Box>
    );
}

function TickerAvatar({
    ticker,
    logoUrl,
    onClick,
}: {
    ticker: string;
    logoUrl?: string | null;
    onClick?: () => void;
}) {
    const candidates = buildLogoCandidates(logoUrl);
    const [attempt, setAttempt] = useState(0);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        setAttempt(0);
        setLoaded(false);
    }, [ticker, logoUrl]);

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
                bgcolor: 'white',
                border: '1px solid',
                borderColor: 'grey.200',
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
                            bgcolor: '#e6e6e3',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
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
                    onLoad={() => setLoaded(true)}
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
}: {
    row: TickerComposition;
    currency: 'USD' | 'RON';
    showPercent: boolean;
    onTogglePercent: () => void;
    onLogoClick?: (row: TickerComposition) => void;
    logoUrl?: string | null;
}) {
    const gainPositive = row.gainLoss >= 0;
    const gainLossPercent = row.costBasis !== 0 ? (row.gainLoss / row.costBasis) * 100 : 0;

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
                '&:hover': { bgcolor: 'grey.50' },
                transition: 'background-color 0.15s ease',
            }}
        >
            <TickerAvatar
                ticker={row.ticker}
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
                        fontWeight={700}
                        sx={{
                            ...primaryTextSx,
                            fontSize: 15,
                            lineHeight: '18px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {row.assetName}
                    </Typography>
                    <Typography
                        sx={{
                            ...secondaryTextSx,
                            fontSize: 13,
                            fontWeight: 600,
                            lineHeight: '18px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {formatCurrency(row.currentPrice, currency)}
                        {row.priceSession ? (
                            <SessionBadge
                                session={row.priceSession}
                                changePercent={row.sessionChangePercent}
                            />
                        ) : null}
                    </Typography>
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
                        {formatQuantity(row.quantity)} @ {formatCurrency(row.avgCost, currency)}
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
                    <Typography
                        fontWeight={600}
                        sx={{
                            fontFamily: '"Open Sans", sans-serif',
                            fontSize: 14,
                            lineHeight: '18px',
                            color: gainPositive ? '#27a69a' : '#d92673',
                            whiteSpace: 'nowrap',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {gainPositive ? '↑' : '↓'}{' '}
                        {showPercent
                            ? `${gainPositive ? '+' : ''}${gainLossPercent.toFixed(2)}%`
                            : `${gainPositive ? '+' : ''}${formatCurrency(row.gainLoss, currency)}`
                        }
                    </Typography>
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
