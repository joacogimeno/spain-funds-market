import { useState, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import MarketOverview from './tabs/MarketOverview';
import CategoryAnalysis from './tabs/CategoryAnalysis';
import GestoraRankings from './tabs/GestoraRankings';
import FundFlows from './tabs/FundFlows';
import Performance from './tabs/Performance';
import Opportunities from './tabs/Opportunities';
import FundExplorer from './tabs/FundExplorer';
import MonthlyReport from './tabs/MonthlyReport';
import FeeAnalysis from './tabs/FeeAnalysis';
import Depositaria from './tabs/Depositaria';
import BancaMarch from './tabs/BancaMarch';
import ProspectAnalysis from './tabs/ProspectAnalysis';
import Inversis from './tabs/Inversis';

const TABS = [
  { id: 'monthly', label: 'Monthly Report', component: MonthlyReport },
  { id: 'overview', label: 'Market Overview', component: MarketOverview },
  { id: 'categories', label: 'Categories', component: CategoryAnalysis },
  { id: 'gestoras', label: 'Gestora Rankings', component: GestoraRankings },
  { id: 'flows', label: 'Fund Flows', component: FundFlows },
  { id: 'performance', label: 'Performance', component: Performance },
  { id: 'fees', label: 'Fee Analysis', component: FeeAnalysis },
  { id: 'depositaria', label: 'Depositar\u00eda', component: Depositaria },
  { id: 'banca_march', label: 'Banca March', component: BancaMarch },
  { id: 'prospects',   label: 'Prospect Analysis', component: ProspectAnalysis },
  { id: 'inversis',    label: 'Inversis',    component: Inversis    },
  { id: 'opportunities', label: 'Opportunities', component: Opportunities },
  { id: 'explorer', label: 'Fund Explorer', component: FundExplorer },
] as const;

type TabId = (typeof TABS)[number]['id'];

// Error boundary to catch rendering crashes in tabs
class TabErrorBoundary extends Component<
  { tabId: string; children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { tabId: string; children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Tab crash [${this.props.tabId}]:`, error, info.componentStack);
  }

  componentDidUpdate(prevProps: { tabId: string }) {
    // Reset error state when switching tabs
    if (prevProps.tabId !== this.props.tabId && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: '#16161f', border: '1px solid #ef444440', borderRadius: 12,
          padding: 32, textAlign: 'center',
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#ef4444', marginBottom: 8,
            fontFamily: "'Outfit', sans-serif" }}>
            Something went wrong rendering this tab
          </div>
          <div style={{ fontSize: 12, color: '#8888a0', marginBottom: 16,
            fontFamily: "'JetBrains Mono', monospace" }}>
            {this.state.error?.message}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 16px', borderRadius: 6, border: '1px solid #2a2a3a',
              background: '#2a2a3a', color: '#e8e8f0', cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif", fontSize: 13,
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(TABS[0].id);
  const ActiveComponent = TABS.find(t => t.id === activeTab)!.component;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: '#12121a',
        borderBottom: '1px solid #2a2a3a',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 32,
        height: 56,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, #d42030, #8b1520)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: '#fff',
            fontFamily: "'JetBrains Mono', monospace",
          }}>I</div>
          <div>
            <div style={{
              fontSize: 15, fontWeight: 700, color: '#e8e8f0',
              fontFamily: "'Outfit', sans-serif", lineHeight: 1.1,
            }}>SPAIN FUNDS</div>
            <div style={{
              fontSize: 9, fontWeight: 500, color: '#555570',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.15em', textTransform: 'uppercase',
            }}>Market Intelligence</div>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: 2, flex: 1, overflowX: 'auto' }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: isActive ? '#d4203020' : 'transparent',
                  color: isActive ? '#ff3040' : '#8888a0',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  borderBottom: isActive ? '2px solid #d42030' : '2px solid transparent',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <div style={{
            padding: '4px 10px',
            borderRadius: 4,
            background: '#10b98120',
            border: '1px solid #10b98140',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: '#10b981',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>
            INVERCO DATA
          </div>
          <div style={{
            padding: '4px 10px',
            borderRadius: 4,
            background: '#f59e0b20',
            border: '1px solid #f59e0b40',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: '#f59e0b',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>
            CNMV DATA
          </div>
        </div>
      </header>

      <main style={{
        flex: 1,
        padding: 32,
        maxWidth: 1440,
        width: '100%',
        margin: '0 auto',
      }}>
        <TabErrorBoundary tabId={activeTab}>
          <ActiveComponent />
        </TabErrorBoundary>
      </main>

      <footer style={{
        borderTop: '1px solid #2a2a3a',
        padding: '12px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        color: '#555570',
      }}>
        <span>Spain Funds Market Intelligence Dashboard — Internal Use Only</span>
        <span>Source: INVERCO monthly data (Jan 2024 — Jan 2026) + CNMV Estadisticas IIC (Q3 2025)</span>
      </footer>
    </div>
  );
}
