import { useState, useMemo } from 'react';

interface Column<T> {
  key: string;
  label: string;
  format?: (v: T[keyof T], row: T) => string | React.ReactNode;
  align?: 'left' | 'right';
  heatmap?: boolean;
  width?: number;
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
  defaultSort?: string;
  defaultDir?: 'asc' | 'desc';
  maxRows?: number;
  onRowClick?: (row: T) => void;
}

function getHeatColor(value: number): string {
  if (value > 20) return '#10b98140';
  if (value > 10) return '#10b98125';
  if (value > 0) return '#10b98115';
  if (value < -20) return '#ef444440';
  if (value < -10) return '#ef444425';
  if (value < 0) return '#ef444415';
  return 'transparent';
}

export default function DataTable<T extends Record<string, unknown>>({ data, columns, defaultSort, defaultDir = 'desc', maxRows, onRowClick }: Props<T>) {
  const [sortKey, setSortKey] = useState(defaultSort || columns[0]?.key || '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultDir);

  const sorted = useMemo(() => {
    const arr = [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return maxRows ? arr.slice(0, maxRows) : arr;
  }, [data, sortKey, sortDir, maxRows]);

  const handleSort = (key: string) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key}
                onClick={() => handleSort(col.key)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(col.key); } }}
                tabIndex={0}
                role="button"
                style={{
                  textAlign: col.align || 'left',
                  width: col.width,
                  cursor: 'pointer',
                }}>
                {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={`${String(row[columns[0]?.key] ?? '')}-${i}`} onClick={() => onRowClick?.(row)} style={{ cursor: onRowClick ? 'pointer' : undefined }}>
              {columns.map(col => {
                const val = row[col.key];
                const bg = col.heatmap && typeof val === 'number' ? getHeatColor(val) : 'transparent';
                return (
                  <td key={col.key} style={{ textAlign: col.align || 'left', background: bg }}>
                    {col.format ? col.format(val as T[keyof T], row) : val == null ? '-' : String(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
