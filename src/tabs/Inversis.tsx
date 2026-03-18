import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line,
} from 'recharts';
import KpiCard from '../components/KpiCard';
import SectionHeader from '../components/SectionHeader';
import InsightCard from '../components/InsightCard';
import DataTable from '../components/DataTable';
import ChartTooltip from '../components/ChartTooltip';
import { CHART_COLORS, CHART_MARGIN } from '../theme';
import rawData from '../data/inversis.json';
import feesData from '../data/cnmv_fees.json';
import depoData from '../data/cnmv_depositaria.json';

/* ── Types ──────────────────────────────────────────────────────── */

interface ByGestora {
  gestora: string; gestora_short: string;
  classes: number; funds: number; aum_m: number;
  wtd_fee_bps: number; est_rev_k: number; investors: number;
}
interface ByGroup {
  group: string; gestoras: number; classes: number; funds: number;
  aum_m: number; est_rev_k: number;
}
interface MarketRankEntry {
  rank: number; depositario: string; depositario_short: string;
  aum_bn: number; market_share_pct: number;
  fund_count: number; class_count: number; is_inversis: boolean;
}
interface AumPoint { label: string; aum_bn: number; }
interface SicavEntry {
  rank: number; group: string; gestora: string;
  aum_m: number; count: number; shareholders: number;
}
interface OpportunityTarget {
  gestora: string; gestora_short: string;
  current_depositario: string; grupo: string;
  aum_m: number; fund_count: number;
  avg_fee_bps: number; potential_rev_k: number; is_captive: boolean;
}
interface RadarPoint { metric: string; inversis: number; market_avg: number; top_peer: number; }

const d = rawData as {
  date: string;
  depositary: {
    aum_bn: number; class_count: number; fund_count: number; gestora_count: number;
    market_share_pct: number; rank_aum: number; rank_gestoras: number;
    wtd_fee_bps: number; est_annual_rev_m: number;
    by_gestora: ByGestora[]; by_group: ByGroup[]; market_ranking: MarketRankEntry[];
  };
  gestora: {
    name: string; aum_bn: number; growth_1y: number | null; growth_ytd: number | null;
    fund_count: number; class_count: number; fee_bps_paid: number; est_rev_k: number;
    aum_series: AumPoint[];
  };
  sicav: {
    total_market_aum_bn: number; total_market_count: number; total_shareholders: number;
    inversis_gestora_aum_m: number; inversis_gestora_count: number;
    market_ranking: SicavEntry[];
  };
  market_context: {
    total_depositario_aum_bn: number; total_depositarios: number; inv_avg_fee_bps: number;
    mkt_dep_fee_p25_bps: number; mkt_dep_fee_p50_bps: number; mkt_dep_fee_p75_bps: number;
  };
  opportunity: {
    addressable_aum_bn: number; target_gestoras_count: number;
    potential_revenue_m: number; targets: OpportunityTarget[];
  };
  positioning: { radar: RadarPoint[] };
};

/* ── CNMV raw data for Market Scan ──────────────────────────────── */

interface FundClass {
  isin: string; fund_name: string; gestora: string; grupo: string;
  category: string; share_class: string; patrimonio_m: number;
  investors: number; depositary_fee: number;
  [key: string]: unknown;
}
interface GestoraDepo {
  gestora: string; depositario: string;
  is_inversis: boolean;
  [key: string]: unknown;
}
const allClasses = feesData.funds as FundClass[];
const gestoraDepoRelations = depoData.gestora_depositario as GestoraDepo[];

interface GestoraFeeGap {
  gestora: string; aum_bn: number;
  actual_fee_bps: number; fair_fee_bps: number; fee_gap_bps: number;
  overpayment_k: number; is_inversis: boolean; current_depo: string;
}

