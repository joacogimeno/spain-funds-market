interface Props {
  title: string;
  children: React.ReactNode;
  color?: string;
}

export default function InsightCard({ title, children, color = '#3b82f6' }: Props) {
  return (
    <div style={{
      background: `${color}10`,
      border: `1px solid ${color}30`,
      borderRadius: 8,
      padding: 16,
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color,
        marginBottom: 8, letterSpacing: '0.05em',
        fontFamily: "'Outfit', sans-serif",
        textTransform: 'uppercase',
      }}>{title}</div>
      <div style={{ fontSize: 13, color: '#e8e8f0', lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}
