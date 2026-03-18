import { useState, useMemo } from 'react';
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
import feesData from '../data/cnmv_fees.json';
import depoData from '../data/cnmv_depositaria.json';

/* ── Raw data ────────────────────────────────────────────────── */

interface FundClass {
  isin: string; fund_name: string; gestora: string; grupo: string;
  category: string; share_class: string; patrimonio_m: number;
  investors: number; ter: number; mgmt_fee_aum: number;
  depositary_fee: number;
  mgmt_fee_returns: number; sub_fee_max: number; sub_fee_min: number;
  redemp_fee_max: number; redemp_fee_min: number;
}
interface GestoraDepo {
  gestora: string; depositario: string; grupo: string;
  fund_count: number; total_aum_m: number;
  avg_depo_fee: number; weighted_depo_fee: number;
  is_captive: boolean; is_inversis: boolean;
}
interface GestoraStat {
  gestora: string; count: number; funds: number;
  avg_ter: number; avg_mgmt_fee: number; total_aum_m: number;
}

const allClasses = feesData.funds as FundClass[];
const gestoraNames = feesData.gestoras as string[];
const gestoraStats = feesData.gestora_stats as GestoraStat[];
const gestoraDepoRelations = depoData.gestora_depositario as GestoraDepo[];
const depoSummary = depoData.summary as { inversis_avg_fee: number };

/* ── Helpers ─────────────────────────────────────────────────── */

const rev = (k: number) => k >= 1000 ? `€${(k / 1000).toFixed(2)}M` : `€${k.toFixed(0)}K`;
const fmtM = (v: number) => `€${v.toFixed(1)}M`;
const fmtB = (v: number) => `€${v.toFixed(2)}B`;
const fmt = (v: number, decimals = 1) => v.toFixed(decimals);

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const frac = idx - lower;
  if (lower + 1 >= sorted.length) return sorted[lower];
  return sorted[lower] + frac * (sorted[lower + 1] - sorted[lower]);
}

function percentileOf(arr: number[], value: number): number {
  const below = arr.filter(v => v < value).length;
  return Math.round((below / arr.length) * 100);
}

/* ── Category benchmarks (market-wide) ───────────────────────── */

interface CategoryBenchmark {
  category: string;
  median_fee_bps: number;
  total_aum_m: number;
  gestora_count: number;
}

function useCategoryBenchmarks() {
  return useMemo(() => {
    // Group all classes by category, then compute each gestora's weighted fee per category
    const catGestoraFees = new Map<string, Map<string, { aum_m: number; fee_aum: number }>>();

    for (const c of allClasses) {
      if (!catGestoraFees.has(c.category)) catGestoraFees.set(c.category, new Map());
      const gMap = catGestoraFees.get(c.category)!;
      const entry = gMap.get(c.gestora) ?? { aum_m: 0, fee_aum: 0 };
      entry.aum_m += c.patrimonio_m;
      entry.fee_aum += c.patrimonio_m * c.depositary_fee;
      gMap.set(c.gestora, entry);
    }

    const benchmarks: CategoryBenchmark[] = [];
    for (const [cat, gMap] of catGestoraFees) {
      const gestoraFees: number[] = [];
      let totalAum = 0;
      for (const [, v] of gMap) {
        if (v.aum_m > 0) gestoraFees.push((v.fee_aum / v.aum_m) * 100); // bps
        totalAum += v.aum_m;
      }
      if (gestoraFees.length === 0) continue;
      const sorted = [...gestoraFees].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      benchmarks.push({
        category: cat,
        median_fee_bps: +median.toFixed(2),
        total_aum_m: totalAum,
        gestora_count: gMap.size,
      });
    }
    return benchmarks;
  }, []);
}

/* ── Computed data for a given gestora ────────────────────────── */

