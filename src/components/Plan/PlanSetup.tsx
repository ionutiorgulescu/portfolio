import { useState } from "react";
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    MenuItem,
    Select,
    TextField,
    CircularProgress,
    Paper,
} from "@mui/material";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from "recharts";
import { usePlan, type PlanParams } from "../../hooks/usePlan";

// ─── Constants ───────────────────────────────────────────────────────────────

const TARGET_VALUES: string[] = ["50,000", "75,000", "100,000", "125,000", "150,000", "200,000"];
const TARGET_YEARS: number[] = [5, 7, 10, 12, 15, 20];

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlanForm {
    startDate: string;
    targetValue: string;
    targetYears: string;
}

interface PlanSetupProps {
    portfolioId: string;
    existingPlan?: PlanForm | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDisplayDate(dateStr: string): string {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}.${m}.${y}`;
}

function formatDollar(value: number): string {
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value}`;
}

function formatMonthYearFromKey(key: string): string {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
    });
}

function addYearsToDate(dateStr: string, years: number): string {
    const [year, month] = dateStr.split("-").map(Number);
    return new Date(year + years, month - 1, 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
    });
}

function toPlanParams(form: PlanForm): PlanParams {
    return {
        startDate: form.startDate,
        targetValue: parseInt(form.targetValue.replace(/,/g, ""), 10),
        targetYears: parseInt(form.targetYears, 10),
    };
}

