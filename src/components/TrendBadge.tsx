interface Props {
  value: number;
  suffix?: string;
}

export default function TrendBadge({ value, suffix = '%' }: Props) {
  const positive = value > 0;
  const color = value === 0 ? '#6b7280' : positive ? '#10b981' : '#ef4444';
  const arrow = value === 0 ? '' : positive ? '\u25B2 ' : '\u25BC ';
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 12,
      fontWeight: 600,
      color,
      padding: '2px 8px',
      borderRadius: 4,
      background: `${color}15`,
    }}>
      {arrow}{value > 0 ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  );
}
