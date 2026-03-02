"""Transform CNMV fee data into cnmv_fees.json for the Fee Analysis dashboard."""
import os
from ..parsers.cnmv_fees import parse_cnmv_fees
from ..config import DATA_DIR, find_cnmv_file


def build_cnmv_fees():
    """Build fee analysis data from CNMV Anexo A2.2.

    Output structure:
    {
      funds: [{isin, fund_name, gestora, grupo, category, share_class,
               patrimonio_m, investors, ter, mgmt_fee_aum, mgmt_fee_returns,
               sub_fee_max, redemp_fee_max, depositary_fee}],
      category_stats: [{category, count, avg_ter, median_ter, p25_ter, p75_ter,
                        avg_mgmt_fee, median_mgmt_fee, avg_patrimonio_m}],
      gestora_stats: [{gestora, count, funds, avg_ter, avg_mgmt_fee, total_aum_m}],
      fee_vs_size: [{isin, fund_name, category, patrimonio_m, ter, mgmt_fee_aum}],
      summary: {total_funds, total_classes, total_gestoras, total_aum_bn,
                avg_ter, avg_mgmt_fee, date}
    }
    """
    cnmv_dir = os.path.join(DATA_DIR, 'CNMV Estadisticas')
    _, cnmv_date = find_cnmv_file(cnmv_dir, 'Anexo')
    cnmv_date = cnmv_date or 'unknown'
    records = parse_cnmv_fees(cnmv_dir)
    if not records:
        return {}

    # Build fund-level list (all share classes)
    funds = []
    for r in records:
        funds.append({
            'isin': r['isin'],
            'fund_name': r['fund_name'],
            'gestora': r['gestora'],
            'grupo': r['grupo'],
            'category': r['category'],
            'share_class': r['share_class'],
            'patrimonio_m': round(r['patrimonio_k'] / 1000, 2) if r['patrimonio_k'] else 0,
            'investors': r['investors'],
            'ter': r['ter'],
            'mgmt_fee_aum': r['mgmt_fee_aum'],
            'mgmt_fee_returns': r['mgmt_fee_returns'],
            'sub_fee_max': r['sub_fee_max'],
            'sub_fee_min': r['sub_fee_min'],
            'redemp_fee_max': r['redemp_fee_max'],
            'redemp_fee_min': r['redemp_fee_min'],
            'depositary_fee': r['depositary_fee'],
        })

    # Category statistics — aggregate at fund level (sum AUM across all classes)
    # patrimonio_k is per-class, so we must sum it; TER uses AUM-weighted average
    _fund_classes = {}
    for r in records:
        key = r['fund_name']
        if key not in _fund_classes:
            _fund_classes[key] = []
        _fund_classes[key].append(r)

    fund_level = {}
    for fname, classes in _fund_classes.items():
        base = dict(classes[0])  # copy first class as template
        total_patrim = sum(c['patrimonio_k'] or 0 for c in classes)
        base['patrimonio_k'] = total_patrim
        base['investors'] = sum(c['investors'] or 0 for c in classes)
        # AUM-weighted TER across classes/compartments
        ter_num = sum((c['ter'] or 0) * (c['patrimonio_k'] or 0)
                      for c in classes if c['ter'] is not None and c['ter'] > 0)
        ter_den = sum(c['patrimonio_k'] or 0
                      for c in classes if c['ter'] is not None and c['ter'] > 0)
        base['ter'] = round(ter_num / ter_den, 4) if ter_den > 0 else base['ter']
        # AUM-weighted depositary fee
        dep_num = sum((c['depositary_fee'] or 0) * (c['patrimonio_k'] or 0)
                      for c in classes if c['depositary_fee'] is not None and c['depositary_fee'] > 0)
        dep_den = sum(c['patrimonio_k'] or 0
                      for c in classes if c['depositary_fee'] is not None and c['depositary_fee'] > 0)
        base['depositary_fee'] = round(dep_num / dep_den, 4) if dep_den > 0 else base['depositary_fee']
        fund_level[fname] = base

    category_groups = {}
    for r in fund_level.values():
        cat = r['category']
        if cat not in category_groups:
            category_groups[cat] = []
        category_groups[cat].append(r)

    category_stats = []
    for cat, cat_records in sorted(category_groups.items()):
        ters = sorted([r['ter'] for r in cat_records if r['ter'] is not None and r['ter'] > 0])
        mgmt_fees = [r['mgmt_fee_aum'] for r in cat_records if r['mgmt_fee_aum'] is not None]
        patrim = [r['patrimonio_k'] for r in cat_records if r['patrimonio_k'] is not None]

        category_stats.append({
            'category': cat,
            'count': len(cat_records),
            'avg_ter': _avg(ters),
            'median_ter': _median(ters),
            'p25_ter': _percentile(ters, 25),
            'p75_ter': _percentile(ters, 75),
            'avg_mgmt_fee': _avg(mgmt_fees),
            'median_mgmt_fee': _median(mgmt_fees),
            'avg_patrimonio_m': round(_avg(patrim) / 1000, 2) if patrim else 0,
        })

    # Gestora statistics
    gestora_groups = {}
    for r in fund_level.values():
        g = r['gestora']
        if g not in gestora_groups:
            gestora_groups[g] = []
        gestora_groups[g].append(r)

    gestora_stats = []
    for g, g_records in sorted(gestora_groups.items()):
        ters = [r['ter'] for r in g_records if r['ter'] is not None and r['ter'] > 0]
        mgmt_fees = [r['mgmt_fee_aum'] for r in g_records if r['mgmt_fee_aum'] is not None]
        total_aum_k = sum(r['patrimonio_k'] or 0 for r in g_records)

        gestora_stats.append({
            'gestora': g,
            'count': len(g_records),
            'funds': len(set(r['fund_name'] for r in g_records)),
            'avg_ter': _avg(ters),
            'avg_mgmt_fee': _avg(mgmt_fees),
            'total_aum_m': round(total_aum_k / 1000, 1),
        })

    # Sort gestora stats by total AUM descending
    gestora_stats.sort(key=lambda x: x['total_aum_m'], reverse=True)

    # Fee vs size scatter data (fund-level, only funds with both TER and AUM)
    fee_vs_size = []
    for r in fund_level.values():
        if r['ter'] and r['ter'] > 0 and r['patrimonio_k'] and r['patrimonio_k'] > 0:
            fee_vs_size.append({
                'isin': r['isin'],
                'fund_name': r['fund_name'],
                'category': r['category'],
                'gestora': r['gestora'],
                'patrimonio_m': round(r['patrimonio_k'] / 1000, 2),
                'ter': r['ter'],
                'mgmt_fee_aum': r['mgmt_fee_aum'] or 0,
            })

    # Fee distribution histogram data
    all_ters = sorted([r['ter'] for r in fund_level.values()
                       if r['ter'] is not None and r['ter'] > 0])
    all_mgmt = sorted([r['mgmt_fee_aum'] for r in fund_level.values()
                        if r['mgmt_fee_aum'] is not None and r['mgmt_fee_aum'] > 0])

    ter_histogram = _build_histogram(all_ters, [0, 0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0])
    mgmt_histogram = _build_histogram(all_mgmt, [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0])

    # Top expensive and cheapest funds (by TER)
    fund_by_ter = sorted(
        [r for r in fund_level.values() if r['ter'] is not None and r['ter'] > 0],
        key=lambda x: x['ter'], reverse=True
    )
    most_expensive = [_fund_summary(r) for r in fund_by_ter[:20]]
    cheapest = [_fund_summary(r) for r in fund_by_ter[-20:]]

    # Summary stats
    total_aum_bn = sum(r['patrimonio_k'] or 0 for r in fund_level.values()) / 1_000_000
    summary = {
        'total_funds': len(fund_level),
        'total_classes': len(records),
        'total_gestoras': len(gestora_groups),
        'total_aum_bn': round(total_aum_bn, 1),
        'avg_ter': _avg(all_ters),
        'median_ter': _median(all_ters),
        'avg_mgmt_fee': _avg(all_mgmt),
        'date': cnmv_date,
    }

    return {
        'funds': funds,
        'category_stats': category_stats,
        'gestora_stats': gestora_stats,
        'fee_vs_size': fee_vs_size,
        'ter_histogram': ter_histogram,
        'mgmt_histogram': mgmt_histogram,
        'most_expensive': most_expensive,
        'cheapest': cheapest,
        'summary': summary,
        'categories': sorted(category_groups.keys()),
        'gestoras': sorted(gestora_groups.keys()),
    }


