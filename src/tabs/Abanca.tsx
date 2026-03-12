import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import KpiCard from '../components/KpiCard';
import SectionHeader from '../components/SectionHeader';
import InsightCard from '../components/InsightCard';
import DataTable from '../components/DataTable';
import ChartTooltip from '../components/ChartTooltip';
import { CHART_MARGIN, CATEGORY_COLORS } from '../theme';
import data from '../data/abanca.json';

/* ── types ──────────────────────────────────────────────────────── */
interface ClassDetail {
  isin: string; share_class: string; aum_k: number;
  dep_fee_bps: number | null; mgmt_fee_pct: number | null;
}
interface AbancaFund {
  fund: string; vocacion: string; category: string;
  aum_m: number; aum_pct: number; classes: number;
  class_detail: ClassDetail[]; investors: number;
  wtd_dep_fee_bps: number; est_dep_rev_k: number;
}
interface AbancaCategory {
  category: string; aum_m: number; aum_pct: number;
  funds: number; classes: number; investors: number;
  wtd_dep_fee_bps: number;
}
interface AbancaPeer {
  gestora: string; gestora_short: string; aum_bn: number;
  funds: number; classes: number; investors: number;
  wtd_dep_fee_bps: number; est_dep_rev_k: number; is_abanca: boolean;
}
interface AbancaScenario {
  name: string; fee_bps: number; description: string;
  est_annual_rev_k: number; delta_vs_cecabank_k: number;
}

const d = data as {
  date: string; gestora_short: string; current_depositario: string;
  summary: {
    total_aum_bn: number; total_funds: number; total_classes: number;
    total_investors: number; total_categories: number;
    wtd_dep_fee_bps: number; est_cecabank_rev_k: number;
    aum_rank_spain: number; fee_percentile: number;
  };
  market_context: {
    total_gestoras: number;
    mkt_dep_fee_p25: number; mkt_dep_fee_p50: number; mkt_dep_fee_p75: number;
  };
  funds: AbancaFund[];
  categories: AbancaCategory[];
  peers: AbancaPeer[];
  scenarios: AbancaScenario[];
};

const { summary: s, market_context: mc } = d;

/* ── helpers ─────────────────────────────────────────────────────── */
const rev  = (k: number) => k >= 1000 ? `€${(k / 1000).toFixed(2)}M` : `€${k.toFixed(0)}K`;
const fmtM = (v: number) => `€${v.toFixed(1)}M`;
const fmt  = (v: number, decimals = 1) => v.toFixed(decimals);

const SUB_TABS = [
  { id: 'overview',   label: 'Overview'          },
  { id: 'portfolio',  label: 'Fund Portfolio'     },
  { id: 'investors',  label: 'Investor Profile'   },
  { id: 'scenarios',  label: 'Revenue Scenarios'  },
] as const;
type SubTab = (typeof SUB_TABS)[number]['id'];

/* ── sub-components ──────────────────────────────────────────────── */

