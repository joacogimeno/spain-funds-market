import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ScatterChart, Scatter } from 'recharts';
import SectionHeader from '../components/SectionHeader';
import KpiCard from '../components/KpiCard';
import DataTable from '../components/DataTable';
import InsightCard from '../components/InsightCard';
import { CHART_MARGIN, CHART_COLORS } from '../theme';
import data from '../data/cnmv_depositaria.json';

const {
  summary, depositario_stats, gestora_depositario, fund_detail,
  opportunity_targets, market_share_chart, fee_by_depositario,
  inversis_by_gestora, qualitative_analysis,
  depositarios, gestoras, categories,
} = data as typeof data & {
  inversis_by_gestora: Array<{
    gestora: string; gestora_short: string; classes: number; funds: number;
    aum_m: number; avg_fee_bps: number; weighted_fee_bps: number;
    est_annual_rev_k: number; is_march: boolean;
  }>;
  qualitative_analysis: Array<{
    type: string; severity: string; title: string; body: string;
  }>;
};

type View = 'depositario' | 'gestora' | 'fund';

// Color map for depositarios
const DEPO_COLORS: Record<string, string> = {};
(depositarios as string[]).forEach((d, i) => {
  DEPO_COLORS[d] = CHART_COLORS[i % CHART_COLORS.length];
});

const INVERSIS_BG = '#10b98112';
const INVERSIS_BORDER = '#10b98130';

