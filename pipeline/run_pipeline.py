#!/usr/bin/env python3
"""Orchestrator — runs all parsers and transformers, outputs JSON files."""
import json
import os
import sys
import time

# Add parent dir to path so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.config import OUTPUT_DIR, get_snapshot_folders
from pipeline.transformers.market_overview import build_market_overview
from pipeline.transformers.category_evolution import build_category_evolution
from pipeline.transformers.gestora_rankings import build_gestora_rankings
from pipeline.transformers.group_rankings import build_group_rankings
from pipeline.transformers.fund_flows import build_fund_flows
from pipeline.transformers.performance import build_performance
from pipeline.transformers.fund_details import build_fund_details
from pipeline.transformers.insights import build_insights
from pipeline.transformers.monthly_report import build_monthly_report
from pipeline.transformers.cnmv_fees import build_cnmv_fees
from pipeline.transformers.cnmv_foreign import build_cnmv_foreign
from pipeline.transformers.cnmv_depositaria import build_cnmv_depositaria
from pipeline.transformers.banca_march import build_banca_march
from pipeline.transformers.abanca import build_abanca
from pipeline.transformers.inversis import build_inversis


def write_json(data, filename):
    """Write data to JSON file in output directory."""
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    size = os.path.getsize(filepath)
    print(f"  -> {filename} ({size:,} bytes)")


def main():
    print("=" * 60)
    print("Spain Funds Market Intelligence Pipeline")
    print("=" * 60)

    # Verify snapshots
    snapshots = get_snapshot_folders()
    print(f"\nFound {len(snapshots)} monthly snapshots:")
    for label, path in snapshots:
        print(f"  {label}: {os.path.basename(path)}")

    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Run transformers
    transforms = [
        ("Market Overview", build_market_overview, "market_overview.json"),
        ("Category Evolution", build_category_evolution, "category_evolution.json"),
        ("Gestora Rankings", build_gestora_rankings, "gestora_rankings.json"),
        ("Group Rankings", build_group_rankings, "group_rankings.json"),
        ("Fund Flows", build_fund_flows, "fund_flows.json"),
        ("Performance", build_performance, "performance.json"),
        ("Fund Details", build_fund_details, "fund_details.json"),
        ("Insights", build_insights, "insights.json"),
        ("Monthly Report", build_monthly_report, "monthly_report.json"),
        ("CNMV Fee Analysis", build_cnmv_fees, "cnmv_fees.json"),
        ("CNMV Foreign IICs", build_cnmv_foreign, "cnmv_foreign.json"),
        ("CNMV Depositaría", build_cnmv_depositaria, "cnmv_depositaria.json"),
        ("Banca March Analysis", build_banca_march, "banca_march.json"),
        ("Abanca Opportunity",   build_abanca,      "abanca.json"),
        ("Inversis Analysis",    build_inversis,    "inversis.json"),
    ]

    fail_fast = '--fail-fast' in sys.argv or os.environ.get('CI') == '1'
    if fail_fast:
        print("  [fail-fast mode: stale outputs removed on error, pipeline aborts]\n")

    total_start = time.time()
    failed = []
    for name, builder, filename in transforms:
        print(f"\n[{name}]")
        start = time.time()
        try:
            data = builder()
            write_json(data, filename)
            elapsed = time.time() - start
            print(f"  Done in {elapsed:.1f}s")
        except Exception as e:
            import traceback
            print(f"  ERROR: {e}")
            traceback.print_exc()
            # Remove stale output so frontend never reads partial/old data
            stale = os.path.join(OUTPUT_DIR, filename)
            if os.path.exists(stale):
                os.remove(stale)
                print(f"  Removed stale {filename}")
            failed.append(name)
            if fail_fast:
                sys.exit(1)

    total_elapsed = time.time() - total_start
    print(f"\n{'=' * 60}")
    if failed:
        print(f"Pipeline finished with {len(failed)} error(s): {', '.join(failed)}")
    else:
        print(f"Pipeline complete in {total_elapsed:.1f}s")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
