import { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, Legend,
} from 'recharts';
import KpiCard from '../components/KpiCard';
import SectionHeader from '../components/SectionHeader';
import InsightCard from '../components/InsightCard';
import DataTable from '../components/DataTable';
import ChartTooltip from '../components/ChartTooltip';
import { CHART_MARGIN } from '../theme';
import raw from '../data/sicav.json';

/* ── Types ───────────────────────────────────────────────────── */

interface Summary {
  period: string; fee_fy_label: string | null; fee_ytd_label: string; prior_label: string | null;
  count: number; series: number; aum_bn: number; investors: number;
  avg_aum_m: number; median_aum_m: number;
  wtd_dep_fee_bps: number; median_dep_fee_bps: number; est_dep_fees_m: number;
  median_mgmt_fee_pct: number; median_ter_pct: number;
  fi_wtd_dep_fee_bps: number; fi_median_dep_fee_bps: number;
  depositarios: number; gestoras: number; switches: number; entries: number; exits: number;
  inversis_count: number; inversis_aum_bn: number; inversis_share_pct: number;
  inversis_count_share_pct: number; inversis_rank: number | null;
  inversis_wtd_fee_bps: number | null; inversis_est_fees_k: number; inversis_gestoras: number;
  inversis_median_size_m: number;
  addressable_aum_bn: number; addressable_gestoras: number;
  inverco_month: string | null; inverco_aum_bn: number | null; inverco_count: number | null;
}
interface DepoStat {
  depositario: string; short: string; count: number; aum_bn: number; share_pct: number;
  count_share_pct: number; investors: number; gestoras: number;
  wtd_fee_bps: number | null; median_fee_bps: number | null; est_fees_k: number; avg_size_m: number;
  prior_count: number | null; switch_in: number; switch_out: number; new: number; exits: number;
  is_inversis: boolean; rank: number;
}
interface GestoraStat {
  gestora: string; short: string; grupo: string; count: number; aum_m: number; share_pct: number;
  investors: number; wtd_fee_bps: number | null; est_fees_k: number;
  primary_depositario: string;
  depositarios: { depositario: string; short: string; count: number; aum_m: number }[];
  inversis_count: number; inversis_aum_m: number; is_inversis_client: boolean; is_captive: boolean;
  fi_aum_m: number; fi_primary_depositario: string | null; addressable_aum_m?: number;
}
interface SicavRow {
  registro: string; name: string; short: string; gestora: string; grupo: string;
  depositario: string; vocacion: string; investors: number; series: number; aum_m: number;
  dep_fee_bps: number | null; dep_fee_basis: 'FY' | 'YTD' | null;
  dep_fee_fy_bps: number | null; dep_fee_ytd_ann_bps: number | null;
  mgmt_fee_pct: number | null; ter_pct: number | null; return_ytd: number | null;
  est_dep_fee_k: number | null; is_inversis: boolean; is_captive: boolean;
  prior_depositario: string | null; switched: boolean; is_new: boolean;
}
interface Move { name: string; short: string; gestora: string; from?: string; to?: string; depositario?: string; aum_m: number; dep_fee_bps?: number | null }

const data = raw as unknown as {
  summary: Summary; depositario_stats: DepoStat[]; gestora_stats: GestoraStat[];
  targets: GestoraStat[]; sicavs: SicavRow[]; switches: Move[]; entries: Move[]; exits: Move[];
  fee_histogram: { bps: string; count: number; inversis_count: number; other_count: number; aum_m: number }[];
  size_buckets: { bucket: string; count: number; aum_m: number; median_fee_bps: number | null; wtd_fee_bps: number | null; inversis_count: number }[];
  quarterly_trend: { quarter: string; count: number; accounts: number; aum_bn: number }[];
  official_fees: { year: number; sicav_dep_fees_m: number; sicav_mgmt_fees_m: number; fi_dep_fees_m: number; sicav_implied_dep_bps: number | null }[];
  monthly_trend: { month: string; aum_bn: number; count: number; shareholders: number }[];
  inverco_ranking: { rank: number; group: string; gestoras: string[]; aum_m: number; count: number; shareholders: number }[];
};
const S = data.summary;

