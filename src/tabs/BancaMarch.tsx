import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from 'recharts';
import SectionHeader from '../components/SectionHeader';
import KpiCard from '../components/KpiCard';
import DataTable from '../components/DataTable';
import InsightCard from '../components/InsightCard';
import { CHART_MARGIN, CHART_COLORS } from '../theme';
import rawData from '../data/banca_march.json';

// ── Types ──────────────────────────────────────────────────────────────────
interface MarchAm {
  gestora: string; gestora_short: string;
  aum_bn: number; funds: number; classes: number;
  weighted_fee_bps: number; avg_nonzero_fee_bps: number;
  zero_fee_aum_m: number; zero_fee_aum_pct: number;
  est_annual_rev_k: number; effective_rate_bps: number;
}
interface InversisGestion {
  gestora: string; aum_bn: number; funds: number; classes: number;
  weighted_fee_bps: number; avg_nonzero_fee_bps: number; est_annual_rev_k: number;
}
interface BancaMarchGroup {
  total_aum_bn: number; total_funds: number; total_classes: number;
  total_est_rev_k: number; effective_rate_bps: number;
}
interface MarketContext {
  inversis_total_aum_bn: number; inversis_total_rev_k: number;
  inversis_book_weighted_avg_bps: number; inversis_book_median_bps: number;
  inversis_book_avg_nonzero_bps: number; total_gestoras_in_book: number;
  march_am_rank_by_aum: number; andbank_weighted_bps: number;
}
interface PeerEntry {
  gestora: string; gestora_short: string; is_march_am: boolean;
  is_inversis_gestion: boolean; is_banca_march_group: boolean;
  aum_m: number; weighted_fee_bps: number; avg_nonzero_fee_bps: number;
  est_annual_rev_k: number; fee_gap_vs_median: number;
  implicit_revenue_shortfall_k: number;
}
interface FundEntry {
  fund: string; gestora: string; classes: number; aum_m: number;
  avg_fee_bps: number; est_annual_rev_k: number; is_zero_fee: boolean;
  shortfall_at_median_k: number;
}
interface Scenario {
  name: string; description: string; weighted_fee_bps: number;
  est_annual_rev_march_am_k: number; delta_vs_status_quo_k: number;
  risk_level: string; group_total_rev_k: number;
}
interface SwitchingRisk {
  classes_to_migrate: number; funds_to_migrate: number;
  group_classes_to_migrate: number; group_funds_to_migrate: number;
  estimated_migration_months: number; estimated_one_time_cost_k: number;
  breakeven_annual_saving_k: number; risk_rating: string; risk_rationale: string;
}
interface QualInsight {
  type: string; severity: string; title: string; body: string;
}
interface FeeBucket {
  label: string; isins: number; aum_bn: number; aum_pct: number;
}
interface PrivatePeer {
  group: string; liquid_aum_m: number; wtd_dep_bps: number; is_march_am: boolean;
}
interface ZeroFeeIsin {
  isin: string; group: string; fund: string; aum_m: number; is_march_am: boolean;
}
interface MarketBenchmarks {
  universe: string; source: string; total_isins: number; total_aum_bn: number;
  march_am_bps: number; march_am_rfecp_bps: number; march_am_percentile: number;
  percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number; wtd_avg: number };
  fee_distribution: FeeBucket[];
  private_bank_peers: PrivatePeer[];
  zero_fee_isins_market: ZeroFeeIsin[];
  bbva_captive_ref_bps: number;
  note: string;
}

const data = rawData as {
  date: string; note: string;
  march_am: MarchAm;
  inversis_gestion: InversisGestion | null;
  banca_march_group: BancaMarchGroup;
  market_context: MarketContext;
  peer_comparison: PeerEntry[];
  march_fund_detail: FundEntry[];
  fee_scenarios: Scenario[];
  switching_risk: SwitchingRisk;
  qualitative_insights: QualInsight[];
  market_benchmarks: MarketBenchmarks;
};

// ── Severity colour map ────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  high: '#ef4444', medium: '#f59e0b',
  low: '#10b981', info: '#3b82f6', opportunity: '#10b981',
};

