import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Divider,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  TextField,
  CircularProgress,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
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

interface ReadOnlyFieldProps {
  label: string;
  value: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeMonthlyNeeded(targetValue: string, targetYears: string): string | null {
  if (!targetValue || !targetYears) return null;
  const total = parseInt(targetValue.replace(/,/g, ""), 10);
  const months = parseInt(targetYears, 10) * 12;
  if (isNaN(total) || isNaN(months) || months === 0) return null;
  return Math.ceil(total / months).toLocaleString();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDollar(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value}`;
}

function toPlanParams(form: PlanForm): PlanParams {
  return {
    startDate: form.startDate,
    targetValue: parseInt(form.targetValue.replace(/,/g, ""), 10),
    targetYears: parseInt(form.targetYears, 10),
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ReadOnlyField({ label, value }: ReadOnlyFieldProps) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, color: "#8F8F8F", textTransform: "uppercase", mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#111" }}>
        {value}
      </Typography>
    </Box>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const fieldSx = {
  "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "#fafafa", fontSize: 15 },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#e0e0e0" },
  "& .MuiInputLabel-root": { fontSize: 14 },
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

  const monthlyNeeded: string | null = computeMonthlyNeeded(form.targetValue, form.targetYears);
  const isComplete: boolean = !!(form.startDate && form.targetValue && form.targetYears);

  const handleFieldChange = <K extends keyof PlanForm>(key: K, value: PlanForm[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (): void => {
    setEditing(false);
    setSaved(true);
    setSubmittedParams(toPlanParams(form));
  };

  const scheduleColor =
    data?.stats.scheduleStatus === "ahead"
      ? "#22c55e"
      : data?.stats.scheduleStatus === "behind"
        ? "#ef4444"
        : "#f59e0b";

  return (
    <Box sx={{ bgcolor: "#f4f4f4", minHeight: "100vh", pb: 5 }}>

      {/* Setup Card */}
      <Card elevation={0} sx={{ mx: 2, borderRadius: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
        <CardContent sx={{ p: 2.5, "&:last-child": { pb: 3 } }}>

          {/* Card Header */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2.5 }}>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: "#8F8F8F", textTransform: "uppercase", mb: 0.5 }}>
                Investment Plan
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#111" }}>
                {saved && form.targetValue ? `$${form.targetValue} Goal` : "Set up your plan"}
              </Typography>
            </Box>

            {saved && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditOutlinedIcon fontSize="small" />}
                onClick={() => setEditing((prev) => !prev)}
                sx={{ borderColor: "#ddd", color: "#444", borderRadius: 2, textTransform: "none", fontWeight: 600, fontSize: 13, "&:hover": { borderColor: "#bbb", bgcolor: "#fafafa" } }}
              >
                {editing ? "Cancel" : "Edit"}
              </Button>
            )}
          </Box>

          {/* Fields */}
          {editing ? (
            <>
              <Box sx={{
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                gap: 2,
                alignItems: { xs: "stretch", md: "flex-end" },
              }}>
                <TextField
                  label="Start date"
                  type="date"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={form.startDate}
                  InputProps={{ readOnly: true }}
                  sx={{ flex: 1, ...fieldSx }}
                />
                <FormControl size="small" sx={{ flex: 1, ...fieldSx }}>
                  <InputLabel>Target value</InputLabel>
                  <Select<string>
                    label="Target value"
                    value={form.targetValue}
                    onChange={(e) => handleFieldChange("targetValue", e.target.value)}
                  >
                    <MenuItem value="" disabled>Select target</MenuItem>
                    {TARGET_VALUES.map((v) => (
                      <MenuItem key={v} value={v}>${v}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ flex: 1, ...fieldSx }}>
                  <InputLabel>Target time</InputLabel>
                  <Select<string>
                    label="Target time"
                    value={form.targetYears}
                    onChange={(e) => handleFieldChange("targetYears", e.target.value)}
                  >
                    <MenuItem value="" disabled>Select years</MenuItem>
                    {TARGET_YEARS.map((y) => (
                      <MenuItem key={y} value={String(y)}>{y} years</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  disabled={!isComplete}
                  onClick={handleSave}
                  sx={{
                    py: 1,
                    px: { xs: 0, md: 3 },
                    borderRadius: 3,
                    bgcolor: "#111",
                    fontWeight: 700,
                    fontSize: 15,
                    textTransform: "none",
                    letterSpacing: 0.3,
                    boxShadow: "none",
                    flexShrink: 0,
                    width: { xs: "100%", md: "auto" },
                    mt: { xs: 0.5, md: 0 },
                    "&:hover": { bgcolor: "#333", boxShadow: "none" },
                    "&.Mui-disabled": { bgcolor: "#ccc", color: "#fff" },
                  }}
                >
                  Calculate Plan
                </Button>
              </Box>

              {/* Monthly needed hint */}
              {monthlyNeeded && (
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "#f7f7f7", borderRadius: 2.5, px: 2, py: 1.5, mt: 2.5 }}>
                  <Typography sx={{ fontSize: 13, color: "#888", fontWeight: 500 }}>Monthly needed</Typography>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#111" }}>${monthlyNeeded} / mo</Typography>
                </Box>
              )}
            </>
          ) : (
            <Box sx={{
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                gap: { xs: 0, md: 4 },
              }}>
                <Box sx={{ py: 1.75, flex: 1, borderBottom: { xs: "1px solid #f0f0f0", md: "none" } }}>
                  <ReadOnlyField label="Start date" value={formatDate(form.startDate)} />
                </Box>
                <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />
                <Box sx={{ py: 1.75, flex: 1, borderBottom: { xs: "1px solid #f0f0f0", md: "none" } }}>
                  <ReadOnlyField label="Target value" value={form.targetValue ? `$${form.targetValue}` : "—"} />
                </Box>
                <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />
                <Box sx={{ py: 1.75, flex: 1 }}>
                  <ReadOnlyField label="Target time" value={form.targetYears ? `${form.targetYears} years` : "—"} />
                </Box>
              </Box>
          )}
        </CardContent>
      </Card>

      {/* Results — only shown after Calculate Plan */}
      {saved && !editing && (
        <>
          {/* Stats Cards */}
          {data && (
            <Box sx={{ mx: 2, mt: 2, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "1fr 1fr 1fr 1fr" }, gap: 1.5 }}>
              <Card elevation={0} sx={{ borderRadius: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", p: 2 }}>
                <Typography sx={{ fontSize: 12, color: "#8F8F8F", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                  Progress
                </Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#111", mt: 0.5 }}>
                  ${data.stats.totalInvested.toLocaleString()}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#8F8F8F", mt: 0.25 }}>
                  of ${form.targetValue} · {data.stats.currentProgress}%
                </Typography>
                <Box sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: "#f0f0f0", overflow: "hidden" }}>
                  <Box sx={{ height: "100%", width: `${data.stats.currentProgress}%`, bgcolor: "#111", borderRadius: 2, transition: "width 0.4s ease" }} />
                </Box>
              </Card>

              <Card elevation={0} sx={{ borderRadius: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", p: 2 }}>
                <Typography sx={{ fontSize: 12, color: "#8F8F8F", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                  Schedule
                </Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 800, color: scheduleColor, mt: 0.5 }}>
                  {data.stats.scheduleStatus === "on-track" ? "On Track" : data.stats.scheduleStatus === "ahead" ? "Ahead" : "Behind"}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#8F8F8F", mt: 0.25 }}>
                  avg ${data.stats.avgMonthly.toLocaleString()} / mo
                </Typography>
              </Card>

              <Card elevation={0} sx={{ borderRadius: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", p: 2 }}>
                <Typography sx={{ fontSize: 12, color: "#8F8F8F", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                  Monthly Target
                </Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#111", mt: 0.5 }}>
                  ${data.stats.targetPerMonth.toLocaleString()}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#8F8F8F", mt: 0.25 }}>
                  {data.stats.monthsTracked} of {data.stats.monthsTotal} months
                </Typography>
              </Card>

              <Card elevation={0} sx={{ borderRadius: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", p: 2 }}>
                <Typography sx={{ fontSize: 12, color: "#8F8F8F", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                  Est. Finish
                </Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#111", mt: 0.5 }}>
                  {data.stats.projectedFinishMonth
                    ? new Date(`${data.stats.projectedFinishMonth}-01`).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                    : "—"}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#8F8F8F", mt: 0.25 }}>
                  at current pace
                </Typography>
              </Card>
            </Box>
          )}

          {/* Trajectory Chart */}
          <Card elevation={0} sx={{ mx: 2, mt: 2, borderRadius: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#111", mb: 0.5 }}>
                Investment Trajectory
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#8F8F8F", mb: 2 }}>
                Actual vs target · ${data?.stats.targetPerMonth.toLocaleString()} / mo target
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
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.trajectory} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "#bbb" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={formatDollar}
                      tick={{ fontSize: 10, fill: "#bbb" }}
                      tickLine={false}
                      axisLine={false}
                      width={36}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        `$${Number(value).toLocaleString()}`,
                        name === "actual" ? "Actual" : "Target",
                      ]}
                      labelStyle={{ fontSize: 12, fontWeight: 600, color: "#111" }}
                      contentStyle={{ borderRadius: 10, border: "1px solid #eee", fontSize: 12 }}
                    />
                    <ReferenceLine
                      y={submittedParams!.targetValue}
                      stroke="#ddd"
                      strokeDasharray="4 4"
                      label={{ value: `$${form.targetValue}`, position: "insideTopRight", fontSize: 10, fill: "#bbb" }}
                    />
                    {/* Target line — dashed gray */}
                    <Line
                      type="monotone"
                      dataKey="target"
                      stroke="#d1d5db"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                      dot={false}
                      activeDot={false}
                    />
                    {/* Actual line — solid black, stops at current month */}
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#111"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "#111" }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}