/* ── Styling helpers ─────────────────────────────────────────── */

const INV = '#10b981';      // Inversis — same highlight as the Depositaría tab
const MKT = '#3b82f6';      // everyone else
const MUTED = '#555570';
const card = { background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 } as const;
const mono = "'JetBrains Mono', monospace";
const fmtM = (m: number) => m >= 1000 ? `€${(m / 1000).toFixed(2)}B` : `€${m.toFixed(m < 10 ? 1 : 0)}M`;
const fmtK = (k: number) => k >= 1000 ? `€${(k / 1000).toFixed(2)}M` : `€${k.toFixed(0)}K`;
const bps = (v: number | null | undefined, d = 1) => v == null ? '—' : `${v.toFixed(d)} bps`;
const short = (s: string, n = 34) => s.length > n ? s.slice(0, n - 2) + '…' : s;
const isInv = (d: string | null | undefined) => !!d && d.includes('INVERSIS');
const depoName = (d: string) => d.replace(', S.A.', '').replace(' S.A.', '').replace(', SUCURSAL EN ESPAÑA', ' (ES)');

function DepoBadge({ name }: { name: string | null | undefined }) {
  if (!name) return <span style={{ color: MUTED }}>—</span>;
  const label = depoName(name);
  return (
    <span style={{
      fontSize: 10, padding: '1px 6px', borderRadius: 3, whiteSpace: 'nowrap',
      background: isInv(name) ? `${INV}20` : '#2a2a3a', color: isInv(name) ? INV : '#8888a0',
    }}>{short(label, 24)}</span>
  );
}

function Pill({ children, color = '#8888a0' }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      fontSize: 9, padding: '1px 5px', borderRadius: 3, marginLeft: 6,
      border: `1px solid ${color}50`, color, fontFamily: mono, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

/* ── Views ───────────────────────────────────────────────────── */

const VIEWS = [
  { id: 'market', label: 'Market & Fees' },
  { id: 'depositarios', label: 'Depositarios' },
  { id: 'gestoras', label: 'Gestoras & Prospects' },
  { id: 'list', label: 'SICAV List' },
] as const;
type View = (typeof VIEWS)[number]['id'];

export default function Sicav() {
  const [view, setView] = useState<View>('market');
  const [listDepo, setListDepo] = useState('');

  const openDepoList = (depo: string) => { setListDepo(depo); setView('list'); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ScopeNote />
      <KpiRow />

      <div style={{ ...card, padding: '12px 24px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            padding: '6px 14px', borderRadius: 6, border: 'none',
            background: view === v.id ? '#d4203020' : 'transparent',
            color: view === v.id ? '#ff3040' : '#8888a0',
            fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: view === v.id ? 600 : 400,
            cursor: 'pointer',
          }}>{v.label}</button>
        ))}
      </div>

      {view === 'market' && <MarketView />}
      {view === 'depositarios' && <DepositariosView onPick={openDepoList} />}
      {view === 'gestoras' && <GestorasView />}
      {view === 'list' && <ListView depo={listDepo} setDepo={setListDepo} />}
    </div>
  );
}

function ScopeNote() {
  return (
    <div style={{
      background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 8,
      padding: '8px 14px', fontSize: 11, color: '#8888a0', lineHeight: 1.6,
    }}>
      <span style={{ color: '#c0c0d0', fontWeight: 600 }}>Scope:</span>{' '}
      All {S.count} Spanish SICAVs registered with CNMV at {S.period} (CNMV SOCREGISTRO / SOCTRIM).{' '}
      <span style={{ color: '#c0c0d0', fontWeight: 600 }}>Depositary fees</span> are what each SICAV actually
      paid, as % of average assets (CNMV SOCPATRIMDISVAR): {S.fee_fy_label ?? 'full-year'} where the SICAV kept the
      same depositario, otherwise {S.fee_ytd_label} annualised. CNMV rounds to 0.01%, so single-SICAV rates
      are ±0.5–1 bp. TER = trailing 12 months. Monthly totals (Inverco, {S.inverco_month}) include
      sociedades de inversión libre and are not comparable 1:1 with CNMV.
    </div>
  );
}

