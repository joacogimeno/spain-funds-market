export const CATEGORY_COLORS: Record<string, string> = {
  'Monetarios': '#06b6d4',
  'RF Euro CP': '#3b82f6',
  'RF Euro LP': '#6366f1',
  'RF Mixta Euro': '#8b5cf6',
  'RV Mixta Euro': '#a855f7',
  'RV Nacional': '#d946ef',
  'RF Internacional': '#2563eb',
  'RF Mixta Internacional': '#7c3aed',
  'RV Mixta Internacional': '#c026d3',
  'RV Euro Resto': '#e11d48',
  'RV Internacional Europa': '#f43f5e',
  'RV Internacional EE.UU': '#ef4444',
  'RV Internacional Japón': '#f97316',
  'RV Internacional Emergentes': '#f59e0b',
  'RV Internacional Resto': '#eab308',
  'Globales': '#22c55e',
  'Garantizados RF': '#64748b',
  'Garantizados RV': '#94a3b8',
  'Garantía parcial': '#78716c',
  'Retorno Absoluto': '#14b8a6',
  'Fondos Índice': '#0ea5e9',
  'Objetivo Rentabilidad': '#a3a3a3',
  'FIL': '#71717a',
  'Hedge Funds': '#525252',
};

export const GESTORA_TYPE_COLORS: Record<string, string> = {
  bank: '#3b82f6',
  independent: '#10b981',
  foreign: '#f59e0b',
  insurance: '#8b5cf6',
  other: '#6b7280',
};

export const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#d946ef', '#f97316', '#22c55e', '#e11d48',
  '#6366f1', '#14b8a6', '#eab308', '#f43f5e', '#a855f7',
];

export const CHART_MARGIN = { top: 20, right: 30, left: 20, bottom: 5 };

export const formatEur = (v: number) => `\u20AC${v.toFixed(1)}B`;
export const formatEurM = (v: number) => `\u20AC${v.toFixed(0)}M`;
export const formatPct = (v: number) => `${v.toFixed(1)}%`;
export const formatDelta = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
export const formatNum = (v: number) => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
};
