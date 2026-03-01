"""Transform CNMV registry + fee data into cnmv_depositaria.json for the Depositaría dashboard."""
import os
from ..parsers.cnmv_registry import parse_cnmv_registry
from ..parsers.cnmv_fees import parse_cnmv_fees, VOCACION_MAP
from ..config import DATA_DIR


# Known captive pairs: grupo keyword → depositario keyword
# These are banks where the gestora uses the parent bank's depositaría by policy
CAPTIVE_KEYWORDS = [
    ('BBVA', 'BBVA'),
    ('BILBAO VIZCAYA', 'BBVA'),
    ('BILBAO VIZCAYA', 'BILBAO VIZCAYA'),
    ('LA CAIXA', 'CECABANK'),  # CaixaBank (grupo="LA CAIXA") uses Cecabank
    ('CAIXABANK', 'CECABANK'),
    ('SANTANDER', 'CACEIS'),  # Santander sold custody to CACEIS
    ('BANKINTER', 'BANKINTER'),
    ('CREDIT AGRICOLE', 'BNP PARIBAS'),  # Sabadell grupo=Credit Agricole, uses BNP
    ('CREDIT AGRICOLE', 'CACEIS'),
    ('KUTXABANK', 'CECABANK'),
    ('IBERCAJA', 'CECABANK'),
    ('UNICAJA', 'CECABANK'),
    ('ABANCA', 'CECABANK'),
    ('LABORAL KUTXA', 'CECABANK'),
    ('CAJA LABORAL', 'CAJA LABORAL'),  # Caja Laboral uses own depositaría
    ('CAJA RURAL', 'CECABANK'),
    ('BANCO COOPERATIVO', 'CECABANK'),  # Cajas rurales group
    ('BANCO COOPERATIVO', 'COOPERATIVO'),  # Gescooperativo uses own group depositaría
    ('MAPFRE', 'MAPFRE'),
    ('MEDIOLANUM', 'MEDIOLANUM'),
    ('DEUTSCHE BANK', 'DEUTSCHE'),
    ('RENTA 4', 'RENTA 4'),
    ('CAJA DE CREDITO DE LOS INGENIEROS', 'ENGINYERS'),  # Caja Ingenieros uses own depo
    ('SINGULAR BANK', 'SINGULAR'),  # Singular Bank uses own depo
]

INVERSIS_NAME = 'BANCO INVERSIS, S.A.'


def _is_captive(grupo, depositario):
    """Check if a gestora-depositario relationship is captive (parent bank uses own depositaría)."""
    grupo_up = (grupo or '').upper()
    depo_up = (depositario or '').upper()
    for g_kw, d_kw in CAPTIVE_KEYWORDS:
        if g_kw in grupo_up and d_kw in depo_up:
            return True
    return False