function KpiRow() {
  const fy = data.official_fees[data.official_fees.length - 1];
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <KpiCard title="SICAVs (CNMV)" value={String(S.count)}
        subtitle={`€${S.aum_bn.toFixed(1)}B · ${S.investors.toLocaleString()} shareholders · ${S.period}`} />
      <KpiCard title="Depositary fee (AUM-wtd)" value={bps(S.wtd_dep_fee_bps, 2)}
        subtitle={`Median SICAV ${bps(S.median_dep_fee_bps, 0)} · FI market ${bps(S.fi_wtd_dep_fee_bps, 1)}`} />
      <KpiCard title="Depositary fees paid / yr" value={`€${S.est_dep_fees_m.toFixed(1)}M`}
        subtitle={fy ? `Official CNMV ${fy.year}: €${fy.sicav_dep_fees_m.toFixed(1)}M (FI: €${fy.fi_dep_fees_m.toFixed(0)}M)` : 'Est. at current AUM'} />
      <KpiCard title="Inversis SICAV book" value={`€${S.inversis_aum_bn.toFixed(2)}B`}
        delta={`#${S.inversis_rank} · ${S.inversis_share_pct.toFixed(1)}% of AUM`} deltaPositive={true}
        subtitle={`${S.inversis_count} SICAVs (${S.inversis_count_share_pct}%) · ${S.inversis_gestoras} gestoras`} />
      <KpiCard title="Inversis fee (AUM-wtd)" value={bps(S.inversis_wtd_fee_bps, 2)}
        delta={`${S.inversis_wtd_fee_bps != null && S.inversis_wtd_fee_bps < S.wtd_dep_fee_bps ? 'below' : 'above'} market ${bps(S.wtd_dep_fee_bps, 2)}`}
        deltaPositive={false}
        subtitle={`≈ ${fmtK(S.inversis_est_fees_k)}/yr depositary income`} />
    </div>
  );
}

/* ── Market & fees ───────────────────────────────────────────── */

