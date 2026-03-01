import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import SectionHeader from '../components/SectionHeader';
import KpiCard from '../components/KpiCard';
import InsightCard from '../components/InsightCard';
import TrendBadge from '../components/TrendBadge';
import { CHART_MARGIN, CHART_COLORS } from '../theme';
import ChartTooltip from '../components/ChartTooltip';
import data from '../data/insights.json';
import foreignData from '../data/cnmv_foreign.json';

const { client_tiers, market_opportunity, positioning } = data;
const { summary: foreignSummary, quarterly_trend, type_breakdown, countries, domestic_vs_foreign } = foreignData;

interface GroupEntry {
  name: string;
  aum_bn: number;
  var_1y: number;
  var_6m?: number;
  var_ytd?: number;
  num_isin: number;
}

function TierCard({ title, color, groups, description }: {
  title: string; color: string; groups: GroupEntry[]; description: string;
}) {
  return (
    <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
      <div style={{
        fontSize: 13, fontWeight: 700, color, marginBottom: 4,
        fontFamily: "'Outfit', sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>{title}</div>
      <div style={{ fontSize: 11, color: '#555570', marginBottom: 16 }}>{description}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {groups.map(g => (
          <div key={g.name} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
            background: '#0a0a0f', borderRadius: 6, border: '1px solid #2a2a3a',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#e8e8f0' }}>{g.name}</div>
              <div style={{ fontSize: 11, color: '#555570', fontFamily: "'JetBrains Mono', monospace" }}>
                {'\u20AC'}{g.aum_bn.toFixed(1)}B | {g.num_isin} ISINs
              </div>
            </div>
            <TrendBadge value={g.var_1y} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SwotCard({ title, color, bg, items }: {
  title: string; color: string; bg: string; items: string[];
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 8, padding: 16 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color, marginBottom: 10,
        letterSpacing: '0.1em', fontFamily: "'Outfit', sans-serif",
      }}>{title}</div>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <li key={i} style={{
            fontSize: 13, color: '#e8e8f0', lineHeight: 1.5,
            paddingLeft: 12, borderLeft: `2px solid ${color}50`,
          }}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function Opportunities() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Client Targeting Tiers */}
      <div>
        <SectionHeader title="Client Targeting Tiers" source="INVERCO — RkGrupos analysis" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <TierCard
            title="Tier 1 — High Growth Independents"
            color="#10b981"
            groups={client_tiers.tier1_high_growth.slice(0, 8)}
            description="Groups growing >20% YoY with >€1B AUM — prime targets for custody/platform services"
          />
          <TierCard
            title="Tier 2 — Growing Regionals"
            color="#3b82f6"
            groups={client_tiers.tier2_growing_regionals.slice(0, 8)}
            description="Groups growing 10-20% YoY with >€2B AUM — expanding institutions needing infrastructure"
          />
          <TierCard
            title="Tier 3 — Established Managers"
            color="#f59e0b"
            groups={client_tiers.tier3_established.slice(0, 8)}
            description="Stable groups >€3B AUM — relationship-driven, value quality and reliability"
          />
        </div>
      </div>

      {/* Market Opportunity Map - SWOT style */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Market Opportunity Map" source="Analyst assessment — INVERCO data" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <SwotCard
            title="GROWTH SECTORS"
            color="#10b981" bg="#10b98115"
            items={market_opportunity.growth_sectors.map(
              (s: { category: string; monthly_net_m: number }) => `${s.category}: +€${Math.abs(s.monthly_net_m).toFixed(0)}M/month net inflows`
            )}
          />
          <SwotCard
            title="DECLINING SECTORS"
            color="#ef4444" bg="#ef444415"
            items={market_opportunity.declining_sectors.map(
              (s: { category: string; monthly_net_m: number }) => `${s.category}: €${s.monthly_net_m.toFixed(0)}M/month net outflows`
            )}
          />
          <SwotCard
            title="STRUCTURAL SHIFTS"
            color="#3b82f6" bg="#3b82f615"
            items={market_opportunity.structural_shifts}
          />
          <SwotCard
            title="THREATS"
            color="#f59e0b" bg="#f59e0b15"
            items={market_opportunity.threats}
          />
        </div>
      </div>

      {/* Inversis Positioning Radar */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Inversis Competitive Positioning" source="Composite analysis" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={positioning.radar}>
              <PolarGrid stroke="#2a2a3a" />
              <PolarAngleAxis dataKey="metric"
                tick={{ fill: '#8888a0', fontSize: 12, fontFamily: "'Outfit', sans-serif" }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]}
                tick={{ fill: '#555570', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} />
              <Radar name="Inversis" dataKey="inversis"
                stroke="#d42030" fill="#d42030" fillOpacity={0.2} strokeWidth={2} />
              <Radar name="Market Average" dataKey="market_avg"
                stroke="#6b7280" fill="#6b7280" fillOpacity={0.1} strokeWidth={1} strokeDasharray="5 5" />
              <Radar name="Top Peer" dataKey="top_peer"
                stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.05} strokeWidth={1} strokeDasharray="3 3" />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center' }}>
            <div style={{ padding: 16, background: '#0a0a0f', borderRadius: 8, border: '1px solid #2a2a3a' }}>
              <div style={{ fontSize: 12, color: '#8888a0', marginBottom: 4 }}>Banca March Group AUM</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700, color: '#d42030' }}>
                {positioning.inversis_group_aum ? `\u20AC${positioning.inversis_group_aum.toFixed(1)}B` : 'N/A'}
              </div>
            </div>
            <div style={{ padding: 16, background: '#0a0a0f', borderRadius: 8, border: '1px solid #2a2a3a' }}>
              <div style={{ fontSize: 12, color: '#8888a0', marginBottom: 4 }}>Group Growth (1Y)</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700 }}>
                {positioning.inversis_growth != null ? <TrendBadge value={positioning.inversis_growth} /> : 'N/A'}
              </div>
            </div>
            <div style={{ padding: 16, background: '#0a0a0f', borderRadius: 8, border: '1px solid #2a2a3a' }}>
              <div style={{ fontSize: 12, color: '#8888a0', marginBottom: 4 }}>Market Average Growth</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700 }}>
                <TrendBadge value={positioning.market_avg_growth} />
              </div>
            </div>
            <InsightCard title="Strategic Edge" color="#d42030">
              Inversis scores highest on <strong>Technology</strong> and <strong>Independence</strong> axes —
              key differentiators for attracting independent gestoras. The opportunity is to convert
              Tier 1 high-growth independents that need robust custody and distribution infrastructure.
            </InsightCard>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* FOREIGN IIC MARKET — CNMV DATA                                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {/* Foreign IIC KPIs */}
      <div>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: 'inline-block', padding: '4px 10px', borderRadius: 4,
            background: '#f59e0b20', border: '1px solid #f59e0b40',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
            color: '#f59e0b', fontWeight: 600, marginBottom: 8,
          }}>CNMV DATA</div>
        </div>
        <SectionHeader title="Foreign IICs Sold in Spain" source={`CNMV Estadisticas — ${foreignSummary.date}`} />
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <KpiCard
            title="Foreign IICs Registered"
            value={foreignSummary.total_iic.toLocaleString()}
            delta={foreignSummary.yoy_growth_pct != null ? `+${foreignSummary.yoy_growth_pct.toFixed(1)}% vol. YoY` : undefined}
            deltaPositive
            subtitle="UCITS funds & companies"
          />
          <KpiCard
            title="Investment Volume"
            value={`\u20AC${foreignSummary.total_volume_bn}B`}
            delta={foreignSummary.ytd_growth_pct != null ? `+${foreignSummary.ytd_growth_pct.toFixed(1)}% YTD` : undefined}
            deltaPositive
            subtitle="Assets under management"
          />
          <KpiCard
            title="Investor Accounts"
            value={`${foreignSummary.total_accounts_m}M`}
            delta={foreignSummary.accounts_yoy_pct != null ? `+${foreignSummary.accounts_yoy_pct.toFixed(1)}% YoY` : undefined}
            deltaPositive
            subtitle="Partícipes / accionistas"
          />
          <KpiCard
            title="Foreign Share of Market"
            value={`${domestic_vs_foreign.foreign_pct}%`}
            subtitle={`\u20AC${domestic_vs_foreign.total_market_bn}B total market`}
          />
        </div>
      </div>

      {/* Quarterly AUM Trend + Domestic vs Foreign Pie */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Foreign IIC Investment Volume (Quarterly)" source="CNMV Cuadro 7.1" />
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={quarterly_trend} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#8888a0' }} />
              <YAxis tick={{ fontSize: 10, fill: '#8888a0' }}
                tickFormatter={(v: number) => `${v}B`} />
              <Tooltip content={<ChartTooltip suffix="B" decimals={1} />} />
              <Area type="monotone" dataKey="volume_bn" name="Volume"
                stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Domestic vs Foreign" source="CNMV + INVERCO" />
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Domestic FI', value: domestic_vs_foreign.domestic_aum_bn },
                  { name: 'Foreign IIC', value: domestic_vs_foreign.foreign_aum_bn },
                ]}
                cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                dataKey="value" nameKey="name"
                label={({ name, value }: { name?: string; value?: number }) => `${name ?? ''}: \u20AC${value ?? 0}B`}
                labelLine={false}
              >
                <Cell fill="#3b82f6" fillOpacity={0.8} />
                <Cell fill="#f59e0b" fillOpacity={0.8} />
              </Pie>
              <Tooltip formatter={(v: number | undefined) => [`\u20AC${v ?? 0}B`, '']}
                contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#555570', marginTop: 4 }}>
            Foreign IICs = {domestic_vs_foreign.foreign_pct}% of total market
          </div>
        </div>
      </div>

      {/* Country Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Foreign IICs by Country of Origin" source="CNMV Cuadro 7.1" />
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={(countries as Array<{ name: string; count: number; pct_of_total: number }>).filter(c => c.count > 0)}
              layout="vertical" margin={{ ...CHART_MARGIN, left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#8888a0' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#8888a0' }} width={95} />
              <Tooltip formatter={(v: number | undefined) => [v ?? 0, 'IICs']}
                contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8 }} />
              <Bar dataKey="count" name="Number of IICs" radius={[0, 4, 4, 0]}>
                {(countries as Array<{ name: string; count: number }>).filter(c => c.count > 0).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
          <SectionHeader title="Country Market Share" source="CNMV Cuadro 7.1" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {(countries as Array<{ name: string; count: number; pct_of_total: number; yoy_pct: number | null }>)
              .filter(c => c.count > 0)
              .map((c, i) => (
              <div key={c.name} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                background: '#0a0a0f', borderRadius: 6, border: '1px solid #2a2a3a',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: CHART_COLORS[i % CHART_COLORS.length],
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#e8e8f0' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: '#555570', fontFamily: "'JetBrains Mono', monospace" }}>
                    {c.count} IICs ({c.pct_of_total}%)
                  </div>
                </div>
                {c.yoy_pct != null && c.yoy_pct !== 0 && (
                  <TrendBadge value={c.yoy_pct} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vehicle Type Breakdown */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Foreign IIC Vehicle Types" source="CNMV Cuadro 7.1" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {(type_breakdown as Array<{ type: string; latest_count: number; latest_volume_bn: number; latest_accounts_m: number; yoy_volume_pct: number | null; yoy_accounts_pct: number | null }>).map(t => (
            <div key={t.type} style={{
              padding: 20, background: '#0a0a0f', borderRadius: 8, border: '1px solid #2a2a3a',
            }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: '#e8e8f0', marginBottom: 12,
                fontFamily: "'Outfit', sans-serif",
              }}>{t.type}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#555570' }}>Count</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#e8e8f0' }}>
                    {t.latest_count}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#555570' }}>Volume</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#e8e8f0' }}>
                    {'\u20AC'}{t.latest_volume_bn}B
                  </div>
                  {t.yoy_volume_pct != null && (
                    <div style={{ marginTop: 2 }}><TrendBadge value={t.yoy_volume_pct} /></div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#555570' }}>Accounts</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#e8e8f0' }}>
                    {t.latest_accounts_m}M
                  </div>
                  {t.yoy_accounts_pct != null && (
                    <div style={{ marginTop: 2 }}><TrendBadge value={t.yoy_accounts_pct} /></div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Foreign IIC Strategic Insight */}
      <InsightCard title="Foreign IIC Distribution Opportunity" color="#f59e0b">
        Foreign IICs represent <strong>{'\u20AC'}{foreignSummary.total_volume_bn}B</strong> in assets —{' '}
        <strong>{domestic_vs_foreign.foreign_pct}%</strong> of the total Spanish fund market.
        With <strong>+{foreignSummary.yoy_growth_pct}% YoY growth</strong> in volume and{' '}
        <strong>+{foreignSummary.accounts_yoy_pct}% YoY</strong> in investor accounts,
        foreign funds are growing faster than domestic FI.
        <strong> Luxembourg</strong> ({(countries as Array<{ name: string; pct_of_total: number }>)[0]?.pct_of_total}%),{' '}
        <strong>Ireland</strong>, and <strong>France</strong> dominate the market.
        Inversis can capture distribution fees from this rapidly expanding segment by providing
        custody and platform access for foreign UCITS sold to Spanish investors.
      </InsightCard>
    </div>
  );
}
