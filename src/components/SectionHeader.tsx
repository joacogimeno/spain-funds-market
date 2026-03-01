interface Props {
  title: string;
  source?: string;
  children?: React.ReactNode;
}

export default function SectionHeader({ title, source, children }: Props) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{
          fontSize: 16, fontWeight: 600, color: '#e8e8f0',
          fontFamily: "'Outfit', sans-serif",
        }}>{title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {children}
        </div>
      </div>
      {source && (
        <div style={{
          fontSize: 11, color: '#555570', marginTop: 4,
          fontFamily: "'JetBrains Mono', monospace",
        }}>Source: {source}</div>
      )}
    </div>
  );
}
