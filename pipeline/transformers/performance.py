"""Transform into performance.json — returns by category across time horizons."""
from ..config import get_snapshot_folders, normalize_category
from ..parsers.rentabilidad import parse_rentabilidad


def build_performance():
    """Build performance data from all snapshots."""
    snapshots = get_snapshot_folders()
    if not snapshots:
        return {}

    # Monthly return snapshots
    monthly_returns = []
    for label, folder in snapshots:
        returns = parse_rentabilidad(folder)
        if not returns:
            continue
        entry = {'date': label, 'categories': {}}
        for rec in returns:
            cat = normalize_category(rec['category'])
            entry['categories'][cat] = {
                'return_month': rec.get('return_month'),
                'return_ytd': rec.get('return_ytd'),
                'return_1y': rec.get('return_1y'),
                'return_3y': rec.get('return_3y'),
                'return_5y': rec.get('return_5y'),
                'return_10y': rec.get('return_10y'),
                'patrimonio_bn': round(rec.get('patrimonio', 0) / 1_000_000, 3),
            }
        monthly_returns.append(entry)

    # Latest heatmap data
    latest = monthly_returns[-1] if monthly_returns else {}
    heatmap = []
    for cat, vals in latest.get('categories', {}).items():
        heatmap.append({
            'category': cat,
            'month': vals.get('return_month'),
            'ytd': vals.get('return_ytd'),
            '1y': vals.get('return_1y'),
            '3y': vals.get('return_3y'),
            '5y': vals.get('return_5y'),
            '10y': vals.get('return_10y'),
            'aum_bn': vals.get('patrimonio_bn', 0),
        })
    heatmap.sort(key=lambda x: x.get('1y') or 0, reverse=True)

    # Risk-return scatter (1y return vs AUM)
    scatter = []
    for item in heatmap:
        if item.get('1y') is not None and item['aum_bn'] > 0:
            scatter.append({
                'category': item['category'],
                'return_1y': item['1y'],
                'return_3y': item.get('3y'),
                'aum_bn': item['aum_bn'],
            })

    return {
        'heatmap': heatmap,
        'scatter': scatter,
        'monthly': monthly_returns,
    }
