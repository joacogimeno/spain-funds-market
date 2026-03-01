import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ReferenceLine } from 'recharts';
import SectionHeader from '../components/SectionHeader';
import TrendBadge from '../components/TrendBadge';
import InsightCard from '../components/InsightCard';
import { CHART_MARGIN, CATEGORY_COLORS } from '../theme';
import data from '../data/monthly_report.json';

const { report_month, prev_month, headline, category_changes, category_flows,
  performance, group_movers, gestora_movers_top, gestora_movers_bottom,
  inversis: _inversis, highlights } = data;
const inversis = _inversis as {
  group: { name: string; aum_bn: number; var_1m: number; var_ytd: number; var_1y: number; num_isin: number } | null;
  gestora: { curr_aum_bn: number; delta_bn: number; delta_pct: number } | null;
};

const MONTH_NAMES: Record<string, string> = {
  '01': 'January', '02': 'February', '03': 'March', '04': 'April',
  '05': 'May', '06': 'June', '07': 'July', '08': 'August',
  '09': 'September', '10': 'October', '11': 'November', '12': 'December',
};

function formatMonth(label: string) {
  const [y, m] = label.split('-');
  return `${MONTH_NAMES[m] || m} ${y}`;
}

function DeltaCell({ value, suffix = '', decimals = 1 }: { value: number | null; suffix?: string; decimals?: number }) {
  if (value == null) return <span style={{ color: '#555570' }}>-</span>;
  const color = value > 0 ? '#10b981' : value < 0 ? '#ef4444' : '#8888a0';
  const sign = value > 0 ? '+' : '';
  return <span style={{ color, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{sign}{value.toFixed(decimals)}{suffix}</span>;
}

function MiniKpi({ label, value, delta, deltaLabel, positive }: {
  label: string; value: string; delta?: string; deltaLabel?: string; positive?: boolean;
}) {
  return (
    <div style={{ flex: 1, background: '#0a0a0f', borderRadius: 8, padding: '14px 18px', border: '1px solid #2a2a3a' }}>
      <div style={{ fontSize: 11, color: '#555570', marginBottom: 4, fontFamily: "'Outfit', sans-serif" }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: '#e8e8f0' }}>{value}</div>
      {delta && (
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: positive ? '#10b981' : positive === false ? '#ef4444' : '#8888a0', marginTop: 2 }}>
          {delta}{deltaLabel ? <span style={{ color: '#555570', marginLeft: 6 }}>{deltaLabel}</span> : null}
        </div>
      )}
    </div>
  );
}