function useMarketScan() {
  return useMemo(() => {
    // 1. Category benchmarks: median depositary fee per category across gestoras
    const catGestoraFees = new Map<string, Map<string, { aum_m: number; fee_aum: number }>>();
    for (const c of allClasses) {
      if (!catGestoraFees.has(c.category)) catGestoraFees.set(c.category, new Map());
      const gMap = catGestoraFees.get(c.category)!;
      const entry = gMap.get(c.gestora) ?? { aum_m: 0, fee_aum: 0 };
      entry.aum_m += c.patrimonio_m;
      entry.fee_aum += c.patrimonio_m * c.depositary_fee;
      gMap.set(c.gestora, entry);
    }

    const benchmarkMap = new Map<string, number>();
    for (const [cat, gMap] of catGestoraFees) {
      const gestoraFees: number[] = [];
      for (const [, v] of gMap) {
        if (v.aum_m > 0) gestoraFees.push((v.fee_aum / v.aum_m) * 100);
      }
      if (gestoraFees.length === 0) continue;
      const sorted = [...gestoraFees].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      benchmarkMap.set(cat, sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]);
    }

    // 2. Per-gestora: actual vs fair fee
    const gestoraMap = new Map<string, { aum_m: number; fee_aum: number; cat_aums: Map<string, number> }>();
    for (const c of allClasses) {
      const entry = gestoraMap.get(c.gestora) ?? { aum_m: 0, fee_aum: 0, cat_aums: new Map() };
      entry.aum_m += c.patrimonio_m;
      entry.fee_aum += c.patrimonio_m * c.depositary_fee;
      entry.cat_aums.set(c.category, (entry.cat_aums.get(c.category) ?? 0) + c.patrimonio_m);
      gestoraMap.set(c.gestora, entry);
    }

    const allGaps: GestoraFeeGap[] = [];
    for (const [gestora, data] of gestoraMap) {
      if (data.aum_m <= 0) continue;
      const actualBps = (data.fee_aum / data.aum_m) * 100;
      let fairFeeWeighted = 0;
      for (const [cat, catAum] of data.cat_aums) {
        fairFeeWeighted += catAum * (benchmarkMap.get(cat) ?? 0);
      }
      const fairBps = fairFeeWeighted / data.aum_m;
      const gapBps = actualBps - fairBps;
      const overpaymentK = (data.aum_m * gapBps / 100) * 10;

      const depoRel = gestoraDepoRelations.find(g => g.gestora === gestora);
      allGaps.push({
        gestora, aum_bn: +(data.aum_m / 1000).toFixed(2),
        actual_fee_bps: +actualBps.toFixed(2), fair_fee_bps: +fairBps.toFixed(2),
        fee_gap_bps: +gapBps.toFixed(2), overpayment_k: +overpaymentK.toFixed(0),
        is_inversis: depoRel?.is_inversis ?? false,
        current_depo: depoRel?.depositario?.split(',')[0] ?? 'Unknown',
      });
    }

    const targets = allGaps.filter(g => !g.is_inversis && g.fee_gap_bps > 0.5).sort((a, b) => b.overpayment_k - a.overpayment_k);
    const inversisClients = allGaps.filter(g => g.is_inversis);
    const inversisAtRisk = inversisClients.filter(g => g.fee_gap_bps > 0.5).sort((a, b) => b.overpayment_k - a.overpayment_k);
    const inversisRepriceable = inversisClients.filter(g => g.fee_gap_bps < -0.5).sort((a, b) => a.overpayment_k - b.overpayment_k);

    return { targets, inversisAtRisk, inversisRepriceable };
  }, []);
}

/* ── Helpers ─────────────────────────────────────────────────────── */
const fmtB   = (v: number) => `€${v.toFixed(2)}B`;
const fmtM   = (v: number) => `€${v.toFixed(1)}M`;
const fmtK   = (k: number) => k >= 1000 ? `€${(k / 1000).toFixed(2)}M` : `€${k.toFixed(0)}K`;
const fmtBps = (v: number) => `${v.toFixed(2)} bps`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const num    = (v: number) => v.toLocaleString('es-ES');

const INVERSIS_RED = '#d42030';
const INVERSIS_RED_DIM = '#d4203040';

/* ── Sub-tab config ──────────────────────────────────────────────── */
const SUB_TABS = [
  { id: 'overview',    label: 'Overview'        },
  { id: 'depositary',  label: 'Depositary Book' },
  { id: 'market',      label: 'Market Position' },
  { id: 'marketscan',  label: 'Market Scan'     },
  { id: 'gestora',     label: 'Gestora'         },
  { id: 'sicav',       label: 'SICAVs'          },
  { id: 'pipeline',    label: 'Pipeline'        },
] as const;
type SubTab = (typeof SUB_TABS)[number]['id'];

