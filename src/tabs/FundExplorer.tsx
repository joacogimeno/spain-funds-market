import { useState, useMemo } from 'react';
import SectionHeader from '../components/SectionHeader';
import DataTable from '../components/DataTable';
import TrendBadge from '../components/TrendBadge';
import data from '../data/fund_details.json';

const { funds, categories, gestoras, total_funds, latest_date } = data;

export default function FundExplorer() {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [gestoraFilter, setGestoraFilter] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = funds as Record<string, unknown>[];
    if (categoryFilter) {
      result = result.filter(f => f.category === categoryFilter);
    }
    if (gestoraFilter) {
      result = result.filter(f => f.gestora === gestoraFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        String(f.name).toLowerCase().includes(q) ||
        String(f.isin).toLowerCase().includes(q) ||
        String(f.gestora).toLowerCase().includes(q)
      );
    }
    return result;
  }, [categoryFilter, gestoraFilter, search]);

  const columns = [
    { key: 'isin', label: 'ISIN', width: 120 },
    { key: 'name', label: 'Fund Name', format: (v: unknown) => {
      const s = String(v);
      return s.length > 50 ? s.slice(0, 48) + '...' : s;
    }},
    { key: 'category', label: 'Category', format: (v: unknown) => (
      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: '#2a2a3a', color: '#8888a0' }}>
        {String(v)}
      </span>
    )},
    { key: 'gestora', label: 'Gestora', format: (v: unknown) => {
      const s = String(v);
      return s.length > 30 ? s.slice(0, 28) + '...' : s;
    }},
    { key: 'patrimonio_m', label: 'AUM (M)', align: 'right' as const,
      format: (v: unknown) => v != null ? `\u20AC${Number(v).toFixed(0)}M` : '-' },
    { key: 'participes', label: 'Investors', align: 'right' as const,
      format: (v: unknown) => v ? Number(v).toLocaleString() : '-' },
    { key: 'return_ytd', label: 'YTD %', align: 'right' as const, heatmap: true,
      format: (v: unknown) => v != null ? <TrendBadge value={Number(v)} /> : '-' },
    { key: 'return_1y', label: '1Y %', align: 'right' as const, heatmap: true,
      format: (v: unknown) => v != null ? <TrendBadge value={Number(v)} /> : '-' },
    { key: 'return_3y', label: '3Y ann', align: 'right' as const, heatmap: true,
      format: (v: unknown) => v != null ? `${Number(v).toFixed(1)}%` : '-' },
    { key: 'net_subs_m', label: 'Net Flows (M)', align: 'right' as const, heatmap: true,
      format: (v: unknown) => {
        const n = Number(v);
        if (!n) return '-';
        return <span style={{ color: n >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
          {n > 0 ? '+' : ''}{n.toFixed(0)}M
        </span>;
      }},
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Filters */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <SectionHeader title="Fund Explorer" source={`INVERCO — ${latest_date} | ${total_funds} funds`} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search fund name or ISIN..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">All Categories ({categories.length})</option>
            {categories.map((c: string) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={gestoraFilter} onChange={e => setGestoraFilter(e.target.value)}>
            <option value="">All Gestoras ({gestoras.length})</option>
            {gestoras.map((g: string) => (
              <option key={g} value={g}>{g.length > 50 ? g.slice(0, 48) + '...' : g}</option>
            ))}
          </select>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12, color: '#8888a0',
          }}>
            {filtered.length} funds
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
        <DataTable
          data={filtered as Record<string, unknown>[]}
          columns={columns}
          defaultSort="patrimonio_m"
          maxRows={100}
        />
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'Total Funds', value: filtered.length.toLocaleString() },
          { label: 'Total AUM', value: `\u20AC${(filtered.reduce((s, f) => s + (Number(f.patrimonio_m) || 0), 0) / 1000).toFixed(1)}B` },
          { label: 'Total Investors', value: filtered.reduce((s, f) => s + (Number(f.participes) || 0), 0).toLocaleString() },
          { label: 'Avg 1Y Return', value: (() => {
            const returns = filtered.filter(f => f.return_1y != null).map(f => Number(f.return_1y));
            return returns.length ? `${(returns.reduce((s, v) => s + v, 0) / returns.length).toFixed(1)}%` : '-';
          })() },
        ].map(stat => (
          <div key={stat.label} style={{
            background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 8, padding: '12px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: '#555570', marginBottom: 4 }}>{stat.label}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: '#e8e8f0' }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
