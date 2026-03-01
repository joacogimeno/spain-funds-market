"""Transform into gestora_rankings.json — gestora AUM rankings with categories."""
from ..config import get_snapshot_folders, normalize_category
from ..parsers.ranking_gestoras import parse_ranking_gestoras


def classify_gestora(name):
    """Classify gestora as bank/independent/foreign/insurance."""
    name_lower = name.lower()
    banks = ['caixabank', 'santander', 'bbva', 'ibercaja', 'kutxabank', 'bankinter',
             'unicaja', 'sabadell', 'abanca', 'caja rural', 'laboral', 'caja laboral',
             'gescooperativo', 'liberbank', 'caja ingenieros']
    foreign = ['amundi', 'caceis', 'credit agricole', 'gesconsult', 'actyus']
    insurance = ['mapfre', 'mutua', 'vidacaixa', 'seguros']
    for b in banks:
        if b in name_lower:
            return 'bank'
    for f in foreign:
        if f in name_lower:
            return 'foreign'
    for i in insurance:
        if i in name_lower:
            return 'insurance'
    return 'independent'


def build_gestora_rankings():
    """Build gestora rankings from all snapshots."""
    snapshots = get_snapshot_folders()
    if not snapshots:
        return {}

    # Parse each snapshot to get monthly gestora data
    monthly_rankings = []
    for label, folder in snapshots:
        gestoras = parse_ranking_gestoras(folder)
        if not gestoras:
            continue
        for g in gestoras:
            total = g.get('total_patrimonio')
            if total is None:
                total = sum(v for v in g.get('categories', {}).values() if isinstance(v, (int, float)))
            monthly_rankings.append({
                'date': label,
                'name': g['name'],
                'total_aum': total / 1_000_000 if total else 0,
                'pct': g.get('pct_total'),
                'num_fondos': g.get('num_fondos', 0),
            })

    # Latest snapshot ranking
    latest_label, latest_folder = snapshots[-1]
    latest_gestoras = parse_ranking_gestoras(latest_folder)

    # Also get a year-ago snapshot for growth calc
    year_ago_label = f"{int(latest_label[:4]) - 1}-{latest_label[5:]}"
    year_ago_data = {}
    for label, folder in snapshots:
        if label == year_ago_label:
            for g in parse_ranking_gestoras(folder):
                total = g.get('total_patrimonio')
                if total is None:
                    total = sum(v for v in g.get('categories', {}).values() if isinstance(v, (int, float)))
                year_ago_data[g['name']] = total

    top_gestoras = []
    for g in latest_gestoras:
        total = g.get('total_patrimonio')
        if total is None:
            total = sum(v for v in g.get('categories', {}).values() if isinstance(v, (int, float)))
        if not total or total == 0:
            continue

        aum_bn = total / 1_000_000

        # Category breakdown
        cat_breakdown = {}
        for cat, val in g.get('categories', {}).items():
            if isinstance(val, (int, float)) and val > 0:
                norm_cat = normalize_category(cat)
                cat_breakdown[norm_cat] = round(val / 1_000_000, 3)

        # YoY growth
        prev = year_ago_data.get(g['name'])
        yoy = round((total - prev) / prev * 100, 1) if prev and prev > 0 else None

        top_gestoras.append({
            'name': g['name'],
            'aum_bn': round(aum_bn, 3),
            'pct': g.get('pct_total'),
            'num_fondos': g.get('num_fondos', 0),
            'type': classify_gestora(g['name']),
            'yoy_growth': yoy,
            'categories': cat_breakdown,
        })

    top_gestoras.sort(key=lambda x: x['aum_bn'], reverse=True)

    # Add rank
    for i, g in enumerate(top_gestoras):
        g['rank'] = i + 1

    # Concentration metrics
    total_market = sum(g['aum_bn'] for g in top_gestoras)
    top3 = sum(g['aum_bn'] for g in top_gestoras[:3])
    top5 = sum(g['aum_bn'] for g in top_gestoras[:5])
    top10 = sum(g['aum_bn'] for g in top_gestoras[:10])

    return {
        'gestoras': top_gestoras,
        'concentration': {
            'top3_pct': round(top3 / total_market * 100, 1) if total_market > 0 else 0,
            'top5_pct': round(top5 / total_market * 100, 1) if total_market > 0 else 0,
            'top10_pct': round(top10 / total_market * 100, 1) if total_market > 0 else 0,
            'total_market_bn': round(total_market, 1),
        },
        'monthly': monthly_rankings,
    }