export default function Depositaria() {
  const [view, setView] = useState<View>('depositario');
  const [depoFilter, setDepoFilter] = useState('');
  const [gestoraFilter, setGestoraFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <KpiCard
          title="Depositarios"
          value={String(summary.total_depositarios)}
          subtitle={`${summary.total_funds.toLocaleString()} funds custodied`}
        />
        <KpiCard
          title="Market AUM"
          value={`\u20AC${summary.total_aum_bn}B`}
          subtitle={`${summary.total_gestoras} gestoras`}
        />
        <KpiCard
          title="Inversis AUM"
          value={`\u20AC${summary.inversis_aum_bn}B`}
          delta={`${summary.inversis_market_share_pct}% market share`}
          deltaPositive={true}
          subtitle={`Rank #${summary.inversis_rank_aum} by AUM`}
        />
        <KpiCard
          title="Inversis Clients"
          value={String(summary.inversis_gestora_count)}
          delta={`Rank #${summary.inversis_rank_gestoras} by gestora count`}
          deltaPositive={true}
          subtitle={`Avg depo fee: ${(summary.inversis_avg_fee * 100).toFixed(1)} bps`}
        />
        {(summary as Record<string, unknown>).inversis_est_annual_rev_m != null && (
          <KpiCard
            title="Est. Annual Rev."
            value={`\u20AC${((summary as Record<string, unknown>).inversis_est_annual_rev_m as number).toFixed(2)}M`}
            subtitle="Depositary fee income (est.)"
          />
        )}
      </div>

      {/* View Toggle + Filters */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: '12px 24px',
      }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {([
            { id: 'depositario' as const, label: 'By Depositario' },
            { id: 'gestora' as const, label: 'By Gestora' },
            { id: 'fund' as const, label: 'By Fund' },
          ]).map(v => (
            <button key={v.id} onClick={() => { setView(v.id); setDepoFilter(''); setGestoraFilter(''); setSearch(''); }} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              background: view === v.id ? '#d4203020' : 'transparent',
              color: view === v.id ? '#ff3040' : '#8888a0',
              fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: view === v.id ? 600 : 400,
              cursor: 'pointer',
            }}>{v.label}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {view !== 'depositario' && (
          <select value={depoFilter} onChange={e => setDepoFilter(e.target.value)} style={{ fontSize: 12 }}>
            <option value="">All Depositarios ({depositarios.length})</option>
            {(depositarios as string[]).map(d => (
              <option key={d} value={d}>{d.length > 45 ? d.slice(0, 43) + '...' : d}</option>
            ))}
          </select>
        )}
        {view === 'fund' && (
          <>
            <select value={gestoraFilter} onChange={e => setGestoraFilter(e.target.value)} style={{ fontSize: 12 }}>
              <option value="">All Gestoras ({gestoras.length})</option>
              {(gestoras as string[]).map(g => (
                <option key={g} value={g}>{g.length > 45 ? g.slice(0, 43) + '...' : g}</option>
              ))}
            </select>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ fontSize: 12 }}>
              <option value="">All Categories ({categories.length})</option>
              {(categories as string[]).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </>
        )}
        {(view === 'gestora' || view === 'fund') && (
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ minWidth: 160 }} />
        )}
      </div>

      {/* View Content */}
      {view === 'depositario' && <ByDepositarioView depoFilter={depoFilter} setDepoFilter={setDepoFilter} />}
      {view === 'gestora' && <ByGestoraView depoFilter={depoFilter} search={search} />}
      {view === 'fund' && <ByFundView depoFilter={depoFilter} gestoraFilter={gestoraFilter} categoryFilter={categoryFilter} search={search} />}

      {/* Charts — always visible */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Market Share Pie */}
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Market Share by Depositario (AUM)" source={`CNMV Anexo A1.1 + A2.2 \u2014 ${summary.date}`} />
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={market_share_chart as Array<{ depositario: string; aum_bn: number; pct: number; is_inversis: boolean }>}
                dataKey="aum_bn" nameKey="depositario"
                cx="50%" cy="50%"
                outerRadius={130} innerRadius={60}
                label={({ name, value }: { name?: string; value?: number }) =>
                  `${(name || '').length > 15 ? (name || '').slice(0, 13) + '..' : name} \u20AC${value}B`
                }
                labelLine={{ stroke: '#555570' }}
              >
                {(market_share_chart as Array<{ is_inversis: boolean }>).map((entry, i) => (
                  <Cell key={i}
                    fill={entry.is_inversis ? '#10b981' : CHART_COLORS[i % CHART_COLORS.length]}
                    fillOpacity={entry.is_inversis ? 1 : 0.7}
                    stroke={entry.is_inversis ? '#10b981' : 'transparent'}
                    strokeWidth={entry.is_inversis ? 2 : 0}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number | undefined) => [`\u20AC${(v ?? 0).toFixed(1)}B`, 'AUM']}
                contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8 }}
                labelStyle={{ color: '#e8e8f0' }} itemStyle={{ color: '#c0c0d0' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Avg Fee by Depositario */}
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Avg Depositary Fee by Custodian" source="CNMV Anexo A2.2" />
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={[...(fee_by_depositario as Array<{ depositario: string; avg_fee: number; aum_bn: number; is_inversis: boolean }>)]
                .sort((a, b) => b.avg_fee - a.avg_fee)}
              layout="vertical" margin={{ ...CHART_MARGIN, left: 170 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#8888a0' }}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)} bps`} />
              <YAxis dataKey="depositario" type="category" tick={{ fontSize: 10, fill: '#8888a0' }} width={165} />
              <Tooltip
                formatter={(v: number | undefined) => [`${((v ?? 0) * 100).toFixed(1)} bps`, 'Avg Fee']}
                contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8 }}
                labelStyle={{ color: '#e8e8f0' }} itemStyle={{ color: '#c0c0d0' }}
              />
              <Bar dataKey="avg_fee" name="Avg Depositary Fee" radius={[0, 4, 4, 0]}>
                {[...(fee_by_depositario as Array<{ is_inversis: boolean; avg_fee: number }>)]
                  .sort((a, b) => b.avg_fee - a.avg_fee)
                  .map((entry, i) => (
                    <Cell key={i}
                      fill={entry.is_inversis ? '#10b981' : entry.avg_fee > 0.08 ? '#ef4444' : entry.avg_fee > 0.06 ? '#f59e0b' : '#3b82f6'}
                      fillOpacity={0.8}
                    />
                  ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scatter: AUM vs Fee by Gestora */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Gestora AUM vs Depositary Fee" source="CNMV Anexo A1.1 + A2.2" />
        <GestoraScatter />
      </div>

      {/* Category-level median fees with depositary comparison */}
      <CategoryFeeByDepositary />

      {/* === SECTION B: INVERSIS CLIENT REVENUE DETAIL === */}
      {inversis_by_gestora && inversis_by_gestora.length > 0 && (
        <div style={{ borderTop: '2px solid #10b98130', paddingTop: 24, marginTop: 8 }}>
          <div style={{
            fontSize: 18, fontWeight: 700, color: '#e8e8f0',
            fontFamily: "'Outfit', sans-serif", marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ display: 'inline-block', width: 4, height: 20, borderRadius: 2, background: '#10b981' }} />
            Inversis Depositary Book — Client Revenue Detail
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Revenue bar by gestora */}
            <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
              <SectionHeader title="Estimated Annual Deposit Fee Revenue by Gestora" source="inversis_depositary_insights_2025Q3.xlsx" />
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={[...inversis_by_gestora].sort((a, b) => b.est_annual_rev_k - a.est_annual_rev_k)}
                  layout="vertical" margin={{ ...CHART_MARGIN, left: 210 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#8888a0' }}
                    tickFormatter={(v: number) => v >= 1000 ? `\u20AC${(v/1000).toFixed(1)}M` : `\u20AC${v.toFixed(0)}K`} />
                  <YAxis dataKey="gestora_short" type="category" tick={{ fontSize: 9, fill: '#8888a0' }} width={205} />
                  <Tooltip
                    formatter={(v: number | undefined) => [`\u20AC${(v ?? 0) >= 1000 ? ((v ?? 0)/1000).toFixed(2)+'M' : (v ?? 0).toFixed(0)+'K'}`, 'Est. Annual Rev.']}
                    contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8 }}
                    labelStyle={{ color: '#e8e8f0' }} itemStyle={{ color: '#c0c0d0' }}
                  />
                  <Bar dataKey="est_annual_rev_k" radius={[0, 4, 4, 0]}>
                    {[...inversis_by_gestora].sort((a, b) => b.est_annual_rev_k - a.est_annual_rev_k).map((entry, i) => (
                      <Cell key={i}
                        fill={entry.is_march ? '#f59e0b' : '#10b981'}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Weighted fee vs AUM scatter */}
            <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
              <SectionHeader title="AUM vs Weighted Deposit Fee Rate (Inversis Book)" source="inversis_depositary_insights_2025Q3.xlsx" />
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart margin={CHART_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="aum_m" name="AUM" type="number"
                    tick={{ fontSize: 10, fill: '#8888a0' }}
                    tickFormatter={(v: number) => v >= 1000 ? `\u20AC${(v/1000).toFixed(1)}B` : `\u20AC${v.toFixed(0)}M`}
                    label={{ value: 'AUM', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#555570' } }}
                  />
                  <YAxis dataKey="weighted_fee_bps" name="Wtd Fee" type="number"
                    tick={{ fontSize: 10, fill: '#8888a0' }}
                    tickFormatter={(v: number) => `${v.toFixed(1)} bps`}
                    label={{ value: 'Weighted Fee (bps)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#555570' } }}
                  />
                  <Tooltip content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload as typeof inversis_by_gestora[0];
                    return (
                      <div style={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 12px', maxWidth: 280 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: d.is_march ? '#f59e0b' : '#10b981', marginBottom: 4 }}>
                          {d.gestora_short}
                        </div>
                        <div style={{ fontSize: 10, color: '#8888a0' }}>
                          AUM: \u20AC{d.aum_m >= 1000 ? (d.aum_m/1000).toFixed(2)+'B' : d.aum_m.toFixed(0)+'M'} | Wtd Fee: {d.weighted_fee_bps.toFixed(2)} bps
                        </div>
                        <div style={{ fontSize: 10, color: '#555570' }}>
                          Est. Rev: \u20AC{d.est_annual_rev_k >= 1000 ? (d.est_annual_rev_k/1000).toFixed(2)+'M' : d.est_annual_rev_k.toFixed(0)+'K'}/yr
                        </div>
                      </div>
                    );
                  }} />
                  <Scatter
                    data={inversis_by_gestora.filter(d => !d.is_march)}
                    name="Other clients" fill="#10b981" fillOpacity={0.75}
                  />
                  <Scatter
                    data={inversis_by_gestora.filter(d => d.is_march)}
                    name="March AM (intragroup)" fill="#f59e0b" fillOpacity={0.9}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Client Revenue Table */}
          <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24, marginTop: 16 }}>
            <SectionHeader title="Inversis Client Fee Detail" source="inversis_depositary_insights_2025Q3.xlsx — Q3 2025" />
            <DataTable
              data={inversis_by_gestora}
              columns={[
                { key: 'gestora_short', label: 'Gestora', format: (v: unknown) => {
                  const s = String(v);
                  return s.length > 38 ? s.slice(0, 36) + '..' : s;
                }},
                { key: 'funds', label: 'Funds', align: 'right' as const },
                { key: 'classes', label: 'Classes', align: 'right' as const },
                { key: 'aum_m', label: 'AUM', align: 'right' as const,
                  format: (v: unknown) => {
                    const m = Number(v);
                    return m >= 1000 ? `\u20AC${(m/1000).toFixed(2)}B` : `\u20AC${m.toFixed(0)}M`;
                  }},
                { key: 'avg_fee_bps', label: 'Avg Fee (non-zero)', align: 'right' as const,
                  format: (v: unknown) => Number(v) > 0 ? `${Number(v).toFixed(2)} bps` : '\u2014' },
                { key: 'weighted_fee_bps', label: 'Wtd Fee (all AUM)', align: 'right' as const,
                  format: (v: unknown, row?: Record<string, unknown>) => {
                    const bps = Number(v);
                    const isMarch = Boolean(row?.is_march);
                    return (
                      <span style={{ color: isMarch ? '#f59e0b' : bps < 5 ? '#ef4444' : '#e8e8f0', fontWeight: isMarch ? 700 : 400 }}>
                        {bps.toFixed(2)} bps
                      </span>
                    );
                  }},
                { key: 'est_annual_rev_k', label: 'Est. Annual Rev.', align: 'right' as const,
                  format: (v: unknown) => {
                    const k = Number(v);
                    return k >= 1000 ? `\u20AC${(k/1000).toFixed(2)}M` : `\u20AC${k.toFixed(0)}K`;
                  }},
              ]}
              defaultSort="est_annual_rev_k"
            />
          </div>
        </div>
      )}

      {/* === SECTION C: QUALITATIVE ANALYSIS === */}
      {qualitative_analysis && qualitative_analysis.length > 0 && (
        <div style={{ borderTop: '2px solid #3b82f630', paddingTop: 24, marginTop: 8 }}>
          <div style={{
            fontSize: 18, fontWeight: 700, color: '#e8e8f0',
            fontFamily: "'Outfit', sans-serif", marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ display: 'inline-block', width: 4, height: 20, borderRadius: 2, background: '#3b82f6' }} />
            Qualitative Analysis
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {qualitative_analysis.map((insight, i) => {
              const colorMap: Record<string, string> = {
                info: '#3b82f6', opportunity: '#10b981', medium: '#f59e0b', high: '#ef4444',
              };
              const color = colorMap[insight.severity] || '#3b82f6';
              return (
                <InsightCard key={i} title={insight.title} color={color}>
                  {insight.body}
                </InsightCard>
              );
            })}
          </div>
        </div>
      )}

      {/* === SECTION D: OPPORTUNITY === */}
      <div style={{
        borderTop: '2px solid #d4203040', paddingTop: 24, marginTop: 8,
      }}>
        <div style={{
          fontSize: 18, fontWeight: 700, color: '#e8e8f0',
          fontFamily: "'Outfit', sans-serif", marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{
            display: 'inline-block', width: 4, height: 20, borderRadius: 2,
            background: '#10b981',
          }} />
          Inversis Business Development Opportunities
        </div>

        <OpportunitySection />
      </div>
    </div>
  );
}

/* ========== BY DEPOSITARIO VIEW ========== */
function ByDepositarioView({ depoFilter, setDepoFilter }: { depoFilter: string; setDepoFilter: (v: string) => void }) {
  const stats = depositario_stats as Array<Record<string, unknown>>;

  // Sub-table: gestoras for selected depositario
  const subGestoras = useMemo(() => {
    if (!depoFilter) return [];
    return (gestora_depositario as Array<Record<string, unknown>>)
      .filter(gd => gd.depositario === depoFilter);
  }, [depoFilter]);

  return (
    <>
      {/* AUM bar chart */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="AUM by Depositario" source={`CNMV Anexo A1.1 + A2.2 \u2014 ${summary.date}`} />
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={market_share_chart as Array<Record<string, unknown>>} layout="vertical"
            margin={{ ...CHART_MARGIN, left: 170 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#8888a0' }}
              tickFormatter={(v: number) => `\u20AC${v.toFixed(0)}B`} />
            <YAxis dataKey="depositario" type="category" tick={{ fontSize: 10, fill: '#8888a0' }} width={165} />
            <Tooltip
              formatter={(v: number | undefined) => [`\u20AC${(v ?? 0).toFixed(1)}B`, 'AUM']}
              contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8 }}
              labelStyle={{ color: '#e8e8f0' }} itemStyle={{ color: '#c0c0d0' }}
            />
            <Bar dataKey="aum_bn" name="AUM" radius={[0, 4, 4, 0]}
              onClick={(_: unknown, idx: number) => {
                const entry = (market_share_chart as Array<{ depositario_full: string }>)[idx];
                setDepoFilter(entry.depositario_full);
              }}
              cursor="pointer"
            >
              {(market_share_chart as Array<{ is_inversis: boolean }>).map((entry, i) => (
                <Cell key={i}
                  fill={entry.is_inversis ? '#10b981' : CHART_COLORS[i % CHART_COLORS.length]}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Depositario Stats Table */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Depositario Overview" source="CNMV Anexo A1.1 + A2.2" />
        <DataTable
          data={stats}
          columns={[
            { key: 'depositario', label: 'Depositario', format: (v: unknown) => {
              const s = String(v);
              const short = s.replace(', S.A.', '').replace(', S.A', '');
              const isInversis = s.includes('INVERSIS');
              return (
                <span style={{
                  cursor: 'pointer', color: isInversis ? '#10b981' : '#e8e8f0',
                  fontWeight: isInversis ? 700 : 400,
                }}>{short.length > 35 ? short.slice(0, 33) + '..' : short}</span>
              );
            }},
            { key: 'gestora_count', label: 'Gestoras', align: 'right' as const },
            { key: 'fund_count', label: 'Funds', align: 'right' as const },
            { key: 'total_aum_bn', label: 'AUM (B)', align: 'right' as const,
              format: (v: unknown) => `\u20AC${Number(v).toFixed(1)}B` },
            { key: 'market_share_pct', label: 'Share', align: 'right' as const,
              format: (v: unknown) => `${Number(v).toFixed(1)}%` },
            { key: 'avg_depo_fee', label: 'Avg Fee', align: 'right' as const,
              format: (v: unknown) => `${(Number(v) * 100).toFixed(1)} bps` },
            { key: 'median_depo_fee', label: 'Med Fee', align: 'right' as const,
              format: (v: unknown) => `${(Number(v) * 100).toFixed(1)} bps` },
          ]}
          defaultSort="total_aum_bn"
          onRowClick={(row) => setDepoFilter(String(row.depositario))}
        />
      </div>

      {/* Sub-table: gestoras for selected depositario */}
      {depoFilter && subGestoras.length > 0 && (
        <div style={{
          background: '#16161f', border: `1px solid ${INVERSIS_BORDER}`,
          borderRadius: 12, padding: 24,
        }}>
          <SectionHeader title={`Gestora Clients of ${depoFilter.replace(', S.A.', '')}`}>
            <button onClick={() => setDepoFilter('')} style={{
              padding: '4px 10px', borderRadius: 4, border: '1px solid #2a2a3a',
              background: '#2a2a3a', color: '#8888a0', fontSize: 11, cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
            }}>Clear filter</button>
          </SectionHeader>
          <DataTable
            data={subGestoras}
            columns={[
              { key: 'gestora', label: 'Gestora', format: (v: unknown) => {
                const s = String(v); return s.length > 45 ? s.slice(0, 43) + '..' : s;
              }},
              { key: 'grupo', label: 'Grupo', format: (v: unknown) => {
                const s = String(v); return s.length > 25 ? s.slice(0, 23) + '..' : s;
              }},
              { key: 'fund_count', label: 'Funds', align: 'right' as const },
              { key: 'total_aum_m', label: 'AUM', align: 'right' as const,
                format: (v: unknown) => {
                  const m = Number(v);
                  return m >= 1000 ? `\u20AC${(m / 1000).toFixed(1)}B` : `\u20AC${m.toFixed(0)}M`;
                }},
              { key: 'avg_depo_fee', label: 'Avg Fee', align: 'right' as const,
                format: (v: unknown) => Number(v) > 0 ? `${(Number(v) * 100).toFixed(1)} bps` : '-' },
              { key: 'weighted_depo_fee', label: 'Wtd Fee', align: 'right' as const,
                format: (v: unknown) => Number(v) > 0 ? `${(Number(v) * 100).toFixed(1)} bps` : '-' },
              { key: 'is_captive', label: 'Captive', align: 'right' as const,
                format: (v: unknown) => v ? (
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: '#f59e0b20', color: '#f59e0b' }}>Captive</span>
                ) : '' },
            ]}
            defaultSort="total_aum_m"
          />
        </div>
      )}
    </>
  );
}

/* ========== BY GESTORA VIEW ========== */
function ByGestoraView({ depoFilter, search }: { depoFilter: string; search: string }) {
  const filtered = useMemo(() => {
    let result = gestora_depositario as Array<Record<string, unknown>>;
    if (depoFilter) result = result.filter(r => r.depositario === depoFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        String(r.gestora).toLowerCase().includes(q) ||
        String(r.grupo).toLowerCase().includes(q) ||
        String(r.depositario).toLowerCase().includes(q)
      );
    }
    return result;
  }, [depoFilter, search]);

  return (
    <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
      <SectionHeader title="Gestora \u2194 Depositario Relationships" source={`CNMV Anexo A1.1 + A2.2 \u2014 ${summary.date} | ${filtered.length} relationships`} />
      <DataTable
        data={filtered}
        columns={[
          { key: 'gestora', label: 'Gestora', format: (v: unknown) => {
            const s = String(v); return s.length > 40 ? s.slice(0, 38) + '..' : s;
          }},
          { key: 'depositario', label: 'Depositario', format: (v: unknown) => {
            const s = String(v).replace(', S.A.', '').replace(', S.A', '');
            const isInversis = String(v).includes('INVERSIS');
            return (
              <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 3,
                background: isInversis ? '#10b98120' : '#2a2a3a',
                color: isInversis ? '#10b981' : '#8888a0',
                fontWeight: isInversis ? 600 : 400,
              }}>{s.length > 25 ? s.slice(0, 23) + '..' : s}</span>
            );
          }},
          { key: 'grupo', label: 'Grupo', format: (v: unknown) => {
            const s = String(v); return s.length > 20 ? s.slice(0, 18) + '..' : s;
          }},
          { key: 'fund_count', label: 'Funds', align: 'right' as const },
          { key: 'total_aum_m', label: 'AUM', align: 'right' as const,
            format: (v: unknown) => {
              const m = Number(v);
              return m >= 1000 ? `\u20AC${(m / 1000).toFixed(1)}B` : `\u20AC${m.toFixed(0)}M`;
            }},
          { key: 'avg_depo_fee', label: 'Avg Fee', align: 'right' as const,
            format: (v: unknown) => Number(v) > 0 ? `${(Number(v) * 100).toFixed(1)} bps` : '-' },
          { key: 'weighted_depo_fee', label: 'Wtd Fee', align: 'right' as const,
            format: (v: unknown) => Number(v) > 0 ? `${(Number(v) * 100).toFixed(1)} bps` : '-' },
          { key: 'is_captive', label: 'Type', align: 'right' as const,
            format: (v: unknown) => v ? (
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: '#f59e0b20', color: '#f59e0b' }}>Captive</span>
            ) : (
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: '#3b82f620', color: '#3b82f6' }}>Independent</span>
            )},
          { key: 'is_inversis', label: '', align: 'right' as const,
            format: (v: unknown) => v ? (
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: '#10b98120', color: '#10b981', fontWeight: 600 }}>Inversis</span>
            ) : '' },
        ]}
        defaultSort="total_aum_m"
        maxRows={100}
      />
    </div>
  );
}

