import { Box, Skeleton } from "@mui/material";

export function RowSkeleton() {
    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 100px',
                alignItems: 'center',
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                gap: 2,
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Skeleton variant="circular" width={40} height={40} />
                <Skeleton width={160} height={20} />
            </Box>
            <Skeleton width={50} height={20} />
            <Skeleton width={80} height={20} />
        </Box>
    );
}
