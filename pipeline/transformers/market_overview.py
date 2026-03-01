"""Transform parsed data into market_overview.json."""
from ..config import get_snapshot_folders, normalize_category
from ..parsers.patrimonio import parse_patrimonio
from ..parsers.participes import parse_participes
from ..parsers.num_fondos import parse_num_fondos
from ..parsers.suscripciones import parse_suscripciones


def build_market_overview():
    """Build market overview data from all snapshots."""
    snapshots = get_snapshot_folders()
    if not snapshots:
        return {}

    # Use latest snapshot for annual historical series (1991-2025)
    latest_label, latest_folder = snapshots[-1]
    patrim_data = parse_patrimonio(latest_folder)
    participes_data = parse_participes(latest_folder)
    fund_count_data = parse_num_fondos(latest_folder)

    # Annual history from the time-series CSV
    annual_history = []
    for rec in patrim_data:
        total_bn = rec.get('total', 0) / 1_000_000
        entry = {
            'date': rec['date'],
            'year': rec['year'],
            'month': rec['month'],
            'total_aum_bn': round(total_bn, 2),
        }
        for k, v in rec.items():
            if k in ('date', 'year', 'month', 'total'):
                continue
            if isinstance(v, (int, float)):
                cat = normalize_category(k)
                entry[cat] = round(v / 1_000_000, 3)
        if rec['month'] == 12:
            annual_history.append(entry)

    # Monthly AUM from each snapshot (Jan 2024 - Jan 2026)
    # Each snapshot's time-series CSV has its latest month as the last row
    monthly_history = []
    for label, folder in snapshots:
        snap_data = parse_patrimonio(folder)
        if not snap_data:
            continue
        # The last row is the current month for that snapshot
        latest_rec = snap_data[-1]
        total_bn = latest_rec.get('total', 0) / 1_000_000
        entry = {
            'date': latest_rec['date'],
            'year': latest_rec['year'],
            'month': latest_rec['month'],
            'total_aum_bn': round(total_bn, 2),
        }
        for k, v in latest_rec.items():
            if k in ('date', 'year', 'month', 'total'):
                continue
            if isinstance(v, (int, float)):
                cat = normalize_category(k)
                entry[cat] = round(v / 1_000_000, 3)
        monthly_history.append(entry)

    # Similarly, monthly participes from each snapshot
    participes_monthly = []
    for label, folder in snapshots:
        snap_data = parse_participes(folder)
        if not snap_data:
            continue
        latest_rec = snap_data[-1]
        participes_monthly.append({
            'date': latest_rec['date'],
            'total': latest_rec.get('total', 0),
        })

    # Monthly fund counts from each snapshot
    funds_monthly = []
    for label, folder in snapshots:
        snap_data = parse_num_fondos(folder)
        if not snap_data:
            continue
        latest_rec = snap_data[-1]
        funds_monthly.append({
            'date': latest_rec['date'],
            'total': latest_rec.get('total', 0),
        })

    # Latest month flows
    latest_flows = parse_suscripciones(latest_folder)
    total_net = sum(r.get('net_month', 0) for r in latest_flows) / 1_000_000

    # Compute latest KPIs
    latest_patrim = monthly_history[-1] if monthly_history else {}

    # YoY growth: compare latest vs same month 12 months ago (by date key)
    yoy_growth = None
    if latest_patrim.get('date'):
        latest_y = int(latest_patrim['date'][:4])
        latest_m = int(latest_patrim['date'][5:])
        yoy_date = f"{latest_y - 1}-{latest_m:02d}"
        yoy_entry = next((e for e in monthly_history if e['date'] == yoy_date), None)
        if yoy_entry and yoy_entry['total_aum_bn'] > 0:
            yoy_growth = ((latest_patrim['total_aum_bn'] - yoy_entry['total_aum_bn'])
                          / yoy_entry['total_aum_bn'] * 100)

    # Latest participes
    latest_participes = participes_monthly[-1]['total'] if participes_monthly else 0
    # Latest fund count
    latest_funds = funds_monthly[-1]['total'] if funds_monthly else 0

    # Collect flows by category for the latest month
    flow_categories = []
    for rec in latest_flows:
        flow_categories.append({
            'category': normalize_category(rec['category']),
            'subs': round(rec.get('subs_month', 0) / 1_000_000, 3),
            'redemptions': round(rec.get('redemp_month', 0) / 1_000_000, 3),
            'net': round(rec.get('net_month', 0) / 1_000_000, 3),
        })

    # AUM Bridge: decompose monthly AUM change into Flows vs Market Effect
    # Market Effect = ΔAUM - Net Flows
    flow_by_date = {}
    for label, folder in snapshots:
        snap_flows = parse_suscripciones(folder)
        if snap_flows:
            snap_date_raw = parse_patrimonio(folder)
            snap_date = snap_date_raw[-1]['date'] if snap_date_raw else label
            net = sum(r.get('net_month', 0) for r in snap_flows) / 1_000_000
            flow_by_date[snap_date] = net

    aum_bridge = []
    cum_flows = 0
    cum_market = 0
    for i, entry in enumerate(monthly_history):
        d = entry['date']
        aum = entry['total_aum_bn']
        flows = round(flow_by_date.get(d, 0), 3)

        if i == 0:
            aum_bridge.append({
                'date': d, 'aum': aum,
                'delta': 0, 'flows': 0, 'market': 0,
                'cum_flows': 0, 'cum_market': 0,
            })
        else:
            prev_aum = monthly_history[i - 1]['total_aum_bn']
            prev_date = monthly_history[i - 1]['date']
            delta = round(aum - prev_aum, 3)

            # Check for month gap (e.g., Jan->Mar = 2 months)
            prev_y, prev_m = int(prev_date[:4]), int(prev_date[5:])
            cur_y, cur_m = int(d[:4]), int(d[5:])
            month_gap = (cur_y - prev_y) * 12 + (cur_m - prev_m)

            if month_gap == 1:
                # Normal single-month comparison
                market = round(delta - flows, 3)
            else:
                # Multi-month gap — we only have 1 month of flows but delta spans
                # multiple months. Mark as approximate; attribute residual to market.
                market = round(delta - flows, 3)

            cum_flows += flows
            cum_market += market

            aum_bridge.append({
                'date': d, 'aum': aum,
                'delta': delta, 'flows': flows, 'market': market,
                'cum_flows': round(cum_flows, 3),
                'cum_market': round(cum_market, 3),
                'gap': month_gap > 1,
            })

    # Summary stats
    total_delta = monthly_history[-1]['total_aum_bn'] - monthly_history[0]['total_aum_bn'] if len(monthly_history) > 1 else 0
    total_flows = sum(e['flows'] for e in aum_bridge)
    total_market = sum(e['market'] for e in aum_bridge)

    aum_bridge_summary = {
        'total_aum_change_bn': round(total_delta, 2),
        'total_flows_bn': round(total_flows, 2),
        'total_market_bn': round(total_market, 2),
        'flows_pct': round(total_flows / total_delta * 100, 1) if total_delta != 0 else 0,
        'market_pct': round(total_market / total_delta * 100, 1) if total_delta != 0 else 0,
        'period': f"{monthly_history[0]['date']} to {monthly_history[-1]['date']}",
    }

    return {
        'kpis': {
            'total_aum_bn': round(latest_patrim.get('total_aum_bn', 0), 1),
            'total_investors': int(latest_participes),
            'total_funds': int(latest_funds),
            'monthly_net_flows_bn': round(total_net, 2),
            'yoy_growth_pct': round(yoy_growth, 1) if yoy_growth else None,
            'latest_date': latest_patrim.get('date', ''),
        },
        'monthly_aum': monthly_history,
        'annual_aum': [e for e in annual_history if e['year'] >= 2005],
        'monthly_participes': participes_monthly,
        'monthly_funds': funds_monthly,
        'latest_flows': flow_categories,
        'aum_bridge': aum_bridge,
        'aum_bridge_summary': aum_bridge_summary,
    }
