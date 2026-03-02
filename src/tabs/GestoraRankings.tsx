import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import SectionHeader from '../components/SectionHeader';
import ChartTooltip from '../components/ChartTooltip';
import InsightCard from '../components/InsightCard';
import DataTable from '../components/DataTable';
import TrendBadge from '../components/TrendBadge';
import { GESTORA_TYPE_COLORS, CHART_MARGIN } from '../theme';
import data from '../data/gestora_rankings.json';
import groupData from '../data/group_rankings.json';

const { gestoras, concentration } = data;
const { groups, inversis } = groupData;

const TOP_N = 20;
const topGestoras = gestoras.slice(0, TOP_N);

const typeLabels: Record<string, string> = {
  bank: 'Bank-linked',
  independent: 'Independent',
  foreign: 'Foreign-owned',
  insurance: 'Insurance',
  other: 'Other',
};

export default function GestoraRankings() {
  const [showGroups, setShowGroups] = useState(false);

  const fmtYoY = (name: string) => {
    const g = (gestoras as Array<{name: string; yoy_growth: number | null}>).find(g => g.name.includes(name));
    return g?.yoy_growth != null ? ` (+${g.yoy_growth.toFixed(1)}%)` : '';
  };

  const concentrationData = [
    { name: 'Top 3', value: concentration.top3_pct, color: '#3b82f6' },
    { name: 'Top 4-5', value: +(concentration.top5_pct - concentration.top3_pct).toFixed(1), color: '#6366f1' },
    { name: 'Top 6-10', value: +(concentration.top10_pct - concentration.top5_pct).toFixed(1), color: '#8b5cf6' },
    { name: 'Others', value: +(100 - concentration.top10_pct).toFixed(1), color: '#2a2a3a' },
  ];

  const typeBreakdown = useMemo(() => {
    const types: Record<string, number> = {};
    gestoras.forEach((g: { type: string; aum_bn: number }) => {
      types[g.type] = (types[g.type] || 0) + g.aum_bn;
    });
    return Object.entries(types).map(([k, v]) => ({
      name: typeLabels[k] || k, value: +v.toFixed(1), color: GESTORA_TYPE_COLORS[k] || '#666',
    })).sort((a, b) => b.value - a.value);
  }, []);

  const tableData = showGroups ? groups : gestoras.slice(0, 50);

  const columns = showGroups ? [
    { key: 'rank', label: '#', width: 40 },
    { key: 'name', label: 'Group', format: (v: unknown) => String(v) },
    { key: 'aum_bn', label: 'AUM (B)', align: 'right' as const, format: (v: unknown) => `\u20AC${Number(v).toFixed(1)}B` },
    { key: 'num_isin', label: 'ISINs', align: 'right' as const },
    { key: 'var_1y', label: '1Y %', align: 'right' as const, heatmap: true, format: (v: unknown) => v != null ? <TrendBadge value={Number(v)} /> : '-' },
    { key: 'var_6m', label: '6M %', align: 'right' as const, heatmap: true, format: (v: unknown) => v != null ? `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(1)}%` : '-' },
    { key: 'var_ytd', label: 'YTD %', align: 'right' as const, heatmap: true, format: (v: unknown) => v != null ? `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(1)}%` : '-' },
  ] : [
    { key: 'rank', label: '#', width: 40 },
    { key: 'name', label: 'Gestora', format: (v: unknown) => {
      const s = String(v);
      return s.length > 40 ? s.slice(0, 38) + '...' : s;
    }},
    { key: 'aum_bn', label: 'AUM (B)', align: 'right' as const, format: (v: unknown) => `\u20AC${Number(v).toFixed(1)}B` },
    { key: 'pct', label: 'Mkt %', align: 'right' as const, format: (v: unknown) => v != null ? `${Number(v).toFixed(1)}%` : '-' },
    { key: 'type', label: 'Type', format: (v: unknown) => {
      const t = String(v);
      return <span style={{ color: GESTORA_TYPE_COLORS[t] || '#666', fontSize: 11 }}>{typeLabels[t] || t}</span>;
    }},
    { key: 'yoy_growth', label: '1Y Growth', align: 'right' as const, heatmap: true, format: (v: unknown) => v != null ? <TrendBadge value={Number(v)} /> : '-' },
    { key: 'num_fondos', label: 'Funds', align: 'right' as const },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top 20 Bar Chart */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title={`Top ${TOP_N} Gestoras by AUM`} source="INVERCO — RKGestoras" />
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={topGestoras} margin={{ ...CHART_MARGIN, left: 200 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v: number) => `${v.toFixed(0)}B`} tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={190}
              tickFormatter={(v: string) => v.length > 30 ? v.slice(0, 28) + '...' : v} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div style={{ background: '#1e1e2a', border: '1px solid #3a3a4a', borderRadius: 8, padding: '10px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, maxWidth: 320 }}>
                  <div style={{ color: '#e8e8f0', fontWeight: 600, marginBottom: 6, whiteSpace: 'normal' }}>{d.name}</div>
                  <div style={{ color: GESTORA_TYPE_COLORS[d.type] || '#8888a0', marginBottom: 4 }}>
                    {'\u20AC'}{Number(d.aum_bn).toFixed(1)}B
                    <span style={{ color: '#555570', marginLeft: 8 }}>({d.pct}% market share)</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#555570' }}>
                    {typeLabels[d.type] || d.type} | {d.num_fondos} funds
                  </div>
                </div>
              );
            }} />
            <Bar dataKey="aum_bn" name="AUM" radius={[0, 4, 4, 0]}>
              {topGestoras.map((entry: { type: string }, i: number) => (
                <Cell key={i} fill={GESTORA_TYPE_COLORS[entry.type] || '#666'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
          {Object.entries(typeLabels).filter(([k]) => k !== 'other').map(([k, label]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8888a0' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: GESTORA_TYPE_COLORS[k] }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Concentration */}
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Market Concentration" source="INVERCO" />
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={concentrationData} cx="50%" cy="50%" innerRadius={70} outerRadius={110}
                dataKey="value" nameKey="name" label={(props: PieLabelRenderProps) => `${props.name}: ${props.value}%`}>
                {concentrationData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#8888a0', marginTop: 8 }}>
            Top 3 hold <strong style={{ color: '#3b82f6' }}>{concentration.top3_pct}%</strong> of market |
            Top 10 hold <strong style={{ color: '#8b5cf6' }}>{concentration.top10_pct}%</strong>
          </div>
        </div>

        {/* By Type */}
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="AUM by Gestora Type" source="INVERCO" />
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={typeBreakdown} cx="50%" cy="50%" innerRadius={70} outerRadius={110}
                dataKey="value" nameKey="name" label={(props: PieLabelRenderProps) => `${props.name}: \u20AC${props.value}B`}>
                {typeBreakdown.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Inversis Spotlight */}
      {inversis.group && (
        <div style={{ background: '#d4203015', border: '1px solid #d4203040', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Inversis Spotlight" source="INVERCO — RkGrupos" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: '#8888a0', marginBottom: 4 }}>Banca March Group</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: '#e8e8f0' }}>
                #{inversis.group.rank}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: '#d42030' }}>
                {'\u20AC'}{inversis.group.aum_bn.toFixed(1)}B
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#8888a0', marginBottom: 4 }}>Inversis Gestion</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: '#e8e8f0' }}>
                {inversis.gestora ? `\u20AC${inversis.gestora.aum_bn.toFixed(1)}B` : 'N/A'}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: '#8888a0' }}>
                {inversis.gestora?.var_1y != null ? <TrendBadge value={inversis.gestora.var_1y} /> : ''}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#8888a0', marginBottom: 4 }}>Group Growth</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700 }}>
                {inversis.group.var_1y != null ? <TrendBadge value={inversis.group.var_1y} /> : 'N/A'}
              </div>
              <div style={{ fontSize: 11, color: '#555570', marginTop: 4 }}>
                {inversis.group.num_isin} ISINs
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sortable Table */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title={showGroups ? "Financial Group Rankings" : "Gestora Rankings"} source="INVERCO">
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setShowGroups(false)} style={{
              padding: '4px 12px', borderRadius: 4, border: '1px solid #2a2a3a', cursor: 'pointer',
              background: !showGroups ? '#d4203020' : 'transparent',
              color: !showGroups ? '#ff3040' : '#8888a0',
              fontFamily: "'Outfit', sans-serif", fontSize: 12,
            }}>Gestoras</button>
            <button onClick={() => setShowGroups(true)} style={{
              padding: '4px 12px', borderRadius: 4, border: '1px solid #2a2a3a', cursor: 'pointer',
              background: showGroups ? '#d4203020' : 'transparent',
              color: showGroups ? '#ff3040' : '#8888a0',
              fontFamily: "'Outfit', sans-serif", fontSize: 12,
            }}>Groups</button>
          </div>
        </SectionHeader>
        <DataTable
          data={tableData as Record<string, unknown>[]}
          columns={columns}
          defaultSort="aum_bn"
          maxRows={50}
        />
      </div>

      <InsightCard title="Competitive Landscape" color="#10b981">
        The top 3 banks (CaixaBank, Santander, BBVA) hold <strong>{concentration.top3_pct}%</strong> of the market
        but tend to grow below average. Independent gestoras like <strong>Mediolanum{fmtYoY('Mediolanum')}</strong>,
        <strong> Dunas{fmtYoY('Dunas')}</strong>, and <strong>Cobas{fmtYoY('Cobas')}</strong> are among the fastest growers.
        Banca March ranks #{inversis.group?.rank} with {'\u20AC'}{inversis.group?.aum_bn.toFixed(1)}B.
      </InsightCard>
    </div>
  );
}
