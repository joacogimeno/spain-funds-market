"""Build banca_march.json — Banca March intragroup depositary relationship analysis.

Uses inversis_depositary_insights_2025Q3.xlsx to analyse:
- Current Banca March / March AM depositary fees vs all Inversis clients
- Revenue shortfall vs market rates (intragroup pricing discount)
- Scenarios for fee normalisation post-Euroclear acquisition (Aug 2026)
- Switching risk assessment
- Market-wide benchmarking vs all Spanish depositaries (CNMV A2.2)
"""
import os
import openpyxl
import pandas as pd

from ..config import DATA_DIR, find_cnmv_file


MARCH_AM_NAME = 'MARCH ASSET MANAGEMENT, S.G.I.I.C., S.A.U.'
INVERSIS_GEST_NAME = 'INVERSIS GESTIÓN, S.A., SGIIC'
BANCA_MARCH_GROUP = 'BANCA MARCH'
INSIGHTS_FILE = 'inversis_depositary_insights_2025Q3.xlsx'


def _read_sheet_as_records(ws, expected_cols):
    """Read a worksheet with a header row into a list of dicts."""
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    header = [str(c).strip() if c is not None else '' for c in rows[0]]
    records = []
    for row in rows[1:]:
        rec = {header[i]: row[i] for i in range(min(len(header), len(row)))}
        records.append(rec)
    return records


def _safe_float(v, default=0.0):
    try:
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default


def _weighted_avg(items, value_key, weight_key, condition=None):
    """AUM-weighted average of value_key, optionally filtered by condition."""
    num = sum(_safe_float(r[value_key]) * _safe_float(r[weight_key])
              for r in items if (condition is None or condition(r)) and _safe_float(r[value_key]) > 0)
    den = sum(_safe_float(r[weight_key])
              for r in items if (condition is None or condition(r)) and _safe_float(r[value_key]) > 0)
    return num / den if den > 0 else 0.0


LIQUID_CATS = {'M', 'MCP', 'RFECP'}   # Monetario, Monetario Corto Plazo, RF Euro Corto Plazo

# Private bank / boutique groups using external third-party depositaries
PRIVATE_BANK_PEERS = [
    'ANDBANK', 'MORA BANC', 'DEUTSCHE BANK', 'UBS', 'A&G',
    'ABANTE', 'CREDIT AGRICOLE', 'MEDIOLANUM', 'BANCA MARCH',
]


