import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, LineChart, Line, Legend, Cell } from 'recharts';
import SectionHeader from '../components/SectionHeader';
import InsightCard from '../components/InsightCard';
import { CATEGORY_COLORS, CHART_COLORS, CHART_MARGIN } from '../theme';
import data from '../data/performance.json';

const { heatmap, scatter, monthly } = data;

function getReturnColor(v: number | null): string {
  if (v === null || v === undefined) return '#1e1e2a';
  if (v > 20) return '#059669';
  if (v > 10) return '#10b981';
  if (v > 5) return '#34d399';
  if (v > 0) return '#6ee7b7';
  if (v > -5) return '#fca5a5';
  if (v > -10) return '#ef4444';
  return '#dc2626';
}

function formatReturn(v: number | null): string {
  if (v === null || v === undefined) return '-';
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
}

const PERIODS = [
  { key: 'month', label: 'Month' },
  { key: 'ytd', label: 'YTD' },
  { key: '1y', label: '1Y' },
  { key: '3y', label: '3Y ann' },
  { key: '5y', label: '5Y ann' },
  { key: '10y', label: '10Y ann' },
];

// Monthly returns for top categories
const topReturnCats = ['RV Nacional', 'RV Euro Resto', 'RV Intl Europa', 'RV Intl EEUU', 'Globales', 'RF Euro CP'];
const monthlyReturnData = (monthly as Array<{ date: string; categories: Record<string, { return_1y?: number }> }>).map(m => {
  const entry: Record<string, unknown> = { date: m.date };
  for (const cat of topReturnCats) {
    const catData = m.categories?.[cat];
    if (catData?.return_1y != null) entry[cat] = catData.return_1y;
  }
  return entry;
});

export default function Performance() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Returns Heatmap Table */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Returns Heatmap by Category" source="INVERCO — Rentab" />
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Category</th>
                <th style={{ textAlign: 'right' }}>AUM</th>
                {PERIODS.map(p => (
                  <th key={p.key} style={{ textAlign: 'center' }}>{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.map((row: Record<string, unknown>) => (
                <tr key={String(row.category)}>
                  <td style={{ color: CATEGORY_COLORS[String(row.category)] || '#e8e8f0', fontWeight: 500 }}>
                    {String(row.category)}
                  </td>
                  <td style={{ textAlign: 'right' }}>{'\u20AC'}{Number(row.aum_bn).toFixed(1)}B</td>
                  {PERIODS.map(p => {
                    const val = row[p.key] as number | null;
                    return (
                      <td key={p.key} style={{
                        textAlign: 'center',
                        background: getReturnColor(val),
                        color: val != null ? '#fff' : '#555570',
                        fontWeight: 600,
                      }}>
                        {formatReturn(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Risk-Return Scatter */}
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Return vs AUM (1Y)" source="INVERCO" />
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="aum_bn" name="AUM" tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => `${v.toFixed(0)}B`}
                label={{ value: 'AUM (B)', position: 'bottom', fontSize: 11, fill: '#8888a0' }} />
              <YAxis dataKey="return_1y" name="1Y Return" tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => `${v}%`}
                label={{ value: '1Y Return (%)', angle: -90, position: 'left', fontSize: 11, fill: '#8888a0' }} />
              <ZAxis dataKey="aum_bn" range={[60, 400]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: '#1e1e2a', border: '1px solid #3a3a4a', borderRadius: 8, padding: '10px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                      <div style={{ color: '#e8e8f0', fontWeight: 600, marginBottom: 4 }}>{d.category}</div>
                      <div style={{ color: '#8888a0' }}>AUM: {'\u20AC'}{d.aum_bn.toFixed(1)}B</div>
                      <div style={{ color: d.return_1y >= 0 ? '#10b981' : '#ef4444' }}>1Y: {d.return_1y.toFixed(1)}%</div>
                      {d.return_3y != null && <div style={{ color: '#8888a0' }}>3Y ann: {d.return_3y.toFixed(1)}%</div>}
                    </div>
                  );
                }}
              />
              <Scatter data={scatter} fill="#3b82f6">
                {scatter.map((entry: { category: string }, i: number) => (
                  <Cell key={i} fill={CATEGORY_COLORS[entry.category] || CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Performance Over Time */}
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="1Y Rolling Returns by Category" source="INVERCO" />
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={monthlyReturnData} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10 }} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div style={{ background: '#1e1e2a', border: '1px solid #3a3a4a', borderRadius: 8, padding: '10px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                    <div style={{ color: '#e8e8f0', fontWeight: 600, marginBottom: 6 }}>{label}</div>
                    {payload.map((entry, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: entry.color }}>
                        <span>{entry.name}</span>
                        <span style={{ fontWeight: 600 }}>{typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}%</span>
                      </div>
                    ))}
                  </div>
                );
              }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {topReturnCats.map((cat, i) => (
                <Line key={cat} type="monotone" dataKey={cat} name={cat}
                  stroke={CATEGORY_COLORS[cat] || CHART_COLORS[i]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <InsightCard title="Performance Insight" color="#ef4444">
        There's a notable <strong>inverse relationship between flows and returns</strong>. Equity categories
        (RV Nacional +45.1% 1Y, RV Intl Europa +17.3%) deliver the highest returns but receive modest flows.
        Meanwhile, fixed income (RF Euro CP +2.1% 1Y) captures the bulk of net inflows. This suggests
        investors are prioritizing capital preservation and yield certainty over total return potential.
      </InsightCard>
    </div>
  );
}
