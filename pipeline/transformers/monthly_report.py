"""Transform into monthly_report.json — MoM analysis and key highlights."""
from ..config import get_snapshot_folders, normalize_category
from ..parsers.patrimonio import parse_patrimonio
from ..parsers.participes import parse_participes
from ..parsers.num_fondos import parse_num_fondos
from ..parsers.suscripciones import parse_suscripciones
from ..parsers.rentabilidad import parse_rentabilidad
from ..parsers.ranking_grupos import parse_ranking_grupos
from ..parsers.ranking_gestoras import parse_ranking_gestoras


def _safe_pct(new, old):
    """Safe percentage change."""
    if old and old != 0:
        return round((new - old) / abs(old) * 100, 2)
    return None


def _fmt_sign(v, decimals=1):
    """Format with sign."""
    if v is None:
        return None
    prefix = '+' if v > 0 else ''
    return f"{prefix}{v:.{decimals}f}"


def build_monthly_report():
    """Build MoM analysis for the latest available month."""
    snapshots = get_snapshot_folders()
    if len(snapshots) < 2:
        return {}

    # Latest two snapshots
    curr_label, curr_folder = snapshots[-1]
    prev_label, prev_folder = snapshots[-2]

    # Also get 12-months-ago snapshot for YoY context
    yoy_folder = None
    yoy_label = None
    if len(snapshots) > 12:
        yoy_label, yoy_folder = snapshots[-13]

    # ---- 1. AUM headline ----
    curr_patrim = parse_patrimonio(curr_folder)
    prev_patrim = parse_patrimonio(prev_folder)
    curr_latest = curr_patrim[-1] if curr_patrim else {}
    prev_latest = prev_patrim[-1] if prev_patrim else {}

    curr_aum = curr_latest.get('total', 0) / 1_000_000
    prev_aum = prev_latest.get('total', 0) / 1_000_000
    aum_delta = round(curr_aum - prev_aum, 2)
    aum_delta_pct = _safe_pct(curr_aum, prev_aum)

    # ---- 2. Investors ----
    curr_part = parse_participes(curr_folder)
    prev_part = parse_participes(prev_folder)
    curr_investors = curr_part[-1].get('total', 0) if curr_part else 0
    prev_investors = prev_part[-1].get('total', 0) if prev_part else 0
    inv_delta = curr_investors - prev_investors
    inv_delta_pct = _safe_pct(curr_investors, prev_investors)

    # ---- 3. Fund count ----
    curr_funds_data = parse_num_fondos(curr_folder)
    prev_funds_data = parse_num_fondos(prev_folder)
    curr_funds = curr_funds_data[-1].get('total', 0) if curr_funds_data else 0
    prev_funds = prev_funds_data[-1].get('total', 0) if prev_funds_data else 0
    funds_delta = curr_funds - prev_funds

    # ---- 4. Flows ----
    curr_flows = parse_suscripciones(curr_folder)
    prev_flows = parse_suscripciones(prev_folder)
    curr_total_net = sum(r.get('net_month', 0) for r in curr_flows) / 1_000_000
    prev_total_net = sum(r.get('net_month', 0) for r in prev_flows) / 1_000_000
    curr_total_subs = sum(r.get('subs_month', 0) for r in curr_flows) / 1_000_000
    prev_total_subs = sum(r.get('subs_month', 0) for r in prev_flows) / 1_000_000
    curr_total_redemp = sum(r.get('redemp_month', 0) for r in curr_flows) / 1_000_000
    prev_total_redemp = sum(r.get('redemp_month', 0) for r in prev_flows) / 1_000_000

    market_effect = round(aum_delta - curr_total_net, 2)

    # ---- 5. Category AUM changes ----
    # Build category AUM for current and previous month
    curr_cats = {}
    for k, v in curr_latest.items():
        if k in ('date', 'year', 'month', 'total'):
            continue
        if isinstance(v, (int, float)):
            cat = normalize_category(k)
            curr_cats[cat] = round(v / 1_000_000, 3)

    prev_cats = {}
    for k, v in prev_latest.items():
        if k in ('date', 'year', 'month', 'total'):
            continue
        if isinstance(v, (int, float)):
            cat = normalize_category(k)
            prev_cats[cat] = round(v / 1_000_000, 3)

    all_cats = sorted(set(list(curr_cats.keys()) + list(prev_cats.keys())))
    category_changes = []
    for cat in all_cats:
        curr_v = curr_cats.get(cat, 0)
        prev_v = prev_cats.get(cat, 0)
        delta = round(curr_v - prev_v, 3)
        pct = _safe_pct(curr_v, prev_v)
        category_changes.append({
            'category': cat,
            'curr_aum_bn': curr_v,
            'prev_aum_bn': prev_v,
            'delta_bn': delta,
            'delta_pct': pct,
        })

    category_changes.sort(key=lambda x: x['delta_bn'], reverse=True)

    # ---- 6. Category flows for current month ----
    category_flows = []
    for rec in curr_flows:
        cat = normalize_category(rec['category'])
        net = round(rec.get('net_month', 0) / 1_000_000, 3)
        subs = round(rec.get('subs_month', 0) / 1_000_000, 3)
        redemp = round(rec.get('redemp_month', 0) / 1_000_000, 3)
        category_flows.append({
            'category': cat, 'net': net, 'subs': subs, 'redemp': redemp,
        })

    # Find previous month flows for comparison
    prev_flow_map = {}
    for rec in prev_flows:
        cat = normalize_category(rec['category'])
        prev_flow_map[cat] = round(rec.get('net_month', 0) / 1_000_000, 3)

    for cf in category_flows:
        cf['prev_net'] = prev_flow_map.get(cf['category'], 0)
        cf['net_change'] = round(cf['net'] - cf['prev_net'], 3)

    category_flows.sort(key=lambda x: x['net'], reverse=True)

    # ---- 7. Performance ----
    curr_returns = parse_rentabilidad(curr_folder)
    prev_returns = parse_rentabilidad(prev_folder)

    prev_ret_map = {}
    for r in prev_returns:
        cat = normalize_category(r['category'])
        prev_ret_map[cat] = r

    performance = []
    for r in curr_returns:
        cat = normalize_category(r['category'])
        month_ret = r.get('return_month')
        ytd_ret = r.get('return_ytd')
        y1_ret = r.get('return_1y')
        prev = prev_ret_map.get(cat, {})
        prev_month_ret = prev.get('return_month')

        performance.append({
            'category': cat,
            'return_month': month_ret,
            'return_ytd': ytd_ret,
            'return_1y': y1_ret,
            'prev_return_month': prev_month_ret,
        })

    performance.sort(key=lambda x: x['return_month'] or -999, reverse=True)

    # ---- 8. Group rankings — var_1m movers ----
    curr_groups = parse_ranking_grupos(curr_folder)
    group_movers = []
    for g in curr_groups:
        if not g.get('patrimonio') or g['patrimonio'] == 0:
            continue
        var_1m = g.get('var_1m')
        if var_1m is None:
            continue
        aum = round(g['patrimonio'] / 1_000_000, 3)
        group_movers.append({
            'name': g['name'],
            'aum_bn': aum,
            'var_1m': var_1m,
            'var_ytd': g.get('var_ytd'),
            'var_1y': g.get('var_1y'),
            'num_isin': int(g.get('num_isin', 0)) if g.get('num_isin') else 0,
        })
    group_movers.sort(key=lambda x: x['var_1m'], reverse=True)

    # ---- 9. Gestora rankings — current snapshot ----
    curr_gestoras = parse_ranking_gestoras(curr_folder)
    prev_gestoras = parse_ranking_gestoras(prev_folder)

    prev_gestora_map = {}
    for ge in prev_gestoras:
        prev_gestora_map[ge['name']] = (ge.get('total_patrimonio') or 0) / 1_000_000

    gestora_movers = []
    for ge in curr_gestoras:
        curr_g_aum = (ge.get('total_patrimonio') or 0) / 1_000_000
        prev_g_aum = prev_gestora_map.get(ge['name'], 0)
        if curr_g_aum < 0.1:
            continue
        delta = round(curr_g_aum - prev_g_aum, 3)
        pct = _safe_pct(curr_g_aum, prev_g_aum)
        gestora_movers.append({
            'name': ge['name'],
            'curr_aum_bn': round(curr_g_aum, 3),
            'prev_aum_bn': round(prev_g_aum, 3),
            'delta_bn': delta,
            'delta_pct': pct,
        })
    gestora_movers.sort(key=lambda x: x['delta_bn'], reverse=True)

    # ---- 10. Auto-generated highlights ----
    highlights = _generate_highlights(
        curr_label=curr_label,
        prev_label=prev_label,
        aum_delta=aum_delta,
        aum_delta_pct=aum_delta_pct,
        curr_aum=curr_aum,
        curr_total_net=curr_total_net,
        prev_total_net=prev_total_net,
        market_effect=market_effect,
        inv_delta=inv_delta,
        category_changes=category_changes,
        category_flows=category_flows,
        performance=performance,
        group_movers=group_movers,
        gestora_movers=gestora_movers,
    )

    # ---- 11. Inversis spotlight MoM ----
    inversis_group = None
    for g in group_movers:
        if 'BANCA MARCH' in g['name'].upper():
            inversis_group = g
            break

    inversis_gestora_curr = None
    inversis_gestora_prev = None
    for ge in gestora_movers:
        if 'INVERSIS' in ge['name'].upper():
            inversis_gestora_curr = ge
            break

    return {
        'report_month': curr_label,
        'prev_month': prev_label,
        'headline': {
            'total_aum_bn': round(curr_aum, 2),
            'prev_aum_bn': round(prev_aum, 2),
            'aum_delta_bn': aum_delta,
            'aum_delta_pct': aum_delta_pct,
            'net_flows_bn': round(curr_total_net, 2),
            'prev_net_flows_bn': round(prev_total_net, 2),
            'market_effect_bn': market_effect,
            'total_subs_bn': round(curr_total_subs, 2),
            'total_redemp_bn': round(curr_total_redemp, 2),
            'prev_subs_bn': round(prev_total_subs, 2),
            'prev_redemp_bn': round(prev_total_redemp, 2),
            'investors': curr_investors,
            'prev_investors': prev_investors,
            'inv_delta': inv_delta,
            'inv_delta_pct': inv_delta_pct,
            'funds': curr_funds,
            'prev_funds': prev_funds,
            'funds_delta': funds_delta,
        },
        'category_changes': category_changes,
        'category_flows': category_flows,
        'performance': performance,
        'group_movers': group_movers,
        'gestora_movers_top': gestora_movers[:15],
        'gestora_movers_bottom': gestora_movers[-15:][::-1] if len(gestora_movers) > 15 else [],
        'inversis': {
            'group': inversis_group,
            'gestora': inversis_gestora_curr,
        },
        'highlights': highlights,
    }