/* ── Overview ────────────────────────────────────────────────────── */
function OverviewSection() {
  const dep  = d.depositary;
  const gest = d.gestora;
  const mc   = d.market_context;
  const opp  = d.opportunity;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Headline KPIs */}
      <div>
        <SectionHeader title="Depositary Business" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <KpiCard title="Depositary AUM"      value={fmtB(dep.aum_bn)}              subtitle="Banco Inversis book" />
          <KpiCard title="Market Share"        value={fmtPct(dep.market_share_pct)}  subtitle={`Rank #${dep.rank_aum} by AUM`} />
          <KpiCard title="Rank by Gestoras"    value={`#${dep.rank_gestoras}`}        subtitle="2nd most clients in Spain" />
          <KpiCard title="Active Clients"      value={`${dep.gestora_count}`}         subtitle="gestoras in custody" />
          <KpiCard title="Funds in Custody"    value={`${dep.fund_count}`}            subtitle={`${dep.class_count} share classes`} />
          <KpiCard title="Est. Revenue"        value={`€${dep.est_annual_rev_m.toFixed(2)}M`} subtitle="annual depositary fees" />
        </div>
      </div>

      <div>
        <SectionHeader title="Gestora Business" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <KpiCard title="Inversis Gestión AUM"  value={fmtB(gest.aum_bn)}    subtitle="under management" />
          <KpiCard title="Growth 1Y"             value={gest.growth_1y != null ? fmtPct(gest.growth_1y) : 'N/A'}
                   subtitle="Inversis Gestión" />
          <KpiCard title="Funds Managed"         value={`${gest.fund_count}`}  subtitle={`${gest.class_count} share classes`} />
          <KpiCard title="Fee Paid (Depositary)" value={fmtBps(gest.fee_bps_paid)} subtitle="as a client of Inversis Bank" />
        </div>
      </div>

      {/* Competitive positioning radar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <SectionHeader title="Competitive Positioning" />
          <div style={{ background: '#16161f', borderRadius: 8, padding: 16, border: '1px solid #2a2a3a' }}>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={d.positioning.radar} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="#2a2a3a" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#8888a0', fontSize: 11, fontFamily: "'Outfit', sans-serif" }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Inversis"    dataKey="inversis"   stroke={INVERSIS_RED} fill={INVERSIS_RED}  fillOpacity={0.25} strokeWidth={2} />
                <Radar name="Market Avg"  dataKey="market_avg" stroke="#8888a0"      fill="#8888a0"       fillOpacity={0.1}  strokeWidth={1} strokeDasharray="4 4" />
                <Radar name="Top Peer"    dataKey="top_peer"   stroke="#f59e0b"      fill="#f59e0b"       fillOpacity={0.1}  strokeWidth={1} />
              </RadarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
              {[
                { color: INVERSIS_RED, label: 'Inversis' },
                { color: '#8888a0',    label: 'Market Avg' },
                { color: '#f59e0b',    label: 'Top Peer' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                  <span style={{ fontSize: 11, color: '#8888a0', fontFamily: "'Outfit', sans-serif" }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Market context */}
        <div>
          <SectionHeader title="Market Context" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <InsightCard title="Technology & Independence Leader" color="#d42030">
              Inversis scores highest on <strong>Technology</strong> and <strong>Independence</strong> — key
              differentiators that resonate with independent gestoras seeking a non-captive depositary.
            </InsightCard>
            <InsightCard title="Depositary Market — Non-Captive Leader" color="#3b82f6">
              Inversis is the <strong>#2 depositary by gestoras served</strong> (25 clients) despite being
              #6 by AUM. This reflects a deliberate focus on independent, mid-size gestoras rather than competing
              head-on with Cecabank (44.7% share) or CACEIS (19.5%).
            </InsightCard>
            <InsightCard title="Fee Positioning" color="#10b981">
              Inversis average fee <strong>{fmtBps(mc.inv_avg_fee_bps)}</strong> sits near market median
              ({fmtBps(mc.mkt_dep_fee_p50_bps)}). Addressable non-captive AUM: <strong>{fmtB(opp.addressable_aum_bn)}</strong>.
            </InsightCard>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Depositary Book ─────────────────────────────────────────────── */