/* ========== BY FUND VIEW ========== */
function ByFundView({ depoFilter, gestoraFilter, categoryFilter, search }: {
  depoFilter: string; gestoraFilter: string; categoryFilter: string; search: string;
}) {
  const filtered = useMemo(() => {
    let result = fund_detail as Array<Record<string, unknown>>;
    if (depoFilter) result = result.filter(r => r.depositario === depoFilter);
    if (gestoraFilter) result = result.filter(r => r.gestora === gestoraFilter);
    if (categoryFilter) result = result.filter(r => r.category === categoryFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        String(r.fund_name).toLowerCase().includes(q) ||
        String(r.isin).toLowerCase().includes(q) ||
        String(r.gestora).toLowerCase().includes(q)
      );
    }
    return result;
  }, [depoFilter, gestoraFilter, categoryFilter, search]);

  return (
    <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
      <SectionHeader title="Fund-Level Depositaría Detail" source={`CNMV Anexo A1.1 + A2.2 \u2014 ${summary.date} | ${filtered.length} funds`} />
      <DataTable
        data={filtered}
        columns={[
          { key: 'fund_name', label: 'Fund', format: (v: unknown) => {
            const s = String(v); return s.length > 35 ? s.slice(0, 33) + '..' : s;
          }},
          { key: 'isin', label: 'ISIN', width: 120 },
          { key: 'gestora', label: 'Gestora', format: (v: unknown) => {
            const s = String(v); return s.length > 25 ? s.slice(0, 23) + '..' : s;
          }},
          { key: 'depositario', label: 'Depositario', format: (v: unknown) => {
            const s = String(v).replace(', S.A.', '').replace(', S.A', '');
            const isInversis = String(v).includes('INVERSIS');
            return (
              <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 3,
                background: isInversis ? '#10b98120' : '#2a2a3a',
                color: isInversis ? '#10b981' : '#8888a0',
              }}>{s.length > 20 ? s.slice(0, 18) + '..' : s}</span>
            );
          }},
          { key: 'category', label: 'Category', format: (v: unknown) => (
            <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: '#2a2a3a', color: '#8888a0' }}>
              {String(v)}
            </span>
          )},
          { key: 'aum_m', label: 'AUM', align: 'right' as const,
            format: (v: unknown) => {
              const m = Number(v);
              return m > 0 ? (m >= 1000 ? `\u20AC${(m / 1000).toFixed(1)}B` : `\u20AC${m.toFixed(0)}M`) : '-';
            }},
          { key: 'depo_fee', label: 'Depo Fee', align: 'right' as const,
            format: (v: unknown) => v != null && Number(v) > 0 ? `${(Number(v) * 100).toFixed(1)} bps` : '-' },
          { key: 'mgmt_fee', label: 'Mgmt Fee', align: 'right' as const,
            format: (v: unknown) => v != null ? `${Number(v).toFixed(2)}%` : '-' },
          { key: 'ter', label: 'TER', align: 'right' as const,
            format: (v: unknown) => v != null ? `${Number(v).toFixed(3)}%` : '-' },
        ]}
        defaultSort="aum_m"
        maxRows={100}
      />
    </div>
  );
}

