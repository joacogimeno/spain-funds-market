import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Cell, ComposedChart, Line } from 'recharts';
import KpiCard from '../components/KpiCard';
import SectionHeader from '../components/SectionHeader';
import ChartTooltip from '../components/ChartTooltip';
import InsightCard from '../components/InsightCard';
import { formatEur, formatDelta, formatNum, CATEGORY_COLORS, CHART_MARGIN } from '../theme';
import data from '../data/market_overview.json';

const { kpis, monthly_aum, annual_aum, monthly_participes, latest_flows } = data;
const aum_bridge = (data as Record<string, unknown>).aum_bridge as Array<{
  date: string; aum: number; delta: number; flows: number; market: number;
  cum_flows: number; cum_market: number; gap?: boolean;
}>;
const bridge_summary = (data as Record<string, unknown>).aum_bridge_summary as {
  total_aum_change_bn: number; total_flows_bn: number; total_market_bn: number;
  flows_pct: number; market_pct: number; period: string;
};

// Top categories for stacked area
const TOP_CATS = ['RF Euro CP', 'RF Euro LP', 'Internacional', 'Globales', 'Monetarios',
  'RF Mixta Euro', 'Retorno Absoluto', 'Fondos Índice', 'Objetivo Rentabilidad',
  'RV Nacional', 'Garantizados RF', 'Garantizados RV', 'RV Mixta Euro'];

// Bridge data without first row (no delta)
const bridgeMonthly = aum_bridge.filter(e => e.delta !== 0);

