"""Build abanca.json — Abanca business opportunity analysis for Inversis.

Uses CNMV Anexo A1.1 (registry) and A2.2 (fees) to analyse:
- Abanca's fund book: AUM, categories, share classes, investor counts
- Current depositary (Cecabank) and the fees being paid
- Complexity profile vs other comparable gestoras
- Revenue opportunity for Inversis at competitive fee levels
"""
import os
from collections import defaultdict

from ..parsers.cnmv_fees import parse_cnmv_fees, VOCACION_MAP
from ..parsers.cnmv_registry import parse_cnmv_registry
from ..config import DATA_DIR, find_cnmv_file


ABANCA_GESTORA = 'ABANCA GESTION DE ACTIVOS, SGIIC, SA'
ABANCA_GROUP   = 'ABANCA'

# Gestoras to include in peer comparison (similar-tier regional banks)
PEER_GESTORAS = [
    'IBERCAJA', 'KUTXABANK', 'UNICAJA', 'CAJA LABORAL',
    'GESCOOPERATIVO', 'BANKINTER', 'SABADELL',
]


def _safe_float(v, default=0.0):
    try:
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default


def build_abanca():
    """Build Abanca depositary opportunity analysis from CNMV data."""
    cnmv_dir = os.path.join(DATA_DIR, 'CNMV Estadisticas')
    _, cnmv_date = find_cnmv_file(cnmv_dir, 'Anexo')
    cnmv_date = cnmv_date or 'unknown'

    fees    = parse_cnmv_fees(cnmv_dir)
    registry = parse_cnmv_registry(cnmv_dir)

    if not fees:
        return {}

    # ── Abanca records ─────────────────────────────────────────────
    abanca_recs = [r for r in fees if ABANCA_GROUP in str(r.get('grupo', '')).upper()]
    if not abanca_recs:
        # Fallback: match by gestora name
        abanca_recs = [r for r in fees if ABANCA_GROUP in str(r.get('gestora', '')).upper()]

    total_aum_k = sum(_safe_float(r['patrimonio_k']) for r in abanca_recs)

    # ── Fund-level aggregation ─────────────────────────────────────
    fund_map = defaultdict(lambda: {
        'classes': [], 'investors': 0, 'aum_k': 0.0, 'vocacion': '', 'dep_fees': []
    })
    for r in abanca_recs:
        fn  = r['fund_name']
        aum = _safe_float(r['patrimonio_k'])
        dep = r['depositary_fee']
        fund_map[fn]['aum_k'] += aum
        fund_map[fn]['vocacion'] = r['vocacion']
        fund_map[fn]['investors'] = r['investors'] or 0  # fund-level field
        fund_map[fn]['classes'].append({
            'isin':        r['isin'],
            'share_class': r['share_class'] or '',
            'aum_k':       round(aum, 0),
            'dep_fee_bps': round(dep * 100, 2) if dep is not None else None,
            'mgmt_fee_pct': r['mgmt_fee_aum'],
        })
        if dep is not None:
            fund_map[fn]['dep_fees'].append((dep, aum))

    funds = []
    for fn, d in sorted(fund_map.items(), key=lambda x: -x[1]['aum_k']):
        w_dep = (sum(f * a for f, a in d['dep_fees']) / d['aum_k']
                 if d['aum_k'] > 0 and d['dep_fees'] else 0.0)
        rev_k  = d['aum_k'] * w_dep / 100
        cat    = VOCACION_MAP.get(d['vocacion'], d['vocacion'])
        funds.append({
            'fund':            fn,
            'vocacion':        d['vocacion'],
            'category':        cat,
            'aum_m':           round(d['aum_k'] / 1000, 1),
            'aum_pct':         round(d['aum_k'] / total_aum_k * 100, 1) if total_aum_k > 0 else 0,
            'classes':         len(d['classes']),
            'class_detail':    sorted(d['classes'], key=lambda x: -x['aum_k']),
            'investors':       d['investors'],
            'wtd_dep_fee_bps': round(w_dep * 100, 2),
            'est_dep_rev_k':   round(rev_k, 1),
        })

    # ── Category breakdown ─────────────────────────────────────────
    cat_map = defaultdict(lambda: {'aum_k': 0.0, 'funds': 0, 'classes': 0, 'investors': 0, 'dep_fees': []})
    for f in funds:
        c = f['category']
        cat_map[c]['aum_k']    += f['aum_m'] * 1000
        cat_map[c]['funds']    += 1
        cat_map[c]['classes']  += f['classes']
        cat_map[c]['investors'] += f['investors']
        if f['wtd_dep_fee_bps'] > 0:
            cat_map[c]['dep_fees'].append((f['wtd_dep_fee_bps'], f['aum_m'] * 1000))

    categories = []
    for cat, d in sorted(cat_map.items(), key=lambda x: -x[1]['aum_k']):
        w_dep = (sum(f * a for f, a in d['dep_fees']) / d['aum_k']
                 if d['aum_k'] > 0 and d['dep_fees'] else 0.0)
        categories.append({
            'category':        cat,
            'aum_m':           round(d['aum_k'] / 1000, 1),
            'aum_pct':         round(d['aum_k'] / total_aum_k * 100, 1) if total_aum_k > 0 else 0,
            'funds':           d['funds'],
            'classes':         d['classes'],
            'investors':       d['investors'],
            'wtd_dep_fee_bps': round(w_dep, 2),
        })

    # ── Portfolio-level metrics ────────────────────────────────────
    w_dep_num  = sum(_safe_float(r['depositary_fee']) * _safe_float(r['patrimonio_k'])
                     for r in abanca_recs)
    w_dep_fee  = w_dep_num / total_aum_k if total_aum_k > 0 else 0.0
    w_dep_bps  = w_dep_fee * 100
    est_rev_k  = total_aum_k * w_dep_fee / 100

    # Unique investor count (fund-level, not summing over classes)
    seen_funds = {}
    for r in abanca_recs:
        fn = r['fund_name']
        if fn not in seen_funds:
            seen_funds[fn] = r['investors'] or 0
    total_investors = sum(seen_funds.values())

    # Depositary used
    abanca_reg = [r for r in registry if ABANCA_GROUP in str(r.get('grupo', '')).upper()
                  or ABANCA_GROUP in str(r.get('gestora', '')).upper()]
    depositarios = list(set(r['depositario'] for r in abanca_reg if r.get('depositario')))

    # ── Market context: rank among all gestoras ────────────────────
    gestora_aum = defaultdict(float)
    gestora_inv = defaultdict(int)
    gestora_funds_cnt = defaultdict(set)
    gestora_classes = defaultdict(int)
    gestora_dep_bps = {}

    for r in fees:
        g   = r['gestora']
        aum = _safe_float(r['patrimonio_k'])
        gestora_aum[g]      += aum
        gestora_classes[g]  += 1
        gestora_funds_cnt[g].add(r['fund_name'])

    seen_g_fund = {}
    for r in fees:
        k = (r['gestora'], r['fund_name'])
        if k not in seen_g_fund:
            seen_g_fund[k] = r['investors'] or 0
            gestora_inv[r['gestora']] += seen_g_fund[k]

    for g, aum_k in gestora_aum.items():
        if aum_k > 0:
            num = sum(_safe_float(r['depositary_fee']) * _safe_float(r['patrimonio_k'])
                      for r in fees if r['gestora'] == g)
            gestora_dep_bps[g] = num / aum_k * 100  # bps

    ranked = sorted(gestora_aum.items(), key=lambda x: -x[1])
    abanca_aum_rank = next((i + 1 for i, (g, _) in enumerate(ranked)
                            if ABANCA_GROUP in g.upper()), None)

    # Fee percentile
    all_bps = sorted(gestora_dep_bps.values())
    n = len(all_bps)
    abanca_fee_rank = sum(1 for f in all_bps if f < w_dep_bps) + 1
    abanca_fee_pct  = round(abanca_fee_rank / n * 100, 0) if n > 0 else None
    mkt_p25 = all_bps[n // 4]   if n > 0 else 0
    mkt_p50 = all_bps[n // 2]   if n > 0 else 0
    mkt_p75 = all_bps[3*n//4]   if n > 0 else 0

    # ── Peer comparison (similar-tier gestoras) ─────────────────────
    peers = []
    for g, aum_k in sorted(gestora_aum.items(), key=lambda x: -x[1])[:20]:
        g_upper = g.upper()
        is_abanca = ABANCA_GROUP in g_upper
        is_peer   = any(p in g_upper for p in PEER_GESTORAS)
        if not (is_abanca or is_peer):
            continue
        dep_bps = gestora_dep_bps.get(g, 0)
        inv_count = gestora_inv.get(g, 0)
        peers.append({
            'gestora':       g,
            'gestora_short': g.split(',')[0].split('SGIIC')[0].strip(),
            'aum_bn':        round(aum_k / 1e6, 2),
            'funds':         len(gestora_funds_cnt[g]),
            'classes':       gestora_classes[g],
            'investors':     inv_count,
            'wtd_dep_fee_bps': round(dep_bps, 2),
            'est_dep_rev_k': round(aum_k * dep_bps / 10000, 0),
            'is_abanca':     is_abanca,
        })
    peers.sort(key=lambda x: -x['aum_bn'])

    # ── Revenue opportunity scenarios ─────────────────────────────
    def _scenario(name, bps, description):
        rev_k = total_aum_k * bps / 10000
        return {
            'name':                name,
            'fee_bps':             bps,
            'description':         description,
            'est_annual_rev_k':    round(rev_k, 0),
            'delta_vs_cecabank_k': round(rev_k - est_rev_k, 0),
        }

    scenarios = [
        _scenario('Cecabank (current)', round(w_dep_bps, 2),
                  f'Current Cecabank rate — {w_dep_bps:.2f} bps weighted avg'),
        _scenario('Inversis competitive (6 bps)', 6.0,
                  'Inversis entry offer — slightly above Cecabank, below market median'),
        _scenario('Market median (7 bps)', round(mkt_p50, 2),
                  f'Inversis at market median ({mkt_p50:.1f} bps) — standard commercial terms'),
        _scenario('Full market rate (8 bps)', 8.0,
                  'Inversis at P75 market rate — reflects service quality premium'),
    ]

    # ── Summary ────────────────────────────────────────────────────
    return {
        'date': cnmv_date,
        'gestora': ABANCA_GESTORA,
        'gestora_short': 'Abanca Gestión',
        'grupo': ABANCA_GROUP,
        'current_depositario': depositarios[0] if depositarios else 'unknown',
        'summary': {
            'total_aum_bn':       round(total_aum_k / 1e6, 3),
            'total_funds':        len(funds),
            'total_classes':      len(abanca_recs),
            'total_investors':    total_investors,
            'total_categories':   len(categories),
            'wtd_dep_fee_bps':    round(w_dep_bps, 2),
            'est_cecabank_rev_k': round(est_rev_k, 0),
            'aum_rank_spain':     abanca_aum_rank,
            'fee_percentile':     abanca_fee_pct,
        },
        'market_context': {
            'total_gestoras':   len(gestora_aum),
            'mkt_dep_fee_p25':  round(mkt_p25, 2),
            'mkt_dep_fee_p50':  round(mkt_p50, 2),
            'mkt_dep_fee_p75':  round(mkt_p75, 2),
        },
        'funds':       funds,
        'categories':  categories,
        'peers':       peers,
        'scenarios':   scenarios,
    }