function monthDiff(fromKey: string, toKey: string): number {
    const [fromYear, fromMonth] = fromKey.split("-").map(Number);
    const [toYear, toMonth] = toKey.split("-").map(Number);
    return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const textInputSx = {
    "& .MuiOutlinedInput-root": {
        height: 32,
        bgcolor: "#f5f5f5",
        fontSize: 14,
        borderRadius: "4px",
        color: "#61615e",
    },
    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#888986" },
    "& .MuiInputBase-input": { py: "6px", px: "8px" },
};

const dropdownSx = {
    height: 32,
    bgcolor: "#fff",
    fontSize: 14,
    borderRadius: "4px",
    color: "#393a36",
    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#393a36" },
    "& .MuiSelect-select": { py: "6px", px: "8px" },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PlanSetup({ portfolioId, existingPlan = null }: PlanSetupProps) {
    const [form, setForm] = useState<PlanForm>(
        existingPlan ?? { startDate: "2023-06-01", targetValue: "", targetYears: "" }
    );
    const [saved, setSaved] = useState<boolean>(!!existingPlan);
    const [editing, setEditing] = useState<boolean>(!existingPlan);
    const [submittedParams, setSubmittedParams] = useState<PlanParams | null>(
        existingPlan ? toPlanParams(existingPlan) : null
    );

    const { data, isFetching, error } = usePlan(portfolioId, submittedParams);

    const isComplete: boolean = !!(form.startDate && form.targetValue && form.targetYears);

    const handleFieldChange = <K extends keyof PlanForm>(key: K, value: PlanForm[K]): void => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = (): void => {
        setEditing(false);
        setSaved(true);
        setSubmittedParams(toPlanParams(form));
    };

    const expectedByNow = data ? data.stats.targetPerMonth * data.stats.monthsTracked : 0;
    const scheduleGap = data ? Math.abs(data.stats.totalInvested - expectedByNow) : 0;
    const scheduleDeltaPct = expectedByNow > 0 && data ? ((data.stats.totalInvested - expectedByNow) / expectedByNow) * 100 : 0;
    const monthlyDelta = data ? data.stats.avgMonthly - data.stats.targetPerMonth : 0;
    const numericTargetValue = submittedParams?.targetValue ?? 0;
    const expectedPctRaw = numericTargetValue > 0 ? (expectedByNow / numericTargetValue) * 100 : 0;
    const investedPctRaw = numericTargetValue > 0 ? ((data?.stats.totalInvested ?? 0) / numericTargetValue) * 100 : 0;
    const expectedPct = Math.max(0, Math.min(expectedPctRaw, 100));
    const investedPct = Math.max(0, Math.min(investedPctRaw, 100));
    const progressExpectedGapPct = Math.max(expectedPct - investedPct, 0);
    const progressRemainingPct = Math.max(0, 100 - investedPct - progressExpectedGapPct);

    const remainingAmount = data && numericTargetValue > 0
        ? Math.max(numericTargetValue - data.stats.totalInvested, 0)
        : 0;
    const remainingMonths = data ? Math.max(data.stats.monthsTotal - data.stats.monthsTracked, 1) : 1;
    const neededPerMonth = remainingAmount > 0 ? Math.round(remainingAmount / remainingMonths) : 0;

    const startKey = form.startDate.slice(0, 7);
    const plannedFinishMonth = data ? (() => {
        const [startYear, startMonth] = startKey.split("-").map(Number);
        const startTotal = startYear * 12 + (startMonth - 1);
        const finishTotal = startTotal + data.stats.monthsTotal - 1;
        const year = Math.floor(finishTotal / 12);
        const month = String((finishTotal % 12) + 1).padStart(2, "0");
        return `${year}-${month}`;
    })() : null;
    const finishVarianceMonths =
        data?.stats.projectedFinishMonth && plannedFinishMonth
            ? monthDiff(plannedFinishMonth, data.stats.projectedFinishMonth)
            : null;
    const deltaToExpected = data ? data.stats.totalInvested - expectedByNow : 0;
    const isAhead = data?.stats.scheduleStatus === "ahead";
    const aheadChipColors = {
        bg: "#edf9f8",
        border: "#9ed9d4",
        text: "#27a69a",
    };

    const projectedFinishLabel = data?.stats.projectedFinishMonth
        ? new Date(`${data.stats.projectedFinishMonth}-01`).toLocaleDateString("en-US", { month: "short", year: "numeric" })
        : null;

    const statCardSx = {
        borderRadius: "16px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.10)",
        p: 3,
        display: "flex",
        flexDirection: "column",
        gap: 3,
    };

    const chipSxBase = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "4px",
        borderWidth: "1px",
        borderStyle: "solid",
        px: 1,
        py: 0.5,
        fontSize: 16,
        lineHeight: "20px",
        fontWeight: 600,
        width: "fit-content",
    };

    return (
        <Box sx={{ bgcolor: "#f4f4f4", minHeight: "100vh", pb: 5 }}>

            {/* Setup Card */}
            <Card elevation={0} sx={{ mx: 2, borderRadius: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <CardContent sx={{ p: 2.5, "&:last-child": { pb: 3 } }}>

                    {/* Fields */}
                    <Box sx={{
                        display: "flex",
                        flexDirection: { xs: "column", md: "row" },
                        gap: 3,
                        alignItems: { xs: "stretch", md: "flex-end" },
                    }}>
                        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                            <Typography sx={{ fontSize: 16, fontWeight: 600, color: "#393a36", lineHeight: "20px" }}>
                                Start Date
                            </Typography>
                            <TextField
                                type="text"
                                size="small"
                                value={toDisplayDate(form.startDate)}
                                InputProps={{ readOnly: true }}
                                sx={textInputSx}
                            />
                        </Box>
                        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                            <Typography sx={{ fontSize: 16, fontWeight: 600, color: "#393a36", lineHeight: "20px" }}>
                                Desired investments
                            </Typography>
                            <Select<string>
                                size="small"
                                displayEmpty
                                value={form.targetValue}
                                onChange={(e) => handleFieldChange("targetValue", e.target.value)}
                                sx={dropdownSx}
                            >
                                <MenuItem value="" disabled>Select target</MenuItem>
                                {TARGET_VALUES.map((v) => (
                                    <MenuItem key={v} value={v}>${v}</MenuItem>
                                ))}
                            </Select>
                        </Box>
                        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                            <Typography sx={{ fontSize: 16, fontWeight: 600, color: "#393a36", lineHeight: "20px" }}>
                                Timeframe
                            </Typography>
                            <Select<string>
                                size="small"
                                displayEmpty
                                value={form.targetYears}
                                onChange={(e) => handleFieldChange("targetYears", e.target.value)}
                                sx={dropdownSx}
                            >
                                <MenuItem value="" disabled>Select years</MenuItem>
                                {TARGET_YEARS.map((y) => (
                                    <MenuItem key={y} value={String(y)}>{y} years</MenuItem>
                                ))}
                            </Select>
                        </Box>
                        <Button
                            variant="contained"
                            disabled={!isComplete}
                            onClick={handleSave}
                            sx={{
                                height: 32,
                                px: { xs: 0, md: 2 },
                                borderRadius: "4px",
                                bgcolor: "#393a36",
                                fontWeight: 600,
                                fontSize: 14,
                                textTransform: "none",
                                letterSpacing: 0,
                                boxShadow: "none",
                                flexShrink: 0,
                                width: { xs: "100%", md: 200 },
                                mt: { xs: 0.5, md: "28px" },
                                "&:hover": { bgcolor: "#55564f", boxShadow: "none" },
                                "&.Mui-disabled": { bgcolor: "#ccc", color: "#fff" },
                            }}
                        >
                            Calculate plan
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {/* Results — only shown after Calculate Plan */}
            {saved && !editing && (
                <>
                    {/* Stats Cards */}
                    {data && (
                        <Box sx={{ mx: 2, mt: 2, display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 1.5 }}>
                            <Card elevation={0} sx={statCardSx}>
                                <Typography sx={{ fontSize: 20, lineHeight: "28px", color: "#393a36", fontFamily: '"Open Sans", sans-serif', fontWeight: 600 }}>
                                    Overall progress
                                </Typography>
                                <Box>
                                    <Typography sx={{ fontSize: 40, lineHeight: "40px", fontWeight: 700, color: "#393a36" }}>
                                        ${data.stats.totalInvested.toLocaleString()}
                                    </Typography>
                                    <Typography sx={{ fontSize: 20, lineHeight: "28px", color: "#61615e", mt: 1.5 }}>
                                        of ${form.targetValue}
                                    </Typography>
                                </Box>
                                <Box sx={{ ...chipSxBase, bgcolor: "#f6f3fa", borderColor: "#ae93d0", color: "#6c3baa" }}>
                                    {data.stats.currentProgress}% complete
                                </Box>
                            </Card>

                            <Card elevation={0} sx={statCardSx}>
                                <Typography sx={{ fontSize: 20, lineHeight: "28px", color: "#393a36", fontWeight: 600 }}>
                                    Schedule
                                </Typography>
                                <Box>
                                    <Typography sx={{ fontSize: 40, lineHeight: "40px", fontWeight: 700, color: "#393a36" }}>
                                        {data.stats.scheduleStatus === "on-track" ? "On track" : data.stats.scheduleStatus === "ahead" ? "Ahead" : "Behind"}
                                    </Typography>
                                    <Typography sx={{ fontSize: 20, lineHeight: "28px", color: "#61615e", mt: 1.5 }}>
                                        {data.stats.scheduleStatus === "on-track"
                                            ? `on target at M${data.stats.monthsTracked}`
                                            : `$${scheduleGap.toLocaleString()} ${data.stats.scheduleStatus === "ahead" ? "ahead" : "gap"} at M${data.stats.monthsTracked}`}
                                    </Typography>
                                </Box>
                                <Box
                                    sx={{
                                        ...chipSxBase,
                                        bgcolor: data.stats.scheduleStatus === "ahead" ? aheadChipColors.bg : "#fdf2f7",
                                        borderColor: data.stats.scheduleStatus === "ahead" ? aheadChipColors.border : "#ea88b2",
                                        color: data.stats.scheduleStatus === "ahead" ? aheadChipColors.text : "#d92673",
                                    }}
                                >
                                    {(data.stats.scheduleStatus === "ahead" ? "▲ " : data.stats.scheduleStatus === "on-track" ? "" : "▼ ")}
                                    {data.stats.scheduleStatus === "on-track"
                                        ? "On target"
                                        : `${scheduleDeltaPct > 0 ? "+" : "-"}${Math.abs(scheduleDeltaPct).toFixed(1)}% vs target`}
                                </Box>
                            </Card>

                            <Card elevation={0} sx={statCardSx}>
                                <Typography sx={{ fontSize: 20, lineHeight: "28px", color: "#393a36", fontWeight: 600 }}>
                                    Monthly average
                                </Typography>
                                <Box>
                                    <Typography sx={{ fontSize: 40, lineHeight: "40px", fontWeight: 700, color: "#393a36" }}>
                                        ${data.stats.avgMonthly.toLocaleString()}
                                    </Typography>
                                    <Typography sx={{ fontSize: 20, lineHeight: "28px", color: "#61615e", mt: 1.5 }}>
                                        target ${data.stats.targetPerMonth.toLocaleString()}/month
                                    </Typography>
                                </Box>
                                <Box
                                    sx={{
                                        ...chipSxBase,
                                        bgcolor: monthlyDelta >= 0 ? aheadChipColors.bg : "#fdf2f7",
                                        borderColor: monthlyDelta >= 0 ? aheadChipColors.border : "#ea88b2",
                                        color: monthlyDelta >= 0 ? aheadChipColors.text : "#d92673",
                                    }}
                                >
                                    {monthlyDelta >= 0 ? "▲ " : "▼ "}
                                    {monthlyDelta >= 0
                                        ? `$${Math.abs(monthlyDelta).toLocaleString()} surplus`
                                        : `-$${Math.abs(monthlyDelta).toLocaleString()} shortfall`}
                                </Box>
                            </Card>

                            <Card elevation={0} sx={statCardSx}>
                                <Typography sx={{ fontSize: 20, lineHeight: "28px", color: "#393a36", fontWeight: 600 }}>
                                    Expected finish
                                </Typography>
                                <Box>
                                    <Typography sx={{ fontSize: 40, lineHeight: "40px", fontWeight: 700, color: "#393a36" }}>
                                        {data.stats.projectedFinishMonth
                                            ? new Date(`${data.stats.projectedFinishMonth}-01`).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                                            : "—"}
                                    </Typography>
                                    <Typography sx={{ fontSize: 20, lineHeight: "28px", color: "#61615e", mt: 1.5 }}>
                                        at current pace
                                    </Typography>
                                </Box>
                                <Box
                                    sx={{
                                        ...chipSxBase,
                                        bgcolor: (finishVarianceMonths ?? 0) <= 0 ? aheadChipColors.bg : "#fdf2f7",
                                        borderColor: (finishVarianceMonths ?? 0) <= 0 ? aheadChipColors.border : "#ea88b2",
                                        color: (finishVarianceMonths ?? 0) <= 0 ? aheadChipColors.text : "#d92673",
                                    }}
                                >
                                    {(finishVarianceMonths ?? 0) <= 0 ? "▲ " : "▼ "}
                                    {finishVarianceMonths === null
                                        ? "No projection"
                                        : finishVarianceMonths === 0
                                            ? "On time"
                                            : finishVarianceMonths > 0
                                                ? `${finishVarianceMonths} months late`
                                                : `${Math.abs(finishVarianceMonths)} months early`}
                                </Box>
                            </Card>
                        </Box>
                    )}

                    {/* Trajectory Chart */}
                    <Card elevation={0} sx={{ mx: 2, mt: 2, borderRadius: "16px", boxShadow: "0 2px 4px rgba(0,0,0,0.10)" }}>
                        <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
                            <Typography sx={{ fontSize: 20, lineHeight: "28px", fontWeight: 600, color: "#393a36", mb: 0.5 }}>
                                Investment trajectory · {formatMonthYearFromKey(form.startDate.slice(0, 7))} – {addYearsToDate(form.startDate, Number(form.targetYears || 0))}
                            </Typography>
                            <Typography sx={{ fontSize: 20, lineHeight: "28px", fontWeight: 400, color: "#61615e", mb: 3 }}>
                                Actual cumulative vs. ${data?.stats.targetPerMonth.toLocaleString()}/mo flat target
                            </Typography>

                            {isFetching ? (
                                <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                                    <CircularProgress size={28} sx={{ color: "#111" }} />
                                </Box>
                            ) : error ? (
                                <Typography sx={{ fontSize: 13, color: "#ef4444", textAlign: "center", py: 4 }}>
                                    Failed to load data
                                </Typography>
                            ) : data ? (
                                <ResponsiveContainer width="100%" height={320}>
                                    <LineChart data={data.trajectory} margin={{ top: 12, right: 16, bottom: 10, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ebebeb" vertical={false} />
                                        <XAxis
                                            dataKey="key"
                                            tickFormatter={formatMonthYearFromKey}
                                            tick={{ fontSize: 14, fill: "#393a36" }}
                                            tickLine={{ stroke: "#b0b0af", strokeWidth: 2, dy: 6 }}
                                            axisLine={{ stroke: "#b0b0af", strokeWidth: 2 }}
                                            interval="preserveStartEnd"
                                            minTickGap={28}
                                        />
                                        <YAxis
                                            tickFormatter={formatDollar}
                                            tick={{ fontSize: 14, fill: "#393a36" }}
                                            tickLine={false}
                                            axisLine={{ stroke: "#b0b0af", strokeWidth: 2 }}
                                            width={52}
                                        />
                                        <Tooltip
                                            cursor={{ stroke: "#b0b0af", strokeWidth: 1.5 }}
                                            formatter={(value) => `$${Number(value).toLocaleString()}`}
                                            labelFormatter={(value) => formatMonthYearFromKey(String(value))}
                                            content={({ active, payload, label }) => {
                                                if (!active || !payload?.length) return null;
                                                const actual = payload.find((entry) => entry.dataKey === "actual");
                                                const target = payload.find((entry) => entry.dataKey === "target");
                                                const targetValue = submittedParams?.targetValue ?? 0;
                                                const actualPct = actual?.value && targetValue > 0 ? ` (${((Number(actual.value) / targetValue) * 100).toFixed(1)}%)` : "";
                                                const targetPct = target?.value && targetValue > 0 ? ` (${((Number(target.value) / targetValue) * 100).toFixed(1)}%)` : "";

                                                return (
                                                    <Paper
                                                        elevation={0}
                                                        sx={{
                                                            borderRadius: "4px",
                                                            border: "1px solid #ebebeb",
                                                            boxShadow: "0 2px 4px rgba(0,0,0,0.10)",
                                                            px: 1,
                                                            py: 1,
                                                            minWidth: 164,
                                                        }}
                                                    >
                                                        <Typography sx={{ fontWeight: 600, fontSize: 14, lineHeight: "18px", mb: 1, color: "#393a36", textAlign: "center" }}>
                                                            {formatMonthYearFromKey(String(label))}
                                                        </Typography>
                                                        {actual?.value !== null && actual?.value !== undefined && (
                                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                                                                <Box
                                                                    sx={{
                                                                        width: 8,
                                                                        height: 8,
                                                                        borderRadius: "50%",
                                                                        bgcolor: isAhead ? "#27a69a" : "#ec4899",
                                                                    }}
                                                                />
                                                                <Typography
                                                                    sx={{
                                                                        fontSize: 14,
                                                                        lineHeight: "18px",
                                                                        color: "#393a36",
                                                                    }}
                                                                >
                                                                    Actual: {Number(actual.value).toLocaleString()}{actualPct}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                        {target?.value !== null && target?.value !== undefined && (
                                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#7c3aed" }} />
                                                                <Typography sx={{ fontSize: 14, lineHeight: "18px", color: "#393a36" }}>
                                                                    Target: {Number(target.value).toLocaleString()}{targetPct}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Paper>
                                                );
                                            }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="target"
                                            stroke="#7c3aed"
                                            strokeWidth={2}
                                            strokeDasharray="2 3"
                                            dot={false}
                                            activeDot={false}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="actual"
                                            stroke={isAhead ? "#27a69a" : "#ec4899"}
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 4, fill: isAhead ? "#27a69a" : "#ec4899" }}
                                            connectNulls={false}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : null}
                        </CardContent>
                    </Card>

                    {data && (
                        <Box
                            sx={{
                                mx: 2,
                                mt: 2,
                                display: "grid",
                                gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
                                gap: 1.5,
                            }}
                        >
                            <Card elevation={0} sx={{ borderRadius: "16px", boxShadow: "0 2px 4px rgba(0,0,0,0.10)" }}>
                                <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
                                    <Typography sx={{ fontSize: 20, lineHeight: "28px", fontWeight: 600, color: "#393a36", mb: 3 }}>
                                        Goal progress · Month {data.stats.monthsTracked} of {data.stats.monthsTotal}
                                    </Typography>

                                    <Box sx={{ position: "relative", mb: 2 }}>
                                        <Box sx={{ display: "flex", width: "100%", height: 36, borderRadius: "999px", overflow: "hidden" }}>
                                            <Box sx={{ width: `${investedPct}%`, bgcolor: "#6c3baa" }} />
                                            <Box sx={{ width: `${progressExpectedGapPct}%`, bgcolor: "#ccbae1" }} />
                                            <Box sx={{ width: `${progressRemainingPct}%`, bgcolor: "#ebebeb" }} />
                                        </Box>
                                        <Box
                                            sx={{
                                                position: "absolute",
                                                left: `${Math.max(0, Math.min(expectedPct, 100))}%`,
                                                top: 0,
                                                transform: "translateX(-50%)",
                                                width: "1px",
                                                height: 36,
                                                bgcolor: "#f3ebff",
                                            }}
                                        />
                                        <Box
                                            sx={{
                                                position: "absolute",
                                                left: `${Math.max(0, Math.min(expectedPct, 100))}%`,
                                                top: 38,
                                                transform: "translateX(-50%)",
                                                width: 0,
                                                height: 0,
                                                borderLeft: "6px solid transparent",
                                                borderRight: "6px solid transparent",
                                                borderBottom: "8px solid #ccbae1",
                                            }}
                                        />
                                    </Box>

                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                            <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#6c3baa" }} />
                                            <Typography sx={{ fontSize: 14, lineHeight: "18px", color: "#61615e", fontWeight: 600 }}>
                                                Invested: ${data.stats.totalInvested.toLocaleString()} ({investedPct.toFixed(1)}%)
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                            <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#ccbae1" }} />
                                            <Typography sx={{ fontSize: 14, lineHeight: "18px", color: "#61615e", fontWeight: 600 }}>
                                                Expected at this point: ${Math.round(expectedByNow).toLocaleString()} ({expectedPct.toFixed(1)}%)
                                            </Typography>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>

                            <Card elevation={0} sx={{ borderRadius: "16px", boxShadow: "0 2px 4px rgba(0,0,0,0.10)" }}>
                                <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
                                    <Typography sx={{ fontSize: 20, lineHeight: "28px", fontWeight: 600, color: "#393a36", mb: 3 }}>
                                        {data.stats.scheduleStatus === "ahead"
                                            ? "Ahead Schedule"
                                            : data.stats.scheduleStatus === "on-track"
                                                ? "On Schedule"
                                                : "Behind Schedule"}
                                    </Typography>
                                    <Typography sx={{ fontSize: 20, lineHeight: "28px", fontWeight: 400, color: "#61615e" }}>
                                        {data.stats.scheduleStatus === "ahead" ? (
                                            <>
                                                You are ${Math.abs(Math.round(deltaToExpected)).toLocaleString()} ahead of the month {data.stats.monthsTracked} target. At this pace, you could reach ${numericTargetValue.toLocaleString()} by{" "}
                                                <Box component="span" sx={{ color: "#61615e", fontWeight: 700 }}>
                                                    {projectedFinishLabel ?? "—"}
                                                </Box>{" "}
                                                <Box component="span" sx={{ color: "#6c3baa", fontWeight: 700 }}>
                                                    {(finishVarianceMonths ?? 0) < 0
                                                        ? `${Math.abs(finishVarianceMonths ?? 0)} months early.`
                                                        : (finishVarianceMonths ?? 0) === 0
                                                            ? "on time."
                                                            : ""}
                                                </Box>
                                            </>
                                        ) : data.stats.scheduleStatus === "on-track" ? (
                                            <>
                                                You are right on the month {data.stats.monthsTracked} target of ${Math.round(expectedByNow).toLocaleString()}. Keeping a pace around{" "}
                                                <Box component="span" sx={{ color: "#6c3baa", fontWeight: 700 }}>
                                                    ${data.stats.targetPerMonth.toLocaleString()}/mo
                                                </Box>{" "}
                                                keeps the plan on track.
                                            </>
                                        ) : (
                                            <>
                                                You are ${Math.abs(Math.round(deltaToExpected)).toLocaleString()} below the month {data.stats.monthsTracked} target of ${Math.round(expectedByNow).toLocaleString()}. Increasing to{" "}
                                                <Box component="span" sx={{ color: "#6c3baa", fontWeight: 700 }}>
                                                    ${neededPerMonth.toLocaleString()}/mo
                                                </Box>{" "}
                                                would put you back on track.
                                            </>
                                        )}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Box>
                    )}
                </>
            )}
        </Box>
    );
}