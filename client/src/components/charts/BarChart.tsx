import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = ["#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#F97316"];

interface Props {
  counts: Record<string, number>;
}

export default function BarChart({ counts }: Props) {
  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));

  if (data.length === 0) {
    return <p className="text-gray-400 text-center py-8">No votes yet</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsBarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="name" tick={{ fontSize: 14 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 14 }} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {data.map((_entry, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
