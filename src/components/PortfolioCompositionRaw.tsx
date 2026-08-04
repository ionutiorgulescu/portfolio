import { Box, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import type { TickerComposition } from "../hooks/usePortfolioComposition";

const primaryTextSx = {
    color: "#393a36",
    fontFamily: '"Open Sans", sans-serif',
};

const secondaryTextSx = {
    color: "#61615e",
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
                width: 40,
                height: 40,
                // Rounded-square "squircle" instead of a strict circle: brand logos come in a mix
                // of square app-icon assets and round vector marks, and a square container looks
                // consistent for both instead of clipping square logos into an odd shape.
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
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                ...(onClick
                    ? {
                        '&:hover': {
                            borderColor: 'grey.400',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                        },
                    }
                    : null),
            }}
        >
            {/* Initials render underneath immediately so a slow network never shows a blank circle. */}
            {(!src || !loaded) && (
                <Typography
                    fontWeight={700}
                    sx={{
                        ...secondaryTextSx,
                        fontSize: 10,
                        lineHeight: "12px",
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
                        p: '4px',
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
    maxWeight,
    currency,
    showPercent,
    onTogglePercent,
    onLogoClick,
    logoUrl,
}: {
    row: TickerComposition;
    maxWeight: number;
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
                display: 'grid',
                // Mobile: ticker | qty | wt | p/l — equal column treatment
                // Desktop: stock+qty | wt | p/l
                gridTemplateColumns: {
                    xs: '56px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
                    sm: '1fr 80px 110px',
                },
                alignItems: 'center',
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                columnGap: { xs: 1.5, sm: 3 },
                '&:last-child': { borderBottom: 'none' },
                '&:hover': { bgcolor: 'grey.50' },
                transition: 'background-color 0.15s ease',
            }}
        >
            {/* Ticker — mobile. On desktop: ticker + name/qty */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    columnGap: 2,
                    minWidth: 0,
                    // Span is automatic; on desktop this is the wide first column
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 0.25,
                        flexShrink: 0,
                        width: { xs: '100%', sm: 'auto' },
                        overflow: 'hidden',
                    }}
                >
                    <TickerAvatar
                        ticker={row.ticker}
                        logoUrl={logoUrl}
                        onClick={onLogoClick ? () => onLogoClick(row) : undefined}
                    />

                    <Typography
                        fontWeight={600}
                        sx={{
                            ...secondaryTextSx,
                            fontSize: 11,
                            lineHeight: '14px',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%',
                            display: { xs: 'block', sm: 'none' },
                        }}
                    >
                        {(row.assetName.length > 9) ? row.assetName.slice(0, 3) + '...' : row.assetName}
                    </Typography>

                    <Typography
                        sx={{
                            ...secondaryTextSx,
                            fontSize: 11,
                            lineHeight: '14px',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%',
                            display: { xs: 'block', sm: 'none' },
                        }}
                    >
                        {formatCurrency(row.currentPrice, currency)}
                    </Typography>
                </Box>

                {/* Name + qty — desktop only */}
                <Box sx={{ flex: 1, minWidth: 0, display: { xs: 'none', sm: 'block' } }}>
                    <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%' }}>
                        <Box
                            sx={{
                                position: 'absolute',
                                left: 0,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                height: 32,
                                width: `${(row.weight / maxWeight) * 100}%`,
                                bgcolor: 'grey.100',
                                borderRadius: '6px',
                                zIndex: 0,
                            }}
                        />

                        <Typography
                            fontWeight={500}
                            sx={{
                                ...primaryTextSx,
                                fontSize: 16,
                                lineHeight: '20px',
                                position: 'relative',
                                zIndex: 1,
                                px: 1,
                                py: 0.5,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {row.assetName} ({formatCurrency(row.currentPrice, currency)})
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'row', px: 1, zIndex: 1, gap: 1 }}>
                            <Typography
                                fontWeight={500}
                                sx={{ ...secondaryTextSx, fontSize: 16, lineHeight: '20px' }}
                            >
                                {formatQuantity(row.quantity)}
                            </Typography>
                            <Typography sx={{ ...secondaryTextSx, fontSize: 14, lineHeight: '20px' }}>
                                avg {formatCurrency(row.avgCost, currency)}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            </Box>

            {/* Qty / Avg — mobile only (own grid column, mirrors ticker column) */}
            <Box
                sx={{
                    display: { xs: 'flex', sm: 'none' },
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 0,
                    gap: 0.25,
                }}
            >
                <Typography
                    fontWeight={500}
                    sx={{
                        ...secondaryTextSx,
                        fontSize: 14,
                        lineHeight: '18px',
                        fontVariantNumeric: 'tabular-nums',
                        textAlign: 'center',
                    }}
                >
                    {formatQuantity(row.quantity)}
                </Typography>
                <Typography
                    sx={{
                        ...secondaryTextSx,
                        fontSize: 12,
                        lineHeight: '18px',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                    }}
                >
                    avg {formatCurrency(row.avgCost, currency)}
                </Typography>
            </Box>

            {/* Weight */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 0,
                }}
            >
                <Typography
                    sx={{
                        ...secondaryTextSx,
                        fontSize: { xs: 14, sm: 16 },
                        lineHeight: { xs: '18px', sm: '20px' },
                        textAlign: 'center',
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {formatPercent(row.weight)}
                </Typography>
            </Box>

            {/* Gain/Loss */}
            <Box
                onClick={onTogglePercent}
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: { xs: 'center', sm: 'flex-end' },
                    justifyContent: 'center',
                    cursor: 'pointer',
                    minWidth: 0,
                }}
            >
                <Typography
                    fontWeight={600}
                    sx={{
                        fontFamily: '"Open Sans", sans-serif',
                        fontSize: { xs: 11, sm: 16 },
                        lineHeight: { xs: '14px', sm: '20px' },
                        color: gainPositive ? '#27a69a' : '#d92673',
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                        textAlign: { xs: 'center', sm: 'right' },
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                    }}
                >
                    {gainPositive ? '↑' : '↓'}{' '}
                    {showPercent
                        ? `${gainPositive ? '+' : ''}${gainLossPercent.toFixed(2)}%`
                        : `${gainPositive ? '+' : ''}${formatCurrency(row.gainLoss, currency)}`
                    }
                </Typography>
            </Box>
        </Box>
    );
}