import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, Cell, Legend } from 'recharts';
import SectionHeader from '../components/SectionHeader';
import KpiCard from '../components/KpiCard';
import DataTable from '../components/DataTable';
import ChartTooltip from '../components/ChartTooltip';
import { CHART_MARGIN, CHART_COLORS } from '../theme';
import data from '../data/cnmv_fees.json';

const {
  summary, category_stats, gestora_stats, fee_vs_size,
  ter_histogram, mgmt_histogram, most_expensive, cheapest,
  categories, gestoras, funds,
} = data;

// Color by category for scatter plot
const CAT_COLORS: Record<string, string> = {};
categories.forEach((c: string, i: number) => {
  CAT_COLORS[c] = CHART_COLORS[i % CHART_COLORS.length];
});

export default function FeeAnalysis() {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [view, setView] = useState<'overview' | 'explorer'>('overview');

  const filteredCategories = useMemo(() => {
    if (!categoryFilter) return category_stats as typeof category_stats;
    return (category_stats as typeof category_stats).filter(
      (c: { category: string }) => c.category === categoryFilter
    );
  }, [categoryFilter]);

  const filteredScatter = useMemo(() => {
    if (!categoryFilter) return fee_vs_size as typeof fee_vs_size;
    return (fee_vs_size as typeof fee_vs_size).filter(
      (f: { category: string }) => f.category === categoryFilter
    );
  }, [categoryFilter]);

  // Category stats sorted by median TER for bar chart
  const catByTer = useMemo(() =>
    [...(category_stats as Array<{ category: string; median_ter: number; count: number }>)]
      .sort((a, b) => b.median_ter - a.median_ter),
  [category_stats]);

  // Top 20 gestoras by AUM for fee comparison
  const topGestoras = useMemo(() =>
    (gestora_stats as Array<{ gestora: string; avg_ter: number; avg_mgmt_fee: number; total_aum_m: number; funds: number }>)
      .slice(0, 20)
      .map(g => ({
        ...g,
        gestora_short: g.gestora.length > 25 ? g.gestora.slice(0, 23) + '...' : g.gestora,
      })),
  [gestora_stats]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <KpiCard
          title="Funds Analyzed"
          value={summary.total_funds.toLocaleString()}
          subtitle={`${summary.total_classes.toLocaleString()} share classes`}
        />
        <KpiCard
          title="Total AUM"
          value={`\u20AC${summary.total_aum_bn}B`}
          subtitle={`${summary.total_gestoras} gestoras`}
        />
        <KpiCard
          title="Avg TER"
          value={`${(summary.avg_ter * 100).toFixed(0)} bps`}
          subtitle={`Median: ${(summary.median_ter * 100).toFixed(0)} bps`}
        />
        <KpiCard
          title="Avg Mgmt Fee"
          value={`${summary.avg_mgmt_fee.toFixed(2)}%`}
          subtitle="On AUM (s/Patrimonio)"
        />
      </div>

      {/* View Toggle + Filter */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center',
        background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: '12px 24px',
      }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {(['overview', 'explorer'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              background: view === v ? '#d4203020' : 'transparent',
              color: view === v ? '#ff3040' : '#8888a0',
              fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: view === v ? 600 : 400,
              cursor: 'pointer', textTransform: 'capitalize',
            }}>{v === 'overview' ? 'Fee Overview' : 'Fund Explorer'}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          style={{ fontSize: 12 }}>
          <option value="">All Categories ({categories.length})</option>
          {(categories as string[]).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {view === 'overview' ? (
        <>
          {/* TER Distribution Histogram */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
              <SectionHeader title="TER Distribution (% Expenses / Avg AUM)" source={`CNMV Anexo A2.2 — ${summary.date}`} />
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ter_histogram} margin={CHART_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8888a0' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#8888a0' }} />
                  <Tooltip content={<ChartTooltip suffix=" funds" decimals={0} />} />
                  <Bar dataKey="count" name="Funds" radius={[4, 4, 0, 0]}>
                    {(ter_histogram as Array<{ count: number }>).map((_, i) => (
                      <Cell key={i} fill={i < 4 ? '#10b981' : i < 7 ? '#f59e0b' : '#ef4444'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
              <SectionHeader title="Management Fee Distribution (% on AUM)" source={`CNMV Anexo A2.2 — ${summary.date}`} />
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={mgmt_histogram} margin={CHART_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8888a0' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#8888a0' }} />
                  <Tooltip content={<ChartTooltip suffix=" funds" decimals={0} />} />
                  <Bar dataKey="count" name="Funds" radius={[4, 4, 0, 0]}>
                    {(mgmt_histogram as Array<{ count: number }>).map((_, i) => (
                      <Cell key={i} fill={i < 4 ? '#3b82f6' : i < 7 ? '#f59e0b' : '#ef4444'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fee by Category — Median TER bar chart */}
          <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
            <SectionHeader title="Median TER by Fund Category" source="CNMV Anexo A2.2 — fund-level aggregation" />
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={catByTer} layout="vertical" margin={{ ...CHART_MARGIN, left: 140 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#8888a0' }}
                  tickFormatter={(v: number) => `${v}%`} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 11, fill: '#8888a0' }} width={135} />
                <Tooltip formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(3)}%`, 'Median TER']}
                  contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8 }}
                  labelStyle={{ color: '#e8e8f0' }} itemStyle={{ color: '#c0c0d0' }} />
                <Bar dataKey="median_ter" name="Median TER" radius={[0, 4, 4, 0]}>
                  {catByTer.map((entry, i) => (
                    <Cell key={i} fill={entry.median_ter > 0.35 ? '#ef4444' : entry.median_ter > 0.2 ? '#f59e0b' : '#10b981'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Fee vs Size Scatter */}
          <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
            <SectionHeader title="TER vs Fund Size (AUM)" source="CNMV Anexo A2.2 — funds with TER > 0" />
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis dataKey="patrimonio_m" name="AUM" type="number" scale="log" domain={['auto', 'auto']}
                  tick={{ fontSize: 10, fill: '#8888a0' }}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}B` : `${v.toFixed(0)}M`}
                  label={{ value: 'AUM (log scale)', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#555570' } }}
                />
                <YAxis dataKey="ter" name="TER" type="number"
                  tick={{ fontSize: 10, fill: '#8888a0' }}
                  tickFormatter={(v: number) => `${v}%`}
                  label={{ value: 'TER (%)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#555570' } }}
                />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload as { fund_name: string; category: string; patrimonio_m: number; ter: number; gestora: string };
                    return (
                      <div style={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 12px', maxWidth: 300 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#e8e8f0', marginBottom: 4 }}>{d.fund_name}</div>
                        <div style={{ fontSize: 10, color: '#8888a0' }}>{d.gestora}</div>
                        <div style={{ fontSize: 10, color: '#555570', marginTop: 4 }}>
                          {d.category} | AUM: {'\u20AC'}{d.patrimonio_m >= 1000 ? `${(d.patrimonio_m/1000).toFixed(1)}B` : `${d.patrimonio_m.toFixed(0)}M`} | TER: {d.ter}%
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {categoryFilter ? (
                  <Scatter name={categoryFilter} data={filteredScatter} fill={CAT_COLORS[categoryFilter] || '#3b82f6'} fillOpacity={0.6} />
                ) : (
                  // Show all categories with different colors — filter out empty categories to avoid null children
                  (categories as string[])
                    .map((cat, ci) => ({
                      cat,
                      ci,
                      data: (fee_vs_size as Array<{ category: string }>).filter(f => f.category === cat),
                    }))
                    .filter(({ data: d }) => d.length > 0)
                    .map(({ cat, ci, data: catData }) => (
                      <Scatter key={cat} name={cat} data={catData}
                        fill={CHART_COLORS[ci % CHART_COLORS.length]} fillOpacity={0.5} />
                    ))
                )}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Gestora Fee Comparison */}
          <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
            <SectionHeader title="Avg TER by Gestora (Top 20 by AUM)" source="CNMV Anexo A2.2" />
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={topGestoras} layout="vertical" margin={{ ...CHART_MARGIN, left: 200 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#8888a0' }}
                  tickFormatter={(v: number) => `${v}%`} />
                <YAxis dataKey="gestora_short" type="category" tick={{ fontSize: 10, fill: '#8888a0' }} width={195} />
                <Tooltip
                  formatter={(v: number | undefined, name?: string) => [`${(v ?? 0).toFixed(3)}%`, name ?? '']}
                  contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8 }}
                  labelStyle={{ color: '#e8e8f0' }} itemStyle={{ color: '#c0c0d0' }}
                />
                <Bar dataKey="avg_ter" name="Avg TER" radius={[0, 4, 4, 0]}>
                  {topGestoras.map((g, i) => (
                    <Cell key={i} fill={g.avg_ter > 0.35 ? '#ef4444' : g.avg_ter > 0.2 ? '#f59e0b' : '#10b981'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Most/Least Expensive Funds */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
              <SectionHeader title="Most Expensive Funds (by TER)" source="CNMV Anexo A2.2" />
              <DataTable
                data={most_expensive as Record<string, unknown>[]}
                columns={[
                  { key: 'fund_name', label: 'Fund', format: (v: unknown) => {
                    const s = String(v); return s.length > 35 ? s.slice(0, 33) + '...' : s;
                  }},
                  { key: 'category', label: 'Cat', format: (v: unknown) => (
                    <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: '#2a2a3a', color: '#8888a0' }}>
                      {String(v)}
                    </span>
                  )},
                  { key: 'ter', label: 'TER', align: 'right' as const,
                    format: (v: unknown) => <span style={{ color: '#ef4444', fontWeight: 600 }}>{Number(v).toFixed(2)}%</span> },
                  { key: 'patrimonio_m', label: 'AUM', align: 'right' as const,
                    format: (v: unknown) => `\u20AC${Number(v).toFixed(0)}M` },
                ]}
                defaultSort="ter"
                maxRows={15}
              />
            </div>

            <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
              <SectionHeader title="Most Cost-Efficient Funds (by TER)" source="CNMV Anexo A2.2" />
              <DataTable
                data={cheapest as Record<string, unknown>[]}
                columns={[
                  { key: 'fund_name', label: 'Fund', format: (v: unknown) => {
                    const s = String(v); return s.length > 35 ? s.slice(0, 33) + '...' : s;
                  }},
                  { key: 'category', label: 'Cat', format: (v: unknown) => (
                    <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: '#2a2a3a', color: '#8888a0' }}>
                      {String(v)}
                    </span>
                  )},
                  { key: 'ter', label: 'TER', align: 'right' as const,
                    format: (v: unknown) => <span style={{ color: '#10b981', fontWeight: 600 }}>{Number(v).toFixed(2)}%</span> },
                  { key: 'patrimonio_m', label: 'AUM', align: 'right' as const,
                    format: (v: unknown) => `\u20AC${Number(v).toFixed(0)}M` },
                ]}
                defaultSort="ter"
                defaultDir="asc"
                maxRows={15}
              />
            </div>
          </div>

          {/* Category Stats Table */}
          <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
            <SectionHeader title="Fee Statistics by Category" source="CNMV Anexo A2.2 — fund-level" />
            <DataTable
              data={filteredCategories as Record<string, unknown>[]}
              columns={[
                { key: 'category', label: 'Category' },
                { key: 'count', label: 'Funds', align: 'right' as const },
                { key: 'avg_ter', label: 'Avg TER', align: 'right' as const,
                  format: (v: unknown) => `${Number(v).toFixed(3)}%` },
                { key: 'median_ter', label: 'Med TER', align: 'right' as const,
                  format: (v: unknown) => `${Number(v).toFixed(3)}%` },
                { key: 'p25_ter', label: 'P25 TER', align: 'right' as const,
                  format: (v: unknown) => `${Number(v).toFixed(3)}%` },
                { key: 'p75_ter', label: 'P75 TER', align: 'right' as const,
                  format: (v: unknown) => `${Number(v).toFixed(3)}%` },
                { key: 'avg_mgmt_fee', label: 'Avg Mgmt', align: 'right' as const,
                  format: (v: unknown) => `${Number(v).toFixed(2)}%` },
                { key: 'avg_patrimonio_m', label: 'Avg AUM', align: 'right' as const,
                  format: (v: unknown) => `\u20AC${Number(v).toFixed(0)}M` },
              ]}
              defaultSort="median_ter"
            />
          </div>
        </>
      ) : (
        /* Fund Explorer View */
        <FundFeeExplorer categoryFilter={categoryFilter} />
      )}
    </div>
  );
}

function FundFeeExplorer({ categoryFilter }: { categoryFilter: string }) {
  const [search, setSearch] = useState('');
  const [gestoraFilter, setGestoraFilter] = useState('');

  const filtered = useMemo(() => {
    let result = funds as Array<Record<string, unknown>>;
    if (categoryFilter) result = result.filter(f => f.category === categoryFilter);
    if (gestoraFilter) result = result.filter(f => f.gestora === gestoraFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        String(f.fund_name).toLowerCase().includes(q) ||
        String(f.isin).toLowerCase().includes(q) ||
        String(f.gestora).toLowerCase().includes(q)
      );
    }
    return result;
  }, [categoryFilter, gestoraFilter, search]);

  return (
    <>
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Fund Fee Explorer" source={`CNMV Anexo A2.2 — ${summary.date} | ${summary.total_classes} share classes`} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" placeholder="Search fund, ISIN, or gestora..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200 }} />
          <select value={gestoraFilter} onChange={e => setGestoraFilter(e.target.value)}>
            <option value="">All Gestoras ({gestoras.length})</option>
            {(gestoras as string[]).map(g => (
              <option key={g} value={g}>{g.length > 50 ? g.slice(0, 48) + '...' : g}</option>
            ))}
          </select>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#8888a0' }}>
            {filtered.length} classes
          </div>
        </div>
      </div>

      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <DataTable
          data={filtered as Record<string, unknown>[]}
          columns={[
            { key: 'isin', label: 'ISIN', width: 120 },
            { key: 'fund_name', label: 'Fund', format: (v: unknown) => {
              const s = String(v); return s.length > 40 ? s.slice(0, 38) + '...' : s;
            }},
            { key: 'share_class', label: 'Class', width: 50 },
            { key: 'category', label: 'Category', format: (v: unknown) => (
              <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: '#2a2a3a', color: '#8888a0' }}>
                {String(v)}
              </span>
            )},
            { key: 'patrimonio_m', label: 'AUM (M)', align: 'right' as const,
              format: (v: unknown) => v ? `\u20AC${Number(v).toFixed(0)}M` : '-' },
            { key: 'ter', label: 'TER', align: 'right' as const, heatmap: true,
              format: (v: unknown) => v != null ? `${Number(v).toFixed(3)}%` : '-' },
            { key: 'mgmt_fee_aum', label: 'Mgmt %', align: 'right' as const,
              format: (v: unknown) => v != null ? `${Number(v).toFixed(2)}%` : '-' },
            { key: 'sub_fee_max', label: 'Sub Max', align: 'right' as const,
              format: (v: unknown) => Number(v) > 0 ? `${Number(v).toFixed(1)}%` : '-' },
            { key: 'redemp_fee_max', label: 'Red Max', align: 'right' as const,
              format: (v: unknown) => Number(v) > 0 ? `${Number(v).toFixed(1)}%` : '-' },
            { key: 'depositary_fee', label: 'Depo', align: 'right' as const,
              format: (v: unknown) => v != null ? `${Number(v).toFixed(2)}%` : '-' },
          ]}
          defaultSort="patrimonio_m"
          maxRows={100}
        />
      </div>
    </>
  );
}
