import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine } from 'recharts';
import SectionHeader from '../components/SectionHeader';
import ChartTooltip from '../components/ChartTooltip';
import InsightCard from '../components/InsightCard';
import DataTable from '../components/DataTable';
import TrendBadge from '../components/TrendBadge';
import { CATEGORY_COLORS, CHART_COLORS, CHART_MARGIN } from '../theme';
import data from '../data/fund_flows.json';

const { monthly, gestora_ranking, cumulative_by_category } = data;

// Prepare monthly net flow data for waterfall
const monthlyNet = monthly.map((m: { date: string; total_net: number; total_subs: number; total_redemp: number }) => ({
  date: m.date,
  net: m.total_net,
  subs: m.total_subs,
  redemp: -m.total_redemp,
}));

// Top categories by cumulative flow
const topFlowCats = Object.entries(cumulative_by_category)
  .map(([cat, points]) => ({
    cat,
    final: (points as { cumulative: number }[])[(points as { cumulative: number }[]).length - 1]?.cumulative || 0,
  }))
  .sort((a, b) => Math.abs(b.final) - Math.abs(a.final))
  .slice(0, 8)
  .map(x => x.cat);

// Figures for the insight text
const cumFinal = Object.entries(cumulative_by_category).map(([cat, points]) => ({
  cat, final: (points as { cumulative: number }[])[(points as { cumulative: number }[]).length - 1]?.cumulative || 0,
}));
const topInflowCats = [...cumFinal].sort((a, b) => b.final - a.final).slice(0, 3);
const topOutflowCats = [...cumFinal].sort((a, b) => a.final - b.final).filter(c => c.final < 0).slice(0, 2);
const last12 = monthlyNet.slice(-12);
const avgNet12 = last12.reduce((a, m) => a + m.net, 0) / (last12.length || 1);
const negMonths12 = last12.filter(m => m.net < 0).length;
const flowPeriod = `${monthlyNet[0]?.date} to ${monthlyNet[monthlyNet.length - 1]?.date}`;

// Build cumulative line chart data
const cumulativeData = monthly.map((m: { date: string }) => {
  const entry: Record<string, unknown> = { date: m.date };
  for (const cat of topFlowCats) {
    const points = (cumulative_by_category as Record<string, { date: string; cumulative: number }[]>)[cat];
    const point = points?.find((p: { date: string }) => p.date === m.date);
    if (point) entry[cat] = point.cumulative;
  }
  return entry;
});

// Latest month category flows
const latestMonth = monthly[monthly.length - 1];
const latestCatFlows = Object.entries(latestMonth?.categories || {} as Record<string, { net: number; subs: number; redemp: number }>)
  .map(([cat, vals]) => ({
    category: cat,
    ...(vals as { net: number; subs: number; redemp: number }),
  }))
  .sort((a, b) => b.net - a.net);

export default function FundFlows() {
  const gestoraColumns = [
    { key: 'name', label: 'Gestora', format: (v: unknown) => {
      const s = String(v);
      return s.length > 45 ? s.slice(0, 43) + '...' : s;
    }},
    { key: 'total_net_bn', label: 'Net Flows (B)', align: 'right' as const, heatmap: true,
      format: (v: unknown) => {
        const n = Number(v);
        return <TrendBadge value={n} suffix="B" />;
      }
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Monthly Net Flow Waterfall */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Monthly Net Flows" source="INVERCO — Sus&Reemb" />
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={monthlyNet} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v: number) => `${v.toFixed(1)}B`} tick={{ fontSize: 10 }} />
            <Tooltip content={<ChartTooltip suffix="B" decimals={2} />} />
            <ReferenceLine y={0} stroke="#555570" />
            <Bar dataKey="net" name="Net Flows" radius={[4, 4, 0, 0]}>
              {monthlyNet.map((entry: { net: number }, i: number) => (
                <Cell key={i} fill={entry.net >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Subs vs Redemptions */}
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Subscriptions vs Redemptions" source="INVERCO" />
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyNet} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}B`} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip suffix="B" decimals={2} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#555570" />
              <Bar dataKey="subs" name="Subscriptions" fill="#10b981" />
              <Bar dataKey="redemp" name="Redemptions" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Latest Month Category Flows */}
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title={`Category Flows — ${latestMonth?.date || ''}`} source="INVERCO" />
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={latestCatFlows.slice(0, 15)} margin={{ ...CHART_MARGIN, left: 140 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v: number) => `${v.toFixed(1)}B`} tick={{ fontSize: 10 }} />
              <YAxis dataKey="category" type="category" tick={{ fontSize: 9 }} width={130} />
              <Tooltip content={<ChartTooltip prefix="\u20AC" suffix="B" decimals={3} />} />
              <ReferenceLine x={0} stroke="#555570" />
              <Bar dataKey="net" name="Net Flows" radius={[0, 4, 4, 0]}>
                {latestCatFlows.slice(0, 15).map((entry, i) => (
                  <Cell key={i} fill={entry.net >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cumulative Flows */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Cumulative Net Flows by Category" source="INVERCO — Sus&Reemb" />
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={cumulativeData} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}B`} tick={{ fontSize: 10 }} />
            <Tooltip content={<ChartTooltip suffix="B" decimals={2} />} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <ReferenceLine y={0} stroke="#555570" />
            {topFlowCats.map((cat, i) => (
              <Line key={cat} type="monotone" dataKey={cat} name={cat}
                stroke={CATEGORY_COLORS[cat] || CHART_COLORS[i]} strokeWidth={2}
                dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Gestora Flow Rankings */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Gestora Net Flow Rankings (Latest Period)" source="INVERCO — RKGestoras por categoria" />
        <DataTable
          data={gestora_ranking as Record<string, unknown>[]}
          columns={gestoraColumns}
          defaultSort="total_net_bn"
          maxRows={30}
        />
      </div>

      <InsightCard title="Flow Analysis" color="#f59e0b">
        Largest cumulative net inflows {flowPeriod}: {topInflowCats.map(c => `${c.cat} (+\u20AC${c.final.toFixed(1)}B)`).join(', ')}.
        {topOutflowCats.length > 0 && <> Largest outflows: {topOutflowCats.map(c => `${c.cat} (\u20AC${c.final.toFixed(1)}B)`).join(', ')}.</>}
        {' '}Over the last 12 months market-wide net flows averaged <strong>{'\u20AC'}{avgNet12.toFixed(1)}B per month</strong>
        {negMonths12 > 0 ? `, with ${negMonths12} month${negMonths12 > 1 ? 's' : ''} of net outflows` : ', with no month of net outflows'}.
      </InsightCard>
    </div>
  );
}
