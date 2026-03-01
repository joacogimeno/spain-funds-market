"""Transform into fund_details.json — individual fund data from latest snapshot."""
from ..config import get_snapshot_folders
from ..parsers.categorias_fondos import parse_all_categories


def build_fund_details():
    """Build fund details from latest snapshot."""
    snapshots = get_snapshot_folders()
    if not snapshots:
        return {}

    latest_label, latest_folder = snapshots[-1]
    all_funds = parse_all_categories(latest_folder)

    # Flatten into a single list with category tag
    funds = []
    for category, fund_list in all_funds.items():
        for f in fund_list:
            fund = {
                'category': category,
                'isin': f['isin'],
                'name': f['name'],
                'gestora': f.get('gestora', ''),
                'grupo': f.get('grupo', ''),
                'patrimonio_m': round(f.get('patrimonio', 0) / 1000, 2),  # thousands -> millions
                'participes': int(f.get('participes', 0)) if f.get('participes') else 0,
                'return_month': f.get('return_month'),
                'return_ytd': f.get('return_ytd'),
                'return_1y': f.get('return_1y'),
                'return_3y': f.get('return_3y'),
                'return_5y': f.get('return_5y'),
                'net_subs_m': round(f.get('net_subs_month', 0) / 1000, 2) if f.get('net_subs_month') else 0,
                'net_subs_year_m': round(f.get('net_subs_year', 0) / 1000, 2) if f.get('net_subs_year') else 0,
            }
            funds.append(fund)

    # Get all categories and gestoras for filters
    categories = sorted(set(f['category'] for f in funds))
    gestoras = sorted(set(f['gestora'] for f in funds if f['gestora']))

    return {
        'funds': funds,
        'categories': categories,
        'gestoras': gestoras,
        'total_funds': len(funds),
        'latest_date': latest_label,
    }
