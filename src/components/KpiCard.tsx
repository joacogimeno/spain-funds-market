interface Props {
  title: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  subtitle?: string;
}

export default function KpiCard({ title, value, delta, deltaPositive, subtitle }: Props) {
  return (
    <div style={{
      background: '#16161f',
      border: '1px solid #2a2a3a',
      borderRadius: 12,
      padding: '20px 24px',
      minWidth: 180,
      flex: 1,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 500, color: '#8888a0',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
        fontFamily: "'Outfit', sans-serif",
      }}>{title}</div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 28, fontWeight: 700, color: '#e8e8f0',
        lineHeight: 1.1,
      }}>{value}</div>
      {delta && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13, fontWeight: 600, marginTop: 6,
          color: deltaPositive ? '#10b981' : '#ef4444',
        }}>{delta}</div>
      )}
      {subtitle && (
        <div style={{ fontSize: 11, color: '#555570', marginTop: 4 }}>{subtitle}</div>
      )}
    </div>
  );
}