interface ComputedFund {
  fund: string; category: string;
  aum_m: number; aum_pct: number; classes: number;
  class_detail: { isin: string; share_class: string; aum_k: number; dep_fee_bps: number; mgmt_fee_pct: number | null }[];
  investors: number; wtd_dep_fee_bps: number; est_dep_rev_k: number;
}
interface ComputedCategory {
  category: string; aum_m: number; aum_pct: number;
  funds: number; classes: number; investors: number; wtd_dep_fee_bps: number;
}
interface ComputedPeer {
  gestora: string; gestora_short: string; aum_bn: number;
  funds: number; classes: number; investors: number;
  wtd_dep_fee_bps: number; est_dep_rev_k: number; is_selected: boolean;
}
interface ComputedScenario {
  name: string; fee_bps: number; description: string;
  est_annual_rev_k: number; delta_vs_current_k: number;
}

interface CategoryFeeComparison {
  category: string;
  actual_bps: number;
  benchmark_bps: number;
  gap_bps: number;
  aum_m: number;
  aum_pct: number;
}

function useGestoraAnalysis(gestora: string, benchmarks: CategoryBenchmark[]) {
  return useMemo(() => {
    if (!gestora) return null;

    // 1. Filter all share classes for this gestora
    const classes = allClasses.filter(f => f.gestora === gestora);
    if (classes.length === 0) return null;

    const grupo = classes[0].grupo;
    const totalAumM = classes.reduce((s, c) => s + c.patrimonio_m, 0);
    const totalAumBn = totalAumM / 1000;
    const totalAumK = totalAumM * 1000;

    // 2. Group by fund_name
    const fundMap = new Map<string, FundClass[]>();
    for (const c of classes) {
      const arr = fundMap.get(c.fund_name) ?? [];
      arr.push(c);
      fundMap.set(c.fund_name, arr);
    }

    // 3. Build fund array
    const funds: ComputedFund[] = [];
    for (const [fundName, fundClasses] of fundMap) {
      const fundAum = fundClasses.reduce((s, c) => s + c.patrimonio_m, 0);
      // Include zero-fee classes in weighted avg — zero fees are real (intragroup pricing), not missing data
      const wtdFee = fundAum > 0
        ? fundClasses.reduce((s, c) => s + c.patrimonio_m * c.depositary_fee, 0) / fundAum
        : 0;

      funds.push({
        fund: fundName,
        category: fundClasses[0].category,
        aum_m: fundAum,
        aum_pct: totalAumM > 0 ? +(fundAum / totalAumM * 100).toFixed(1) : 0,
        classes: fundClasses.length,
        class_detail: fundClasses.map(c => ({
          isin: c.isin,
          share_class: c.share_class,
          aum_k: c.patrimonio_m * 1000,
          dep_fee_bps: +(c.depositary_fee * 100).toFixed(2),
          mgmt_fee_pct: c.mgmt_fee_aum > 0 ? c.mgmt_fee_aum : null,
        })),
        investors: fundClasses[0].investors, // fund-level, same across classes
        wtd_dep_fee_bps: +(wtdFee * 100).toFixed(2),
        est_dep_rev_k: +(fundAum * wtdFee * 10).toFixed(1), // aum_m * (fee/100) * 1000 = aum_m * fee * 10
      });
    }
    funds.sort((a, b) => b.aum_m - a.aum_m);

    // 4. Total stats
    const totalFunds = funds.length;
    const totalClasses = classes.length;
    const totalInvestors = funds.reduce((s, f) => s + f.investors, 0);
    const categories = [...new Set(funds.map(f => f.category))];

    // Weighted depositary fee across ALL classes (including zero-fee — they represent real intragroup pricing)
    const wtdDepFeePct = totalAumM > 0
      ? classes.reduce((s, c) => s + c.patrimonio_m * c.depositary_fee, 0) / totalAumM
      : 0;
    const wtdDepFeeBps = +(wtdDepFeePct * 100).toFixed(2);
    const estCurrentRevK = +(totalAumK * wtdDepFeePct / 100).toFixed(0);

    // AUM rank
    const sortedByAum = [...gestoraStats].sort((a, b) => b.total_aum_m - a.total_aum_m);
    const aumRank = sortedByAum.findIndex(g => g.gestora === gestora) + 1;

    // Fee percentile (among all gestoras with depositary fee data)
    const allWtdFees = gestoraDepoRelations.filter(g => g.weighted_depo_fee > 0).map(g => g.weighted_depo_fee * 100);
    const feePercentile = allWtdFees.length > 0 ? percentileOf(allWtdFees, wtdDepFeeBps) : 0;

    // Market context
    const mktP25 = allWtdFees.length > 0 ? +percentile(allWtdFees, 25).toFixed(1) : 0;
    const mktP50 = allWtdFees.length > 0 ? +percentile(allWtdFees, 50).toFixed(1) : 0;
    const mktP75 = allWtdFees.length > 0 ? +percentile(allWtdFees, 75).toFixed(1) : 0;

    // 5. Current depositary
    const depoRelation = gestoraDepoRelations.find(g => g.gestora === gestora);
    const currentDepositario = depoRelation?.depositario ?? 'Unknown';

    // 6. Category breakdown
    const catMap = new Map<string, { aum_m: number; funds: number; classes: number; investors: number; fee_aum: number }>();
    for (const f of funds) {
      const entry = catMap.get(f.category) ?? { aum_m: 0, funds: 0, classes: 0, investors: 0, fee_aum: 0 };
      entry.aum_m += f.aum_m;
      entry.funds += 1;
      entry.classes += f.classes;
      entry.investors += f.investors;
      // Include zero-fee funds in weighted average
      entry.fee_aum += f.aum_m * f.wtd_dep_fee_bps;
      catMap.set(f.category, entry);
    }
    const catBreakdown: ComputedCategory[] = [...catMap.entries()]
      .map(([cat, v]) => ({
        category: cat,
        aum_m: +v.aum_m.toFixed(1),
        aum_pct: totalAumM > 0 ? +(v.aum_m / totalAumM * 100).toFixed(1) : 0,
        funds: v.funds,
        classes: v.classes,
        investors: v.investors,
        wtd_dep_fee_bps: v.aum_m > 0 ? +(v.fee_aum / v.aum_m).toFixed(1) : 0,
      }))
      .sort((a, b) => b.aum_m - a.aum_m);

    // 7. Peers (similar-sized gestoras, ±5 rank positions, plus some larger/smaller for context)
    const peerRange = 5;
    const startIdx = Math.max(0, aumRank - 1 - peerRange);
    const endIdx = Math.min(sortedByAum.length, aumRank + peerRange);
    const peerGestoras = sortedByAum.slice(startIdx, endIdx);

    const peers: ComputedPeer[] = peerGestoras.map(pg => {
      const pgClasses = allClasses.filter(c => c.gestora === pg.gestora);
      const pgFundMap = new Map<string, FundClass[]>();
      for (const c of pgClasses) {
        const arr = pgFundMap.get(c.fund_name) ?? [];
        arr.push(c);
        pgFundMap.set(c.fund_name, arr);
      }
      const pgInvestors = [...pgFundMap.values()].reduce((s, fc) => s + fc[0].investors, 0);
      // Compute weighted fee directly from raw classes (including zeros — real intragroup pricing)
      const pgAumM = pgClasses.reduce((s, c) => s + c.patrimonio_m, 0);
      const pgWtdFee = pgAumM > 0
        ? (pgClasses.reduce((s, c) => s + c.patrimonio_m * c.depositary_fee, 0) / pgAumM) * 100
        : 0;
      return {
        gestora: pg.gestora,
        gestora_short: pg.gestora.split(',')[0],
        aum_bn: +(pg.total_aum_m / 1000).toFixed(2),
        funds: pg.funds,
        classes: pg.count,
        investors: pgInvestors,
        wtd_dep_fee_bps: +pgWtdFee.toFixed(2),
        est_dep_rev_k: +(pg.total_aum_m * 1000 * pgWtdFee / 10000).toFixed(0),
        is_selected: pg.gestora === gestora,
      };
    }).sort((a, b) => b.aum_bn - a.aum_bn);

    // 8. Category-adjusted fee analysis
    const benchmarkMap = new Map(benchmarks.map(b => [b.category, b.median_fee_bps]));
    let fairFeeWeighted = 0;
    for (const c of catBreakdown) {
      fairFeeWeighted += c.aum_m * (benchmarkMap.get(c.category) ?? 0);
    }
    const fairFeeBps = totalAumM > 0 ? +(fairFeeWeighted / totalAumM).toFixed(2) : 0;
    const feeGapBps = +(wtdDepFeeBps - fairFeeBps).toFixed(2);

    const categoryFeeComparison: CategoryFeeComparison[] = catBreakdown.map(c => ({
      category: c.category,
      actual_bps: c.wtd_dep_fee_bps,
      benchmark_bps: +(benchmarkMap.get(c.category) ?? 0).toFixed(2),
      gap_bps: +(c.wtd_dep_fee_bps - (benchmarkMap.get(c.category) ?? 0)).toFixed(2),
      aum_m: c.aum_m,
      aum_pct: c.aum_pct,
    }));

    // 9. Revenue scenarios
    // Revenue = AUM_K * fee_bps / 10000 (1 bps = 0.01% = 0.0001)
    const revAtBps = (bps: number) => +(totalAumK * bps / 10000).toFixed(0);
    const fairFeeRevK = revAtBps(fairFeeBps);
    const scenarios: ComputedScenario[] = [
      {
        name: `${currentDepositario.split(',')[0]} (current)`,
        fee_bps: wtdDepFeeBps,
        description: `Current depositary rate — weighted average across all funds`,
        est_annual_rev_k: estCurrentRevK,
        delta_vs_current_k: 0,
      },
      {
        name: 'Competitive (P25)',
        fee_bps: mktP25,
        description: `Market 25th percentile — aggressive competitive pricing`,
        est_annual_rev_k: revAtBps(mktP25),
        delta_vs_current_k: +(revAtBps(mktP25) - estCurrentRevK).toFixed(0),
      },
      {
        name: 'Market Median',
        fee_bps: mktP50,
        description: `Market median depositary fee — standard market pricing`,
        est_annual_rev_k: revAtBps(mktP50),
        delta_vs_current_k: +(revAtBps(mktP50) - estCurrentRevK).toFixed(0),
      },
      {
        name: 'Premium (P75)',
        fee_bps: mktP75,
        description: `Market 75th percentile — premium service pricing`,
        est_annual_rev_k: revAtBps(mktP75),
        delta_vs_current_k: +(revAtBps(mktP75) - estCurrentRevK).toFixed(0),
      },
      {
        name: 'Category-Adjusted Fair',
        fee_bps: fairFeeBps,
        description: `Weighted median by fund category — accounts for portfolio mix`,
        est_annual_rev_k: fairFeeRevK,
        delta_vs_current_k: +(fairFeeRevK - estCurrentRevK).toFixed(0),
      },
    ];

    // Fixed income %
    const fixedIncomePct = catBreakdown
      .filter(c => c.category.startsWith('RF'))
      .reduce((s, c) => s + c.aum_pct, 0);

    return {
      gestora, grupo, currentDepositario,
      gestora_short: gestora.split(',')[0],
      summary: {
        total_aum_bn: totalAumBn,
        total_funds: totalFunds,
        total_classes: totalClasses,
        total_investors: totalInvestors,
        total_categories: categories.length,
        wtd_dep_fee_bps: wtdDepFeeBps,
        est_current_rev_k: estCurrentRevK,
        aum_rank_spain: aumRank,
        fee_percentile: feePercentile,
        fixed_income_pct: fixedIncomePct,
      },
      market_context: {
        total_gestoras: gestoraStats.length,
        mkt_dep_fee_p25: mktP25,
        mkt_dep_fee_p50: mktP50,
        mkt_dep_fee_p75: mktP75,
      },
      funds, categories: catBreakdown, peers, scenarios,
      categoryFeeComparison, fairFeeBps, feeGapBps,
    };
  }, [gestora, benchmarks]);
}