const RISK_COLOR: Record<string, string> = {
  none: '#555570', very_low: '#10b981', low: '#22c55e',
  low_medium: '#f59e0b', medium: '#f97316',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function aum(m: number) {
  return m >= 1000 ? `€${(m / 1000).toFixed(2)}B` : `€${m.toFixed(0)}M`;
}
function rev(k: number) {
  return k >= 1000 ? `€${(k / 1000).toFixed(2)}M` : `€${k.toFixed(0)}K`;
}
function delta(k: number) {
  if (k === 0) return <span style={{ color: '#555570' }}>—</span>;
  const pos = k > 0;
  return <span style={{ color: pos ? '#10b981' : '#ef4444', fontWeight: 600 }}>
    {pos ? '+' : ''}{rev(k)}
  </span>;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function BancaMarch() {
  const { march_am, inversis_gestion, banca_march_group, market_context,
          peer_comparison, march_fund_detail, fee_scenarios, switching_risk,
          qualitative_insights, market_benchmarks } = data;
  const mCtx = market_context;
  const mb = market_benchmarks;
  const statusQuo = fee_scenarios[0];

  // Tab within the tab
  const [subTab, setSubTab] = useState<'overview' | 'peers' | 'funds' | 'scenarios' | 'risk' | 'market'>('overview');

  const subTabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'peers' as const, label: 'Peer Comparison' },
    { id: 'funds' as const, label: 'Fund Detail' },
    { id: 'scenarios' as const, label: 'Revenue Scenarios' },
    { id: 'risk' as const, label: 'Switching Risk' },
    { id: 'market' as const, label: 'Market Benchmarks' },
  ];

  const peerChartData = peer_comparison
    .filter(p => p.weighted_fee_bps > 0)
    .map(p => ({
      ...p,
      label: p.gestora_short.length > 22 ? p.gestora_short.slice(0, 20) + '..' : p.gestora_short,
    }))
    .sort((a, b) => a.weighted_fee_bps - b.weighted_fee_bps);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Warning Banner ─────────────────────────────────────────────── */}
      <div style={{
        background: '#f59e0b10', border: '1px solid #f59e0b40', borderRadius: 10,
        padding: '12px 20px', display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 18, lineHeight: 1.3 }}>⚠</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', fontFamily: "'Outfit', sans-serif", marginBottom: 3 }}>
            Ownership Change — August 2026
          </div>
          <div style={{ fontSize: 12, color: '#c0a060', lineHeight: 1.6 }}>
            {data.note} This tab analyses the commercial and pricing implications for
            Inversis&apos;s depositary relationship with Banca March group entities.
          </div>
        </div>
      </div>

      {/* ── KPI Row ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard
          title="March AM AUM (Inversis)"
          value={`€${march_am.aum_bn.toFixed(2)}B`}
          subtitle={`${march_am.funds} funds · ${march_am.classes} classes`}
        />
        <KpiCard
          title="Current Weighted Fee"
          value={`${march_am.weighted_fee_bps.toFixed(2)} bps`}
          delta={`Market median: ${mCtx.inversis_book_median_bps.toFixed(1)} bps`}
          deltaPositive={false}
          subtitle="All March AM AUM incl. zero-fee"
        />
        <KpiCard
          title="Est. Annual Revenue"
          value={rev(march_am.est_annual_rev_k)}
          subtitle="Current depositary fee income"
        />
        <KpiCard
          title="Zero-Fee AUM"
          value={`${march_am.zero_fee_aum_pct.toFixed(0)}%`}
          delta={`€${(march_am.zero_fee_aum_m / 1000).toFixed(1)}B at 0 bps`}
          deltaPositive={false}
          subtitle="Intragroup pricing — no market basis"
        />
        <KpiCard
          title="Revenue vs Market Median"
          value={rev(mCtx.inversis_book_median_bps * march_am.aum_bn * 100 - march_am.est_annual_rev_k)}
          delta="Potential uplift at 7 bps"
          deltaPositive={true}
          subtitle="If raised to book median"
        />
      </div>

      {/* ── Group Totals ─────────────────────────────────────────────────── */}
      <div style={{
        background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 20,
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24,
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#555570', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>
            March AM
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b', fontFamily: "'JetBrains Mono', monospace" }}>
            {march_am.weighted_fee_bps.toFixed(2)} bps
          </div>
          <div style={{ fontSize: 11, color: '#8888a0', marginTop: 4 }}>
            {rev(march_am.est_annual_rev_k)}/yr · €{march_am.aum_bn.toFixed(2)}B AUM
          </div>
        </div>
        {inversis_gestion && (
          <div>
            <div style={{ fontSize: 11, color: '#555570', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>
              Inversis Gestión
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981', fontFamily: "'JetBrains Mono', monospace" }}>
              {inversis_gestion.weighted_fee_bps.toFixed(2)} bps
            </div>
            <div style={{ fontSize: 11, color: '#8888a0', marginTop: 4 }}>
              {rev(inversis_gestion.est_annual_rev_k)}/yr · €{inversis_gestion.aum_bn.toFixed(2)}B AUM
            </div>
          </div>
        )}
        <div>
          <div style={{ fontSize: 11, color: '#555570', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>
            Group Combined
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f0', fontFamily: "'JetBrains Mono', monospace" }}>
            {banca_march_group.effective_rate_bps.toFixed(2)} bps
          </div>
          <div style={{ fontSize: 11, color: '#8888a0', marginTop: 4 }}>
            {rev(banca_march_group.total_est_rev_k)}/yr · €{banca_march_group.total_aum_bn.toFixed(2)}B AUM
          </div>
        </div>
      </div>

      {/* ── Sub-tab Navigation ───────────────────────────────────────────── */}
      <div style={{
        background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 10,
        padding: '10px 16px', display: 'flex', gap: 4,
      }}>
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            padding: '6px 16px', borderRadius: 6, border: 'none',
            background: subTab === t.id ? '#f59e0b20' : 'transparent',
            color: subTab === t.id ? '#f59e0b' : '#8888a0',
            fontFamily: "'Outfit', sans-serif", fontSize: 12,
            fontWeight: subTab === t.id ? 600 : 400, cursor: 'pointer',
            borderBottom: subTab === t.id ? '2px solid #f59e0b' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Sub-tab Content ──────────────────────────────────────────────── */}
      {subTab === 'overview' && <OverviewSection
        marchAm={march_am} mCtx={mCtx} statusQuo={statusQuo}
        qualInsights={qualitative_insights}
        peerChartData={peerChartData}
      />}
      {subTab === 'peers' && <PeersSection peers={peer_comparison} mCtx={mCtx} peerChartData={peerChartData} />}
      {subTab === 'funds' && <FundsSection funds={march_fund_detail} mCtx={mCtx} />}
      {subTab === 'scenarios' && <ScenariosSection scenarios={fee_scenarios} marchAm={march_am} mCtx={mCtx} />}
      {subTab === 'risk' && <RiskSection risk={switching_risk} />}
      {subTab === 'market' && <MarketBenchmarksSection mb={mb} marchAm={march_am} bbvaBps={mb.bbva_captive_ref_bps} />}
    </div>
  );
}

// ── Overview Sub-tab ───────────────────────────────────────────────────────
function OverviewSection({ marchAm, mCtx, statusQuo, qualInsights, peerChartData }: {
  marchAm: MarchAm; mCtx: MarketContext; statusQuo: Scenario;
  qualInsights: QualInsight[];
  peerChartData: (PeerEntry & { label: string })[];
}) {
  return (
    <>
      {/* Peer fee chart — context for overview */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader
          title="Weighted Depositary Fee Rate — All Inversis Clients (sorted low→high)"
          source="inversis_depositary_insights_2025Q3.xlsx — Q3 2025"
        />
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={peerChartData} layout="vertical" margin={{ ...CHART_MARGIN, left: 200 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#8888a0' }}
              tickFormatter={(v: number) => `${v.toFixed(1)} bps`} />
            <YAxis dataKey="label" type="category" tick={{ fontSize: 9, fill: '#8888a0' }} width={195} />
            <ReferenceLine x={mCtx.inversis_book_median_bps} stroke="#3b82f6" strokeDasharray="5 3"
              label={{ value: `Median ${mCtx.inversis_book_median_bps.toFixed(1)} bps`, fill: '#3b82f6', fontSize: 10, position: 'insideTopRight' }} />
            <ReferenceLine x={marchAm.weighted_fee_bps} stroke="#f59e0b" strokeDasharray="3 2" />
            <Tooltip
              formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(2)} bps`, 'Wtd Fee']}
              contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8 }}
              labelStyle={{ color: '#e8e8f0' }} itemStyle={{ color: '#c0c0d0' }}
            />
            <Bar dataKey="weighted_fee_bps" radius={[0, 4, 4, 0]}>
              {peerChartData.map((entry, i) => (
                <Cell key={i}
                  fill={entry.is_march_am ? '#f59e0b' : entry.is_inversis_gestion ? '#10b981' : CHART_COLORS[i % CHART_COLORS.length]}
                  fillOpacity={entry.is_banca_march_group ? 1.0 : 0.6}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ marginTop: 8, fontSize: 10, color: '#555570', display: 'flex', gap: 16 }}>
          <span>
            <span style={{ display: 'inline-block', width: 10, height: 10, background: '#f59e0b', borderRadius: 2, marginRight: 4 }} />
            March AM (intragroup)
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 10, height: 10, background: '#10b981', borderRadius: 2, marginRight: 4 }} />
            Inversis Gestión (intragroup)
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 12, height: 2, background: '#3b82f6', marginRight: 4, verticalAlign: 'middle' }} />
            Book median ({mCtx.inversis_book_median_bps.toFixed(1)} bps)
          </span>
        </div>
      </div>

      {/* Qualitative insights grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {qualInsights.map((ins, i) => (
          <InsightCard key={i} title={ins.title} color={SEV_COLOR[ins.severity] || '#3b82f6'}>
            {ins.body}
          </InsightCard>
        ))}
      </div>
    </>
  );
}

// ── Peers Sub-tab ──────────────────────────────────────────────────────────
function PeersSection({ peers, mCtx, peerChartData }: {
  peers: PeerEntry[]; mCtx: MarketContext;
  peerChartData: (PeerEntry & { label: string })[];
}) {
  const sorted = [...peers].sort((a, b) => b.aum_m - a.aum_m);

  return (
    <>
      {/* Revenue shortfall chart */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader
          title="Implicit Revenue Shortfall vs Book Median — Inversis Clients"
          source="inversis_depositary_insights_2025Q3.xlsx | Shortfall = (median bps − wtd fee bps) × AUM"
        />
        <ResponsiveContainer width="100%" height={380}>
          <BarChart
            data={[...peers].sort((a, b) => b.implicit_revenue_shortfall_k - a.implicit_revenue_shortfall_k).map(p => ({
              ...p,
              label: p.gestora_short.length > 22 ? p.gestora_short.slice(0, 20) + '..' : p.gestora_short,
            }))}
            layout="vertical" margin={{ ...CHART_MARGIN, left: 200 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#8888a0' }}
              tickFormatter={(v: number) => v >= 1000 ? `€${(v/1000).toFixed(1)}M` : `€${v.toFixed(0)}K`} />
            <YAxis dataKey="label" type="category" tick={{ fontSize: 9, fill: '#8888a0' }} width={195} />
            <ReferenceLine x={0} stroke="#555570" />
            <Tooltip
              formatter={(v: number | undefined) => [(v ?? 0) >= 1000 ? `€${((v ?? 0)/1000).toFixed(2)}M` : `€${(v ?? 0).toFixed(0)}K`, 'Shortfall vs Median']}
              contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8 }}
              labelStyle={{ color: '#e8e8f0' }} itemStyle={{ color: '#c0c0d0' }}
            />
            <Bar dataKey="implicit_revenue_shortfall_k" radius={[0, 4, 4, 0]}>
              {[...peers].sort((a, b) => b.implicit_revenue_shortfall_k - a.implicit_revenue_shortfall_k).map((entry, i) => (
                <Cell key={i}
                  fill={entry.is_march_am ? '#f59e0b' : entry.implicit_revenue_shortfall_k > 0 ? '#ef4444' : '#10b981'}
                  fillOpacity={entry.is_banca_march_group ? 1.0 : 0.65}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Full peer table */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Fee Comparison — All Inversis Depositary Clients" source="inversis_depositary_insights_2025Q3.xlsx" />
        <DataTable
          data={sorted as unknown as Array<Record<string, unknown>>}
          columns={[
            { key: 'gestora_short', label: 'Gestora', format: (v: unknown, row?: Record<string, unknown>) => {
              const s = String(v);
              const isMarch = Boolean(row?.is_march_am);
              const isInv = Boolean(row?.is_inversis_gestion);
              return (
                <span style={{
                  color: isMarch ? '#f59e0b' : isInv ? '#10b981' : '#e8e8f0',
                  fontWeight: (isMarch || isInv) ? 700 : 400,
                }}>
                  {isMarch && '★ '}{isInv && '◆ '}{s.length > 38 ? s.slice(0, 36) + '..' : s}
                </span>
              );
            }},
            { key: 'aum_m', label: 'AUM', align: 'right' as const,
              format: (v: unknown) => aum(Number(v)) },
            { key: 'avg_nonzero_fee_bps', label: 'Avg Fee (non-zero)', align: 'right' as const,
              format: (v: unknown) => Number(v) > 0 ? `${Number(v).toFixed(2)} bps` : '—' },
            { key: 'weighted_fee_bps', label: 'Wtd Fee (all AUM)', align: 'right' as const,
              format: (v: unknown, row?: Record<string, unknown>) => {
                const bps = Number(v);
                const isMarch = Boolean(row?.is_march_am);
                const median = mCtx.inversis_book_median_bps;
                return (
                  <span style={{ color: isMarch ? '#f59e0b' : bps < median - 1 ? '#ef4444' : bps < median ? '#f59e0b' : '#10b981', fontWeight: isMarch ? 700 : 400 }}>
                    {bps.toFixed(2)} bps
                  </span>
                );
              }},
            { key: 'est_annual_rev_k', label: 'Est. Rev./yr', align: 'right' as const,
              format: (v: unknown) => rev(Number(v)) },
            { key: 'fee_gap_vs_median', label: 'Gap vs Median', align: 'right' as const,
              format: (v: unknown) => {
                const val = Number(v);
                if (Math.abs(val) < 0.05) return <span style={{ color: '#555570' }}>≈0</span>;
                return <span style={{ color: val < 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                  {val > 0 ? '+' : ''}{val.toFixed(2)} bps
                </span>;
              }},
            { key: 'implicit_revenue_shortfall_k', label: 'Rev. Shortfall', align: 'right' as const,
              format: (v: unknown) => {
                const k = Number(v);
                if (k <= 0) return <span style={{ color: '#10b981' }}>At/above median</span>;
                return <span style={{ color: k > 500 ? '#ef4444' : '#f59e0b' }}>{rev(k)}</span>;
              }},
          ]}
          defaultSort="aum_m"
          maxRows={30}
        />
        <div style={{ marginTop: 10, fontSize: 10, color: '#555570' }}>
          ★ = March Asset Management (intragroup) &nbsp;|&nbsp; ◆ = Inversis Gestión (intragroup)
        </div>
      </div>
    </>
  );
}

// ── Funds Sub-tab ──────────────────────────────────────────────────────────
function FundsSection({ funds, mCtx }: { funds: FundEntry[]; mCtx: MarketContext }) {
  const totalAum = funds.reduce((s, f) => s + f.aum_m, 0);
  const zeroFeeAum = funds.filter(f => f.is_zero_fee).reduce((s, f) => s + f.aum_m, 0);
  const totalShortfall = funds.reduce((s, f) => s + f.shortfall_at_median_k, 0);

  return (
    <>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard title="Total Banca March Funds" value={String(funds.length)}
          subtitle={`${aum(totalAum)} total AUM`} />
        <KpiCard title="Zero-Fee Funds" value={String(funds.filter(f => f.is_zero_fee).length)}
          delta={`${aum(zeroFeeAum)} at 0 bps`} deltaPositive={false}
          subtitle="No depositary fee charged" />
        <KpiCard title="Total Shortfall vs Median" value={rev(totalShortfall)}
          delta={`At ${mCtx.inversis_book_median_bps.toFixed(1)} bps market rate`} deltaPositive={false}
          subtitle="Foregone annual revenue" />
      </div>

      {/* Bar chart: AUM by fund, colored by zero-fee */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Banca March Funds — AUM and Deposit Fee" source="inversis_depositary_insights_2025Q3.xlsx" />
        <ResponsiveContainer width="100%" height={Math.max(300, funds.length * 22)}>
          <BarChart
            data={[...funds].sort((a, b) => b.aum_m - a.aum_m).map(f => ({
              ...f,
              label: f.fund.length > 35 ? f.fund.slice(0, 33) + '..' : f.fund,
            }))}
            layout="vertical" margin={{ ...CHART_MARGIN, left: 320 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#8888a0' }}
              tickFormatter={(v: number) => v >= 1000 ? `€${(v/1000).toFixed(1)}B` : `€${v.toFixed(0)}M`} />
            <YAxis dataKey="label" type="category" tick={{ fontSize: 9, fill: '#8888a0' }} width={315} />
            <Tooltip
              formatter={(v: number | undefined, name: string | undefined) => [
                name === 'aum_m' ? aum(v ?? 0) : `${(v ?? 0).toFixed(2)} bps`,
                name === 'aum_m' ? 'AUM' : 'Avg Fee',
              ]}
              contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8 }}
              labelStyle={{ color: '#e8e8f0' }} itemStyle={{ color: '#c0c0d0' }}
            />
            <Bar dataKey="aum_m" radius={[0, 4, 4, 0]}>
              {[...funds].sort((a, b) => b.aum_m - a.aum_m).map((entry, i) => (
                <Cell key={i}
                  fill={entry.is_zero_fee ? '#ef444480' : '#f59e0b'}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ marginTop: 8, fontSize: 10, color: '#555570', display: 'flex', gap: 16 }}>
          <span>
            <span style={{ display: 'inline-block', width: 10, height: 10, background: '#ef4444', borderRadius: 2, marginRight: 4, opacity: 0.5 }} />
            Zero-fee fund (0 bps)
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 10, height: 10, background: '#f59e0b', borderRadius: 2, marginRight: 4 }} />
            Fee-bearing fund
          </span>
        </div>
      </div>

      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Fund-by-Fund Deposit Fee Detail" source="inversis_depositary_insights_2025Q3.xlsx" />
        <DataTable
          data={[...funds].sort((a, b) => b.aum_m - a.aum_m) as unknown as Array<Record<string, unknown>>}
          columns={[
            { key: 'fund', label: 'Fund', format: (v: unknown) => {
              const s = String(v);
              return s.length > 40 ? s.slice(0, 38) + '..' : s;
            }},
            { key: 'gestora', label: 'Gestora', format: (v: unknown) => {
              const s = String(v);
              return s.length > 20 ? s.slice(0, 18) + '..' : s;
            }},
            { key: 'classes', label: 'Classes', align: 'right' as const },
            { key: 'aum_m', label: 'AUM', align: 'right' as const,
              format: (v: unknown) => aum(Number(v)) },
            { key: 'avg_fee_bps', label: 'Avg Fee', align: 'right' as const,
              format: (v: unknown, row?: Record<string, unknown>) => {
                const bps = Number(v);
                const isZero = Boolean(row?.is_zero_fee);
                return isZero
                  ? <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 10, background: '#ef444420', padding: '1px 5px', borderRadius: 3 }}>0 bps</span>
                  : <span>{bps.toFixed(2)} bps</span>;
              }},
            { key: 'est_annual_rev_k', label: 'Est. Rev./yr', align: 'right' as const,
              format: (v: unknown) => {
                const k = Number(v);
                return k > 0 ? rev(k) : <span style={{ color: '#555570' }}>—</span>;
              }},
            { key: 'shortfall_at_median_k', label: 'Shortfall vs Median', align: 'right' as const,
              format: (v: unknown) => {
                const k = Number(v);
                return k > 0
                  ? <span style={{ color: '#f59e0b' }}>{rev(k)}</span>
                  : <span style={{ color: '#10b981', fontSize: 10 }}>At/above median</span>;
              }},
          ]}
          defaultSort="aum_m"
        />
      </div>
    </>
  );
}

// ── Scenarios Sub-tab ──────────────────────────────────────────────────────
function ScenariosSection({ scenarios, marchAm, mCtx }: {
  scenarios: Scenario[]; marchAm: MarchAm; mCtx: MarketContext;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const status_quo_rev = scenarios[0]?.est_annual_rev_march_am_k || 0;

  const chartData = scenarios.map((s, i) => ({
    name: `S${i}`,
    label: s.name.replace('Scenario ', '').replace(' — ', '\n'),
    rev_k: s.est_annual_rev_march_am_k,
    delta_k: s.delta_vs_status_quo_k,
    group_rev_k: s.group_total_rev_k,
    risk: s.risk_level,
    isSelected: selected === i,
  }));

  return (
    <>
      {/* Scenario bar chart */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader
          title="March AM Revenue Scenarios — Annual Depositary Fee Income"
          source="Based on Q3 2025 AUM; click a bar to see details"
        />
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={CHART_MARGIN} barSize={60}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8888a0' }}
              tickFormatter={(v) => chartData.find(d => d.name === v)?.label.split('\n')[0] || v}
            />
            <YAxis tick={{ fontSize: 10, fill: '#8888a0' }}
              tickFormatter={(v: number) => v >= 1000 ? `€${(v/1000).toFixed(1)}M` : `€${v.toFixed(0)}K`} />
            <ReferenceLine y={status_quo_rev} stroke="#555570" strokeDasharray="4 3"
              label={{ value: 'Status quo', fill: '#555570', fontSize: 10, position: 'insideTopLeft' }} />
            <Tooltip
              content={({ payload, label }) => {
                if (!payload?.length) return null;
                const idx = chartData.findIndex(d => d.name === label);
                const s = scenarios[idx];
                if (!s) return null;
                return (
                  <div style={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8, padding: '10px 14px', maxWidth: 280 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#e8e8f0', marginBottom: 6 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#8888a0', marginBottom: 8 }}>{s.description}</div>
                    <div style={{ fontSize: 13, color: '#e8e8f0' }}>March AM rev: {rev(s.est_annual_rev_march_am_k)}/yr</div>
                    {s.delta_vs_status_quo_k !== 0 && (
                      <div style={{ fontSize: 12, color: s.delta_vs_status_quo_k > 0 ? '#10b981' : '#ef4444', marginTop: 4 }}>
                        {s.delta_vs_status_quo_k > 0 ? '+' : ''}{rev(s.delta_vs_status_quo_k)} vs status quo
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#555570', marginTop: 6 }}>
                      Weighted fee: {s.weighted_fee_bps.toFixed(2)} bps
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="rev_k" radius={[4, 4, 0, 0]} cursor="pointer"
              onClick={(_: unknown, idx: number) => setSelected(selected === idx ? null : idx)}>
              {chartData.map((entry, i) => (
                <Cell key={i}
                  fill={i === 0 ? '#555570' : RISK_COLOR[entry.risk] || '#3b82f6'}
                  fillOpacity={selected === null || selected === i ? 1.0 : 0.35}
                  stroke={selected === i ? '#fff' : 'transparent'}
                  strokeWidth={selected === i ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Scenario detail cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {scenarios.map((s, i) => {
          const riskColor = RISK_COLOR[s.risk_level] || '#3b82f6';
          const isStatus = i === 0;
          return (
            <div key={i}
              onClick={() => setSelected(selected === i ? null : i)}
              style={{
                background: selected === i ? '#1e1e30' : '#16161f',
                border: `1px solid ${selected === i ? riskColor : '#2a2a3a'}`,
                borderRadius: 12, padding: 20, cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e8e8f0', fontFamily: "'Outfit', sans-serif" }}>{s.name}</div>
                {!isStatus && (
                  <span style={{
                    fontSize: 9, padding: '2px 7px', borderRadius: 3,
                    background: `${riskColor}20`, color: riskColor, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    {s.risk_level.replace('_', ' ')} risk
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#8888a0', marginBottom: 12, lineHeight: 1.5 }}>{s.description}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#555570', marginBottom: 3 }}>March AM Rev.</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e8f0', fontFamily: "'JetBrains Mono', monospace" }}>
                    {rev(s.est_annual_rev_march_am_k)}
                  </div>
                  <div style={{ fontSize: 10, color: '#555570', marginTop: 2 }}>{s.weighted_fee_bps.toFixed(2)} bps wtd</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#555570', marginBottom: 3 }}>Delta vs Status Quo</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                    {delta(s.delta_vs_status_quo_k)}
                  </div>
                  <div style={{ fontSize: 10, color: '#555570', marginTop: 2 }}>Group total: {rev(s.group_total_rev_k)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Risk Sub-tab ───────────────────────────────────────────────────────────
function RiskSection({ risk }: { risk: SwitchingRisk }) {
  const ratingColor = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' }[risk.risk_rating] || '#3b82f6';

  return (
    <>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard title="Risk Rating" value={risk.risk_rating}
          subtitle="Probability of switching depositario" />
        <KpiCard title="Classes to Migrate" value={String(risk.classes_to_migrate)}
          subtitle={`${risk.funds_to_migrate} funds — each requires CNMV notification`} />
        <KpiCard title="Group-Wide Scope" value={`${risk.group_classes_to_migrate} classes`}
          subtitle={`${risk.group_funds_to_migrate} funds total (March AM + Inversis Gestión)`} />
        <KpiCard title="Migration Timeline" value={`~${risk.estimated_migration_months} mo.`}
          subtitle="Regulatory + operational process" />
        <KpiCard title="One-Time Switch Cost" value={`€${risk.estimated_one_time_cost_k}K`}
          subtitle="Estimated legal + ops + systems" />
        <KpiCard title="Breakeven Saving" value={`€${risk.breakeven_annual_saving_k}K/yr`}
          subtitle="Min saving to justify switching (3yr amortisation)" />
      </div>

      {/* Risk rating banner */}
      <div style={{
        background: `${ratingColor}12`, border: `1px solid ${ratingColor}40`,
        borderRadius: 12, padding: 24,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: ratingColor, fontFamily: "'Outfit', sans-serif", marginBottom: 12 }}>
          Switching Risk Assessment: {risk.risk_rating}
        </div>
        <div style={{ fontSize: 13, color: '#c0c0d0', lineHeight: 1.7 }}>
          {risk.risk_rationale}
        </div>
      </div>

      {/* Switching process timeline */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="What Switching Would Require" source="Regulatory process analysis" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 8 }}>
          {[
            { phase: 'Board Resolution', months: 'Month 1', detail: 'Board approval + CNMV notification of intent to change depositario', color: '#3b82f6' },
            { phase: 'Fund Prospectus Updates', months: 'Months 2–5', detail: `${risk.classes_to_migrate} fund prospectus/KIID updates, one per share class. CNMV review per class`, color: '#8b5cf6' },
            { phase: 'Systems Migration', months: 'Months 4–10', detail: 'Custody records transfer, securities settlement cut-over, reporting integration', color: '#f59e0b' },
            { phase: 'Go-Live', months: `Month ${risk.estimated_migration_months}`, detail: `Full cut-over. Estimated cost: €${risk.estimated_one_time_cost_k}K one-time + ${risk.breakeven_annual_saving_k}K/yr breakeven`, color: '#10b981' },
          ].map((step, i) => (
            <div key={i} style={{ background: '#0a0a12', borderRadius: 8, padding: 16, borderTop: `3px solid ${step.color}` }}>
              <div style={{ fontSize: 10, color: step.color, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {step.phase}
              </div>
              <div style={{ fontSize: 11, color: '#555570', marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>{step.months}</div>
              <div style={{ fontSize: 11, color: '#8888a0', lineHeight: 1.5 }}>{step.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom insight */}
      <InsightCard title="Conclusion: Fee normalisation is feasible with low commercial risk" color="#10b981">
        The combination of high operational switching costs (€{risk.estimated_one_time_cost_k}K+, {risk.estimated_migration_months}-month process),
        regulatory complexity ({risk.classes_to_migrate} individual CNMV filings), and the absence of a credible lower-cost
        alternative in the market for a mandate of this size and complexity means that a phased fee increase
        (Scenarios A → B over 18–24 months) is very unlikely to trigger a depositary change.
        The key risk mitigation is <strong>early communication</strong> — notifying March AM of the repricing
        rationale in Q1 2026 as part of the Euroclear transition, rather than as a post-acquisition surprise.
      </InsightCard>
    </>
  );
}

// ── Market Benchmarks Section ───────────────────────────────────────────────
function MarketBenchmarksSection({
  mb, marchAm, bbvaBps,
}: {
  mb: MarketBenchmarks;
  marchAm: MarchAm;
  bbvaBps: number;
}) {
  const peers = mb.private_bank_peers;
  const dist  = mb.fee_distribution;

  // Colour helper for distribution bars
  const distColor = (label: string) =>
    label === '0 bps' ? '#ef4444' :
    label === '0–2 bps' ? '#f97316' :
    label === '2-5 bps' ? '#f59e0b' :
    label === '5-7 bps' ? '#10b981' :
    '#3b82f6';

  return (
    <>
      {/* ── Context headline ────────────────────────────────────────────── */}
      <InsightCard title="Market Context" color="#ef4444">
        Banca March&apos;s RFECP/M effective deposit rate of <strong>{mb.march_am_rfecp_bps.toFixed(2)} bps</strong> places it
        at the <strong>{mb.march_am_percentile.toFixed(0)}th percentile</strong> of the entire Spanish market
        for short-term fixed income and money market funds ({mb.total_isins} active ISINs, €{mb.total_aum_bn.toFixed(0)}B AUM
        across all depositaries). Even{' '}
        <strong>BBVA depositing its own funds in BBVA</strong> (captive internal arrangement) charges{' '}
        <strong>{bbvaBps.toFixed(1)} bps</strong> — {(bbvaBps / mb.march_am_rfecp_bps).toFixed(0)}× what
        Inversis currently charges Banca March. There are only 8 zero-fee ISINs with real AUM in this
        category across Spain; all 6 with meaningful assets belong to Banca March.
      </InsightCard>

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Market P50', value: `${mb.percentiles.p50.toFixed(1)} bps`, sub: 'Median for M/MCP/RFECP' },
          { label: 'Market P25', value: `${mb.percentiles.p25.toFixed(1)} bps`, sub: '25th percentile' },
          { label: 'Market Wtd Avg', value: `${mb.percentiles.wtd_avg.toFixed(2)} bps`, sub: 'AUM-weighted avg' },
          { label: 'BBVA Captive Rate', value: `${bbvaBps.toFixed(1)} bps`, sub: 'BBVA→BBVA internal pricing' },
        ].map(k => (
          <div key={k.label} style={{
            background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 10, padding: '14px 18px',
          }}>
            <div style={{ fontSize: 11, color: '#555570', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>{k.label}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: '#e8e8f0' }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#8888a0', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Fee distribution chart ──────────────────────────────────────── */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader
          title="Deposit Fee Distribution — RFECP / M / MCP (all Spanish funds)"
          source={mb.source}
        />
        <div style={{ marginBottom: 10, fontSize: 12, color: '#8888a0' }}>
          AUM (€B) by deposit fee bucket · {mb.total_isins} active ISINs · Banca March highlighted in red
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={dist} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8888a0' }} />
            <YAxis tick={{ fontSize: 10, fill: '#8888a0' }}
              tickFormatter={(v: number | undefined) => `€${(v ?? 0).toFixed(1)}B`} />
            <Tooltip
              formatter={(v: number | undefined) => [`€${(v ?? 0).toFixed(2)}B`, 'AUM']}
              contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8 }}
              labelStyle={{ color: '#e8e8f0' }} itemStyle={{ color: '#c0c0d0' }}
            />
            <Bar dataKey="aum_bn" radius={[4, 4, 0, 0]}>
              {dist.map((entry, i) => (
                <Cell key={i} fill={distColor(entry.label)} fillOpacity={0.75} />
              ))}
            </Bar>
            {/* Reference line at March AM position (0 bps) */}
          </BarChart>
        </ResponsiveContainer>
        <div style={{ marginTop: 8, display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 11, color: '#8888a0' }}>
          {dist.map((d, i) => (
            <span key={i}>
              <span style={{ display: 'inline-block', width: 10, height: 10, background: distColor(d.label), borderRadius: 2, marginRight: 4 }} />
              {d.label}: {d.isins} ISINs / €{d.aum_bn.toFixed(1)}B ({d.aum_pct.toFixed(1)}%)
            </span>
          ))}
        </div>
      </div>

      {/* ── Private bank peer comparison ────────────────────────────────── */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader
          title="Private Bank / Boutique Groups — RFECP/M Deposit Fees (All Depositaries)"
          source={mb.source}
        />
        <div style={{ marginBottom: 12, fontSize: 12, color: '#8888a0' }}>
          AUM-weighted deposit fee for liquid fund categories only. Includes groups regardless of depositary used.
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={[...peers].sort((a, b) => a.wtd_dep_bps - b.wtd_dep_bps)}
            layout="vertical" margin={{ ...CHART_MARGIN, left: 140 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#8888a0' }}
              tickFormatter={(v: number | undefined) => `${(v ?? 0).toFixed(1)} bps`} />
            <YAxis dataKey="group" type="category" tick={{ fontSize: 10, fill: '#8888a0' }} width={135} />
            <ReferenceLine x={mb.percentiles.p50} stroke="#3b82f6" strokeDasharray="5 3"
              label={{ value: `Market P50 ${mb.percentiles.p50.toFixed(1)} bps`, fill: '#3b82f6', fontSize: 9, position: 'insideTopRight' }} />
            <ReferenceLine x={bbvaBps} stroke="#6366f1" strokeDasharray="3 2"
              label={{ value: `BBVA captive ${bbvaBps.toFixed(1)} bps`, fill: '#6366f1', fontSize: 9, position: 'insideBottomRight' }} />
            <Tooltip
              formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(2)} bps`, 'Wtd Fee']}
              contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8 }}
              labelStyle={{ color: '#e8e8f0' }} itemStyle={{ color: '#c0c0d0' }}
            />
            <Bar dataKey="wtd_dep_bps" radius={[0, 4, 4, 0]}>
              {[...peers].sort((a, b) => a.wtd_dep_bps - b.wtd_dep_bps).map((entry, i) => (
                <Cell key={i}
                  fill={entry.is_march_am ? '#ef4444' : CHART_COLORS[i % CHART_COLORS.length]}
                  fillOpacity={entry.is_march_am ? 1.0 : 0.65}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Percentile context table ─────────────────────────────────────── */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Market Percentile Context" source="CNMV A2.2 + Inversis Q3-2025" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 8 }}>
          {[
            { label: 'P10', bps: mb.percentiles.p10, note: 'Cheapest decile (incl. bank-internal)' },
            { label: 'P25', bps: mb.percentiles.p25, note: 'Lower quartile' },
            { label: 'P50 Median', bps: mb.percentiles.p50, note: 'Half of market pays less' },
            { label: 'P75', bps: mb.percentiles.p75, note: 'Upper quartile' },
            { label: 'P90', bps: mb.percentiles.p90, note: 'Highest decile' },
            { label: 'Banca March', bps: mb.march_am_rfecp_bps, note: `${mb.march_am_percentile.toFixed(0)}th percentile — sole commercial outlier` },
          ].map(row => (
            <div key={row.label} style={{
              background: '#0a0a0f', borderRadius: 8, padding: '12px 16px',
              border: row.label === 'Banca March' ? '1px solid #ef444450' : '1px solid #2a2a3a',
            }}>
              <div style={{ fontSize: 11, color: row.label === 'Banca March' ? '#ef4444' : '#8888a0', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                {row.label}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: row.label === 'Banca March' ? '#ef4444' : '#e8e8f0' }}>
                {row.bps.toFixed(2)} bps
              </div>
              <div style={{ fontSize: 11, color: '#555570', marginTop: 3 }}>{row.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Zero-fee ISINs across whole market ─────────────────────────── */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Zero-Fee ISINs with AUM — Full Spanish Market (RFECP/M)" source={mb.source} />
        <div style={{ fontSize: 12, color: '#8888a0', marginBottom: 12 }}>
          Only 2 entities have zero-fee RFECP/M classes with positive AUM. The Mutuafondo entry is a
          €3.6M solidarity fund (explicitly charitable purpose). All other zero-fee ISINs with real
          assets belong exclusively to Banca March.
        </div>
        <DataTable
          columns={[
            { key: 'isin', label: 'ISIN', width: 130 },
            { key: 'fund', label: 'Fund', width: 320 },
            { key: 'group', label: 'Group', width: 160 },
            { key: 'aum_m', label: 'AUM (€M)', width: 100, align: 'right',
              format: (v: unknown) => `€${((v as number) ?? 0).toFixed(1)}M` },
            { key: 'is_march_am', label: 'Banca March', width: 110,
              format: (v: unknown) => {
                const isMarch = v as boolean;
                return <span style={{ color: isMarch ? '#ef4444' : '#555570', fontWeight: isMarch ? 700 : 400 }}>{isMarch ? '✓ YES' : '—'}</span>;
              } },
          ]}
          data={mb.zero_fee_isins_market as unknown as Record<string, unknown>[]}
        />
      </div>
    </>
  );
}