function OverviewSection() {
  const fixedIncomePct = d.categories
    .filter(c => c.category.startsWith('RF'))
    .reduce((s, c) => s + c.aum_pct, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <InsightCard title="Strategic Summary" color="#10b981">
        <strong>Abanca Gestión de Activos</strong> is Spain's <strong>#{s.aum_rank_spain}</strong> fund manager
        by AUM (€{s.total_aum_bn.toFixed(1)}B, {s.total_funds} funds, {s.total_investors.toLocaleString()} investors).
        Currently custodied exclusively at <strong>Cecabank</strong> — paying <strong>{s.wtd_dep_fee_bps.toFixed(2)} bps</strong> weighted
        ({s.fee_percentile}th percentile, below the {mc.mkt_dep_fee_p50.toFixed(1)} bps market median).
        Abanca's book is {fixedIncomePct.toFixed(0)}% fixed income by AUM — operationally straightforward for any depositary.
        Estimated depositary revenue currently flowing to Cecabank: <strong>~{rev(s.est_cecabank_rev_k)}/yr</strong>.
      </InsightCard>

      {/* Category composition bars */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Portfolio Composition by Category" source="CNMV Estadísticas IIC — Anexo A2.2" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {d.categories.map(c => (
            <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 160, fontSize: 12, color: '#8888a0', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', flexShrink: 0 }}>
                {c.category}
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <div style={{
                  width: `${c.aum_pct}%`, height: 26, borderRadius: 4,
                  background: CATEGORY_COLORS[c.category] || '#3b82f6',
                  opacity: 0.85, display: 'flex', alignItems: 'center', paddingLeft: 8, minWidth: 50,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
                    {fmtM(c.aum_m)} · {c.aum_pct}%
                  </span>
                </div>
              </div>
              <div style={{ width: 90, textAlign: 'right', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#8888a0' }}>
                {c.investors.toLocaleString()} inv
              </div>
              <div style={{ width: 70, textAlign: 'right', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#f59e0b' }}>
                {c.wtd_dep_fee_bps.toFixed(1)} bps
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Peer comparison */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="AUM vs Peers — Similar Regional Gestoras" source="CNMV Estadísticas IIC — Anexo A2.2" />
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={d.peers}
            layout="vertical"
            margin={{ ...CHART_MARGIN, left: 180 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis type="number" tickFormatter={v => `€${v.toFixed(1)}B`}
              tick={{ fill: '#8888a0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
            <YAxis type="category" dataKey="gestora_short" width={175}
              tick={{ fill: '#8888a0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
            <Tooltip content={<ChartTooltip prefix="€" suffix="B" decimals={2} />} />
            <Bar dataKey="aum_bn" radius={[0, 4, 4, 0]}>
              {d.peers.map((p, i) => (
                <Cell key={i} fill={p.is_abanca ? '#10b981' : '#3b82f6'} opacity={p.is_abanca ? 1 : 0.6} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Depositary fee vs peers */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Depositary Fee vs Peer Gestoras (bps)" source="CNMV Estadísticas IIC — Anexo A2.2" />
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={d.peers} layout="vertical" margin={{ ...CHART_MARGIN, left: 180 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis type="number" tickFormatter={v => `${v} bps`}
              tick={{ fill: '#8888a0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
            <YAxis type="category" dataKey="gestora_short" width={175}
              tick={{ fill: '#8888a0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
            <Tooltip content={<ChartTooltip suffix=" bps" decimals={2} />} />
            <ReferenceLine x={mc.mkt_dep_fee_p50} stroke="#f59e0b" strokeDasharray="4 3"
              label={{ value: `Median ${mc.mkt_dep_fee_p50} bps`, fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} />
            <Bar dataKey="wtd_dep_fee_bps" radius={[0, 4, 4, 0]}>
              {d.peers.map((p, i) => (
                <Cell key={i} fill={p.is_abanca ? '#10b981' : '#6366f1'} opacity={p.is_abanca ? 1 : 0.6} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PortfolioSection() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const fundColumns = [
    { key: 'fund', label: 'Fund', format: (v: unknown) => {
      const s = String(v); return s.length > 42 ? s.slice(0, 40) + '…' : s;
    }},
    { key: 'category', label: 'Category', format: (v: unknown) => (
      <span style={{ color: CATEGORY_COLORS[String(v)] || '#8888a0', fontSize: 11 }}>{String(v)}</span>
    )},
    { key: 'aum_m', label: 'AUM', align: 'right' as const, format: (v: unknown) => fmtM(Number(v)) },
    { key: 'aum_pct', label: 'Mkt %', align: 'right' as const, format: (v: unknown) => `${Number(v).toFixed(1)}%` },
    { key: 'classes', label: 'Classes', align: 'right' as const },
    { key: 'investors', label: 'Investors', align: 'right' as const, format: (v: unknown) => Number(v).toLocaleString() },
    { key: 'wtd_dep_fee_bps', label: 'Dep fee', align: 'right' as const, format: (v: unknown) => `${Number(v).toFixed(1)} bps` },
    { key: 'est_dep_rev_k', label: 'Est. Cecabank rev', align: 'right' as const, format: (v: unknown) => rev(Number(v)) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title={`Abanca Fund Portfolio — ${s.total_funds} Funds, ${s.total_classes} Share Classes`}
          source="CNMV Estadísticas IIC — Anexo A2.2" />
        <DataTable data={d.funds as unknown as Record<string, unknown>[]} columns={fundColumns} defaultSort="aum_m" />
      </div>

      {/* Expandable class-level detail */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Share Class Detail" source="CNMV A2.2 — click a fund to expand" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {d.funds.map(f => (
            <div key={f.fund}>
              <div
                onClick={() => setExpanded(expanded === f.fund ? null : f.fund)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  background: expanded === f.fund ? '#1e1e2e' : '#0a0a0f',
                  borderRadius: 6, border: '1px solid #2a2a3a', cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 11, color: '#555570', width: 14 }}>{expanded === f.fund ? '▼' : '▶'}</span>
                <span style={{ flex: 1, fontSize: 13, color: '#e8e8f0', fontFamily: "'Outfit', sans-serif" }}>
                  {f.fund}
                </span>
                <span style={{ fontSize: 11, color: CATEGORY_COLORS[f.category] || '#8888a0', width: 160, textAlign: 'right' }}>
                  {f.category}
                </span>
                <span style={{ fontSize: 12, color: '#e8e8f0', fontFamily: "'JetBrains Mono', monospace", width: 80, textAlign: 'right' }}>
                  {fmtM(f.aum_m)}
                </span>
                <span style={{ fontSize: 11, color: '#8888a0', fontFamily: "'JetBrains Mono', monospace", width: 60, textAlign: 'right' }}>
                  {f.classes} class{f.classes !== 1 ? 'es' : ''}
                </span>
              </div>
              {expanded === f.fund && (
                <div style={{ padding: '8px 16px', background: '#0d0d17', borderRadius: '0 0 6px 6px', border: '1px solid #2a2a3a', borderTop: 'none' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                    <thead>
                      <tr style={{ color: '#555570' }}>
                        <th style={{ textAlign: 'left', padding: '4px 8px' }}>ISIN</th>
                        <th style={{ textAlign: 'left', padding: '4px 8px' }}>Class</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px' }}>AUM</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px' }}>Dep fee</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px' }}>Mgmt fee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.class_detail.map(c => (
                        <tr key={c.isin} style={{ borderTop: '1px solid #1e1e2e', color: '#c8c8d8' }}>
                          <td style={{ padding: '4px 8px' }}>{c.isin}</td>
                          <td style={{ padding: '4px 8px', color: '#8888a0' }}>{c.share_class || '—'}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right' }}>€{(c.aum_k / 1000).toFixed(1)}M</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: '#f59e0b' }}>
                            {c.dep_fee_bps != null ? `${c.dep_fee_bps.toFixed(1)} bps` : '—'}
                          </td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: '#8888a0' }}>
                            {c.mgmt_fee_pct != null ? `${(c.mgmt_fee_pct * 100).toFixed(0)} bps` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InvestorsSection() {
  const topFundsByInvestors = [...d.funds].sort((a, b) => b.investors - a.investors);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <InsightCard title="Investor Profile" color="#6366f1">
        Abanca has <strong>{s.total_investors.toLocaleString()} registered fund investors</strong> across {s.total_funds} funds —
        reflecting a broad retail client base distributed through Abanca's branch network across Galicia and beyond.
        The two largest funds by investor count are <strong>Abanca Renta Fija Patrimonio</strong> ({d.funds.find(f => f.investors === Math.max(...d.funds.map(f => f.investors)))?.investors.toLocaleString()} investors)
        and <strong>Abanca FonDepósito</strong> ({d.funds.find(f => f.fund.includes('FONDEPOSITO'))?.investors.toLocaleString()} investors).
        Fixed income categories account for approximately <strong>{Math.round(d.categories.filter(c => c.category.startsWith('RF')).reduce((s, c) => s + c.investors, 0) / s.total_investors * 100)}%</strong> of all investors.
      </InsightCard>

      {/* Investors by fund */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Investor Count by Fund" source="CNMV Estadísticas IIC — Anexo A2.2" />
        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={topFundsByInvestors} layout="vertical" margin={{ ...CHART_MARGIN, left: 260 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis type="number" tickFormatter={v => v.toLocaleString()}
              tick={{ fill: '#8888a0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
            <YAxis type="category" dataKey="fund" width={255}
              tickFormatter={v => v.replace(', FI', '').replace('ABANCA ', '')}
              tick={{ fill: '#8888a0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
            <Tooltip content={<ChartTooltip decimals={0} />} />
            <Bar dataKey="investors" radius={[0, 4, 4, 0]}>
              {topFundsByInvestors.map((f, i) => (
                <Cell key={i} fill={CATEGORY_COLORS[f.category] || '#6366f1'} opacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Investors by category */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Investors by Category" source="CNMV Estadísticas IIC — Anexo A2.2" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {[...d.categories].sort((a, b) => b.investors - a.investors).map(c => {
            const pct = Math.round(c.investors / s.total_investors * 100);
            return (
              <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 160, fontSize: 12, color: '#8888a0', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', flexShrink: 0 }}>
                  {c.category}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    width: `${Math.max(pct, 2)}%`, height: 22, borderRadius: 4,
                    background: CATEGORY_COLORS[c.category] || '#6366f1', opacity: 0.8,
                    display: 'flex', alignItems: 'center', paddingLeft: 8, minWidth: 40,
                  }}>
                    <span style={{ fontSize: 11, color: '#fff', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
                      {c.investors.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div style={{ width: 48, textAlign: 'right', fontSize: 11, color: '#8888a0', fontFamily: "'JetBrains Mono', monospace" }}>
                  {pct}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScenariosSection() {
  const cecabankRev = d.scenarios[0].est_annual_rev_k;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <InsightCard title="Inversis Revenue Opportunity" color="#f59e0b">
        Abanca currently pays <strong>Cecabank ~{rev(cecabankRev)}/yr</strong> in depositary fees
        at a weighted {s.wtd_dep_fee_bps.toFixed(2)} bps — below the {mc.mkt_dep_fee_p50.toFixed(1)} bps market median
        (Cecabank captive pricing advantage). Inversis would need to price competitively at <strong>6–7 bps</strong> to be
        viable. At market median (7 bps), the Abanca mandate would generate <strong>{rev(d.scenarios[2].est_annual_rev_k)}/yr</strong> for Inversis —
        a <strong>+{rev(d.scenarios[2].delta_vs_cecabank_k)}</strong> uplift vs Cecabank's current take.
        The mandate covers {s.total_funds} funds, {s.total_classes} share classes across {s.total_categories} categories,
        with {s.total_investors.toLocaleString()} retail investors — moderate complexity.
      </InsightCard>

      {/* Scenario bar chart */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Annual Depositary Revenue Scenarios" source="CNMV A2.2 · Inversis analysis" />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={d.scenarios} margin={{ ...CHART_MARGIN, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis dataKey="name" tick={{ fill: '#8888a0', fontSize: 10, fontFamily: "'Outfit', sans-serif" }}
              interval={0} angle={-10} textAnchor="end" />
            <YAxis tickFormatter={v => rev(v)}
              tick={{ fill: '#8888a0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
            <Tooltip content={<ChartTooltip prefix="€" suffix="K" decimals={0} />} />
            <ReferenceLine y={cecabankRev} stroke="#ef4444" strokeDasharray="4 3"
              label={{ value: 'Cecabank current', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
            <Bar dataKey="est_annual_rev_k" radius={[4, 4, 0, 0]}>
              {d.scenarios.map((sc, i) => (
                <Cell key={i} fill={i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : i === 2 ? '#10b981' : '#3b82f6'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Scenario table */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Scenario Detail" source={`AUM base: €${s.total_aum_bn.toFixed(1)}B · ${d.date}`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {d.scenarios.map((sc, i) => {
            const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'];
            const col = colors[i] || '#8888a0';
            return (
              <div key={sc.name} style={{
                background: '#0a0a0f', border: `1px solid ${col}30`,
                borderLeft: `3px solid ${col}`, borderRadius: 8, padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 20,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f0', fontFamily: "'Outfit', sans-serif" }}>
                    {sc.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#8888a0', marginTop: 4 }}>{sc.description}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: col, fontFamily: "'JetBrains Mono', monospace" }}>
                    {rev(sc.est_annual_rev_k)}
                  </div>
                  {sc.delta_vs_cecabank_k !== 0 && (
                    <div style={{ fontSize: 12, color: sc.delta_vs_cecabank_k > 0 ? '#10b981' : '#ef4444', marginTop: 2 }}>
                      {sc.delta_vs_cecabank_k > 0 ? '+' : ''}{rev(sc.delta_vs_cecabank_k)} vs Cecabank
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Complexity / switching risk */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[
          { label: 'Funds to migrate', value: String(s.total_funds), color: '#3b82f6' },
          { label: 'Share classes', value: String(s.total_classes), color: '#6366f1' },
          { label: 'Categories', value: String(s.total_categories), color: '#8b5cf6' },
          { label: 'Retail investors', value: s.total_investors.toLocaleString(), color: '#10b981' },
        ].map(item => (
          <div key={item.label} style={{
            background: '#0a0a0f', border: `1px solid ${item.color}30`,
            borderRadius: 8, padding: '14px 18px',
          }}>
            <div style={{ fontSize: 11, color: '#8888a0', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'Outfit', sans-serif" }}>
              {item.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: item.color, fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── main export ─────────────────────────────────────────────────── */
export default function Abanca() {
  const [subTab, setSubTab] = useState<SubTab>('overview');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#e8e8f0', fontFamily: "'Outfit', sans-serif" }}>
              Abanca Gestión de Activos
            </div>
            <div style={{ fontSize: 13, color: '#8888a0', marginTop: 4 }}>
              Business opportunity analysis · Current depositary: <strong style={{ color: '#ef4444' }}>{d.current_depositario}</strong>
            </div>
          </div>
          <div style={{
            padding: '6px 14px', borderRadius: 6, background: '#10b98120',
            border: '1px solid #10b98140', fontSize: 11, color: '#10b981',
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
          }}>
            PROSPECT · {d.date}
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <KpiCard title="AUM (Abanca Gestión)"
            value={`€${s.total_aum_bn.toFixed(2)}B`}
            subtitle={`#${s.aum_rank_spain} gestora in Spain`} />
          <KpiCard title="Funds / Classes"
            value={`${s.total_funds} / ${s.total_classes}`}
            subtitle={`${s.total_categories} asset categories`} />
          <KpiCard title="Retail Investors"
            value={s.total_investors.toLocaleString()}
            subtitle="Registered fund investors" />
          <KpiCard title="Current Dep. Fee (Cecabank)"
            value={`${fmt(s.wtd_dep_fee_bps, 2)} bps`}
            delta={`${s.fee_percentile}th percentile · Median: ${mc.mkt_dep_fee_p50} bps`}
            deltaPositive={false}
            subtitle="Weighted avg across all funds" />
          <KpiCard title="Cecabank Rev. (est.)"
            value={rev(s.est_cecabank_rev_k)}
            delta={`+${rev(d.scenarios[2].delta_vs_cecabank_k)} at market median`}
            deltaPositive={true}
            subtitle="Annual depositary revenue foregone" />
        </div>

        {/* Sub-tab nav */}
        <div style={{ display: 'flex', gap: 4, marginTop: 20, borderTop: '1px solid #2a2a3a', paddingTop: 16 }}>
          {SUB_TABS.map(t => (
            <button key={t.id} onClick={() => setSubTab(t.id)} style={{
              padding: '7px 16px', borderRadius: 6, border: 'none',
              background: subTab === t.id ? '#10b98120' : 'transparent',
              color: subTab === t.id ? '#10b981' : '#8888a0',
              fontFamily: "'Outfit', sans-serif", fontSize: 13,
              fontWeight: subTab === t.id ? 600 : 400, cursor: 'pointer',
              borderBottom: subTab === t.id ? '2px solid #10b981' : '2px solid transparent',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'overview'  && <OverviewSection />}
      {subTab === 'portfolio' && <PortfolioSection />}
      {subTab === 'investors' && <InvestorsSection />}
      {subTab === 'scenarios' && <ScenariosSection />}
    </div>
  );
}