def _build_market_benchmarks(cnmv_dir: str, march_am_bps: float) -> dict:
    """
    Load CNMV Anexo A2.2 (all Spanish IICs, all depositaries) and compute:
    - Fee distribution for M/MCP/RFECP across the whole market
    - Per-group weighted fee for private bank comparables
    - Market percentile rank for March AM's effective rate
    """
    anexo_path, _ = find_cnmv_file(cnmv_dir, 'Anexo')
    if anexo_path is None:
        return {}

    try:
        df = pd.read_excel(anexo_path, sheet_name='A2.2', header=None, skiprows=9,
                           dtype={18: float})  # deposit_fee column
        df.columns = [
            'grupo', 'gestora', 'fondo', 'compart', 'categoria',
            'gastos_k', 'ter_pct', 'participes', 'clase', 'isin',
            'divisa', 'patrimonio_k', 'mgmt_aum', 'mgmt_rdos',
            'sub_max', 'sub_min', 'red_max', 'red_min',
            'deposit_fee', 'dto_max', 'dto_min',
        ]
        df['grupo']     = df['grupo'].ffill()
        df['gestora']   = df['gestora'].ffill()
        df['fondo']     = df['fondo'].ffill()
        df['categoria'] = df['categoria'].ffill()

        df = df[df['isin'].notna() & df['isin'].astype(str).str.startswith('ES')]
        df['patrimonio_k'] = pd.to_numeric(df['patrimonio_k'], errors='coerce').fillna(0)
        df['deposit_fee']  = pd.to_numeric(df['deposit_fee'],  errors='coerce').fillna(0)
        df['dep_bps']      = df['deposit_fee'] * 100   # convert % → bps

        df_liq = df[df['categoria'].isin(LIQUID_CATS) & (df['patrimonio_k'] > 0)].copy()
    except Exception as e:
        print(f'  Warning: could not load CNMV Anexo for market benchmarks: {e}')
        return {}

    total_aum = df_liq['patrimonio_k'].sum()
    if total_aum == 0:
        return {}

    # ── Fee distribution buckets ───────────────────────────────────────────
    def _bucket(lo, hi):
        if lo == 0 and hi == 0:
            mask = df_liq['dep_bps'] == 0
        else:
            mask = (df_liq['dep_bps'] > lo) & (df_liq['dep_bps'] <= hi)
        aum = df_liq.loc[mask, 'patrimonio_k'].sum()
        return {
            'label': '0 bps' if (lo == 0 and hi == 0) else
                     (f'< 2 bps' if lo == 0 else f'{int(lo)}-{int(hi)} bps'),
            'isins': int(mask.sum()),
            'aum_bn': round(aum / 1e6, 2),
            'aum_pct': round(aum / total_aum * 100, 1),
        }

    fee_distribution = [
        _bucket(0,  0),
        _bucket(0,  2),   # 0 < fee ≤ 2
        _bucket(2,  5),
        _bucket(5,  7),
        _bucket(7,  9),
        _bucket(9, 12),
        _bucket(12, 999),
    ]
    # Fix label for the 0<fee≤2 bucket
    fee_distribution[1]['label'] = '0–2 bps'

    # ── Market percentiles (all active ISINs) ─────────────────────────────
    p10  = float(df_liq['dep_bps'].quantile(0.10))
    p25  = float(df_liq['dep_bps'].quantile(0.25))
    p50  = float(df_liq['dep_bps'].quantile(0.50))
    p75  = float(df_liq['dep_bps'].quantile(0.75))
    p90  = float(df_liq['dep_bps'].quantile(0.90))
    wtd  = float((df_liq['dep_bps'] * df_liq['patrimonio_k']).sum() / total_aum)

    # March AM effective RFECP/M rate: compute directly from CNMV data
    # (more accurate for this market comparison than the overall portfolio rate)
    march_liq = df_liq[df_liq['grupo'].str.contains('BANCA MARCH', case=False, na=False)]
    if not march_liq.empty and march_liq['patrimonio_k'].sum() > 0:
        march_am_rfecp_bps = float(
            (march_liq['dep_bps'] * march_liq['patrimonio_k']).sum()
            / march_liq['patrimonio_k'].sum()
        )
    else:
        march_am_rfecp_bps = march_am_bps  # fallback to overall rate

    # Percentile rank for March AM RFECP/M rate
    march_rank_pct = float((df_liq['dep_bps'] <= march_am_rfecp_bps).mean() * 100)

    # ── Private bank peer comparison ──────────────────────────────────────
    private_peers = []
    for grp_name in PRIVATE_BANK_PEERS:
        grp_df = df_liq[df_liq['grupo'].str.contains(grp_name, case=False, na=False)]
        if grp_df.empty or grp_df['patrimonio_k'].sum() == 0:
            continue
        aum_k  = grp_df['patrimonio_k'].sum()
        w_bps  = float((grp_df['dep_bps'] * grp_df['patrimonio_k']).sum() / aum_k)
        is_march = 'MARCH' in grp_name
        private_peers.append({
            'group': grp_name,
            'liquid_aum_m': round(aum_k / 1000, 1),
            'wtd_dep_bps': round(w_bps, 2),
            'is_march_am': is_march,
        })
    private_peers.sort(key=lambda x: -x['liquid_aum_m'])

    # ── Zero-fee ISINs across whole market ────────────────────────────────
    zero_market = df_liq[df_liq['dep_bps'] == 0][
        ['isin', 'grupo', 'fondo', 'patrimonio_k', 'dep_bps']
    ].sort_values('patrimonio_k', ascending=False)
    zero_market_list = [
        {
            'isin': str(r['isin']),
            'group': str(r['grupo']),
            'fund': str(r['fondo']),
            'aum_m': round(r['patrimonio_k'] / 1000, 1),
            'is_march_am': 'MARCH' in str(r['grupo']).upper(),
        }
        for _, r in zero_market.iterrows()
        if r['patrimonio_k'] > 0
    ]

    # ── BBVA captive reference ─────────────────────────────────────────────
    bbva_liq = df_liq[df_liq['grupo'].str.contains('BILBAO VIZCAYA|BBVA', case=False, na=False)]
    bbva_main = bbva_liq[bbva_liq['dep_bps'] >= 4]   # main products, not the 1-bps anomaly
    bbva_wtd = float((bbva_main['dep_bps'] * bbva_main['patrimonio_k']).sum()
                     / bbva_main['patrimonio_k'].sum()) if not bbva_main.empty else 5.0

    return {
        'universe': 'RFECP + M + MCP (all Spanish IICs, all depositaries)',
        'source': 'CNMV Estadísticas IIC 2025 Q3 Anexo A2.2',
        'total_isins': int(len(df_liq)),
        'total_aum_bn': round(total_aum / 1e6, 1),
        'march_am_bps': round(march_am_bps, 2),          # overall portfolio weighted rate
        'march_am_rfecp_bps': round(march_am_rfecp_bps, 2),  # RFECP/M-specific rate from CNMV
        'march_am_percentile': round(march_rank_pct, 1),
        'percentiles': {
            'p10': round(p10, 2), 'p25': round(p25, 2), 'p50': round(p50, 2),
            'p75': round(p75, 2), 'p90': round(p90, 2), 'wtd_avg': round(wtd, 2),
        },
        'fee_distribution': fee_distribution,
        'private_bank_peers': private_peers,
        'zero_fee_isins_market': zero_market_list,
        'bbva_captive_ref_bps': round(bbva_wtd, 2),
        'note': (
            'Even BBVA depositing its own funds in BBVA (captive arrangement) charges '
            f'{bbva_wtd:.1f} bps for RFECP products. Banca March at {march_am_rfecp_bps:.2f} bps '
            'is the sole outlier with meaningful AUM across all Spanish depositaries.'
        ),
    }


