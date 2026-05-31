import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function UsageTrendChart({ data, valueKey = "totalCalls", label = "Calls" }) {
  const rows = (data || []).map((d) => ({
    date: d.date?.slice(5) || d.date,
    value: d[valueKey] ?? d.calls ?? d.spendCents ?? 0,
  }));

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 py-8 text-center">No trend data yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <Tooltip formatter={(v) => [v, label]} />
        <Area type="monotone" dataKey="value" stroke="#4f46e5" fill="#818cf8" fillOpacity={0.25} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