def _fund_summary(r):
    """Compact fund summary for rankings."""
    return {
        'fund_name': r['fund_name'],
        'category': r['category'],
        'gestora': r['gestora'],
        'patrimonio_m': round((r['patrimonio_k'] or 0) / 1000, 1),
        'ter': r['ter'],
        'mgmt_fee_aum': r['mgmt_fee_aum'],
        'investors': r['investors'],
    }


def _avg(values):
    if not values:
        return 0
    return round(sum(values) / len(values), 4)


def _median(values):
    if not values:
        return 0
    s = sorted(values)
    n = len(s)
    if n % 2 == 1:
        return round(s[n // 2], 4)
    return round((s[n // 2 - 1] + s[n // 2]) / 2, 4)


def _percentile(values, pct):
    if not values:
        return 0
    s = sorted(values)
    k = (pct / 100) * (len(s) - 1)
    f = int(k)
    c = f + 1
    if c >= len(s):
        return round(s[f], 4)
    return round(s[f] + (k - f) * (s[c] - s[f]), 4)


def _build_histogram(values, bins):
    """Build histogram counts for given bin edges."""
    result = []
    for i in range(len(bins) - 1):
        lo, hi = bins[i], bins[i + 1]
        count = sum(1 for v in values if lo <= v < hi)
        label = f'{lo}–{hi}%'
        result.append({'label': label, 'lo': lo, 'hi': hi, 'count': count})
    # Last bin: >= last edge
    last = bins[-1]
    count = sum(1 for v in values if v >= last)
    result.append({'label': f'>{last}%', 'lo': last, 'hi': None, 'count': count})
    return result