/* ── Sub-tab config ──────────────────────────────────────────── */

const SUB_TABS = [
  { id: 'overview',    label: 'Overview'          },
  { id: 'portfolio',   label: 'Fund Portfolio'    },
  { id: 'investors',   label: 'Investor Profile'  },
  { id: 'scenarios',   label: 'Revenue Scenarios' },
] as const;
type SubTab = (typeof SUB_TABS)[number]['id'];

/* ── Sub-components ──────────────────────────────────────────── */

type AnalysisData = NonNullable<ReturnType<typeof useGestoraAnalysis>>;

function OverviewSection({ d }: { d: AnalysisData }) {
  const { summary: s, market_context: mc } = d;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <InsightCard title="Strategic Summary" color="#10b981">
        <strong>{d.gestora_short}</strong> is Spain's <strong>#{s.aum_rank_spain}</strong> fund manager
        by AUM (€{s.total_aum_bn.toFixed(1)}B, {s.total_funds} funds, {s.total_investors.toLocaleString()} investors).
        Currently custodied at <strong>{d.currentDepositario.split(',')[0]}</strong> — paying <strong>{s.wtd_dep_fee_bps.toFixed(2)} bps</strong> weighted
        ({s.fee_percentile}th percentile, {s.wtd_dep_fee_bps < mc.mkt_dep_fee_p50 ? 'below' : 'above'} the {mc.mkt_dep_fee_p50.toFixed(1)} bps market median).
        Category-adjusted fair fee for this portfolio: <strong style={{ color: d.feeGapBps > 0 ? '#ef4444' : '#10b981' }}>{d.fairFeeBps.toFixed(1)} bps</strong>
        {' '}({d.feeGapBps > 0 ? 'overpaying' : 'underpaying'} by {Math.abs(d.feeGapBps).toFixed(1)} bps).
        The book is {s.fixed_income_pct.toFixed(0)}% fixed income by AUM.
        Estimated depositary revenue currently: <strong>~{rev(s.est_current_rev_k)}/yr</strong>.
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

      {/* Category-adjusted fee comparison */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Depositary Fee vs Category Benchmark" source="CNMV A2.2 — category-adjusted" />
        <div style={{ marginBottom: 12, fontSize: 12, color: '#8888a0' }}>
          Actual fee vs market median for each fund category. Fair fee for this portfolio mix: <strong style={{ color: d.feeGapBps > 0 ? '#ef4444' : '#10b981' }}>{d.fairFeeBps.toFixed(1)} bps</strong>
          {' '}(gap: <span style={{ color: d.feeGapBps > 0 ? '#ef4444' : '#10b981' }}>{d.feeGapBps > 0 ? '+' : ''}{d.feeGapBps.toFixed(1)} bps</span>)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {d.categoryFeeComparison.map(c => {
            const maxFee = Math.max(...d.categoryFeeComparison.map(x => Math.max(x.actual_bps, x.benchmark_bps)), 1);
            return (
              <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 160, fontSize: 11, color: '#8888a0', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', flexShrink: 0 }}>
                  {c.category}
                </div>
                <div style={{ flex: 1, position: 'relative', height: 22 }}>
                  {/* Benchmark bar (background) */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0,
                    width: `${(c.benchmark_bps / maxFee) * 100}%`, height: '100%',
                    borderRadius: 3, background: '#3b82f640', border: '1px dashed #3b82f680',
                  }} />
                  {/* Actual bar (foreground) */}
                  <div style={{
                    position: 'absolute', top: 2, left: 0,
                    width: `${(c.actual_bps / maxFee) * 100}%`, height: 18,
                    borderRadius: 3, background: c.gap_bps > 0.5 ? '#ef444490' : c.gap_bps < -0.5 ? '#10b98190' : '#8888a060',
                    minWidth: c.actual_bps > 0 ? 4 : 0,
                  }} />
                </div>
                <div style={{ width: 55, textAlign: 'right', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#f59e0b' }}>
                  {c.actual_bps.toFixed(1)}
                </div>
                <div style={{ width: 55, textAlign: 'right', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#3b82f6' }}>
                  {c.benchmark_bps.toFixed(1)}
                </div>
                <div style={{ width: 55, textAlign: 'right', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: c.gap_bps > 0.5 ? '#ef4444' : c.gap_bps < -0.5 ? '#10b981' : '#555570' }}>
                  {c.gap_bps > 0 ? '+' : ''}{c.gap_bps.toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'flex-end', marginTop: 10, fontSize: 10, color: '#555570' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#f59e0b', borderRadius: 2, marginRight: 4 }} />Actual</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#3b82f640', border: '1px dashed #3b82f680', borderRadius: 2, marginRight: 4 }} />Category Median</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#ef444490', borderRadius: 2, marginRight: 4 }} />Overpaying</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#10b98190', borderRadius: 2, marginRight: 4 }} />Underpaying</span>
        </div>
      </div>

      {/* Peer comparison — AUM */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="AUM vs Peers — Similar-Sized Gestoras" source="CNMV Estadísticas IIC — Anexo A2.2" />
        <ResponsiveContainer width="100%" height={Math.max(200, d.peers.length * 32)}>
          <BarChart data={d.peers} layout="vertical" margin={{ ...CHART_MARGIN, left: 180 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis type="number" tickFormatter={v => `€${v.toFixed(1)}B`}
              tick={{ fill: '#8888a0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
            <YAxis type="category" dataKey="gestora_short" width={175}
              tick={{ fill: '#8888a0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
            <Tooltip content={<ChartTooltip prefix="€" suffix="B" decimals={2} />} />
            <Bar dataKey="aum_bn" radius={[0, 4, 4, 0]}>
              {d.peers.map((p, i) => (
                <Cell key={`${p.gestora_short}-${i}`} fill={p.is_selected ? '#10b981' : '#3b82f6'} opacity={p.is_selected ? 1 : 0.6} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Depositary fee vs peers */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Depositary Fee vs Peer Gestoras (bps)" source="CNMV Estadísticas IIC — Anexo A2.2" />
        <ResponsiveContainer width="100%" height={Math.max(200, d.peers.length * 32)}>
          <BarChart data={d.peers} layout="vertical" margin={{ ...CHART_MARGIN, left: 180 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis type="number" tickFormatter={v => `${v} bps`}
              tick={{ fill: '#8888a0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
            <YAxis type="category" dataKey="gestora_short" width={175}
              tick={{ fill: '#8888a0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
            <Tooltip content={<ChartTooltip suffix=" bps" decimals={2} />} />
            <ReferenceLine x={d.fairFeeBps} stroke="#f59e0b" strokeDasharray="4 3"
              label={{ value: `Fair ${d.fairFeeBps.toFixed(1)} bps`, fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} />
            <Bar dataKey="wtd_dep_fee_bps" radius={[0, 4, 4, 0]}>
              {d.peers.map((p, i) => (
                <Cell key={`${p.gestora_short}-${i}`} fill={p.is_selected ? '#10b981' : '#6366f1'} opacity={p.is_selected ? 1 : 0.6} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PortfolioSection({ d }: { d: AnalysisData }) {
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
    { key: 'est_dep_rev_k', label: 'Est. Rev', align: 'right' as const, format: (v: unknown) => rev(Number(v)) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title={`Fund Portfolio — ${d.summary.total_funds} Funds, ${d.summary.total_classes} Share Classes`}
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
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: c.dep_fee_bps > 0 ? '#f59e0b' : '#555570' }}>
                            {c.dep_fee_bps.toFixed(1)} bps
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

function InvestorsSection({ d }: { d: AnalysisData }) {
  const { summary: s } = d;
  const topFundsByInvestors = useMemo(() => [...d.funds].sort((a, b) => b.investors - a.investors), [d.funds]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <InsightCard title="Investor Profile" color="#6366f1">
        {d.gestora_short} has <strong>{s.total_investors.toLocaleString()} registered fund investors</strong> across {s.total_funds} funds.
        {topFundsByInvestors.length > 0 && <> The largest fund by investor count is <strong>{topFundsByInvestors[0].fund}</strong> ({topFundsByInvestors[0].investors.toLocaleString()} investors).</>}
        {' '}Fixed income categories account for approximately <strong>{s.fixed_income_pct.toFixed(0)}%</strong> of AUM.
      </InsightCard>

      {/* Investors by fund */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Investor Count by Fund" source="CNMV Estadísticas IIC — Anexo A2.2" />
        <ResponsiveContainer width="100%" height={Math.max(250, topFundsByInvestors.length * 28)}>
          <BarChart data={topFundsByInvestors} layout="vertical" margin={{ ...CHART_MARGIN, left: 260 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis type="number" tickFormatter={v => v.toLocaleString()}
              tick={{ fill: '#8888a0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
            <YAxis type="category" dataKey="fund" width={255}
              tickFormatter={(v: string) => v.length > 35 ? v.slice(0, 33) + '..' : v}
              tick={{ fill: '#8888a0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
            <Tooltip content={<ChartTooltip decimals={0} />} />
            <Bar dataKey="investors" radius={[0, 4, 4, 0]}>
              {topFundsByInvestors.map((f, i) => (
                <Cell key={`${f.fund}-${i}`} fill={CATEGORY_COLORS[f.category] || '#6366f1'} opacity={0.85} />
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
            const pct = s.total_investors > 0 ? Math.round(c.investors / s.total_investors * 100) : 0;
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

function ScenariosSection({ d }: { d: AnalysisData }) {
  const { summary: s, market_context: mc } = d;
  const currentRev = d.scenarios[0].est_annual_rev_k;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <InsightCard title="Inversis Revenue Opportunity" color="#f59e0b">
        {d.gestora_short} currently pays <strong>{d.currentDepositario.split(',')[0]} ~{rev(currentRev)}/yr</strong> in depositary fees
        at a weighted {s.wtd_dep_fee_bps.toFixed(2)} bps — {s.wtd_dep_fee_bps < mc.mkt_dep_fee_p50 ? 'below' : 'above'} the {mc.mkt_dep_fee_p50.toFixed(1)} bps market median.
        {d.scenarios[2] && <> At market median ({d.scenarios[2].fee_bps} bps), this mandate would generate <strong>{rev(d.scenarios[2].est_annual_rev_k)}/yr</strong> for Inversis —
        a <strong>{d.scenarios[2].delta_vs_current_k > 0 ? '+' : ''}{rev(Math.abs(d.scenarios[2].delta_vs_current_k))}</strong> {d.scenarios[2].delta_vs_current_k > 0 ? 'uplift' : 'reduction'} vs current.</>}
        {' '}The mandate covers {s.total_funds} funds, {s.total_classes} share classes across {s.total_categories} categories,
        with {s.total_investors.toLocaleString()} investors.
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
            <ReferenceLine y={currentRev} stroke="#ef4444" strokeDasharray="4 3"
              label={{ value: 'Current', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
            <Bar dataKey="est_annual_rev_k" radius={[4, 4, 0, 0]}>
              {d.scenarios.map((_, i) => {
                const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
                return <Cell key={i} fill={colors[i] || '#8888a0'} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Scenario detail cards */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Scenario Detail" source={`AUM base: ${fmtB(s.total_aum_bn)}`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {d.scenarios.map((sc, i) => {
            const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
            const col = colors[i] || '#8888a0';
            return (
              <div key={sc.name} style={{
                background: '#0a0a0f', border: `1px solid ${col}30`,
                borderLeft: `3px solid ${col}`, borderRadius: 8, padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 20,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f0', fontFamily: "'Outfit', sans-serif" }}>
                    {sc.name} <span style={{ fontSize: 11, color: '#8888a0', fontWeight: 400 }}>({fmt(sc.fee_bps, 1)} bps)</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#8888a0', marginTop: 4 }}>{sc.description}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: col, fontFamily: "'JetBrains Mono', monospace" }}>
                    {rev(sc.est_annual_rev_k)}
                  </div>
                  {sc.delta_vs_current_k !== 0 && (
                    <div style={{ fontSize: 12, color: sc.delta_vs_current_k > 0 ? '#10b981' : '#ef4444', marginTop: 2 }}>
                      {sc.delta_vs_current_k > 0 ? '+' : ''}{rev(Math.abs(sc.delta_vs_current_k))} vs current
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Complexity metrics */}
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

/* ── Gestora selector with search ────────────────────────────── */

function GestoraSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [search, setSearch] = useState('');

  const filteredGestoras = useMemo(() => {
    if (!search) return gestoraNames;
    const q = search.toLowerCase();
    return gestoraNames.filter(g => g.toLowerCase().includes(q));
  }, [search]);

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
      <input
        type="text"
        placeholder="Search gestora..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ minWidth: 180, maxWidth: 250 }}
      />
      <select
        value={value}
        onChange={e => { onChange(e.target.value); setSearch(''); }}
        style={{ fontSize: 12, flex: 1, maxWidth: 400 }}
      >
        <option value="">Select a gestora ({gestoraNames.length} available)</option>
        {filteredGestoras.map(g => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────── */

export default function ProspectAnalysis() {
  const [selectedGestora, setSelectedGestora] = useState('');
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const benchmarks = useCategoryBenchmarks();
  const analysis = useGestoraAnalysis(selectedGestora, benchmarks);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#e8e8f0', fontFamily: "'Outfit', sans-serif" }}>
              {analysis ? analysis.gestora_short : 'Prospect Analysis'}
            </div>
            <div style={{ fontSize: 13, color: '#8888a0', marginTop: 4 }}>
              {analysis
                ? <>Business opportunity analysis · Current depositary: <strong style={{ color: '#ef4444' }}>{analysis.currentDepositario.split(',')[0]}</strong></>
                : 'Select a gestora to analyze depositary opportunity'}
            </div>
          </div>
          {analysis && (
            <div style={{
              padding: '6px 14px', borderRadius: 6, background: '#10b98120',
              border: '1px solid #10b98140', fontSize: 11, color: '#10b981',
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
            }}>
              PROSPECT · CNMV Q3 2025
            </div>
          )}
        </div>

        {/* Gestora selector */}
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
          padding: '12px 0', borderBottom: analysis ? '1px solid #2a2a3a' : 'none',
          marginBottom: analysis ? 16 : 0,
        }}>
          <GestoraSelector value={selectedGestora} onChange={v => { setSelectedGestora(v); setSubTab('overview'); }} />
        </div>

        {/* KPI row + sub-tabs — only when gestora selected */}
        {analysis && (
          <>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
              <KpiCard title={`AUM (${analysis.gestora_short})`}
                value={fmtB(analysis.summary.total_aum_bn)}
                subtitle={`#${analysis.summary.aum_rank_spain} gestora in Spain`} />
              <KpiCard title="Funds / Classes"
                value={`${analysis.summary.total_funds} / ${analysis.summary.total_classes}`}
                subtitle={`${analysis.summary.total_categories} asset categories`} />
              <KpiCard title="Investors"
                value={analysis.summary.total_investors.toLocaleString()}
                subtitle="Registered fund investors" />
              <KpiCard title="Current Dep. Fee"
                value={`${fmt(analysis.summary.wtd_dep_fee_bps, 2)} bps`}
                delta={`${analysis.summary.fee_percentile}th pctl · Median: ${analysis.market_context.mkt_dep_fee_p50} bps`}
                deltaPositive={false}
                subtitle="Weighted avg across all funds" />
              <KpiCard title="Current Rev. (est.)"
                value={rev(analysis.summary.est_current_rev_k)}
                delta={analysis.scenarios[2] ? `${analysis.scenarios[2].delta_vs_current_k > 0 ? '+' : ''}${rev(Math.abs(analysis.scenarios[2].delta_vs_current_k))} at market median` : undefined}
                deltaPositive={analysis.scenarios[2] ? analysis.scenarios[2].delta_vs_current_k > 0 : undefined}
                subtitle="Annual depositary revenue" />
            </div>

            {/* Sub-tab nav */}
            <div style={{ display: 'flex', gap: 4, borderTop: '1px solid #2a2a3a', paddingTop: 16 }}>
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
          </>
        )}
      </div>

      {/* Empty state */}
      {!analysis && selectedGestora === '' && (
        <div style={{
          background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12,
          padding: 48, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#e8e8f0', fontFamily: "'Outfit', sans-serif", marginBottom: 8 }}>
            Select a Gestora to Begin
          </div>
          <div style={{ fontSize: 13, color: '#8888a0', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
            Choose any of the {gestoraNames.length} Spanish fund managers to generate a full
            depositary opportunity analysis — portfolio composition, fee benchmarking,
            peer comparison, and revenue scenarios.
          </div>
        </div>
      )}

      {/* Content */}
      {analysis && (
        <>
          {subTab === 'overview'  && <OverviewSection d={analysis} />}
          {subTab === 'portfolio' && <PortfolioSection d={analysis} />}
          {subTab === 'investors' && <InvestorsSection d={analysis} />}
          {subTab === 'scenarios' && <ScenariosSection d={analysis} />}
        </>
      )}
    </div>
  );
}
