"""Transform into category_evolution.json — AUM by category over time."""
from ..config import get_snapshot_folders, normalize_category
from ..parsers.patrimonio import parse_patrimonio


def build_category_evolution():
    """Build category evolution data."""
    snapshots = get_snapshot_folders()
    if not snapshots:
        return {}

    latest_label, latest_folder = snapshots[-1]
    patrim_hist = parse_patrimonio(latest_folder)

    # Monthly data from each snapshot
    monthly = []
    for label, folder in snapshots:
        snap_data = parse_patrimonio(folder)
        if not snap_data:
            continue
        rec = snap_data[-1]  # Latest row from this snapshot
        entry = {'date': rec['date']}
        for k, v in rec.items():
            if k in ('date', 'year', 'month', 'total'):
                continue
            if isinstance(v, (int, float)):
                cat = normalize_category(k)
                entry[cat] = round(v / 1_000_000, 3)
        entry['total'] = round(rec.get('total', 0) / 1_000_000, 2)
        monthly.append(entry)

    # Latest month category breakdown for treemap
    latest = monthly[-1] if monthly else {}
    # Find entry ~12 months ago
    prev_year = monthly[-13] if len(monthly) > 12 else (monthly[0] if monthly else {})

    treemap = []
    for k, v in latest.items():
        if k in ('date', 'total'):
            continue
        if isinstance(v, (int, float)) and v > 0:
            growth = None
            if k in prev_year and prev_year[k] > 0:
                growth = round((v - prev_year[k]) / prev_year[k] * 100, 1)
            treemap.append({
                'category': k,
                'aum_bn': round(v, 2),
                'yoy_growth': growth,
            })
    treemap.sort(key=lambda x: x['aum_bn'], reverse=True)

    # Annual snapshots from historical series
    annual = []
    for rec in patrim_hist:
        if rec['month'] != 12:
            continue
        if rec['year'] < 2015:
            continue
        entry = {'date': rec['date'], 'year': rec['year']}
        for k, v in rec.items():
            if k in ('date', 'year', 'month', 'total'):
                continue
            if isinstance(v, (int, float)):
                cat = normalize_category(k)
                entry[cat] = round(v / 1_000_000, 3)
        entry['total'] = round(rec.get('total', 0) / 1_000_000, 2)
        annual.append(entry)

    # Category growth rates
    growth_rates = [
        {'category': item['category'], 'growth_pct': item['yoy_growth'], 'aum_bn': item['aum_bn']}
        for item in treemap if item['yoy_growth'] is not None
    ]
    growth_rates.sort(key=lambda x: x['growth_pct'], reverse=True)

    return {
        'monthly': monthly,
        'annual': annual,
        'treemap': treemap,
        'growth_rates': growth_rates,
    }