function DepositarySection() {
  const dep = d.depositary;
  const totalRev = dep.by_gestora.reduce((s, g) => s + g.est_rev_k, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* By-group bar chart */}
      <div>
        <SectionHeader title="AUM by Client Group" />
        <div style={{ background: '#16161f', borderRadius: 8, padding: 16, border: '1px solid #2a2a3a' }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dep.by_group} layout="vertical" margin={{ top: 4, right: 80, left: 130, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#8888a0', fontSize: 10 }}
                     tickFormatter={v => `€${(v / 1000).toFixed(1)}B`} />
              <YAxis type="category" dataKey="group" tick={{ fill: '#c8c8d8', fontSize: 11 }} width={120} />
              <Tooltip content={<ChartTooltip prefix="€" suffix="M" decimals={1} />} />
              <Bar dataKey="aum_m" radius={[0, 4, 4, 0]}>
                {dep.by_group.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Client gestora table */}
      <div>
        <SectionHeader title="Client Gestoras — Full Book" />
        <DataTable
          columns={[
            { key: 'gestora_short', label: 'Gestora' },
            { key: 'funds',        label: 'Funds',    align: 'right' as const },
            { key: 'classes',      label: 'Classes',  align: 'right' as const },
            { key: 'investors',    label: 'Investors',align: 'right' as const, format: (v: unknown) => num(Number(v)) },
            { key: 'aum_m',        label: 'AUM',      align: 'right' as const, format: (v: unknown) => fmtM(Number(v)) },
            { key: 'wtd_fee_bps',  label: 'Fee (bps)',align: 'right' as const, format: (v: unknown) => Number(v).toFixed(2) },
            { key: 'est_rev_k',    label: 'Est. Revenue', align: 'right' as const, format: (v: unknown) => fmtK(Number(v)) },
          ]}
          data={dep.by_gestora as unknown as Record<string, unknown>[]}
        />
      </div>

      {/* Revenue summary */}
      <div>
        <SectionHeader title="Revenue Breakdown" />
        <div style={{ background: '#16161f', borderRadius: 8, padding: 16, border: '1px solid #2a2a3a' }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dep.by_gestora.slice(0, 12)} margin={{ top: 4, right: 20, left: 20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
              <XAxis dataKey="gestora_short" tick={{ fill: '#8888a0', fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
                     angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#8888a0', fontSize: 10 }} tickFormatter={v => `€${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<ChartTooltip prefix="€" suffix="K" decimals={0} />} />
              <Bar dataKey="est_rev_k" radius={[4, 4, 0, 0]}>
                {dep.by_gestora.slice(0, 12).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#8888a0', fontFamily: "'Outfit', sans-serif" }}>
            Total estimated annual depositary revenue: <strong style={{ color: '#e8e8f0' }}>{fmtK(totalRev)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Market Position ─────────────────────────────────────────────── */
function MarketSection() {
  const dep = d.depositary;
  const mc  = d.market_context;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Market summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        <KpiCard title="Total Market AUM" value={fmtB(mc.total_depositario_aum_bn)} subtitle="all depositarios" />
        <KpiCard title="Inversis Share"   value={fmtPct(dep.market_share_pct)}      subtitle={`Rank #${dep.rank_aum}`} />
        <KpiCard title="Rank by Clients"  value={`#${dep.rank_gestoras}`}            subtitle="gestoras served" />
        <KpiCard title="Mkt Fee Median"   value={fmtBps(mc.mkt_dep_fee_p50_bps)}    subtitle="depositario avg" />
        <KpiCard title="Inversis Avg Fee" value={fmtBps(mc.inv_avg_fee_bps)}         subtitle="vs median" />
      </div>

      {/* Depositario AUM ranking */}
      <div>
        <SectionHeader title="Depositario Market Ranking by AUM" />
        <div style={{ background: '#16161f', borderRadius: 8, padding: 16, border: '1px solid #2a2a3a' }}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={dep.market_ranking} layout="vertical"
                      margin={{ top: 4, right: 100, left: 180, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#8888a0', fontSize: 10 }}
                     tickFormatter={v => `€${v.toFixed(0)}B`} />
              <YAxis type="category" dataKey="depositario_short"
                     tick={{ fill: '#c8c8d8', fontSize: 11 }} width={170} />
              <Tooltip content={<ChartTooltip prefix="€" suffix="B" decimals={2} />} />
              <Bar dataKey="aum_bn" radius={[0, 4, 4, 0]} label={{
                position: 'right',
                formatter: (v: unknown) => `${d.depositary.market_ranking.find(r => r.aum_bn === (v as number))?.market_share_pct?.toFixed(1) ?? ''}%`,
                fill: '#8888a0', fontSize: 10,
              } as Record<string, unknown>}>
                {dep.market_ranking.map((r, i) => (
                  <Cell key={i} fill={r.is_inversis ? INVERSIS_RED : '#2a2a4a'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fee comparison */}
      <div>
        <SectionHeader title="Depositary Fee Comparison" />
        <div style={{ background: '#16161f', borderRadius: 8, padding: 20, border: '1px solid #2a2a3a' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Market P25',    bps: mc.mkt_dep_fee_p25_bps, color: '#3b82f6' },
              { label: 'Market Median', bps: mc.mkt_dep_fee_p50_bps, color: '#8888a0' },
              { label: 'Inversis Avg',  bps: mc.inv_avg_fee_bps,     color: INVERSIS_RED },
              { label: 'Market P75',    bps: mc.mkt_dep_fee_p75_bps, color: '#f59e0b' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 120, fontSize: 12, color: '#8888a0', fontFamily: "'JetBrains Mono', monospace" }}>
                  {item.label}
                </span>
                <div style={{ flex: 1, background: '#0d0d15', borderRadius: 4, height: 20, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min((item.bps / 15) * 100, 100)}%`,
                    height: '100%',
                    background: item.color,
                    borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6,
                  }}>
                    <span style={{ fontSize: 10, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>
                      {item.bps.toFixed(1)} bps
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 12, color: '#8888a0', fontFamily: "'Outfit', sans-serif", lineHeight: 1.6 }}>
            Inversis's average depositary fee sits near the market median, reflecting a competitive
            positioning that balances attractiveness to independent gestoras with sustainable economics.
            The range spans from highly captive/subsidised arrangements to premium boutique pricing.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Gestora ─────────────────────────────────────────────────────── */
function GestoraSection() {
  const g = d.gestora;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        <KpiCard title="AUM (Gestora)"    value={fmtB(g.aum_bn)}    subtitle="Inversis Gestión" />
        <KpiCard title="Growth 1Y"        value={g.growth_1y != null ? fmtPct(g.growth_1y) : 'N/A'} subtitle="year-on-year" />
        <KpiCard title="Growth YTD"       value={g.growth_ytd != null ? fmtPct(g.growth_ytd) : 'N/A'} subtitle="year-to-date" />
        <KpiCard title="Funds"            value={`${g.fund_count}`}  subtitle={`${g.class_count} share classes`} />
        <KpiCard title="Fee Paid"         value={fmtBps(g.fee_bps_paid)} subtitle="depositary fee paid to Inversis Bank" />
      </div>

      {/* AUM time series */}
      {g.aum_series.length > 0 && (
        <div>
          <SectionHeader title="Inversis Gestión — AUM Time Series" />
          <div style={{ background: '#16161f', borderRadius: 8, padding: 16, border: '1px solid #2a2a3a' }}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={g.aum_series} margin={{ top: 8, right: 24, left: 12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis dataKey="label" tick={{ fill: '#8888a0', fontSize: 10 }}
                       interval={g.aum_series.length > 0 ? Math.floor(g.aum_series.length / 6) : 0} />
                <YAxis tick={{ fill: '#8888a0', fontSize: 10 }}
                       tickFormatter={v => `€${(v * 1000).toFixed(0)}M`}
                       domain={['auto', 'auto']} />
                <Tooltip content={<ChartTooltip prefix="€" suffix="B" decimals={3} />} />
                <Line
                  type="monotone" dataKey="aum_bn" stroke={INVERSIS_RED} strokeWidth={2.5}
                  dot={{ fill: INVERSIS_RED, r: 3 }} activeDot={{ r: 5 }}
                  name="AUM (€M)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div>
        <InsightCard title="Dual Entity Structure" color="#f59e0b">
          Inversis operates two distinct legal entities: <strong>Banco Inversis, S.A.</strong> (the depositary /
          custody bank) and <strong>Inversis Gestión, S.A., SGIIC</strong> (the fund management company). Both
          sit within the same group, historically under Banca March. Following the Euroclear acquisition
          (Aug 2026), the group structure is evolving.
        </InsightCard>
      </div>
    </div>
  );
}

/* ── SICAVs ──────────────────────────────────────────────────────── */
function SicavSection() {
  const s  = d.sicav;
  const invSharePct = s.total_market_aum_bn > 0
    ? (s.inversis_gestora_aum_m / (s.total_market_aum_bn * 1000) * 100)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <SectionHeader title="SICAV Market Overview" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <KpiCard title="Total SICAV Market"    value={fmtB(s.total_market_aum_bn)}  subtitle="Spain total AUM" />
          <KpiCard title="Number of SICAVs"      value={num(s.total_market_count)}     subtitle="active vehicles" />
          <KpiCard title="Total Shareholders"    value={num(s.total_shareholders)}     subtitle="accionistas" />
          <KpiCard title="Inversis Gestión AUM"  value={fmtM(s.inversis_gestora_aum_m)} subtitle={`${s.inversis_gestora_count} SICAVs managed`} />
          <KpiCard title="Gestora Market Share"  value={fmtPct(invSharePct)}           subtitle="of SICAV market by AUM" />
        </div>
      </div>

      {/* Group ranking */}
      <div>
        <SectionHeader title="SICAV Ranking by Group" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#16161f', borderRadius: 8, padding: 16, border: '1px solid #2a2a3a' }}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={s.market_ranking.slice(0, 15)} layout="vertical"
                        margin={{ top: 4, right: 60, left: 130, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#8888a0', fontSize: 10 }}
                       tickFormatter={v => `€${(v / 1000).toFixed(0)}M`} />
                <YAxis type="category" dataKey="group" tick={{ fill: '#c8c8d8', fontSize: 11 }} width={120} />
                <Tooltip content={<ChartTooltip prefix="€" suffix="M" decimals={1} />} />
                <Bar dataKey="aum_m" radius={[0, 4, 4, 0]}>
                  {s.market_ranking.slice(0, 15).map((r, i) => (
                    <Cell key={i}
                      fill={r.group.includes('MARCH') && r.gestora.includes('INVERSIS')
                        ? INVERSIS_RED
                        : CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* SICAV table */}
          <DataTable
            columns={[
              { key: 'rank',         label: '#',           align: 'right' as const },
              { key: 'group',        label: 'Group'                                },
              { key: 'aum_m',        label: 'AUM',         align: 'right' as const, format: (v: unknown) => `€${(Number(v) / 1000).toFixed(2)}B` },
              { key: 'count',        label: 'SICAVs',      align: 'right' as const },
              { key: 'shareholders', label: 'Accionistas', align: 'right' as const, format: (v: unknown) => num(Number(v)) },
            ]}
            data={s.market_ranking.slice(0, 20) as unknown as Record<string, unknown>[]}
          />
        </div>
      </div>

      <InsightCard title="SICAV Context" color="#3b82f6">
        The Spanish SICAV market ({num(s.total_market_count)} vehicles, {fmtB(s.total_market_aum_bn)}) is dominated
        by large private banking groups. Inversis Gestión manages <strong>{s.inversis_gestora_count} SICAVs
        ({fmtM(s.inversis_gestora_aum_m)} AUM)</strong>, principally for Banca March group clients.
        SICAV custody (depositaria services) for third-party SICAVs represents an additional revenue opportunity
        not fully captured in the depositary fund book data above.
      </InsightCard>
    </div>
  );
}

/* ── Pipeline ────────────────────────────────────────────────────── */
function PipelineSection() {
  const opp = d.opportunity;
  const nc  = opp.targets.filter(t => !t.is_captive);
  const cap = opp.targets.filter(t => t.is_captive);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        <KpiCard title="Addressable AUM"     value={fmtB(opp.addressable_aum_bn)} subtitle="non-captive not yet Inversis clients" />
        <KpiCard title="Target Gestoras"     value={`${nc.length}`}               subtitle="non-captive opportunities" />
        <KpiCard title="Potential Revenue"   value={`€${opp.potential_revenue_m.toFixed(1)}M`} subtitle="at current avg fee" />
        <KpiCard title="Captive (Defended)"  value={`${cap.length}`}              subtitle="captive bank relationships" />
      </div>

      {/* Non-captive targets */}
      <div>
        <SectionHeader title="Non-Captive Opportunity Targets" />
        <DataTable
          columns={[
            { key: 'gestora_short',        label: 'Gestora'                                                          },
            { key: 'current_depositario',  label: 'Current Depositary'                                               },
            { key: 'aum_m',                label: 'AUM',          align: 'right' as const, format: (v: unknown) => fmtM(Number(v)) },
            { key: 'fund_count',           label: 'Funds',        align: 'right' as const                            },
            { key: 'avg_fee_bps',          label: 'Curr Fee',     align: 'right' as const, format: (v: unknown) => `${Number(v).toFixed(1)} bps` },
            { key: 'potential_rev_k',      label: 'Pot. Revenue', align: 'right' as const, format: (v: unknown) => fmtK(Number(v)) },
          ]}
          data={nc as unknown as Record<string, unknown>[]}
        />
      </div>

      <InsightCard title="Business Development Priority" color="#d42030">
        The <strong>{fmtB(opp.addressable_aum_bn)} addressable market</strong> represents gestoras
        currently using other depositaries that are not locked into a captive parent-bank relationship.
        The highest-value targets are independent gestoras with €1B+ AUM already at non-captive
        depositaries — particularly those at Cecabank or CACEIS where Inversis can compete on
        technology, independence, and service quality.
      </InsightCard>
    </div>
  );
}

/* ── Market Scan ────────────────────────────────────────────────── */
function MarketScanSection({ targets, inversisAtRisk, inversisRepriceable }: {
  targets: GestoraFeeGap[];
  inversisAtRisk: GestoraFeeGap[];
  inversisRepriceable: GestoraFeeGap[];
}) {
  const totalTargetRev = targets.reduce((s, g) => s + g.overpayment_k, 0);
  const totalAtRiskRev = inversisAtRisk.reduce((s, g) => s + g.overpayment_k, 0);
  const totalRepriceRev = inversisRepriceable.reduce((s, g) => s + Math.abs(g.overpayment_k), 0);

  const targetColumns = [
    { key: 'gestora', label: 'Gestora', format: (v: unknown) => { const s = String(v); return s.length > 35 ? s.slice(0, 33) + '…' : s; } },
    { key: 'current_depo', label: 'Depositary' },
    { key: 'aum_bn', label: 'AUM', align: 'right' as const, format: (v: unknown) => `€${Number(v).toFixed(1)}B` },
    { key: 'actual_fee_bps', label: 'Actual', align: 'right' as const, format: (v: unknown) => `${Number(v).toFixed(1)} bps` },
    { key: 'fair_fee_bps', label: 'Fair Fee', align: 'right' as const, format: (v: unknown) => `${Number(v).toFixed(1)} bps` },
    { key: 'fee_gap_bps', label: 'Gap', align: 'right' as const, heatmap: true, format: (v: unknown) => {
      const n = Number(v);
      return <span style={{ color: n > 0 ? '#ef4444' : '#10b981' }}>{n > 0 ? '+' : ''}{n.toFixed(1)} bps</span>;
    }},
    { key: 'overpayment_k', label: 'Overpaying', align: 'right' as const, format: (v: unknown) => fmtK(Number(v)) },
  ];

  const inversisColumns = [
    { key: 'gestora', label: 'Client', format: (v: unknown) => { const s = String(v); return s.length > 35 ? s.slice(0, 33) + '…' : s; } },
    { key: 'aum_bn', label: 'AUM', align: 'right' as const, format: (v: unknown) => `€${Number(v).toFixed(1)}B` },
    { key: 'actual_fee_bps', label: 'Actual', align: 'right' as const, format: (v: unknown) => `${Number(v).toFixed(1)} bps` },
    { key: 'fair_fee_bps', label: 'Fair Fee', align: 'right' as const, format: (v: unknown) => `${Number(v).toFixed(1)} bps` },
    { key: 'fee_gap_bps', label: 'Gap', align: 'right' as const, format: (v: unknown) => {
      const n = Number(v);
      return <span style={{ color: n > 0 ? '#ef4444' : '#10b981' }}>{n > 0 ? '+' : ''}{n.toFixed(1)} bps</span>;
    }},
    { key: 'overpayment_k', label: 'Impact', align: 'right' as const, format: (v: unknown) => {
      const n = Number(v);
      return <span style={{ color: n > 0 ? '#ef4444' : '#10b981' }}>{n > 0 ? '+' : ''}{fmtK(Math.abs(n))}</span>;
    }},
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <KpiCard title="Prospect Targets" value={String(targets.length)}
          subtitle={`Overpaying ~${fmtK(totalTargetRev)}/yr total`} />
        <KpiCard title="Inversis At Risk" value={String(inversisAtRisk.length)}
          subtitle={`Overpaying ~${fmtK(totalAtRiskRev)}/yr vs fair`} />
        <KpiCard title="Inversis Repriceable" value={String(inversisRepriceable.length)}
          subtitle={`Underpaying ~${fmtK(totalRepriceRev)}/yr vs fair`} />
      </div>

      <InsightCard title="Category-Adjusted Market Scan" color="#f59e0b">
        Each gestora's <strong>actual depositary fee</strong> is compared against a <strong>category-adjusted fair fee</strong> —
        the AUM-weighted median depositary fee per fund category. Gestoras overpaying for their portfolio type are prospect targets;
        Inversis clients overpaying are at risk of switching; those underpaying represent repricing opportunity.
      </InsightCard>

      {/* Prospect Targets */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title={`Prospect Targets — Non-Inversis Gestoras Overpaying (${targets.length})`} source="CNMV A2.2 · Category-adjusted" />
        {targets.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={Math.min(500, Math.max(200, targets.slice(0, 15).length * 32))}>
              <BarChart data={targets.slice(0, 15)} layout="vertical" margin={{ ...CHART_MARGIN, left: 200 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis type="number" tickFormatter={v => fmtK(v)}
                  tick={{ fill: '#8888a0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
                <YAxis type="category" dataKey="gestora" width={195}
                  tickFormatter={(v: string) => v.length > 28 ? v.slice(0, 26) + '..' : v}
                  tick={{ fill: '#8888a0', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const g = payload[0].payload as GestoraFeeGap;
                  return (
                    <div style={{ background: '#1e1e2a', border: '1px solid #3a3a4a', borderRadius: 8, padding: '10px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                      <div style={{ color: '#e8e8f0', fontWeight: 600, marginBottom: 4 }}>{g.gestora}</div>
                      <div style={{ color: '#8888a0' }}>AUM: €{g.aum_bn.toFixed(1)}B · Depo: {g.current_depo}</div>
                      <div style={{ color: '#ef4444', marginTop: 4 }}>Overpaying {fmtK(g.overpayment_k)}/yr (+{g.fee_gap_bps.toFixed(1)} bps vs fair)</div>
                    </div>
                  );
                }} />
                <Bar dataKey="overpayment_k" radius={[0, 4, 4, 0]}>
                  {targets.slice(0, 15).map((t, i) => (
                    <Cell key={`${t.gestora}-${i}`} fill="#ef4444" opacity={0.7 + (0.3 * (1 - i / 15))} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <DataTable data={targets as unknown as Record<string, unknown>[]} columns={targetColumns} defaultSort="overpayment_k" maxRows={30} />
          </>
        ) : (
          <div style={{ color: '#555570', textAlign: 'center', padding: 24 }}>No gestoras significantly overpaying vs category benchmark</div>
        )}
      </div>

      {/* Inversis Book Health */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: '#ef444410', border: '1px solid #ef444430', borderRadius: 12, padding: 24 }}>
          <SectionHeader title={`Inversis Clients At Risk (${inversisAtRisk.length})`} source="Overpaying vs category-adjusted fair fee" />
          {inversisAtRisk.length > 0 ? (
            <DataTable data={inversisAtRisk as unknown as Record<string, unknown>[]} columns={inversisColumns} defaultSort="overpayment_k" maxRows={20} />
          ) : (
            <div style={{ color: '#555570', textAlign: 'center', padding: 24 }}>No Inversis clients significantly overpaying</div>
          )}
        </div>
        <div style={{ background: '#10b98110', border: '1px solid #10b98130', borderRadius: 12, padding: 24 }}>
          <SectionHeader title={`Inversis Repriceable (${inversisRepriceable.length})`} source="Underpaying vs category-adjusted fair fee" />
          {inversisRepriceable.length > 0 ? (
            <DataTable data={inversisRepriceable as unknown as Record<string, unknown>[]} columns={inversisColumns} defaultSort="overpayment_k" maxRows={20} />
          ) : (
            <div style={{ color: '#555570', textAlign: 'center', padding: 24 }}>No Inversis clients significantly underpaying</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Root Component ──────────────────────────────────────────────── */
export default function Inversis() {
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const dep = d.depositary;
  const marketScan = useMarketScan();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#e8e8f0',
            fontFamily: "'Outfit', sans-serif" }}>
            Inversis — Market Snapshot
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#8888a0',
            fontFamily: "'Outfit', sans-serif" }}>
            Banco Inversis depositary ({dep.gestora_count} gestoras · {fmtB(dep.aum_bn)}) +
            Inversis Gestión ({fmtB(d.gestora.aum_bn)} AUM) · Data: CNMV {d.date}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <div style={{
            padding: '4px 10px', borderRadius: 4, background: INVERSIS_RED_DIM,
            border: `1px solid ${INVERSIS_RED}60`, fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, color: INVERSIS_RED, fontWeight: 600,
          }}>
            DEPOSITARY #{dep.rank_aum}
          </div>
          <div style={{
            padding: '4px 10px', borderRadius: 4, background: '#10b98120',
            border: '1px solid #10b98140', fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, color: '#10b981', fontWeight: 600,
          }}>
            {dep.gestora_count} CLIENTS
          </div>
        </div>
      </div>

      {/* Sub-tab nav */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #2a2a3a', paddingBottom: 0 }}>
        {SUB_TABS.map(tab => {
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              style={{
                padding: '8px 16px', borderRadius: '6px 6px 0 0', border: 'none',
                background: active ? '#16161f' : 'transparent',
                color: active ? '#e8e8f0' : '#8888a0',
                fontFamily: "'Outfit', sans-serif", fontSize: 13,
                fontWeight: active ? 600 : 400, cursor: 'pointer',
                borderBottom: active ? `2px solid ${INVERSIS_RED}` : '2px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {subTab === 'overview'   && <OverviewSection />}
      {subTab === 'depositary' && <DepositarySection />}
      {subTab === 'market'     && <MarketSection />}
      {subTab === 'marketscan' && <MarketScanSection targets={marketScan.targets} inversisAtRisk={marketScan.inversisAtRisk} inversisRepriceable={marketScan.inversisRepriceable} />}
      {subTab === 'gestora'    && <GestoraSection />}
      {subTab === 'sicav'      && <SicavSection />}
      {subTab === 'pipeline'   && <PipelineSection />}
    </div>
  );
}
