"""Transform into group_rankings.json — financial group rankings."""
from ..config import get_snapshot_folders
from ..parsers.ranking_grupos import parse_ranking_grupos


def build_group_rankings():
    """Build group rankings from all snapshots."""
    snapshots = get_snapshot_folders()
    if not snapshots:
        return {}

    latest_label, latest_folder = snapshots[-1]
    groups = parse_ranking_grupos(latest_folder)

    # Year-ago snapshot
    year_ago_label = f"{int(latest_label[:4]) - 1}-{latest_label[5:]}"
    year_ago_data = {}
    for label, folder in snapshots:
        if label == year_ago_label:
            for g in parse_ranking_grupos(folder):
                if g.get('patrimonio'):
                    year_ago_data[g['name'].upper().strip()] = g['patrimonio']

    result = []
    for g in groups:
        patrim = g.get('patrimonio')
        if not patrim or patrim == 0:
            continue
        aum_bn = patrim / 1_000_000

        # Sub-gestoras
        subs = []
        for s in g.get('gestoras', []):
            if s.get('patrimonio'):
                subs.append({
                    'name': s['name'],
                    'aum_bn': round(s['patrimonio'] / 1_000_000, 3),
                    'var_1y': s.get('var_1y'),
                })

        result.append({
            'rank': g.get('rank'),
            'name': g['name'],
            'aum_bn': round(aum_bn, 3),
            'num_isin': int(g.get('num_isin', 0)) if g.get('num_isin') else 0,
            'var_1y': g.get('var_1y'),
            'var_6m': g.get('var_6m'),
            'var_3m': g.get('var_3m'),
            'var_1m': g.get('var_1m'),
            'var_ytd': g.get('var_ytd'),
            'gestoras': subs,
        })

    # Inversis spotlight
    inversis_group = None
    inversis_gestora = None
    for g in result:
        if 'BANCA MARCH' in g['name'].upper() or 'MARCH' in g['name'].upper():
            inversis_group = g
        for s in g.get('gestoras', []):
            if 'INVERSIS' in s['name'].upper():
                inversis_gestora = s

    return {
        'groups': result,
        'inversis': {
            'group': inversis_group,
            'gestora': inversis_gestora,
        },
    }