/* ========== SCATTER: GESTORA AUM VS FEE ========== */
function GestoraScatter() {
  const scatterData = useMemo(() =>
    (gestora_depositario as Array<{
      gestora: string; depositario: string; total_aum_m: number;
      avg_depo_fee: number; is_inversis: boolean; is_captive: boolean;
    }>)
      .filter(gd => gd.avg_depo_fee > 0 && gd.total_aum_m > 0)
      .map(gd => ({
        ...gd,
        gestora_short: gd.gestora.length > 30 ? gd.gestora.slice(0, 28) + '..' : gd.gestora,
        depo_short: gd.depositario.replace(', S.A.', '').replace(', S.A', ''),
        fee_bps: +(gd.avg_depo_fee * 100).toFixed(1),
      })),
  []);

  const inversis = scatterData.filter(d => d.is_inversis);
  const others = scatterData.filter(d => !d.is_inversis);

  return (
    <ResponsiveContainer width="100%" height={440}>
      <ScatterChart margin={{ ...CHART_MARGIN, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
        <XAxis dataKey="total_aum_m" name="AUM" type="number" scale="log" domain={['auto', 'auto']}
          tick={{ fontSize: 10, fill: '#8888a0' }}
          tickFormatter={(v: number) => v >= 1000 ? `\u20AC${(v / 1000).toFixed(0)}B` : `\u20AC${v.toFixed(0)}M`}
          label={{ value: 'AUM (log scale)', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#555570' } }}
        />
        <YAxis dataKey="fee_bps" name="Depo Fee" type="number"
          tick={{ fontSize: 10, fill: '#8888a0' }}
          tickFormatter={(v: number) => `${v} bps`}
          label={{ value: 'Depositary Fee (bps)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#555570' } }}
        />
        <Tooltip content={({ payload }) => {
          if (!payload?.length) return null;
          const d = payload[0].payload as typeof scatterData[0];
          return (
            <div style={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 12px', maxWidth: 320 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: d.is_inversis ? '#10b981' : '#e8e8f0', marginBottom: 4 }}>
                {d.gestora_short}
              </div>
              <div style={{ fontSize: 10, color: '#8888a0' }}>
                Depo: {d.depo_short} {d.is_captive ? '(captive)' : ''}
              </div>
              <div style={{ fontSize: 10, color: '#555570', marginTop: 4 }}>
                AUM: {d.total_aum_m >= 1000 ? `\u20AC${(d.total_aum_m / 1000).toFixed(1)}B` : `\u20AC${d.total_aum_m.toFixed(0)}M`} | Fee: {d.fee_bps} bps
              </div>
            </div>
          );
        }} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 20 }} />
        {others.length > 0 && (
          <Scatter name="Other Depositarios" data={others} fill="#3b82f6" fillOpacity={0.5} />
        )}
        {inversis.length > 0 && (
          <Scatter name="Inversis Clients" data={inversis} fill="#10b981" fillOpacity={0.9} />
        )}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/* ========== CATEGORY FEE BY DEPOSITARY ========== */
function CategoryFeeByDepositary() {
  const [selectedDepo, setSelectedDepo] = useState('');

  const { categoryMedians, depoFeesByCategory } = useMemo(() => {
    // Compute median depositary fee per category across all gestoras
    const catGestoraFees = new Map<string, number[]>();
    const catAum = new Map<string, number>();

    // Group classes by category, then compute per-gestora weighted fees
    const catGestora = new Map<string, Map<string, { aum: number; fee_aum: number }>>();
    for (const f of fund_detail as Array<{ category: string; gestora: string; aum_m: number; depo_fee: number; depositario: string }>) {
      if (!f.category || f.aum_m <= 0) continue;
      if (!catGestora.has(f.category)) catGestora.set(f.category, new Map());
      const gMap = catGestora.get(f.category)!;
      const entry = gMap.get(f.gestora) ?? { aum: 0, fee_aum: 0 };
      entry.aum += f.aum_m;
      entry.fee_aum += f.aum_m * (f.depo_fee ?? 0);
      gMap.set(f.gestora, entry);
      catAum.set(f.category, (catAum.get(f.category) ?? 0) + f.aum_m);
    }

    for (const [cat, gMap] of catGestora) {
      const fees: number[] = [];
      for (const [, v] of gMap) {
        if (v.aum > 0) fees.push((v.fee_aum / v.aum) * 100);
      }
      catGestoraFees.set(cat, fees);
    }

    const medians: Array<{ category: string; median_bps: number; aum_m: number }> = [];
    for (const [cat, fees] of catGestoraFees) {
      if (fees.length === 0) continue;
      const sorted = [...fees].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      medians.push({ category: cat, median_bps: +median.toFixed(2), aum_m: catAum.get(cat) ?? 0 });
    }
    medians.sort((a, b) => b.aum_m - a.aum_m);

    // Per-depositary per-category weighted fee
    const depoMap = new Map<string, Map<string, { aum: number; fee_aum: number }>>();
    for (const f of fund_detail as Array<{ category: string; depositario: string; aum_m: number; depo_fee: number }>) {
      if (!f.category || !f.depositario || f.aum_m <= 0) continue;
      if (!depoMap.has(f.depositario)) depoMap.set(f.depositario, new Map());
      const cMap = depoMap.get(f.depositario)!;
      const entry = cMap.get(f.category) ?? { aum: 0, fee_aum: 0 };
      entry.aum += f.aum_m;
      entry.fee_aum += f.aum_m * (f.depo_fee ?? 0);
      cMap.set(f.category, entry);
    }

    const depoFees = new Map<string, Map<string, number>>();
    for (const [depo, cMap] of depoMap) {
      const catFees = new Map<string, number>();
      for (const [cat, v] of cMap) {
        if (v.aum > 0) catFees.set(cat, +((v.fee_aum / v.aum) * 100).toFixed(2));
      }
      depoFees.set(depo, catFees);
    }

    return { categoryMedians: medians, depoFeesByCategory: depoFees };
  }, []);

  const selectedDepoFees = selectedDepo ? depoFeesByCategory.get(selectedDepo) : null;

  const chartData = categoryMedians.map(cm => ({
    category: cm.category,
    median_bps: cm.median_bps,
    depo_bps: selectedDepoFees?.get(cm.category) ?? null,
  }));

  const depoNames = [...depoFeesByCategory.keys()].sort();

  return (
    <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
      <SectionHeader title="Median Depositary Fee by Fund Category" source="CNMV Anexo A2.2">
        <select value={selectedDepo} onChange={e => setSelectedDepo(e.target.value)} style={{ fontSize: 12, maxWidth: 300 }}>
          <option value="">Compare with a depositario...</option>
          {depoNames.map(d => (
            <option key={d} value={d}>{d.replace(/, S\.A\.?/, '').length > 35 ? d.replace(/, S\.A\.?/, '').slice(0, 33) + '..' : d.replace(/, S\.A\.?/, '')}</option>
          ))}
        </select>
      </SectionHeader>

      <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 28)}>
        <BarChart data={chartData} layout="vertical" margin={{ ...CHART_MARGIN, left: 180 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
          <XAxis type="number" tickFormatter={v => `${v} bps`}
            tick={{ fill: '#8888a0', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} />
          <YAxis type="category" dataKey="category" width={175}
            tick={{ fill: '#8888a0', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} />
          <Tooltip content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div style={{ background: '#1e1e2a', border: '1px solid #3a3a4a', borderRadius: 8, padding: '10px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                <div style={{ color: '#e8e8f0', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                {payload.map((entry, i) => (
                  <div key={i} style={{ color: entry.color, padding: '2px 0' }}>
                    {entry.name}: {Number(entry.value).toFixed(2)} bps
                  </div>
                ))}
              </div>
            );
          }} />
          <Bar dataKey="median_bps" name="Market Median" fill="#3b82f6" fillOpacity={0.6} radius={[0, 4, 4, 0]} />
          {selectedDepo && (
            <Bar dataKey="depo_bps" name={selectedDepo.replace(/, S\.A\.?/, '').slice(0, 25)} fill="#10b981" fillOpacity={0.85} radius={[0, 4, 4, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 10, color: '#555570' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#3b82f6', opacity: 0.6, borderRadius: 2, marginRight: 4 }} />Market Median</span>
        {selectedDepo && <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#10b981', borderRadius: 2, marginRight: 4 }} />{selectedDepo.replace(/, S\.A\.?/, '').slice(0, 30)}</span>}
      </div>
    </div>
  );
}

/* ========== OPPORTUNITY SECTION ========== */
function OpportunitySection() {
  const nonCaptiveTargets = useMemo(() =>
    (opportunity_targets as Array<Record<string, unknown>>)
      .filter(t => !t.is_captive),
  []);

  const premiumTargets = useMemo(() =>
    nonCaptiveTargets.filter(t => Number(t.fee_vs_inversis_avg) > 0),
  [nonCaptiveTargets]);

  const addressableAum = useMemo(() =>
    nonCaptiveTargets.reduce((sum, t) => sum + Number(t.total_aum_m), 0) / 1000,
  [nonCaptiveTargets]);

  const potentialRevenue = useMemo(() =>
    premiumTargets.reduce((sum, t) => sum + Number(t.potential_revenue_k), 0) / 1000,
  [premiumTargets]);

  return (
    <>
      {/* Opportunity KPIs */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <KpiCard
          title="Addressable Market"
          value={`\u20AC${addressableAum.toFixed(1)}B`}
          subtitle="Non-captive gestoras, excl. Inversis"
        />
        <KpiCard
          title="Target Gestoras"
          value={String(premiumTargets.length)}
          delta={`Paying > ${(summary.inversis_avg_fee * 100).toFixed(1)} bps (Inversis avg)`}
          deltaPositive={true}
          subtitle="Higher fee = easier pitch"
        />
        <KpiCard
          title="Target AUM"
          value={`\u20AC${(premiumTargets.reduce((s, t) => s + Number(t.total_aum_m), 0) / 1000).toFixed(1)}B`}
          subtitle="Combined AUM of premium targets"
        />
        <KpiCard
          title="Est. Fee Revenue"
          value={`\u20AC${potentialRevenue.toFixed(1)}M`}
          subtitle="If all premium targets switched"
        />
      </div>

      {/* Target Table */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Prospective Gestora Targets" source="Non-captive gestoras not currently using Inversis, sorted by AUM" />
        <DataTable
          data={nonCaptiveTargets}
          columns={[
            { key: 'gestora', label: 'Gestora', format: (v: unknown) => {
              const s = String(v); return s.length > 40 ? s.slice(0, 38) + '..' : s;
            }},
            { key: 'current_depositario', label: 'Current Depositario', format: (v: unknown) => {
              const s = String(v).replace(', S.A.', '').replace(', S.A', '');
              return s.length > 25 ? s.slice(0, 23) + '..' : s;
            }},
            { key: 'fund_count', label: 'Funds', align: 'right' as const },
            { key: 'total_aum_m', label: 'AUM', align: 'right' as const,
              format: (v: unknown) => {
                const m = Number(v);
                return m >= 1000 ? `\u20AC${(m / 1000).toFixed(1)}B` : `\u20AC${m.toFixed(0)}M`;
              }},
            { key: 'avg_depo_fee', label: 'Avg Fee', align: 'right' as const,
              format: (v: unknown) => Number(v) > 0 ? `${(Number(v) * 100).toFixed(1)} bps` : '-' },
            { key: 'fee_vs_inversis_avg', label: 'vs Inversis', align: 'right' as const, heatmap: true,
              format: (v: unknown) => {
                const val = Number(v);
                const bps = (val * 100).toFixed(1);
                if (val > 0) return <span style={{ color: '#10b981', fontWeight: 600 }}>+{bps} bps</span>;
                if (val < 0) return <span style={{ color: '#ef4444' }}>{bps} bps</span>;
                return '-';
              }},
            { key: 'potential_revenue_k', label: 'Fee Rev', align: 'right' as const,
              format: (v: unknown) => {
                const k = Number(v);
                return k > 0 ? (k >= 1000 ? `\u20AC${(k / 1000).toFixed(1)}M` : `\u20AC${k.toFixed(0)}K`) : '-';
              }},
          ]}
          defaultSort="total_aum_m"
          maxRows={50}
        />
      </div>

      {/* Insight */}
      <InsightCard title="Business Development Insight" color="#10b981">
        Inversis is the <strong>#{summary.inversis_rank_gestoras} depositario by number of gestora clients</strong> ({summary.inversis_gestora_count} gestoras)
        and <strong>#{summary.inversis_rank_aum} by AUM</strong> ({'\u20AC'}{summary.inversis_aum_bn}B, {summary.inversis_market_share_pct}% market share).
        The addressable non-captive market outside Inversis totals <strong>{'\u20AC'}{addressableAum.toFixed(0)}B</strong> across {nonCaptiveTargets.length} gestoras.
        Of these, <strong>{premiumTargets.length} gestoras ({'\u20AC'}{(premiumTargets.reduce((s, t) => s + Number(t.total_aum_m), 0) / 1000).toFixed(1)}B AUM)</strong> currently
        pay a higher depositary fee than Inversis&apos;s average of {(summary.inversis_avg_fee * 100).toFixed(1)} bps, making them natural pitch targets.
        The largest independent targets include {
          nonCaptiveTargets.slice(0, 3).map(t => String(t.gestora).split(',')[0]).join(', ')
        }.
      </InsightCard>
    </>
  );
}
