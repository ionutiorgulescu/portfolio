import { Box, Typography } from "@mui/material";
import type { TickerComposition } from "../hooks/usePortfolioComposition";
import { TransactionType } from "../types/positions";

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatPercent(value: number): string {
    return `${value.toFixed(2)}%`;
}

export function CompositionRow({ row, maxWeight }: { row: TickerComposition; maxWeight: number }) {
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
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 10 }}>
                        {row.transactionType === TransactionType.Crypto ? row.ticker.slice(0, 3) : row.ticker.slice(0, 4)}
                    </Typography>
                </Box>

                <Box sx={{ flex: 1, minWidth: 0, display: { xs: 'none', sm: 'flex' } }}>
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
                            variant="body2"
                            fontWeight={500}
                            sx={{
                                position: 'relative',
                                zIndex: 1,
                                px: 1,
                                py: 0.5,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {row.assetName}
                        </Typography>
                    </Box>
                </Box>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
                {formatPercent(row.weight)}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{ color: gainPositive ? '#16a34a' : '#dc2626' }}
                >
                    {gainPositive ? '↑' : '↓'} {gainPositive ? '+' : ''}{formatCurrency(row.gainLoss)}
                </Typography>
            </Box>
        </Box>
    );
}