def _median(values):
    if not values:
        return 0
    s = sorted(values)
    n = len(s)
    if n % 2 == 1:
        return round(s[n // 2], 4)
    return round((s[n // 2 - 1] + s[n // 2]) / 2, 4)


def build_cnmv_depositaria():
    """Build depositaría market data from CNMV Anexo A1.1 + A2.2."""
    cnmv_dir = os.path.join(DATA_DIR, 'CNMV Estadisticas')

    # Parse both sources
    registry = parse_cnmv_registry(cnmv_dir)
    fees = parse_cnmv_fees(cnmv_dir)

    if not registry:
        return {}

    # Build ISIN → fee/AUM lookup from A2.2
    fee_by_isin = {}
    for r in fees:
        fee_by_isin[r['isin']] = {
            'depositary_fee': r['depositary_fee'],
            'patrimonio_k': r['patrimonio_k'],
            'mgmt_fee_aum': r['mgmt_fee_aum'],
            'ter': r['ter'],
            'category': r['category'],
            'vocacion': r['vocacion'],
            'investors': r['investors'],
        }

    # Join registry + fees by ISIN
    joined = []
    for r in registry:
        fee_data = fee_by_isin.get(r['isin'], {})
        joined.append({
            'fund_name': r['fund_name'],
            'isin': r['isin'],
            'share_class': r['share_class'],
            'gestora': r['gestora'],
            'depositario': r['depositario'],
            'grupo': r['grupo'],
            'category': fee_data.get('category', ''),
            'depo_fee': fee_data.get('depositary_fee'),
            'patrimonio_k': fee_data.get('patrimonio_k'),
            'mgmt_fee': fee_data.get('mgmt_fee_aum'),
            'ter': fee_data.get('ter'),
            'investors': fee_data.get('investors', 0),
        })

    # === Fund-level aggregation (sum AUM across all classes per fund) ===
    _fund_classes = {}
    for r in joined:
        key = r['fund_name']
        if key not in _fund_classes:
            _fund_classes[key] = []
        _fund_classes[key].append(r)

    fund_level = {}
    for fname, classes in _fund_classes.items():
        base = dict(classes[0])
        total_patrim = sum(c['patrimonio_k'] or 0 for c in classes)
        base['patrimonio_k'] = total_patrim
        base['investors'] = sum(c.get('investors') or 0 for c in classes)
        # AUM-weighted depo fee
        dep_num = sum((c['depo_fee'] or 0) * (c['patrimonio_k'] or 0)
                      for c in classes if c['depo_fee'] is not None and c['depo_fee'] > 0)
        dep_den = sum(c['patrimonio_k'] or 0
                      for c in classes if c['depo_fee'] is not None and c['depo_fee'] > 0)
        base['depo_fee'] = round(dep_num / dep_den, 4) if dep_den > 0 else base['depo_fee']
        # AUM-weighted TER
        ter_num = sum((c['ter'] or 0) * (c['patrimonio_k'] or 0)
                      for c in classes if c['ter'] is not None and c['ter'] > 0)
        ter_den = sum(c['patrimonio_k'] or 0
                      for c in classes if c['ter'] is not None and c['ter'] > 0)
        base['ter'] = round(ter_num / ter_den, 4) if ter_den > 0 else base['ter']
        fund_level[fname] = base

    funds = list(fund_level.values())
    total_aum_k = sum(f['patrimonio_k'] or 0 for f in funds)

    # === Depositario Stats ===
    depo_groups = {}
    for f in funds:
        d = f['depositario']
        if d not in depo_groups:
            depo_groups[d] = []
        depo_groups[d].append(f)

    depositario_stats = []
    for d, d_funds in sorted(depo_groups.items(), key=lambda x: -sum(f['patrimonio_k'] or 0 for f in x[1])):
        aum_k = sum(f['patrimonio_k'] or 0 for f in d_funds)
        depo_fees = [f['depo_fee'] for f in d_funds if f['depo_fee'] is not None and f['depo_fee'] > 0]
        gestoras = set(f['gestora'] for f in d_funds)

        depositario_stats.append({
            'depositario': d,
            'gestora_count': len(gestoras),
            'fund_count': len(d_funds),
            'total_aum_bn': round(aum_k / 1_000_000, 1),
            'market_share_pct': round(aum_k / total_aum_k * 100, 1) if total_aum_k > 0 else 0,
            'avg_depo_fee': round(sum(depo_fees) / len(depo_fees), 4) if depo_fees else 0,
            'median_depo_fee': _median(depo_fees),
            'is_inversis': INVERSIS_NAME in d,
        })

    # === Gestora-Depositario relationships ===
    gd_key = {}  # (gestora, depositario) -> list of funds
    for f in funds:
        key = (f['gestora'], f['depositario'])
        if key not in gd_key:
            gd_key[key] = []
        gd_key[key].append(f)

    # Inversis avg fee for opportunity comparison
    inversis_funds = [f for f in funds if INVERSIS_NAME in f['depositario']]
    inversis_fees = [f['depo_fee'] for f in inversis_funds if f['depo_fee'] is not None and f['depo_fee'] > 0]
    inversis_avg_fee = round(sum(inversis_fees) / len(inversis_fees), 4) if inversis_fees else 0.075

    gestora_depositario = []
    for (gestora, depositario), gd_funds in sorted(gd_key.items(), key=lambda x: -sum(f['patrimonio_k'] or 0 for f in x[1])):
        aum_k = sum(f['patrimonio_k'] or 0 for f in gd_funds)
        depo_fees = [f['depo_fee'] for f in gd_funds if f['depo_fee'] is not None and f['depo_fee'] > 0]
        grupo = gd_funds[0]['grupo']

        # Weighted avg depo fee by AUM
        weighted_num = sum((f['depo_fee'] or 0) * (f['patrimonio_k'] or 0)
                          for f in gd_funds if f['depo_fee'] is not None and f['depo_fee'] > 0)
        weighted_den = sum(f['patrimonio_k'] or 0
                          for f in gd_funds if f['depo_fee'] is not None and f['depo_fee'] > 0)
        weighted_fee = round(weighted_num / weighted_den, 4) if weighted_den > 0 else 0

        # Category mix
        cat_map = {}
        for f in gd_funds:
            cat = f['category'] or 'Unknown'
            if cat not in cat_map:
                cat_map[cat] = {'aum_k': 0, 'funds': 0}
            cat_map[cat]['aum_k'] += f['patrimonio_k'] or 0
            cat_map[cat]['funds'] += 1
        category_mix = sorted([
            {'category': cat, 'aum_m': round(v['aum_k'] / 1000, 1), 'funds': v['funds']}
            for cat, v in cat_map.items()
        ], key=lambda x: -x['aum_m'])

        gestora_depositario.append({
            'gestora': gestora,
            'depositario': depositario,
            'grupo': grupo,
            'fund_count': len(gd_funds),
            'total_aum_m': round(aum_k / 1000, 1),
            'avg_depo_fee': round(sum(depo_fees) / len(depo_fees), 4) if depo_fees else 0,
            'weighted_depo_fee': weighted_fee,
            'is_captive': _is_captive(grupo, depositario),
            'is_inversis': INVERSIS_NAME in depositario,
            'category_mix': category_mix[:5],  # top 5 categories
        })

    # === Fund Detail ===
    fund_detail = []
    for f in funds:
        fund_detail.append({
            'fund_name': f['fund_name'],
            'isin': f['isin'],
            'gestora': f['gestora'],
            'depositario': f['depositario'],
            'category': f['category'] or 'Unknown',
            'aum_m': round((f['patrimonio_k'] or 0) / 1000, 1),
            'depo_fee': f['depo_fee'],
            'mgmt_fee': f['mgmt_fee'],
            'ter': f['ter'],
            'is_inversis': INVERSIS_NAME in f['depositario'],
        })

    # === Opportunity Targets ===
    # Group by gestora (across all their depositarios)
    gestora_all = {}
    for f in funds:
        g = f['gestora']
        if g not in gestora_all:
            gestora_all[g] = []
        gestora_all[g].append(f)

    opportunity_targets = []
    for gestora, g_funds in gestora_all.items():
        # Skip if already Inversis client
        depos = set(f['depositario'] for f in g_funds)
        if INVERSIS_NAME in depos:
            continue

        grupo = g_funds[0]['grupo']
        primary_depo = max(depos, key=lambda d: sum(
            f['patrimonio_k'] or 0 for f in g_funds if f['depositario'] == d))

        is_captive = _is_captive(grupo, primary_depo)

        aum_k = sum(f['patrimonio_k'] or 0 for f in g_funds)
        depo_fees = [f['depo_fee'] for f in g_funds if f['depo_fee'] is not None and f['depo_fee'] > 0]
        avg_fee = round(sum(depo_fees) / len(depo_fees), 4) if depo_fees else 0

        # Category mix
        cat_map = {}
        for f in g_funds:
            cat = f['category'] or 'Unknown'
            if cat not in cat_map:
                cat_map[cat] = {'aum_k': 0, 'funds': 0}
            cat_map[cat]['aum_k'] += f['patrimonio_k'] or 0
            cat_map[cat]['funds'] += 1
        category_mix = sorted([
            {'category': cat, 'aum_m': round(v['aum_k'] / 1000, 1), 'funds': v['funds']}
            for cat, v in cat_map.items()
        ], key=lambda x: -x['aum_m'])

        opportunity_targets.append({
            'gestora': gestora,
            'current_depositario': primary_depo,
            'grupo': grupo,
            'total_aum_m': round(aum_k / 1000, 1),
            'fund_count': len(g_funds),
            'avg_depo_fee': avg_fee,
            'fee_vs_inversis_avg': round(avg_fee - inversis_avg_fee, 4),
            'potential_revenue_k': round(aum_k * avg_fee / 100, 0) if avg_fee > 0 else 0,
            'is_captive': is_captive,
            'category_mix': category_mix[:3],
        })

    # Sort: non-captive first, then by AUM
    opportunity_targets.sort(key=lambda x: (x['is_captive'], -x['total_aum_m']))

    # === Market Share Chart (short names for display) ===
    market_share_chart = []
    for ds in depositario_stats:
        short = ds['depositario'].replace(', S.A.', '').replace(', S.A', '').replace(' S.A.', '')
        market_share_chart.append({
            'depositario': short,
            'depositario_full': ds['depositario'],
            'aum_bn': ds['total_aum_bn'],
            'pct': ds['market_share_pct'],
            'is_inversis': ds['is_inversis'],
        })

    # === Fee by Depositario (for bar chart) ===
    fee_by_depositario = []
    for ds in depositario_stats:
        short = ds['depositario'].replace(', S.A.', '').replace(', S.A', '').replace(' S.A.', '')
        fee_by_depositario.append({
            'depositario': short,
            'depositario_full': ds['depositario'],
            'avg_fee': ds['avg_depo_fee'],
            'median_fee': ds['median_depo_fee'],
            'aum_bn': ds['total_aum_bn'],
            'is_inversis': ds['is_inversis'],
        })

    # === Summary ===
    inversis_stats = next((d for d in depositario_stats if d['is_inversis']), None)
    inversis_rank_aum = next((i + 1 for i, d in enumerate(depositario_stats) if d['is_inversis']), 0)
    # Rank by gestora count
    by_gestora_count = sorted(depositario_stats, key=lambda x: -x['gestora_count'])
    inversis_rank_gestoras = next((i + 1 for i, d in enumerate(by_gestora_count) if d['is_inversis']), 0)

    # Opportunity summary
    non_captive_targets = [t for t in opportunity_targets if not t['is_captive']]
    premium_targets = [t for t in non_captive_targets if t['fee_vs_inversis_avg'] > 0]

    summary = {
        'total_depositarios': len(depositario_stats),
        'total_gestoras': len(gestora_all),
        'total_funds': len(funds),
        'total_aum_bn': round(total_aum_k / 1_000_000, 1),
        'inversis_aum_bn': inversis_stats['total_aum_bn'] if inversis_stats else 0,
        'inversis_market_share_pct': inversis_stats['market_share_pct'] if inversis_stats else 0,
        'inversis_gestora_count': inversis_stats['gestora_count'] if inversis_stats else 0,
        'inversis_avg_fee': inversis_avg_fee,
        'inversis_rank_aum': inversis_rank_aum,
        'inversis_rank_gestoras': inversis_rank_gestoras,
        'addressable_aum_bn': round(sum(t['total_aum_m'] for t in non_captive_targets) / 1000, 1),
        'target_gestoras': len(premium_targets),
        'potential_revenue_m': round(sum(t['potential_revenue_k'] for t in premium_targets) / 1000, 1),
        'date': '2025-Q3',
    }

    all_depositarios = sorted(set(f['depositario'] for f in funds))
    all_gestoras = sorted(set(f['gestora'] for f in funds))
    all_categories = sorted(set(f['category'] for f in funds if f['category']))

    return {
        'summary': summary,
        'depositario_stats': depositario_stats,
        'gestora_depositario': gestora_depositario,
        'fund_detail': fund_detail,
        'opportunity_targets': opportunity_targets,
        'market_share_chart': market_share_chart,
        'fee_by_depositario': fee_by_depositario,
        'depositarios': all_depositarios,
        'gestoras': all_gestoras,
        'categories': all_categories,
    }
