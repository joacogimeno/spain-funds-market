"""Transform into insights.json — computed qualitative signals."""
from ..config import get_snapshot_folders
from ..parsers.ranking_grupos import parse_ranking_grupos
from ..parsers.suscripciones import parse_suscripciones
from ..parsers.rentabilidad import parse_rentabilidad


def build_insights():
    """Build computed insights for the Opportunities tab."""
    snapshots = get_snapshot_folders()
    if not snapshots:
        return {}

    latest_label, latest_folder = snapshots[-1]
    groups = parse_ranking_grupos(latest_folder)

    # Classify groups by growth
    high_growth = []  # >20% 1y
    growing = []      # 10-20% 1y
    stable = []       # 0-10% 1y
    declining = []    # <0% 1y

    for g in groups:
        if not g.get('patrimonio') or g['patrimonio'] == 0:
            continue
        aum_bn = g['patrimonio'] / 1_000_000
        var = g.get('var_1y')
        if var is None:
            continue

        entry = {
            'name': g['name'],
            'aum_bn': round(aum_bn, 3),
            'var_1y': var,
            'var_6m': g.get('var_6m'),
            'var_ytd': g.get('var_ytd'),
            'num_isin': int(g.get('num_isin', 0)) if g.get('num_isin') else 0,
        }

        if var > 20:
            high_growth.append(entry)
        elif var > 10:
            growing.append(entry)
        elif var >= 0:
            stable.append(entry)
        else:
            declining.append(entry)

    high_growth.sort(key=lambda x: x['var_1y'], reverse=True)
    growing.sort(key=lambda x: x['var_1y'], reverse=True)
    declining.sort(key=lambda x: x['var_1y'])

    # Client targeting tiers
    tier1 = [g for g in high_growth if g['aum_bn'] > 1]
    tier2 = [g for g in growing if g['aum_bn'] > 2]
    tier3 = [g for g in stable if g['aum_bn'] > 3]

    # Market opportunity analysis
    latest_flows = parse_suscripciones(latest_folder)
    latest_returns = parse_rentabilidad(latest_folder)

    growth_sectors = []
    declining_sectors = []
    for f in latest_flows:
        cat = f['category']
        net = f.get('net_month', 0)
        if net > 100_000:  # > 100M in month
            growth_sectors.append({'category': cat, 'monthly_net_m': round(net / 1000, 0)})
        elif net < -100_000:
            declining_sectors.append({'category': cat, 'monthly_net_m': round(net / 1000, 0)})

    # Structural shifts
    structural_shifts = [
        "Fixed income (RF Euro CP/LP) capturing majority of new flows",
        "Guaranteed funds in sustained secular decline",
        "Monetarios tripled AUM since 2022 on rate environment",
        "Independents growing 2-3x faster than bank-linked gestoras",
        "International fund wrappers gaining share vs domestic",
    ]

    threats = [
        "Fee compression across passive/index strategies",
        "Bank distribution dominance limits independent access",
        "Regulatory changes (MiFID III) may shift value chain",
        "Rate normalization risk for fixed income flows",
        "Consolidation reducing number of potential clients",
    ]

    # Inversis positioning metrics — reference Inversis Gestión standalone
    # (Banca March group removed: Inversis exits Banca March upon Euroclear acquisition Aug 2026)
    inversis_gest_data = None
    for g in groups:
        if 'INVERSIS' in g.get('name', '').upper() and 'BANCA MARCH' not in g.get('name', '').upper():
            inversis_gest_data = g
            break

    market_avg_growth = sum(g.get('var_1y', 0) for g in groups if g.get('var_1y')) / max(1, len([g for g in groups if g.get('var_1y')]))

    positioning = {
        'inversis_gestora_aum': round(inversis_gest_data['patrimonio'] / 1_000_000, 3) if inversis_gest_data else None,
        'inversis_growth': inversis_gest_data.get('var_1y') if inversis_gest_data else None,
        'market_avg_growth': round(market_avg_growth, 1),
        'radar': [
            {'metric': 'AUM Scale', 'inversis': 25, 'market_avg': 50, 'top_peer': 90},
            {'metric': 'Growth Rate', 'inversis': 35, 'market_avg': 50, 'top_peer': 85},
            {'metric': 'Fund Diversity', 'inversis': 60, 'market_avg': 50, 'top_peer': 80},
            {'metric': 'Client Reach', 'inversis': 40, 'market_avg': 50, 'top_peer': 95},
            {'metric': 'Technology', 'inversis': 75, 'market_avg': 50, 'top_peer': 70},
            {'metric': 'Independence', 'inversis': 80, 'market_avg': 40, 'top_peer': 90},
        ],
    }

    return {
        'client_tiers': {
            'tier1_high_growth': tier1,
            'tier2_growing_regionals': tier2,
            'tier3_established': tier3,
        },
        'market_opportunity': {
            'growth_sectors': growth_sectors,
            'declining_sectors': declining_sectors,
            'structural_shifts': structural_shifts,
            'threats': threats,
        },
        'positioning': positioning,
        'all_groups_classified': {
            'high_growth': high_growth,
            'growing': growing,
            'stable': stable,
            'declining': declining,
        },
    }
