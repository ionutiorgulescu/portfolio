import { Box, Typography } from "@mui/material";
import type { TickerComposition } from "../hooks/usePortfolioComposition";

const primaryTextSx = {
    color: "#393a36",
    fontFamily: '"Open Sans", sans-serif',
};

const secondaryTextSx = {
    color: "#61615e",
    fontFamily: '"Open Sans", sans-serif',
};

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

export function PortfolioCompositionRow({ row, maxWeight, currency }: { row: TickerComposition; maxWeight: number; currency: 'USD' | 'RON' }) {
    const gainPositive = row.gainLoss >= 0;

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 110px',
                alignItems: 'center',
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                gap: 2,
                '&:last-child': { borderBottom: 'none' },
                '&:hover': { bgcolor: 'grey.50' },
                transition: 'background-color 0.15s ease',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                {/* Ticker avatar */}
                <Box
                    sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: 'grey.100',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    <Typography
                        fontWeight={700}
                        sx={{
                            ...secondaryTextSx,
                            fontSize: 10,
                            lineHeight: "12px",
                        }}
                    >
                        {row.ticker.slice(0, 4)}
                    </Typography>
                </Box>

                {/* Name + progress bar area */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%' }}>
                        {/* Progress bar — desktop only */}
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
                                display: { xs: 'none', sm: 'block' },
                            }}
                        />

                        {/* Asset name — desktop only */}
                        <Typography
                            fontWeight={500}
                            sx={{
                                ...primaryTextSx,
                                fontSize: 16,
                                lineHeight: "20px",
                                position: 'relative',
                                zIndex: 1,
                                px: 1,
                                py: 0.5,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: { xs: 'none', sm: 'block' },
                            }}
                        >
                            {row.assetName}
                        </Typography>
                        <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'row', px: 1, zIndex: 1, gap: 1 }}>
                            <Typography
                                fontWeight={500}
                                sx={{ ...secondaryTextSx, fontSize: 16, lineHeight: "20px" }}
                            >
                                qty {formatQuantity(row.quantity)}
                            </Typography>
                            <Typography sx={{ ...secondaryTextSx, fontSize: 14, lineHeight: "20px" }}>
                                avg {formatCurrency(row.avgCost, currency)}
                            </Typography>
                        </Box>

                        {/* Quantity + Avg Cost — mobile only */}
                        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', px: 1, zIndex: 1, }}>
                            <Typography
                                fontWeight={500}
                                sx={{ ...secondaryTextSx, fontSize: 16, lineHeight: "20px" }}
                            >
                                {formatQuantity(row.quantity)}
                            </Typography>
                            <Typography sx={{ ...secondaryTextSx, fontSize: 14, lineHeight: "20px" }}>
                                avg {formatCurrency(row.avgCost, currency)}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            </Box>

            { }
            <Typography
                sx={{
                    ...secondaryTextSx,
                    fontSize: 16,
                    lineHeight: "20px",
                    textAlign: 'right',
                }}
            >
                {formatPercent(row.weight)}
            </Typography>

            {/* Gain/Loss */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                <Typography
                    fontWeight={600}
                    sx={{
                        fontFamily: '"Open Sans", sans-serif',
                        fontSize: 16,
                        lineHeight: "20px",
                        color: gainPositive ? '#27a69a' : '#d92673',
                    }}
                >
                    {gainPositive ? '↑' : '↓'} {gainPositive ? '+' : ''}{formatCurrency(row.gainLoss, currency)}
                </Typography>
            </Box>
        </Box>
    );
}