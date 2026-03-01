import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import SectionHeader from '../components/SectionHeader';
import ChartTooltip from '../components/ChartTooltip';
import InsightCard from '../components/InsightCard';
import { CATEGORY_COLORS, CHART_COLORS, CHART_MARGIN } from '../theme';
import data from '../data/category_evolution.json';

const { monthly, treemap, growth_rates, annual } = data;

// Top categories for multi-line chart
const TOP_LINE_CATS = ['RF Euro CP', 'RF Euro LP', 'Internacional', 'Globales', 'Monetarios', 'RF Mixta Euro'];

function getGrowthColor(v: number | null): string {
  if (v === null) return '#6b7280';
  if (v > 30) return '#10b981';
  if (v > 10) return '#22c55e';
  if (v > 0) return '#6ee7b7';
  if (v > -10) return '#fca5a5';
  return '#ef4444';
}

export default function CategoryAnalysis() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Treemap-style horizontal bars (sized by AUM, colored by growth) */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Category AUM & Growth" source="INVERCO — PatrimFondosEuro" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {treemap.map((item: { category: string; aum_bn: number; yoy_growth: number | null }) => {
            const maxAum = treemap[0]?.aum_bn || 1;
            const width = (item.aum_bn / maxAum) * 100;
            return (
              <div key={item.category} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 140, fontSize: 12, color: '#8888a0', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', flexShrink: 0 }}>
                  {item.category}
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <div style={{
                    width: `${width}%`, height: 28, borderRadius: 4,
                    background: CATEGORY_COLORS[item.category] || '#3b82f6',
                    opacity: 0.8,
                    display: 'flex', alignItems: 'center', paddingLeft: 8,
                    minWidth: 60,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>
                      {'\u20AC'}{item.aum_bn.toFixed(1)}B
                    </span>
                  </div>
                </div>
                <div style={{
                  width: 70, textAlign: 'right', fontSize: 12, fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: getGrowthColor(item.yoy_growth),
                }}>
                  {item.yoy_growth !== null ? `${item.yoy_growth > 0 ? '+' : ''}${item.yoy_growth}%` : '-'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Evolution Multi-Line */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Top Category Evolution (Monthly)" source="INVERCO" />
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={monthly} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}B`} tick={{ fontSize: 10 }} />
            <Tooltip content={<ChartTooltip suffix="B" decimals={1} />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {TOP_LINE_CATS.map((cat, i) => (
              <Line key={cat} type="monotone" dataKey={cat} name={cat}
                stroke={CATEGORY_COLORS[cat] || CHART_COLORS[i]} strokeWidth={2}
                dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Growth Rate Bars */}
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="YoY Growth by Category" source="INVERCO" />
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={growth_rates} margin={{ ...CHART_MARGIN, left: 120 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10 }} />
              <YAxis dataKey="category" type="category" tick={{ fontSize: 9 }} width={110} />
              <Tooltip content={<ChartTooltip suffix="%" decimals={1} />} />
              <Bar dataKey="growth_pct" name="YoY Growth" radius={[0, 4, 4, 0]}>
                {growth_rates.map((entry: { growth_pct: number }, i: number) => (
                  <Cell key={i} fill={entry.growth_pct >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Annual Stacked Bar */}
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Annual Category Mix (2015-2025)" source="INVERCO" />
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={annual} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}B`} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip suffix="B" decimals={1} />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {TOP_LINE_CATS.map(cat => (
                <Bar key={cat} dataKey={cat} name={cat} stackId="a"
                  fill={CATEGORY_COLORS[cat] || '#666'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <InsightCard title="Structural Shift" color="#8b5cf6">
        The Spanish fund landscape is undergoing a structural transformation. <strong>Fixed income</strong> categories
        (RF Euro CP +53.3%) have surged on the rate environment, while <strong>guaranteed funds</strong> continue
        their secular decline (-28.2% RF, -33.1% RV). Monetarios nearly tripled since 2022.
        International fund wrappers now represent the largest single allocation at <strong>{'\u20AC'}140.5B</strong>.
      </InsightCard>
    </div>
  );
}