def _generate_highlights(*, curr_label, prev_label, aum_delta, aum_delta_pct,
                         curr_aum, curr_total_net, prev_total_net,
                         market_effect, inv_delta,
                         category_changes, category_flows,
                         performance, group_movers, gestora_movers):
    """Auto-generate narrative highlights from the data."""
    highlights = []

    # 1. Overall market direction
    direction = 'grew' if aum_delta > 0 else 'contracted'
    highlights.append({
        'type': 'headline',
        'icon': 'chart',
        'text': (f"The Spanish fund market {direction} by \u20AC{abs(aum_delta):.1f}B "
                 f"({'+' if aum_delta_pct > 0 else ''}{aum_delta_pct:.1f}%) "
                 f"to reach \u20AC{curr_aum:.1f}B in {curr_label}."),
    })

    # 2. Flows vs market attribution
    if abs(curr_total_net) > 0.01:
        flow_pct = round(curr_total_net / aum_delta * 100, 0) if aum_delta != 0 else 0
        market_pct = round(market_effect / aum_delta * 100, 0) if aum_delta != 0 else 0
        highlights.append({
            'type': 'attribution',
            'icon': 'flows',
            'text': (f"Growth driven by \u20AC{market_effect:.1f}B market appreciation "
                     f"and \u20AC{curr_total_net:.1f}B net investor flows."),
        })

    # 3. Flow trend vs previous month
    flow_change = curr_total_net - prev_total_net
    if abs(flow_change) > 0.1:
        direction = 'increased' if flow_change > 0 else 'decreased'
        highlights.append({
            'type': 'flows',
            'icon': 'trend',
            'text': (f"Net flows {direction} by \u20AC{abs(flow_change):.1f}B vs {prev_label} "
                     f"(\u20AC{curr_total_net:.1f}B vs \u20AC{prev_total_net:.1f}B)."),
        })

    # 4. Top category gainer
    if category_changes:
        top = category_changes[0]
        highlights.append({
            'type': 'category',
            'icon': 'up',
            'text': (f"Biggest category gainer: {top['category']} "
                     f"(+\u20AC{top['delta_bn']:.1f}B, "
                     f"{'+' if top['delta_pct'] > 0 else ''}{top['delta_pct']:.1f}%)."),
        })

    # 5. Top category loser
    if category_changes:
        bottom = category_changes[-1]
        if bottom['delta_bn'] < 0:
            highlights.append({
                'type': 'category',
                'icon': 'down',
                'text': (f"Biggest category decliner: {bottom['category']} "
                         f"(\u20AC{bottom['delta_bn']:.1f}B, "
                         f"{bottom['delta_pct']:.1f}%)."),
            })

    # 6. Best performing category
    best_perf = [p for p in performance if p.get('return_month') is not None]
    if best_perf:
        top_perf = best_perf[0]
        highlights.append({
            'type': 'performance',
            'icon': 'star',
            'text': (f"Best monthly return: {top_perf['category']} "
                     f"at {'+' if top_perf['return_month'] > 0 else ''}"
                     f"{top_perf['return_month']:.2f}%."),
        })

    # 7. Worst performing
    if best_perf:
        worst_perf = best_perf[-1]
        if worst_perf['return_month'] < 0:
            highlights.append({
                'type': 'performance',
                'icon': 'alert',
                'text': (f"Worst monthly return: {worst_perf['category']} "
                         f"at {worst_perf['return_month']:.2f}%."),
            })

    # 8. Top flow attractor
    if category_flows:
        top_flow = category_flows[0]
        highlights.append({
            'type': 'flows',
            'icon': 'inflow',
            'text': (f"Top flow attractor: {top_flow['category']} "
                     f"with \u20AC{top_flow['net']:.2f}B net inflows."),
        })

    # 9. Investor trend
    if inv_delta != 0:
        direction = 'gained' if inv_delta > 0 else 'lost'
        highlights.append({
            'type': 'investors',
            'icon': 'people',
            'text': (f"The market {direction} {abs(inv_delta):,.0f} investors this month."),
        })

    # 10. Biggest group mover
    if group_movers:
        top_group = group_movers[0]
        highlights.append({
            'type': 'group',
            'icon': 'building',
            'text': (f"Fastest growing group: {top_group['name']} "
                     f"({'+' if top_group['var_1m'] > 0 else ''}{top_group['var_1m']:.1f}% MoM, "
                     f"\u20AC{top_group['aum_bn']:.1f}B AUM)."),
        })

    return highlights
