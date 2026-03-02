"""Transform CNMV foreign IIC data into cnmv_foreign.json for the dashboard."""
import os
from ..parsers.cnmv_foreign_iic import parse_cnmv_foreign_iic
from ..parsers.patrimonio import parse_patrimonio
from ..config import DATA_DIR, get_snapshot_folders, find_cnmv_file


def build_cnmv_foreign():
    """Build foreign IIC market analysis from CNMV Cuadro 7.1-7.3.

    Output structure:
    {
      summary: {total_iic, total_accounts, total_volume_bn, yoy_growth, ytd_growth},
      quarterly_trend: [{quarter, num_iic, accounts_m, volume_bn}],
      type_breakdown: [{type, latest_count, latest_volume_bn, latest_accounts_m, yoy_pct}],
      countries: [{name, count, pct_of_total}],
      size_distribution: [{bracket, count, volume_bn}],
      domestic_vs_foreign: {domestic_aum_bn, foreign_aum_bn, foreign_pct},
    }
    """
    cnmv_dir = os.path.join(DATA_DIR, 'CNMV Estadisticas')
    raw = parse_cnmv_foreign_iic(cnmv_dir)
    if not raw:
        return {}

    quarters = raw['quarters']
    summary_data = raw['summary']
    dist_vol = raw['distribution_volume']

    # Quarterly trend
    quarterly_trend = []
    for i, q in enumerate(quarters):
        num_iic = _val(summary_data['num_iic']['total']['values'], i)
        accounts = _val(summary_data['accounts']['total']['values'], i)
        volume_k = _val(summary_data['volume_k']['total']['values'], i)
        quarterly_trend.append({
            'quarter': q,
            'num_iic': int(num_iic) if num_iic else None,
            'accounts_m': round(accounts / 1_000_000, 2) if accounts else None,
            'volume_bn': round(volume_k / 1_000_000, 1) if volume_k else None,
        })

    # Latest quarter values
    latest_total = summary_data['num_iic']['total']
    latest_accounts = summary_data['accounts']['total']
    latest_volume = summary_data['volume_k']['total']

    latest_num = _val(latest_total['values'], -1)
    latest_acc = _val(latest_accounts['values'], -1)
    latest_vol = _val(latest_volume['values'], -1)

    summary = {
        'total_iic': int(latest_num) if latest_num else 0,
        'total_accounts_m': round(latest_acc / 1_000_000, 2) if latest_acc else 0,
        'total_volume_bn': round(latest_vol / 1_000_000, 1) if latest_vol else 0,
        'yoy_growth_pct': latest_volume['pct'].get('yoy'),
        'ytd_growth_pct': latest_volume['pct'].get('ytd'),
        'qoq_growth_pct': latest_volume['pct'].get('qoq'),
        'accounts_yoy_pct': latest_accounts['pct'].get('yoy'),
        'date': quarters[-1] if quarters else 'unknown',
    }

    # Type breakdown (fondos vs sociedades)
    type_breakdown = []
    for tipo, label in [('fondos', 'Fondos (Funds)'), ('sociedades', 'Sociedades (Companies)')]:
        num = summary_data['num_iic'][tipo]
        vol = summary_data['volume_k'][tipo]
        acc = summary_data['accounts'][tipo]
        type_breakdown.append({
            'type': label,
            'latest_count': int(_val(num['values'], -1) or 0),
            'latest_volume_bn': round((_val(vol['values'], -1) or 0) / 1_000_000, 1),
            'latest_accounts_m': round((_val(acc['values'], -1) or 0) / 1_000_000, 2),
            'yoy_volume_pct': vol['pct'].get('yoy'),
            'yoy_accounts_pct': acc['pct'].get('yoy'),
        })

    # Country breakdown
    countries = []
    total_count = int(latest_num) if latest_num else 1
    for c in summary_data.get('countries', []):
        latest_count = _val(c['values'], -1)
        if latest_count and latest_count > 0:
            countries.append({
                'name': c['name'],
                'count': int(latest_count),
                'pct_of_total': round(latest_count / total_count * 100, 1),
                'yoy_pct': c['pct'].get('yoy'),
            })
    countries.sort(key=lambda x: x['count'], reverse=True)

    # Size distribution (from Cuadro 7.2)
    size_distribution = []
    for i, bracket in enumerate(dist_vol.get('by_count', [])):
        volume_entry = dist_vol['by_volume'][i] if i < len(dist_vol.get('by_volume', [])) else None
        latest_count = _val(bracket['values'], -1)
        latest_vol = _val(volume_entry['values'], -1) if volume_entry else None
        size_distribution.append({
            'bracket': bracket['bracket'],
            'count': int(latest_count) if latest_count else 0,
            'volume_bn': round(latest_vol / 1_000_000, 1) if latest_vol else 0,
        })

    # Domestic vs Foreign comparison — pull latest domestic AUM from INVERCO data
    domestic_aum_bn = 0
    snapshots = get_snapshot_folders()
    if snapshots:
        latest_patrim = parse_patrimonio(snapshots[-1][1])
        if latest_patrim:
            domestic_aum_bn = round(latest_patrim[-1].get('total', 0) / 1_000_000, 1)
    foreign_aum_bn = summary['total_volume_bn']
    total_market = domestic_aum_bn + foreign_aum_bn
    comparison = {
        'domestic_aum_bn': domestic_aum_bn,
        'foreign_aum_bn': foreign_aum_bn,
        'total_market_bn': round(total_market, 1),
        'foreign_pct': round(foreign_aum_bn / total_market * 100, 1) if total_market else 0,
        'note': 'Domestic AUM from latest INVERCO monthly snapshot',
    }

    return {
        'summary': summary,
        'quarterly_trend': quarterly_trend,
        'type_breakdown': type_breakdown,
        'countries': countries,
        'size_distribution': size_distribution,
        'domestic_vs_foreign': comparison,
    }


def _val(values, idx):
    """Safely get value from list by index."""
    if not values:
        return None
    try:
        return values[idx]
    except IndexError:
        return None
