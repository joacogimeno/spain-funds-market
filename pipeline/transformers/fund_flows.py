"""Transform into fund_flows.json — subscriptions/redemptions analysis."""
from ..config import get_snapshot_folders, normalize_category
from ..parsers.suscripciones import parse_suscripciones
from ..parsers.ranking_suscripciones import parse_ranking_suscripciones


def build_fund_flows():
    """Build fund flows data from all snapshots."""
    snapshots = get_snapshot_folders()
    if not snapshots:
        return {}

    # Monthly flows across all snapshots
    monthly_flows = []
    for label, folder in snapshots:
        flows = parse_suscripciones(folder)
        if not flows:
            continue
        entry = {'date': label}
        total_subs = 0
        total_redemp = 0
        total_net = 0
        cats = {}
        for rec in flows:
            cat = normalize_category(rec['category'])
            net = rec.get('net_month', 0) / 1_000_000  # to billions
            subs = rec.get('subs_month', 0) / 1_000_000
            redemp = rec.get('redemp_month', 0) / 1_000_000
            cats[cat] = {'net': round(net, 3), 'subs': round(subs, 3), 'redemp': round(redemp, 3)}
            total_subs += subs
            total_redemp += redemp
            total_net += net
        entry['total_subs'] = round(total_subs, 3)
        entry['total_redemp'] = round(total_redemp, 3)
        entry['total_net'] = round(total_net, 3)
        entry['categories'] = cats
        monthly_flows.append(entry)

    # Latest month gestora flow rankings
    latest_label, latest_folder = snapshots[-1]
    gestora_flows = parse_ranking_suscripciones(latest_folder)

    gestora_flow_ranking = []
    for g in gestora_flows:
        total = g.get('total_net_flows', 0)
        gestora_flow_ranking.append({
            'name': g['name'],
            'total_net_bn': round(total / 1_000_000, 3),
            'flows_by_category': {k: round(v / 1_000_000, 3) for k, v in g.get('flows', {}).items()},
        })
    gestora_flow_ranking.sort(key=lambda x: x['total_net_bn'], reverse=True)

    # Category cumulative flows
    cat_cumulative = {}
    for entry in monthly_flows:
        for cat, vals in entry.get('categories', {}).items():
            if cat not in cat_cumulative:
                cat_cumulative[cat] = []
            cum = cat_cumulative[cat][-1]['cumulative'] if cat_cumulative[cat] else 0
            cat_cumulative[cat].append({
                'date': entry['date'],
                'net': vals['net'],
                'cumulative': round(cum + vals['net'], 3),
            })

    return {
        'monthly': monthly_flows,
        'gestora_ranking': gestora_flow_ranking,
        'cumulative_by_category': cat_cumulative,
    }