export default function MarketOverview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <KpiCard
          title="Total AUM"
          value={formatEur(kpis.total_aum_bn)}
          delta={kpis.yoy_growth_pct ? formatDelta(kpis.yoy_growth_pct) + ' YoY' : undefined}
          deltaPositive={(kpis.yoy_growth_pct ?? 0) > 0}
          subtitle={`as of ${kpis.latest_date}`}
        />
        <KpiCard
          title="Investors"
          value={formatNum(kpis.total_investors)}
          subtitle="Total participes"
        />
        <KpiCard
          title="Active Funds"
          value={kpis.total_funds.toLocaleString()}
          subtitle="Registered ISINs"
        />
        <KpiCard
          title="Monthly Net Flows"
          value={`\u20AC${kpis.monthly_net_flows_bn.toFixed(2)}B`}
          deltaPositive={kpis.monthly_net_flows_bn > 0}
          delta={kpis.monthly_net_flows_bn > 0 ? 'Net inflows' : 'Net outflows'}
        />
      </div>

      {/* Total AUM Evolution */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Total AUM Evolution (Jan 2024 — Jan 2026)" source="INVERCO — PatrimFondosEuro" />
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={monthly_aum} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}B`} tick={{ fontSize: 11 }} />
            <Tooltip content={<ChartTooltip suffix="B" decimals={1} />} />
            <Area type="monotone" dataKey="total_aum_bn" name="Total AUM"
              stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* AUM Bridge: Flows vs Market Effect */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="AUM Growth Decomposition: Flows vs Market Effect" source="INVERCO — PatrimFondos + Sus&Reemb" />

        {/* Summary cards */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1, background: '#0a0a0f', borderRadius: 8, padding: '14px 18px', border: '1px solid #2a2a3a' }}>
            <div style={{ fontSize: 11, color: '#555570', marginBottom: 4, fontFamily: "'Outfit', sans-serif" }}>
              Total AUM Change ({bridge_summary.period})
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: '#e8e8f0' }}>
              +{'\u20AC'}{bridge_summary.total_aum_change_bn.toFixed(1)}B
            </div>
          </div>
          <div style={{ flex: 1, background: '#10b98110', borderRadius: 8, padding: '14px 18px', border: '1px solid #10b98130' }}>
            <div style={{ fontSize: 11, color: '#10b981', marginBottom: 4, fontFamily: "'Outfit', sans-serif" }}>
              Due to Net Flows
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: '#10b981' }}>
              +{'\u20AC'}{bridge_summary.total_flows_bn.toFixed(1)}B
              <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 8 }}>({bridge_summary.flows_pct}%)</span>
            </div>
          </div>
          <div style={{ flex: 1, background: '#3b82f610', borderRadius: 8, padding: '14px 18px', border: '1px solid #3b82f630' }}>
            <div style={{ fontSize: 11, color: '#3b82f6', marginBottom: 4, fontFamily: "'Outfit', sans-serif" }}>
              Due to Market Effect
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>
              +{'\u20AC'}{bridge_summary.total_market_bn.toFixed(1)}B
              <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 8 }}>({bridge_summary.market_pct}%)</span>
            </div>
          </div>
        </div>

        {/* Monthly stacked bar: flows vs market */}
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={bridgeMonthly} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}B`} tick={{ fontSize: 10 }} />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = bridgeMonthly.find(e => e.date === label);
              return (
                <div style={{ background: '#1e1e2a', border: '1px solid #3a3a4a', borderRadius: 8, padding: '10px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                  <div style={{ color: '#e8e8f0', fontWeight: 600, marginBottom: 6 }}>{label}{d?.gap ? ' (2-mo gap)' : ''}</div>
                  <div style={{ color: '#8888a0' }}>{'\u0394'}AUM: <strong style={{ color: '#e8e8f0' }}>{'\u20AC'}{d?.delta.toFixed(2)}B</strong></div>
                  <div style={{ color: '#10b981' }}>Net Flows: {'\u20AC'}{d?.flows.toFixed(2)}B</div>
                  <div style={{ color: '#3b82f6' }}>Market Effect: {'\u20AC'}{d?.market.toFixed(2)}B</div>
                </div>
              );
            }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#555570" />
            <Bar dataKey="flows" name="Net Flows" fill="#10b981" stackId="a" />
            <Bar dataKey="market" name="Market Effect" stackId="a">
              {bridgeMonthly.map((entry, i) => (
                <Cell key={i} fill={entry.market >= 0 ? '#3b82f6' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cumulative Flows vs Market */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Cumulative Growth Attribution" source="INVERCO" />
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={aum_bridge} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}B`} tick={{ fontSize: 10 }} />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = aum_bridge.find(e => e.date === label);
              return (
                <div style={{ background: '#1e1e2a', border: '1px solid #3a3a4a', borderRadius: 8, padding: '10px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                  <div style={{ color: '#e8e8f0', fontWeight: 600, marginBottom: 6 }}>{label}</div>
                  <div style={{ color: '#10b981' }}>Cumulative Flows: +{'\u20AC'}{d?.cum_flows.toFixed(1)}B</div>
                  <div style={{ color: '#3b82f6' }}>Cumulative Market: +{'\u20AC'}{d?.cum_market.toFixed(1)}B</div>
                </div>
              );
            }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="cum_flows" name="Cumulative Net Flows"
              stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="cum_market" name="Cumulative Market Effect"
              stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Category Composition Stacked Area */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="AUM Composition by Category" source="INVERCO — PatrimFondosEuro" />
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={monthly_aum} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}B`} tick={{ fontSize: 11 }} />
            <Tooltip content={<ChartTooltip suffix="B" decimals={1} />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {TOP_CATS.filter(cat => monthly_aum.some((d: Record<string, unknown>) => cat in d)).map(cat => (
              <Area key={cat} type="monotone" dataKey={cat} name={cat}
                stackId="1" stroke={CATEGORY_COLORS[cat] || '#666'}
                fill={CATEGORY_COLORS[cat] || '#666'} fillOpacity={0.8} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Annual Bar Chart */}
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Annual AUM (2005-2025)" source="INVERCO" />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={annual_aum} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}B`} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip suffix="B" decimals={1} />} />
              <Bar dataKey="total_aum_bn" name="Total AUM" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Latest Flows */}
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Monthly Net Flows by Category" source="INVERCO — Sus&Reemb" />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[...latest_flows].sort((a: {net: number}, b: {net: number}) => b.net - a.net)} margin={{ ...CHART_MARGIN, left: 120 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v: number) => `${v.toFixed(1)}B`} tick={{ fontSize: 10 }} />
              <YAxis dataKey="category" type="category" tick={{ fontSize: 9 }} width={110} />
              <Tooltip content={<ChartTooltip prefix="\u20AC" suffix="B" decimals={3} />} />
              <Bar dataKey="net" name="Net Flows" fill="#3b82f6"
                radius={[0, 4, 4, 0]}
                label={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Investors */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Investor Evolution" source="INVERCO — ParticipesFondos" />
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={monthly_participes} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v: number) => formatNum(v)} tick={{ fontSize: 11 }} />
            <Tooltip content={<ChartTooltip decimals={0} />} />
            <Area type="monotone" dataKey="total" name="Investors"
              stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Key Insight */}
      <InsightCard title="Key Insight" color="#3b82f6">
        The Spanish fund market grew <strong>+{'\u20AC'}{bridge_summary.total_aum_change_bn.toFixed(0)}B</strong> from
        {' '}{bridge_summary.period}. This growth is split roughly evenly: <strong>{'\u20AC'}{bridge_summary.total_flows_bn.toFixed(0)}B
        ({bridge_summary.flows_pct}%) from net investor flows</strong> and <strong>{'\u20AC'}{bridge_summary.total_market_bn.toFixed(0)}B
        ({bridge_summary.market_pct}%) from market appreciation</strong>. Flows have been consistently positive every
        single month, providing a reliable growth floor of {'\u20AC'}1-4B/month. Market effects are more volatile —
        driving months like Mar 2024 (+{'\u20AC'}5.3B) but also dragging in Apr 2024 (-{'\u20AC'}2.7B).
      </InsightCard>
    </div>
  );
}