export default function MonthlyReport() {
  const monthLabel = formatMonth(report_month);
  const prevLabel = formatMonth(prev_month);

  // Category AUM waterfall data
  const catWaterfall = useMemo(() =>
    category_changes.map(c => ({
      ...c,
      fill: c.delta_bn > 0 ? '#10b981' : '#ef4444',
    })), []);

  // Top/bottom performers for the month
  const topPerformers = performance.filter(p => p.return_month != null).slice(0, 8);
  const bottomPerformers = performance.filter(p => p.return_month != null).slice(-5).reverse();

  // Group movers: filter meaningful size (>€0.5B) for top movers chart
  const significantGroupMovers = useMemo(() => {
    const filtered = group_movers.filter(g => g.aum_bn > 0.5);
    const top10 = filtered.slice(0, 10);
    const bottom10 = filtered.slice(-10).reverse();
    return { top10, bottom10 };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Report Header */}
      <div style={{ background: 'linear-gradient(135deg, #16161f, #1a1a2e)', border: '1px solid #2a2a3a', borderRadius: 12, padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: '#d42030', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              Monthly Report
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#e8e8f0', fontFamily: "'Outfit', sans-serif" }}>
              {monthLabel}
            </div>
            <div style={{ fontSize: 13, color: '#555570', fontFamily: "'Outfit', sans-serif", marginTop: 4 }}>
              vs {prevLabel}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 36, fontWeight: 700, color: headline.aum_delta_bn > 0 ? '#10b981' : '#ef4444' }}>
              {headline.aum_delta_bn > 0 ? '+' : ''}{'\u20AC'}{headline.aum_delta_bn.toFixed(1)}B
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: '#8888a0', marginTop: 2 }}>
              {headline.aum_delta_pct > 0 ? '+' : ''}{headline.aum_delta_pct.toFixed(2)}% MoM
            </div>
          </div>
        </div>
      </div>

      {/* Key Highlights */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Key Highlights" source="Auto-generated analysis" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {highlights.map((h: { type: string; icon: string; text: string }, i: number) => {
            const iconMap: Record<string, string> = {
              chart: '\u25B2', flows: '\u21C4', trend: '\u2192', up: '\u25B2',
              down: '\u25BC', star: '\u2605', alert: '\u26A0', inflow: '\u2192',
              people: '\u2302', building: '\u2302',
            };
            const colorMap: Record<string, string> = {
              headline: '#3b82f6', attribution: '#8b5cf6', flows: '#10b981',
              category: '#f59e0b', performance: '#ef4444', investors: '#06b6d4',
              group: '#d42030',
            };
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '10px 14px', borderRadius: 8,
                background: `${colorMap[h.type] || '#3b82f6'}08`,
                borderLeft: `3px solid ${colorMap[h.type] || '#3b82f6'}60`,
              }}>
                <span style={{ color: colorMap[h.type] || '#3b82f6', fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                  {iconMap[h.icon] || '\u2022'}
                </span>
                <span style={{ color: '#c8c8d0', fontSize: 13, fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
                  {h.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Headline KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        <MiniKpi
          label="Total AUM"
          value={`\u20AC${headline.total_aum_bn.toFixed(1)}B`}
          delta={`${headline.aum_delta_bn > 0 ? '+' : ''}\u20AC${headline.aum_delta_bn.toFixed(1)}B`}
          deltaLabel="MoM"
          positive={headline.aum_delta_bn > 0}
        />
        <MiniKpi
          label="Net Flows"
          value={`\u20AC${headline.net_flows_bn.toFixed(2)}B`}
          delta={`${headline.net_flows_bn > headline.prev_net_flows_bn ? '\u25B2' : '\u25BC'} from \u20AC${headline.prev_net_flows_bn.toFixed(2)}B`}
          positive={headline.net_flows_bn > headline.prev_net_flows_bn}
        />
        <MiniKpi
          label="Market Effect"
          value={`${headline.market_effect_bn > 0 ? '+' : ''}\u20AC${headline.market_effect_bn.toFixed(1)}B`}
          delta={`${((headline.market_effect_bn / headline.prev_aum_bn) * 100).toFixed(2)}% return`}
          positive={headline.market_effect_bn > 0}
        />
        <MiniKpi
          label="Investors"
          value={headline.investors.toLocaleString()}
          delta={`${headline.inv_delta > 0 ? '+' : ''}${headline.inv_delta.toLocaleString()}`}
          deltaLabel={`(${headline.inv_delta_pct > 0 ? '+' : ''}${headline.inv_delta_pct.toFixed(2)}%)`}
          positive={headline.inv_delta > 0}
        />
        <MiniKpi
          label="Active Funds"
          value={headline.funds.toLocaleString()}
          delta={`${headline.funds_delta > 0 ? '+' : ''}${headline.funds_delta}`}
          deltaLabel="new funds"
          positive={headline.funds_delta > 0}
        />
      </div>

      {/* Growth Attribution — Flows vs Market */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Growth Attribution" source="INVERCO" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {/* Stacked bar visual */}
            <div style={{ position: 'relative', height: 48, borderRadius: 8, overflow: 'hidden', background: '#0a0a0f' }}>
              {headline.aum_delta_bn > 0 ? (
                <>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${Math.max(0, (headline.net_flows_bn / headline.aum_delta_bn) * 100)}%`,
                    background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#fff', fontWeight: 600,
                  }}>
                    Flows {'\u20AC'}{headline.net_flows_bn.toFixed(1)}B
                  </div>
                  <div style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0,
                    width: `${Math.max(0, (headline.market_effect_bn / headline.aum_delta_bn) * 100)}%`,
                    background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#fff', fontWeight: 600,
                  }}>
                    Market {'\u20AC'}{headline.market_effect_bn.toFixed(1)}B
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ef4444', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                  AUM declined {'\u20AC'}{Math.abs(headline.aum_delta_bn).toFixed(1)}B
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8888a0', fontFamily: "'JetBrains Mono', monospace" }}>
              <span>Flows: {((headline.net_flows_bn / headline.aum_delta_bn) * 100).toFixed(0)}%</span>
              <span>Market: {((headline.market_effect_bn / headline.aum_delta_bn) * 100).toFixed(0)}%</span>
            </div>

            {/* Flow details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
              <div style={{ background: '#0a0a0f', borderRadius: 6, padding: '10px 14px', border: '1px solid #2a2a3a' }}>
                <div style={{ fontSize: 10, color: '#555570' }}>Subscriptions</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: '#10b981', fontWeight: 600 }}>
                  {'\u20AC'}{headline.total_subs_bn.toFixed(1)}B
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#555570' }}>
                  prev: {'\u20AC'}{headline.prev_subs_bn.toFixed(1)}B ({headline.total_subs_bn > headline.prev_subs_bn ? '+' : ''}{((headline.total_subs_bn - headline.prev_subs_bn) / headline.prev_subs_bn * 100).toFixed(1)}%)
                </div>
              </div>
              <div style={{ background: '#0a0a0f', borderRadius: 6, padding: '10px 14px', border: '1px solid #2a2a3a' }}>
                <div style={{ fontSize: 10, color: '#555570' }}>Redemptions</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: '#ef4444', fontWeight: 600 }}>
                  {'\u20AC'}{headline.total_redemp_bn.toFixed(1)}B
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#555570' }}>
                  prev: {'\u20AC'}{headline.prev_redemp_bn.toFixed(1)}B ({headline.total_redemp_bn > headline.prev_redemp_bn ? '+' : ''}{((headline.total_redemp_bn - headline.prev_redemp_bn) / headline.prev_redemp_bn * 100).toFixed(1)}%)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Performance Snapshot */}
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Monthly Returns by Category" source="INVERCO — Rentab" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px', gap: 4, padding: '4px 8px', fontSize: 10, color: '#555570', fontFamily: "'JetBrains Mono', monospace" }}>
              <span>Category</span>
              <span style={{ textAlign: 'right' }}>Month</span>
              <span style={{ textAlign: 'right' }}>Prev</span>
              <span style={{ textAlign: 'right' }}>1Y</span>
            </div>
            {topPerformers.map((p, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px', gap: 4,
                padding: '6px 8px', borderRadius: 4,
                background: i % 2 === 0 ? '#0a0a0f' : 'transparent',
                fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
              }}>
                <span style={{ color: '#c8c8d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.category}</span>
                <span style={{ textAlign: 'right' }}><DeltaCell value={p.return_month} suffix="%" decimals={2} /></span>
                <span style={{ textAlign: 'right' }}><DeltaCell value={p.prev_return_month} suffix="%" decimals={2} /></span>
                <span style={{ textAlign: 'right' }}><DeltaCell value={p.return_1y} suffix="%" /></span>
              </div>
            ))}
            {bottomPerformers.length > 0 && (
              <>
                <div style={{ borderTop: '1px solid #2a2a3a', margin: '4px 0' }} />
                {bottomPerformers.map((p, i) => (
                  <div key={`b-${i}`} style={{
                    display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px', gap: 4,
                    padding: '6px 8px', borderRadius: 4,
                    background: i % 2 === 0 ? '#0a0a0f' : 'transparent',
                    fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    <span style={{ color: '#c8c8d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.category}</span>
                    <span style={{ textAlign: 'right' }}><DeltaCell value={p.return_month} suffix="%" decimals={2} /></span>
                    <span style={{ textAlign: 'right' }}><DeltaCell value={p.prev_return_month} suffix="%" decimals={2} /></span>
                    <span style={{ textAlign: 'right' }}><DeltaCell value={p.return_1y} suffix="%" /></span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Category AUM Changes — Waterfall */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title={`Category AUM Changes: ${prevLabel} \u2192 ${monthLabel}`} source="INVERCO — PatrimFondos" />
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={catWaterfall} margin={{ ...CHART_MARGIN, left: 160 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}B`} tick={{ fontSize: 10 }} />
            <YAxis dataKey="category" type="category" tick={{ fontSize: 10 }} width={150} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div style={{ background: '#1e1e2a', border: '1px solid #3a3a4a', borderRadius: 8, padding: '10px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                  <div style={{ color: '#e8e8f0', fontWeight: 600, marginBottom: 6 }}>{d.category}</div>
                  <div style={{ color: '#8888a0' }}>{'\u20AC'}{d.prev_aum_bn.toFixed(1)}B {'\u2192'} {'\u20AC'}{d.curr_aum_bn.toFixed(1)}B</div>
                  <div style={{ color: d.delta_bn > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                    {d.delta_bn > 0 ? '+' : ''}{'\u20AC'}{d.delta_bn.toFixed(2)}B ({d.delta_pct > 0 ? '+' : ''}{d.delta_pct.toFixed(1)}%)
                  </div>
                </div>
              );
            }} />
            <ReferenceLine x={0} stroke="#555570" />
            <Bar dataKey="delta_bn" name="AUM Change" radius={[0, 4, 4, 0]}>
              {catWaterfall.map((entry: { delta_bn: number }, i: number) => (
                <Cell key={i} fill={entry.delta_bn > 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category Flows */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title={`Net Flows by Category — ${monthLabel}`} source="INVERCO — Sus&Reemb" />
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={category_flows} margin={{ ...CHART_MARGIN, left: 180 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}B`} tick={{ fontSize: 10 }} />
            <YAxis dataKey="category" type="category" tick={{ fontSize: 9 }} width={170} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div style={{ background: '#1e1e2a', border: '1px solid #3a3a4a', borderRadius: 8, padding: '10px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                  <div style={{ color: '#e8e8f0', fontWeight: 600, marginBottom: 6 }}>{d.category}</div>
                  <div style={{ color: '#10b981' }}>Subs: {'\u20AC'}{d.subs.toFixed(2)}B</div>
                  <div style={{ color: '#ef4444' }}>Redemptions: {'\u20AC'}{d.redemp.toFixed(2)}B</div>
                  <div style={{ color: d.net > 0 ? '#10b981' : '#ef4444', fontWeight: 600, borderTop: '1px solid #3a3a4a', paddingTop: 4, marginTop: 4 }}>
                    Net: {d.net > 0 ? '+' : ''}{'\u20AC'}{d.net.toFixed(3)}B
                  </div>
                  <div style={{ color: '#8888a0', fontSize: 11, marginTop: 4 }}>
                    Prev month: {d.prev_net > 0 ? '+' : ''}{'\u20AC'}{d.prev_net.toFixed(3)}B
                    <span style={{ color: d.net_change > 0 ? '#10b981' : '#ef4444', marginLeft: 6 }}>
                      ({d.net_change > 0 ? '+' : ''}{'\u20AC'}{d.net_change.toFixed(3)}B)
                    </span>
                  </div>
                </div>
              );
            }} />
            <ReferenceLine x={0} stroke="#555570" />
            <Bar dataKey="net" name="Net Flows" radius={[0, 4, 4, 0]}>
              {category_flows.map((entry: { net: number }, i: number) => (
                <Cell key={i} fill={entry.net > 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Group Movers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Top Movers */}
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Top Group Movers (MoM %)" source="INVERCO — RkGrupos" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 50px', gap: 4, padding: '4px 8px', fontSize: 10, color: '#555570', fontFamily: "'JetBrains Mono', monospace" }}>
              <span>Group</span>
              <span style={{ textAlign: 'right' }}>MoM %</span>
              <span style={{ textAlign: 'right' }}>AUM</span>
              <span style={{ textAlign: 'right' }}>1Y %</span>
            </div>
            {significantGroupMovers.top10.map((g, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 70px 70px 50px', gap: 4,
                padding: '6px 8px', borderRadius: 4,
                background: i % 2 === 0 ? '#0a0a0f' : 'transparent',
                fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
              }}>
                <span style={{ color: '#c8c8d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                <span style={{ textAlign: 'right' }}><TrendBadge value={g.var_1m} /></span>
                <span style={{ textAlign: 'right', color: '#8888a0' }}>{'\u20AC'}{g.aum_bn.toFixed(1)}B</span>
                <span style={{ textAlign: 'right' }}><DeltaCell value={g.var_1y} suffix="%" /></span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Movers */}
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Bottom Group Movers (MoM %)" source="INVERCO — RkGrupos" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 50px', gap: 4, padding: '4px 8px', fontSize: 10, color: '#555570', fontFamily: "'JetBrains Mono', monospace" }}>
              <span>Group</span>
              <span style={{ textAlign: 'right' }}>MoM %</span>
              <span style={{ textAlign: 'right' }}>AUM</span>
              <span style={{ textAlign: 'right' }}>1Y %</span>
            </div>
            {significantGroupMovers.bottom10.map((g, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 70px 70px 50px', gap: 4,
                padding: '6px 8px', borderRadius: 4,
                background: i % 2 === 0 ? '#0a0a0f' : 'transparent',
                fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
              }}>
                <span style={{ color: '#c8c8d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                <span style={{ textAlign: 'right' }}><TrendBadge value={g.var_1m} /></span>
                <span style={{ textAlign: 'right', color: '#8888a0' }}>{'\u20AC'}{g.aum_bn.toFixed(1)}B</span>
                <span style={{ textAlign: 'right' }}><DeltaCell value={g.var_1y} suffix="%" /></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gestora AUM Movers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Top Gestora AUM Gainers" source="INVERCO — RKGestoras" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px', gap: 4, padding: '4px 8px', fontSize: 10, color: '#555570', fontFamily: "'JetBrains Mono', monospace" }}>
              <span>Gestora</span>
              <span style={{ textAlign: 'right' }}>{'\u0394'} AUM</span>
              <span style={{ textAlign: 'right' }}>{'\u0394'} %</span>
            </div>
            {gestora_movers_top.map((g: { name: string; curr_aum_bn: number; delta_bn: number; delta_pct: number | null }, i: number) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 70px 70px', gap: 4,
                padding: '6px 8px', borderRadius: 4,
                background: i % 2 === 0 ? '#0a0a0f' : 'transparent',
                fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
              }}>
                <span style={{ color: '#c8c8d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.name}>
                  {g.name.length > 28 ? g.name.slice(0, 26) + '...' : g.name}
                </span>
                <span style={{ textAlign: 'right' }}><DeltaCell value={g.delta_bn} suffix="B" decimals={2} /></span>
                <span style={{ textAlign: 'right' }}><DeltaCell value={g.delta_pct} suffix="%" /></span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Top Gestora AUM Decliners" source="INVERCO — RKGestoras" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px', gap: 4, padding: '4px 8px', fontSize: 10, color: '#555570', fontFamily: "'JetBrains Mono', monospace" }}>
              <span>Gestora</span>
              <span style={{ textAlign: 'right' }}>{'\u0394'} AUM</span>
              <span style={{ textAlign: 'right' }}>{'\u0394'} %</span>
            </div>
            {gestora_movers_bottom.map((g: { name: string; curr_aum_bn: number; delta_bn: number; delta_pct: number | null }, i: number) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 70px 70px', gap: 4,
                padding: '6px 8px', borderRadius: 4,
                background: i % 2 === 0 ? '#0a0a0f' : 'transparent',
                fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
              }}>
                <span style={{ color: '#c8c8d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.name}>
                  {g.name.length > 28 ? g.name.slice(0, 26) + '...' : g.name}
                </span>
                <span style={{ textAlign: 'right' }}><DeltaCell value={g.delta_bn} suffix="B" decimals={2} /></span>
                <span style={{ textAlign: 'right' }}><DeltaCell value={g.delta_pct} suffix="%" /></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inversis Spotlight */}
      {(inversis.group || inversis.gestora) && (
        <div style={{ background: '#d4203015', border: '1px solid #d4203040', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Inversis — Monthly Snapshot" source="INVERCO — RkGrupos + RKGestoras" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {inversis.group && (
              <div>
                <div style={{ fontSize: 12, color: '#8888a0', marginBottom: 4 }}>Banca March Group</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#e8e8f0' }}>
                  {'\u20AC'}{inversis.group.aum_bn.toFixed(1)}B
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                  <TrendBadge value={inversis.group.var_1m} />
                  <span style={{ color: '#555570', marginLeft: 8, fontSize: 11 }}>MoM</span>
                </div>
              </div>
            )}
            {inversis.gestora && (
              <div>
                <div style={{ fontSize: 12, color: '#8888a0', marginBottom: 4 }}>Inversis Gestion</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#e8e8f0' }}>
                  {'\u20AC'}{inversis.gestora.curr_aum_bn.toFixed(3)}B
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                  <DeltaCell value={inversis.gestora.delta_bn} suffix="B" decimals={3} />
                  <span style={{ color: '#555570', marginLeft: 8, fontSize: 11 }}>
                    ({inversis.gestora.delta_pct != null ? `${inversis.gestora.delta_pct > 0 ? '+' : ''}${inversis.gestora.delta_pct.toFixed(1)}%` : '-'})
                  </span>
                </div>
              </div>
            )}
            {inversis.group && (
              <div>
                <div style={{ fontSize: 12, color: '#8888a0', marginBottom: 4 }}>Group 1Y Growth</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700 }}>
                  <TrendBadge value={inversis.group.var_1y} />
                </div>
                <div style={{ fontSize: 11, color: '#555570', marginTop: 4 }}>
                  {inversis.group.num_isin} ISINs
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary Insight */}
      <InsightCard title={`${monthLabel} — Executive Summary`} color="#3b82f6">
        The Spanish fund market {headline.aum_delta_bn > 0 ? 'grew' : 'contracted'} by <strong>{'\u20AC'}{Math.abs(headline.aum_delta_bn).toFixed(1)}B</strong> ({headline.aum_delta_pct > 0 ? '+' : ''}{headline.aum_delta_pct.toFixed(2)}%) to reach <strong>{'\u20AC'}{headline.total_aum_bn.toFixed(1)}B</strong>.
        {' '}Market appreciation contributed <strong>{'\u20AC'}{headline.market_effect_bn.toFixed(1)}B</strong> ({((headline.market_effect_bn / headline.aum_delta_bn) * 100).toFixed(0)}%)
        {' '}while net investor flows added <strong>{'\u20AC'}{headline.net_flows_bn.toFixed(1)}B</strong> ({((headline.net_flows_bn / headline.aum_delta_bn) * 100).toFixed(0)}%).
        {' '}Flows doubled vs {prevLabel} ({'\u20AC'}{headline.prev_net_flows_bn.toFixed(1)}B), with <strong>{category_flows[0]?.category}</strong> leading
        {' '}at {'\u20AC'}{category_flows[0]?.net.toFixed(2)}B. The market added <strong>{headline.inv_delta.toLocaleString()}</strong> new investors,
        {' '}reaching {headline.investors.toLocaleString()} total.
      </InsightCard>
    </div>
  );
}
