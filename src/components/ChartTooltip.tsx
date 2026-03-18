interface Props {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}

export default function ChartTooltip({ active, payload, label, suffix = '', prefix = '', decimals = 1 }: Props) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1e1e2a',
      border: '1px solid #3a3a4a',
      borderRadius: 8,
      padding: '10px 14px',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 12,
    }}>
      <div style={{ color: '#e8e8f0', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {payload.map((entry, i) => (
        <div key={entry.dataKey ?? i} style={{
          display: 'flex', justifyContent: 'space-between', gap: 16,
          padding: '2px 0',
          color: entry.color || '#8888a0',
        }}>
          <span>{entry.name}</span>
          <span style={{ fontWeight: 600 }}>
            {prefix}{typeof entry.value === 'number' ? entry.value.toFixed(decimals) : entry.value}{suffix}
          </span>
        </div>
      ))}
    </div>
  );
}