function MarketView() {
  const fy = data.official_fees[data.official_fees.length - 1];
  const first = data.official_fees[0];
  const q = data.quarterly_trend;
  const qFirst = q[0];
  const qLast = q[q.length - 1];

  // Monthly (Inverco) and quarter-end (CNMV) on one €bn axis
  const trend = useMemo(() => {
    const rows = new Map<string, { label: string; inverco?: number; cnmv?: number; inverco_n?: number; cnmv_n?: number }>();
    for (const m of data.monthly_trend) rows.set(m.month, { label: m.month, inverco: m.aum_bn, inverco_n: m.count });
    for (const r of q) {
      const [y, qq] = r.quarter.split('-Q');
      const key = `${y}-${String(Number(qq) * 3).padStart(2, '0')}`;
      const row = rows.get(key) ?? { label: key };
      row.cnmv = r.aum_bn; row.cnmv_n = r.count;
      rows.set(key, row);
    }
    return [...rows.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [q]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <InsightCard title="What the SICAV data says" color="#8b5cf6">
        The SICAV market is <strong>small and shrinking in number</strong> ({qFirst?.count} → {qLast?.count} SICAVs
        between {qFirst?.quarter} and {qLast?.quarter}; {S.exits} de-registered in the last 12 months, {S.entries} new)
        but <strong>growing in assets</strong> (€{qFirst?.aum_bn.toFixed(1)}B → €{qLast?.aum_bn.toFixed(1)}B).
        SICAVs paid <strong>€{fy?.sicav_dep_fees_m.toFixed(1)}M</strong> in depositary fees in {fy?.year}
        {first && <> (vs €{first.sicav_dep_fees_m.toFixed(1)}M in {first.year}, before the 2022 tax reform)</>} —
        about {fy ? (fy.sicav_dep_fees_m / fy.fi_dep_fees_m * 100).toFixed(1) : '—'}% of what FI pay.
        The typical SICAV pays <strong>{bps(S.median_dep_fee_bps, 0)}</strong>, but large SICAVs negotiate far less,
        so the AUM-weighted rate is <strong>{bps(S.wtd_dep_fee_bps, 1)}</strong>
        {fy?.sicav_implied_dep_bps != null && <> (CNMV's own P&L implies {bps(fy.sicav_implied_dep_bps, 1)} for {fy.year} — the bottom-up and top-down figures reconcile)</>}.
        Inversis is <strong>#{S.inversis_rank}</strong> with {S.inversis_count} SICAVs; its book skews to small SICAVs
        (median €{S.inversis_median_size_m}M vs €{S.median_aum_m}M market) priced at {bps(S.inversis_wtd_fee_bps, 1)} AUM-weighted.
      </InsightCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
        <div style={card}>
          <SectionHeader title="SICAV assets (€B)" source="Inverco monthly (incl. SIL) · CNMV Cuadro 4.1 quarter-end" />
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tickFormatter={v => `€${v}B`} domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip prefix="€" suffix="B" decimals={2} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="inverco" name="Inverco monthly" stroke={MKT} strokeWidth={2} dot={false} connectNulls />
              <Line dataKey="cnmv" name="CNMV quarter-end" stroke="#f59e0b" strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, stroke: '#16161f' }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <SectionHeader title="Number of SICAVs" source="Inverco monthly (incl. SIL) · CNMV Cuadro 4.1 quarter-end" />
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip decimals={0} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="inverco_n" name="Inverco monthly" stroke={MKT} strokeWidth={2} dot={false} connectNulls />
              <Line dataKey="cnmv_n" name="CNMV quarter-end" stroke="#f59e0b" strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, stroke: '#16161f' }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
        <div style={card}>
          <SectionHeader title="Depositary fees paid by all SICAVs (€M / yr)" source="CNMV Cuadro 8.4 — consolidated SICAV P&L" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.official_fees} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={v => `€${v}M`} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip prefix="€" suffix="M" decimals={2} />} />
              <Bar dataKey="sicav_dep_fees_m" name="Depositary fees" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11, color: '#8888a0', marginTop: 8 }}>
            Management fees paid by SICAVs in {fy?.year}: €{fy?.sicav_mgmt_fees_m.toFixed(1)}M.
            FI paid €{fy?.fi_dep_fees_m.toFixed(0)}M of depositary fees in the same year (Cuadro 8.2).
          </div>
        </div>
        <div style={card}>
          <SectionHeader title="Depositary fee by SICAV size" source={`CNMV SOCPATRIMDISVAR — ${S.fee_fy_label} / ${S.fee_ytd_label}`} />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.size_buckets} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={v => `${v}`} tick={{ fontSize: 10 }} unit=" bps" />
              <Tooltip content={<ChartTooltip suffix=" bps" decimals={1} />} />
              <Bar dataKey="median_fee_bps" name="Median fee" fill={MKT} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: '#8888a0', fontFamily: mono }}>
            {data.size_buckets.map(b => (
              <span key={b.bucket}>{b.bucket}: {b.count} ({b.inversis_count} Inv.)</span>
            ))}
          </div>
        </div>
      </div>

      <div style={card}>
        <SectionHeader title="Number of SICAVs by depositary fee paid (bps)"
          source={`CNMV SOCPATRIMDISVAR · rate rounded to whole bps · ${S.fee_fy_label} / ${S.fee_ytd_label}`} />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.fee_histogram} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
            <XAxis dataKey="bps" tick={{ fontSize: 10 }} tickFormatter={(v: string) => `${v} bps`} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip content={<ChartTooltip decimals={0} />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="other_count" name="Other depositarios" stackId="a" fill={MKT} />
            <Bar dataKey="inversis_count" name="Inversis" stackId="a" fill={INV} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Depositarios ────────────────────────────────────────────── */

function DepositariosView({ onPick }: { onPick: (d: string) => void }) {
  const rows = data.depositario_stats;
  const inv = rows.find(r => r.is_inversis);
  const byFee = useMemo(() => [...rows].filter(r => r.wtd_fee_bps != null).sort((a, b) => (b.wtd_fee_bps ?? 0) - (a.wtd_fee_bps ?? 0)), [rows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {inv && (
        <InsightCard title="Inversis in the SICAV depositary market" color={INV}>
          Inversis holds <strong>{inv.count} SICAVs (€{inv.aum_bn.toFixed(2)}B, {inv.share_pct.toFixed(1)}% of assets)</strong> for {inv.gestoras} gestoras —
          #{inv.rank} behind CACEIS, which alone custodies {rows[0]?.share_pct.toFixed(0)}% of SICAV assets.
          Since {S.prior_label}: {inv.prior_count} → {inv.count} SICAVs ({inv.switch_in} won from other depositarios,
          {' '}{inv.switch_out} lost to competitors, {inv.exits} de-registered).
          Inversis' AUM-weighted fee is {bps(inv.wtd_fee_bps, 2)} vs {bps(S.wtd_dep_fee_bps, 2)} for the market; median {bps(inv.median_fee_bps, 0)} vs {bps(S.median_dep_fee_bps, 0)}.
        </InsightCard>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
        <div style={card}>
          <SectionHeader title="SICAV assets by depositario (€B)" source={`CNMV SOCREGISTRO / SOCTRIM — ${S.period}`} />
          <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 34)}>
            <BarChart data={rows} layout="vertical" margin={{ ...CHART_MARGIN, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" horizontal={false} />
              <XAxis type="number" tickFormatter={v => `€${v}B`} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="short" width={190} tick={{ fontSize: 10 }} tickFormatter={(v: string) => short(v, 28)} />
              <Tooltip content={<ChartTooltip prefix="€" suffix="B" decimals={2} />} />
              <Bar dataKey="aum_bn" name="SICAV AUM" radius={[0, 4, 4, 0]}>
                {rows.map(r => <Cell key={r.depositario} fill={r.is_inversis ? INV : MKT} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <SectionHeader title="AUM-weighted depositary fee (bps)" source={`CNMV SOCPATRIMDISVAR — dashed line = market ${bps(S.wtd_dep_fee_bps, 2)}`} />
          <ResponsiveContainer width="100%" height={Math.max(220, byFee.length * 34)}>
            <BarChart data={byFee} layout="vertical" margin={{ ...CHART_MARGIN, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} unit=" bps" />
              <YAxis type="category" dataKey="short" width={190} tick={{ fontSize: 10 }} tickFormatter={(v: string) => short(v, 28)} />
              <Tooltip content={<ChartTooltip suffix=" bps" decimals={2} />} />
              <ReferenceLine x={S.wtd_dep_fee_bps} stroke="#8888a0" strokeDasharray="4 3" />
              <Bar dataKey="wtd_fee_bps" name="Wtd fee" radius={[0, 4, 4, 0]}>
                {byFee.map(r => <Cell key={r.depositario} fill={r.is_inversis ? INV : MKT} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={card}>
        <SectionHeader title="Depositario league table — SICAVs" source={`CNMV ${S.period}; 12-month moves vs ${S.prior_label} register · click a row to list its SICAVs`} />
        <DataTable
          data={rows as unknown as Record<string, unknown>[]}
          onRowClick={r => onPick(String(r.depositario))}
          columns={[
            { key: 'rank', label: '#', width: 30 },
            { key: 'depositario', label: 'Depositario', format: (v: unknown) => <DepoBadge name={String(v)} /> },
            { key: 'count', label: 'SICAVs', align: 'right' as const },
            { key: 'aum_bn', label: 'AUM', align: 'right' as const, format: (v: unknown) => `€${Number(v).toFixed(2)}B` },
            { key: 'share_pct', label: 'Share', align: 'right' as const, format: (v: unknown) => `${Number(v).toFixed(1)}%` },
            { key: 'gestoras', label: 'Gestoras', align: 'right' as const },
            { key: 'avg_size_m', label: 'Avg size', align: 'right' as const, format: (v: unknown) => fmtM(Number(v)) },
            { key: 'wtd_fee_bps', label: 'Wtd fee', align: 'right' as const, format: (v: unknown) => bps(v as number | null, 2) },
            { key: 'median_fee_bps', label: 'Median', align: 'right' as const, format: (v: unknown) => bps(v as number | null, 1) },
            { key: 'est_fees_k', label: 'Est. fees/yr', align: 'right' as const, format: (v: unknown) => fmtK(Number(v)) },
            { key: 'prior_count', label: `${S.prior_label ?? 'Prior'}`, align: 'right' as const, format: (v: unknown) => v == null ? '—' : String(v) },
            { key: 'switch_in', label: 'Won', align: 'right' as const, format: (v: unknown) => Number(v) ? <span style={{ color: INV }}>+{String(v)}</span> : '·' },
            { key: 'switch_out', label: 'Lost', align: 'right' as const, format: (v: unknown) => Number(v) ? <span style={{ color: '#ef4444' }}>−{String(v)}</span> : '·' },
            { key: 'exits', label: 'Wound up', align: 'right' as const, format: (v: unknown) => Number(v) ? `−${String(v)}` : '·' },
          ]}
          defaultSort="aum_bn"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
        <div style={card}>
          <SectionHeader title={`Depositary switches since ${S.prior_label}`} source="Same SICAV, different depositario in the CNMV register" />
          {data.switches.length === 0 ? <div style={{ color: MUTED, fontSize: 12 }}>No switches.</div> : (
            <DataTable
              data={data.switches as unknown as Record<string, unknown>[]}
              columns={[
                { key: 'short', label: 'SICAV', format: (v: unknown) => short(String(v), 22) },
                { key: 'gestora', label: 'Gestora', format: (v: unknown) => short(String(v), 16) },
                { key: 'from', label: 'From', format: (v: unknown) => <DepoBadge name={String(v)} /> },
                { key: 'to', label: 'To', format: (v: unknown) => <DepoBadge name={String(v)} /> },
                { key: 'aum_m', label: 'AUM', align: 'right' as const, format: (v: unknown) => fmtM(Number(v)) },
              ]}
              defaultSort="aum_m"
            />
          )}
        </div>
        <div style={card}>
          <SectionHeader title={`SICAVs de-registered since ${S.prior_label}`} source="In the prior-year CNMV register, absent now (AUM at prior date)" />
          {data.exits.length === 0 ? <div style={{ color: MUTED, fontSize: 12 }}>None.</div> : (
            <DataTable
              data={data.exits as unknown as Record<string, unknown>[]}
              columns={[
                { key: 'short', label: 'SICAV', format: (v: unknown) => short(String(v), 24) },
                { key: 'gestora', label: 'Gestora', format: (v: unknown) => short(String(v), 18) },
                { key: 'depositario', label: 'Depositario', format: (v: unknown) => <DepoBadge name={String(v)} /> },
                { key: 'aum_m', label: 'AUM', align: 'right' as const, format: (v: unknown) => fmtM(Number(v)) },
              ]}
              defaultSort="aum_m"
              maxRows={20}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Gestoras & prospects ────────────────────────────────────── */

function GestorasView() {
  const [onlyTargets, setOnlyTargets] = useState(false);
  const invFee = (S.inversis_wtd_fee_bps ?? S.wtd_dep_fee_bps) / 10000;
  const targets = useMemo(() => data.targets.map(t => ({
    ...t,
    rev_at_current_k: t.est_fees_k * ((t.addressable_aum_m ?? 0) / t.aum_m),
    rev_at_inversis_k: (t.addressable_aum_m ?? 0) * 1000 * invFee,
  })), [invFee]);
  const top = targets.slice(0, 3);
  const rows = onlyTargets ? targets : data.gestora_stats;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <InsightCard title="SICAV prospects" color="#f59e0b">
        <strong>{S.addressable_gestoras} non-captive gestoras</strong> hold <strong>€{S.addressable_aum_bn.toFixed(1)}B</strong> of
        SICAV assets at other depositarios (excluding set-ups where gestora and depositario share a financial group).
        Largest: {top.map((t, i) => (
          <span key={t.gestora}>{i > 0 ? ', ' : ''}<strong>{t.short}</strong> ({fmtM(t.addressable_aum_m ?? 0)} at {depoName(t.primary_depositario)}{t.is_inversis_client ? ' — already an Inversis client for part of the book' : ''})</span>
        ))}.
        Rows marked <Pill color={INV}>INV CLIENT</Pill> already use Inversis for some SICAVs or funds — a cross-sell, not a cold pitch.
      </InsightCard>

      <div style={card}>
        <SectionHeader title={onlyTargets ? 'Prospect list — SICAV books held elsewhere' : 'SICAV gestoras'}
          source={`CNMV ${S.period} · fees ${S.fee_fy_label} / ${S.fee_ytd_label} · FI columns from CNMV Anexo`}>
          <label style={{ fontSize: 12, color: '#8888a0', display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyTargets} onChange={e => setOnlyTargets(e.target.checked)} />
            Prospects only
          </label>
        </SectionHeader>
        <DataTable
          data={rows as unknown as Record<string, unknown>[]}
          columns={[
            { key: 'gestora', label: 'Gestora', format: (v: unknown, r: Record<string, unknown>) => (
              <span>{short(String(r.short ?? v), 30)}
                {r.is_inversis_client ? <Pill color={INV}>INV CLIENT</Pill> : null}
                {r.is_captive ? <Pill>CAPTIVE</Pill> : null}
              </span>
            )},
            { key: 'count', label: 'SICAVs', align: 'right' as const },
            { key: 'aum_m', label: 'SICAV AUM', align: 'right' as const, format: (v: unknown) => fmtM(Number(v)) },
            { key: 'share_pct', label: 'Share', align: 'right' as const, format: (v: unknown) => `${Number(v).toFixed(1)}%` },
            { key: 'primary_depositario', label: 'SICAV depositario', format: (v: unknown, r: Record<string, unknown>) => (
              <span><DepoBadge name={String(v)} />
                {(r.depositarios as unknown[]).length > 1 ? <span style={{ fontSize: 10, color: MUTED }}> +{(r.depositarios as unknown[]).length - 1}</span> : null}
              </span>
            )},
            { key: 'wtd_fee_bps', label: 'Wtd fee', align: 'right' as const, format: (v: unknown) => bps(v as number | null, 1) },
            { key: 'est_fees_k', label: 'Fees/yr', align: 'right' as const, format: (v: unknown) => fmtK(Number(v)) },
            { key: 'inversis_aum_m', label: 'At Inversis', align: 'right' as const, format: (v: unknown) => Number(v) > 0 ? <span style={{ color: INV }}>{fmtM(Number(v))}</span> : '·' },
            ...(onlyTargets ? [
              { key: 'addressable_aum_m', label: 'Addressable', align: 'right' as const, format: (v: unknown) => fmtM(Number(v)) },
              { key: 'rev_at_inversis_k', label: `@ Inv. ${bps(S.inversis_wtd_fee_bps, 1)}`, align: 'right' as const, format: (v: unknown) => fmtK(Number(v)) },
            ] : []),
            { key: 'fi_aum_m', label: 'FI AUM', align: 'right' as const, format: (v: unknown) => Number(v) > 0 ? fmtM(Number(v)) : '·' },
            { key: 'fi_primary_depositario', label: 'FI depositario', format: (v: unknown) => <DepoBadge name={v as string | null} /> },
          ]}
          defaultSort={onlyTargets ? 'addressable_aum_m' : 'aum_m'}
        />
      </div>

      <div style={card}>
        <SectionHeader title={`Inverco SICAV ranking by group — ${S.inverco_month}`}
          source={`Inverco monthly; includes sociedades de inversión libre; ~99% sample · total €${S.inverco_aum_bn?.toFixed(1)}B / ${S.inverco_count} sociedades`} />
        <DataTable
          data={data.inverco_ranking as unknown as Record<string, unknown>[]}
          columns={[
            { key: 'rank', label: '#', width: 30 },
            { key: 'group', label: 'Group' },
            { key: 'gestoras', label: 'Gestoras', format: (v: unknown) => <span style={{ fontSize: 11, color: '#8888a0' }}>{(v as string[]).join(' · ')}</span> },
            { key: 'aum_m', label: 'AUM', align: 'right' as const, format: (v: unknown) => fmtM(Number(v)) },
            { key: 'count', label: 'Sociedades', align: 'right' as const },
            { key: 'shareholders', label: 'Shareholders', align: 'right' as const, format: (v: unknown) => Number(v).toLocaleString() },
          ]}
          defaultSort="aum_m"
        />
      </div>
    </div>
  );
}

/* ── Full list ───────────────────────────────────────────────── */

function ListView({ depo, setDepo }: { depo: string; setDepo: (d: string) => void }) {
  const [search, setSearch] = useState('');
  const [gestora, setGestora] = useState('');
  const depos = useMemo(() => data.depositario_stats.map(d => d.depositario), []);
  const gestoras = useMemo(() => [...new Set(data.sicavs.map(s => s.gestora))].sort(), []);

  const rows = useMemo(() => {
    let r = data.sicavs;
    if (depo) r = r.filter(s => s.depositario === depo);
    if (gestora) r = r.filter(s => s.gestora === gestora);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(s => s.name.toLowerCase().includes(q) || s.gestora.toLowerCase().includes(q) || s.registro === q);
    }
    return r;
  }, [depo, gestora, search]);
  const aum = rows.reduce((a, s) => a + s.aum_m, 0);
  const fees = rows.reduce((a, s) => a + (s.est_dep_fee_k ?? 0), 0);

  return (
    <div style={card}>
      <SectionHeader title="All SICAVs" source={`CNMV ${S.period} · fee basis: FY = ${S.fee_fy_label}, YTD = ${S.fee_ytd_label} annualised`} />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input type="text" placeholder="Search SICAV, gestora or CNMV nº…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
        <select value={depo} onChange={e => setDepo(e.target.value)} style={{ fontSize: 12 }}>
          <option value="">All depositarios ({depos.length})</option>
          {depos.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={gestora} onChange={e => setGestora(e.target.value)} style={{ fontSize: 12, maxWidth: 320 }}>
          <option value="">All gestoras ({gestoras.length})</option>
          {gestoras.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <div style={{ fontFamily: mono, fontSize: 12, color: '#8888a0' }}>
          {rows.length} SICAVs · {fmtM(aum)} · fees ≈ {fmtK(fees)}/yr
        </div>
      </div>
      <DataTable
        data={rows as unknown as Record<string, unknown>[]}
        columns={[
          { key: 'name', label: 'SICAV', format: (_v: unknown, r: Record<string, unknown>) => (
            <span title={`CNMV nº ${r.registro} · ${r.vocacion}`}>{short(String(r.short), 32)}
              {r.switched ? <Pill color="#f59e0b">SWITCHED</Pill> : null}
            </span>
          )},
          { key: 'gestora', label: 'Gestora', format: (v: unknown) => short(String(v), 28) },
          { key: 'depositario', label: 'Depositario', format: (v: unknown) => <DepoBadge name={String(v)} /> },
          { key: 'aum_m', label: 'AUM', align: 'right' as const, format: (v: unknown) => fmtM(Number(v)) },
          { key: 'investors', label: 'Holders', align: 'right' as const, format: (v: unknown) => Number(v).toLocaleString() },
          { key: 'dep_fee_bps', label: 'Depo fee', align: 'right' as const, format: (v: unknown, r: Record<string, unknown>) => (
            <span title={`${S.fee_fy_label}: ${bps(r.dep_fee_fy_bps as number | null)} · ${S.fee_ytd_label} annualised: ${bps(r.dep_fee_ytd_ann_bps as number | null)}`}>
              {bps(v as number | null, 0)}{r.dep_fee_basis === 'YTD' ? <span style={{ color: MUTED }}>*</span> : null}
            </span>
          )},
          { key: 'est_dep_fee_k', label: 'Fee €/yr', align: 'right' as const, format: (v: unknown) => v == null ? '—' : fmtK(Number(v)) },
          { key: 'mgmt_fee_pct', label: 'Mgmt', align: 'right' as const, format: (v: unknown) => v == null ? '—' : `${Number(v).toFixed(2)}%` },
          { key: 'ter_pct', label: 'TER', align: 'right' as const, format: (v: unknown) => v == null ? '—' : `${Number(v).toFixed(2)}%` },
          { key: 'return_ytd', label: 'Ret. YTD', align: 'right' as const, format: (v: unknown) => v == null ? '—' : `${Number(v).toFixed(1)}%` },
        ]}
        defaultSort="aum_m"
      />
      <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
        * {S.fee_ytd_label} annualised (SICAV changed depositario or had no {S.fee_fy_label} data). Hover a fee to see both bases.
        Mgmt fee is the effective rate charged (incl. any performance fee). Est. fee €/yr = current AUM × depositary rate.
      </div>
    </div>
  );
}