def build_banca_march():
    """Build Banca March depositary relationship analysis."""
    cnmv_dir = os.path.join(DATA_DIR, 'CNMV Estadisticas')
    _, cnmv_date = find_cnmv_file(cnmv_dir, 'Anexo')
    cnmv_date = cnmv_date or 'unknown'
    fp = os.path.join(cnmv_dir, INSIGHTS_FILE)

    if not os.path.exists(fp):
        print(f'  Warning: {fp} not found')
        return {}

    wb = openpyxl.load_workbook(fp, data_only=True)

    # ── Load sheets ────────────────────────────────────────────────────────
    isin_records = _read_sheet_as_records(wb['inversis_isin_detail'], [])
    gest_records = _read_sheet_as_records(wb['inversis_by_gestora'], [])
    grp_records  = _read_sheet_as_records(wb['inversis_by_group'], [])
    fund_records = _read_sheet_as_records(wb['inversis_by_fund'], [])
    rank_records = _read_sheet_as_records(wb['depositary_ranking'], [])
    wb.close()

    # ── Gestora-level slices ───────────────────────────────────────────────
    march_gest = next((r for r in gest_records if MARCH_AM_NAME in str(r.get('Sociedad Gestora', ''))), None)
    inv_gest   = next((r for r in gest_records if INVERSIS_GEST_NAME in str(r.get('Sociedad Gestora', ''))), None)
    march_grp  = next((r for r in grp_records  if BANCA_MARCH_GROUP in str(r.get('Grupo Financiero', ''))), None)

    if not march_gest:
        print('  Warning: March AM not found in gestora data')
        return {}

    # ── March AM core metrics ──────────────────────────────────────────────
    march_total_aum_k  = _safe_float(march_gest.get('aum_k'))
    march_avg_fee      = _safe_float(march_gest.get('avg_deposit_fee_pct'))   # simple avg across all classes (%)
    march_weighted_fee = _safe_float(march_gest.get('aum_w_deposit_fee_pct')) # AUM-weighted over ALL aum (%)
    march_rev_k        = _safe_float(march_gest.get('est_deposit_fee_rev_k'))
    march_classes      = int(_safe_float(march_gest.get('classes', 0)))
    march_funds        = int(_safe_float(march_gest.get('funds', 0)))

    # Zero-fee AUM: computed directly from ISIN-level data (deposit_fee == 0 and AUM > 0).
    # This is more accurate than the indirect weighted/avg ratio method.
    march_zero_fee_aum_k = sum(
        _safe_float(r.get('patrimonio_class_k_eur'))
        for r in isin_records
        if MARCH_AM_NAME in str(r.get('Sociedad Gestora', ''))
        and _safe_float(r.get('deposit_fee')) == 0.0
        and _safe_float(r.get('patrimonio_class_k_eur')) > 0
    )
    march_zero_fee_pct = (march_zero_fee_aum_k / march_total_aum_k * 100) if march_total_aum_k > 0 else 0

    # ── Inversis Gestión metrics ───────────────────────────────────────────
    inv_gestion = None
    if inv_gest:
        inv_gestion = {
            'gestora': INVERSIS_GEST_NAME,
            'aum_bn': round(_safe_float(inv_gest.get('aum_k')) / 1_000_000, 3),
            'funds': int(_safe_float(inv_gest.get('funds', 0))),
            'classes': int(_safe_float(inv_gest.get('classes', 0))),
            'weighted_fee_bps': round(_safe_float(inv_gest.get('aum_w_deposit_fee_pct')) * 100, 2),
            'avg_nonzero_fee_bps': round(_safe_float(inv_gest.get('avg_deposit_fee_pct')) * 100, 2),
            'est_annual_rev_k': round(_safe_float(inv_gest.get('est_deposit_fee_rev_k')), 1),
        }

    # ── Banca March group totals ───────────────────────────────────────────
    grp_aum_k = _safe_float(march_grp.get('aum_k')) if march_grp else 0
    grp_rev_k = _safe_float(march_grp.get('est_deposit_fee_rev_k')) if march_grp else 0
    grp_classes = int(_safe_float(march_grp.get('classes', 0))) if march_grp else 0
    grp_funds   = int(_safe_float(march_grp.get('funds', 0))) if march_grp else 0

    # ── Market context from depositary_ranking + all gestoras ─────────────
    total_book_aum_k = sum(_safe_float(r.get('aum_k')) for r in rank_records
                          if 'INVERSIS' in str(r.get('Entidad Depositaria', '')))
    # Use total from the Inversis row in depositary_ranking
    inv_rank_row = next((r for r in rank_records if 'INVERSIS' in str(r.get('Entidad Depositaria', ''))), None)
    total_book_aum_k = _safe_float(inv_rank_row.get('aum_k')) if inv_rank_row else sum(
        _safe_float(r.get('aum_k')) for r in gest_records)

    total_rev_k = sum(_safe_float(r.get('est_deposit_fee_rev_k')) for r in gest_records)
    book_weighted_avg_bps = (total_rev_k / total_book_aum_k * 100 * 100) if total_book_aum_k > 0 else 0

    # Median deposit fee across ALL gestoras (using weighted fee)
    weighted_fees = [_safe_float(r.get('aum_w_deposit_fee_pct')) * 100
                     for r in gest_records if _safe_float(r.get('aum_w_deposit_fee_pct')) > 0]
    weighted_fees.sort()
    n = len(weighted_fees)
    market_median_bps = weighted_fees[n // 2] if n > 0 else 7.0

    # Mean of non-zero avg fees
    avg_fees = [_safe_float(r.get('avg_deposit_fee_pct')) * 100
                for r in gest_records if _safe_float(r.get('avg_deposit_fee_pct')) > 0]
    market_avg_nonzero_bps = sum(avg_fees) / len(avg_fees) if avg_fees else 7.5

    # ── Peer comparison table ──────────────────────────────────────────────
    peer_comparison = []
    for r in sorted(gest_records, key=lambda x: -_safe_float(x.get('aum_k'))):
        g = str(r.get('Sociedad Gestora', ''))
        aum_k = _safe_float(r.get('aum_k'))
        w_fee = _safe_float(r.get('aum_w_deposit_fee_pct')) * 100  # bps
        avg_fee = _safe_float(r.get('avg_deposit_fee_pct')) * 100   # bps
        rev_k = _safe_float(r.get('est_deposit_fee_rev_k'))
        is_march = MARCH_AM_NAME in g
        is_inv_gest = INVERSIS_GEST_NAME in g
        peer_comparison.append({
            'gestora': g,
            'gestora_short': g.split(',')[0],
            'is_march_am': is_march,
            'is_inversis_gestion': is_inv_gest,
            'is_banca_march_group': is_march or is_inv_gest,
            'aum_m': round(aum_k / 1000, 1),
            'weighted_fee_bps': round(w_fee, 2),
            'avg_nonzero_fee_bps': round(avg_fee, 2),
            'est_annual_rev_k': round(rev_k, 1),
            'fee_gap_vs_median': round(w_fee - market_median_bps, 2),  # negative = below market
            'implicit_revenue_shortfall_k': round((market_median_bps - w_fee) / 10000 * aum_k, 1),
        })

    # ── Zero-fee fund detail ───────────────────────────────────────────────
    zero_fee_funds = []
    all_march_funds = [r for r in fund_records if BANCA_MARCH_GROUP in str(r.get('Grupo Financiero', ''))]
    for r in sorted(all_march_funds, key=lambda x: -_safe_float(x.get('aum_k'))):
        avg_fee_pct = _safe_float(r.get('avg_deposit_fee_pct'))
        rev_k = _safe_float(r.get('est_deposit_fee_rev_k'))
        aum_k = _safe_float(r.get('aum_k'))
        zero_fee_funds.append({
            'fund': str(r.get('Fondo', '')),
            'gestora': str(r.get('Sociedad Gestora', '')).split(',')[0],
            'classes': int(_safe_float(r.get('classes', 1))),
            'aum_m': round(aum_k / 1000, 1),
            'avg_fee_bps': round(avg_fee_pct * 100, 2),
            'est_annual_rev_k': round(rev_k, 1),
            'is_zero_fee': avg_fee_pct == 0.0,
            'shortfall_at_median_k': round((market_median_bps / 100 - avg_fee_pct) / 100 * aum_k, 1)
                                     if avg_fee_pct < market_median_bps / 100 else 0,
        })

    # ── Revenue scenarios ──────────────────────────────────────────────────
    # Scenarios apply to March AM (the strategic question)
    # Current: march_weighted_fee_bps on march_total_aum_k
    march_w_bps = march_weighted_fee * 100  # e.g. 3.25 bps

    def _scenario(name, description, new_weighted_bps, risk):
        rev_k = march_total_aum_k * new_weighted_bps / 100 / 100
        return {
            'name': name,
            'description': description,
            'weighted_fee_bps': round(new_weighted_bps, 2),
            'est_annual_rev_march_am_k': round(rev_k, 1),
            'delta_vs_status_quo_k': round(rev_k - march_rev_k, 1),
            'risk_level': risk,
        }

    # Andbank peer fee (closest AUM comparable to March AM)
    andbank_gest = next((r for r in gest_records if 'ANDBANK WEALTH' in str(r.get('Sociedad Gestora', ''))), None)
    andbank_bps = _safe_float(andbank_gest.get('aum_w_deposit_fee_pct')) * 100 if andbank_gest else 6.83

    scenarios = [
        _scenario(
            'Status Quo',
            'Current intragroup pricing — unchanged',
            march_w_bps,
            'none',
        ),
        _scenario(
            'Scenario A — Activate zero-fee AUM at 5 bps',
            f'Apply 5 bps only to currently zero-fee AUM (€{march_zero_fee_aum_k/1000:.0f}M); '
            f'fee-bearing AUM stays at {march_avg_fee*100:.1f} bps avg',
            (march_rev_k + march_zero_fee_aum_k * 5 / 100 / 100) / march_total_aum_k * 100 * 100,
            'very_low',
        ),
        _scenario(
            'Scenario B — Andbank parity',
            f'Align to Andbank WM weighted rate ({andbank_bps:.2f} bps) — '
            f'closest AUM peer (€{_safe_float(andbank_gest.get("aum_k"))/1e6:.1f}B) to March AM',
            andbank_bps,
            'low',
        ),
        _scenario(
            'Scenario C — Book median (7 bps)',
            f'Raise to Inversis book median of {market_median_bps:.1f} bps across all gestoras',
            market_median_bps,
            'low_medium',
        ),
        _scenario(
            'Scenario D — Full market rate (8 bps)',
            'Apply market-rate pricing applicable to unaffiliated boutique gestoras of this size',
            8.0,
            'medium',
        ),
    ]

    # Also compute group-level impact for each scenario
    for s in scenarios:
        if s['name'] == 'Status Quo':
            s['group_total_rev_k'] = round(grp_rev_k, 1)
        else:
            inv_rev_k = _safe_float(inv_gest.get('est_deposit_fee_rev_k')) if inv_gest else 0
            s['group_total_rev_k'] = round(s['est_annual_rev_march_am_k'] + inv_rev_k, 1)

    # ── Switching risk ─────────────────────────────────────────────────────
    # CNMV requires individual notification for each share class change
    switching_risk = {
        'classes_to_migrate': march_classes,
        'funds_to_migrate': march_funds,
        'group_classes_to_migrate': grp_classes,
        'group_funds_to_migrate': grp_funds,
        'estimated_migration_months': 12,
        'estimated_one_time_cost_k': 300,  # legal + operational + systems
        'breakeven_annual_saving_k': round(300 / 3, 0),  # 3-year amortisation
        'risk_rating': 'LOW',
        'risk_rationale': (
            f'Migrating {march_classes} fund classes across {march_funds} funds '
            'requires individual CNMV notification per class, shareholder communication, '
            'and systems cut-over — estimated 12-month process at €250-350k one-time cost. '
            'A competitor would need to offer savings >€100k/yr to make the switch rational. '
            'No major Spanish depositary currently targets the March AM segment with '
            'aggressive pricing; Cecabank and CACEIS focus on larger mandates. '
            'Post-Euroclear acquisition, Inversis will have enhanced standing as an '
            'independent tier-1 depositary, further reducing defection risk.'
        ),
    }

    # ── Qualitative insights ───────────────────────────────────────────────
    march_rank_in_book = next(
        (i + 1 for i, r in enumerate(peer_comparison) if r['is_march_am']), 0)

    scen_a = next((s for s in scenarios if 'Scenario A' in s['name']), None)
    scen_b = next((s for s in scenarios if 'Scenario B' in s['name']), None)
    scen_a_delta_k = scen_a['delta_vs_status_quo_k'] if scen_a else 0
    scen_b_delta_k = scen_b['delta_vs_status_quo_k'] if scen_b else 0

    qualitative_insights = [
        {
            'type': 'pricing_gap',
            'severity': 'high',
            'title': 'March AM pays the lowest effective depositary fee of all Inversis clients',
            'body': (
                f'March AM\'s AUM-weighted depositary fee is {march_w_bps:.2f} bps — '
                f'{market_median_bps - march_w_bps:.1f} bps below the Inversis book median of {market_median_bps:.1f} bps. '
                f'It is ranked #{march_rank_in_book} out of {len(peer_comparison)} gestoras by AUM '
                f'but last by weighted fee rate. '
                f'Andbank WM, the closest peer by AUM (€{_safe_float(andbank_gest.get("aum_k"))/1e6:.1f}B), '
                f'pays {andbank_bps:.2f} bps — {andbank_bps - march_w_bps:.1f} bps more than March AM.'
            ),
        },
        {
            'type': 'zero_fee_drag',
            'severity': 'high',
            'title': f'{march_zero_fee_pct:.0f}% of March AM AUM carries zero depositary fee',
            'body': (
                f'An estimated €{march_zero_fee_aum_k/1000:.0f}M of March AM\'s €{march_total_aum_k/1e6:.1f}B AUM '
                f'under Inversis custody is charged 0 bps — almost certainly reflecting an '
                f'intragroup arrangement (primarily MARCH PAGARÉS and short-term RF funds). '
                f'This single item foregoes c.€{march_zero_fee_aum_k * market_median_bps / 100 / 100:.0f}K/yr '
                f'at market rates ({market_median_bps:.0f} bps). Post-Euroclear completion, '
                f'this pricing will have no intragroup justification.'
            ),
        },
        {
            'type': 'revenue_opportunity',
            'severity': 'medium',
            'title': f'Phased fee normalisation could add €{scen_a_delta_k:.0f}K–€{scen_b_delta_k:.0f}K/yr in additional depositary revenue',
            'body': (
                f'Raising March AM to Andbank parity ({andbank_bps:.2f} bps) would generate '
                f'€{march_total_aum_k * andbank_bps / 100 / 100:.0f}K vs current €{march_rev_k:.0f}K — '
                f'an uplift of €{march_total_aum_k * andbank_bps / 100 / 100 - march_rev_k:.0f}K (+{(march_total_aum_k * andbank_bps / 100 / 100 / march_rev_k - 1)*100:.0f}%). '
                f'A phased approach (Scenario A first, then B) over 18–24 months minimises '
                f'commercial disruption and is below the threshold that would trigger a '
                f'cost/benefit review by March AM.'
            ),
        },
        {
            'type': 'timing',
            'severity': 'medium',
            'title': 'August 2026 Euroclear acquisition is the natural repricing trigger',
            'body': (
                'The ownership change from Banca March to Euroclear removes the intragroup '
                'basis for preferential pricing. At that point, the March AM relationship '
                'becomes a standard third-party commercial arrangement. Inversis should '
                'initiate fee renegotiation in Q1 2026 — before the close — framing it as '
                'transition to arm\'s-length terms. Early communication protects the '
                'relationship better than a post-close surprise.'
            ),
        },
        {
            'type': 'switching_risk',
            'severity': 'low',
            'title': 'Switching risk is low: operational friction protects Inversis\'s book',
            'body': (
                f'Moving {march_classes} share classes across {march_funds} funds requires '
                'CNMV notification per class, fund prospectus updates, shareholder communications, '
                'and systems migration — typically a 12-month process costing €250-350K. '
                f'A competitor would need to undercut by >{switching_risk["breakeven_annual_saving_k"]:.0f}K/yr '
                'to make the switch rational for March AM. No major Spanish depositary '
                'currently offers a credible alternative at materially lower cost for '
                'a mandate of this complexity and mix.'
            ),
        },
    ]

    # ── Market-wide benchmarking (full CNMV A2.2) ─────────────────────────
    # Compares March AM deposit fees against ALL Spanish depositaries (not just Inversis clients)
    market_benchmarks = _build_market_benchmarks(cnmv_dir, march_w_bps)

    # ── Summary ────────────────────────────────────────────────────────────
    return {
        'date': cnmv_date,
        'note': 'Inversis exits Banca March group upon Euroclear acquisition (expected Aug 2026). '
                'All intragroup pricing then becomes arm\'s-length commercial pricing.',
        'march_am': {
            'gestora': MARCH_AM_NAME,
            'gestora_short': 'March Asset Management',
            'aum_bn': round(march_total_aum_k / 1_000_000, 3),
            'funds': march_funds,
            'classes': march_classes,
            'weighted_fee_bps': round(march_w_bps, 2),
            'avg_nonzero_fee_bps': round(march_avg_fee * 100, 2),
            'zero_fee_aum_m': round(march_zero_fee_aum_k / 1000, 0),
            'zero_fee_aum_pct': round(march_zero_fee_pct, 1),
            'est_annual_rev_k': round(march_rev_k, 1),
            'effective_rate_bps': round(march_w_bps, 2),
        },
        'inversis_gestion': inv_gestion,
        'banca_march_group': {
            'total_aum_bn': round(grp_aum_k / 1_000_000, 3),
            'total_funds': grp_funds,
            'total_classes': grp_classes,
            'total_est_rev_k': round(grp_rev_k, 1),
            'effective_rate_bps': round(grp_rev_k / grp_aum_k * 100 * 100, 2) if grp_aum_k > 0 else 0,
        },
        'market_context': {
            'inversis_total_aum_bn': round(total_book_aum_k / 1_000_000, 3),
            'inversis_total_rev_k': round(total_rev_k, 1),
            'inversis_book_weighted_avg_bps': round(book_weighted_avg_bps, 2),
            'inversis_book_median_bps': round(market_median_bps, 2),
            'inversis_book_avg_nonzero_bps': round(market_avg_nonzero_bps, 2),
            'total_gestoras_in_book': len(gest_records),
            'march_am_rank_by_aum': march_rank_in_book,
            'andbank_weighted_bps': round(andbank_bps, 2),
        },
        'peer_comparison': peer_comparison,
        'march_fund_detail': zero_fee_funds,
        'fee_scenarios': scenarios,
        'switching_risk': switching_risk,
        'qualitative_insights': qualitative_insights,
        'market_benchmarks': market_benchmarks,
    }
