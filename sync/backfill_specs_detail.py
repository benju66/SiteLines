"""One-time Specifications Phase-2 backfill (⛔ owner-approved run).

Stamps each spec section's CURRENT revision detail — issued/received date, revision
label, and the current PDF `url` — onto `procore_specification_sections_master.raw`,
WITHOUT running the full nightly pipeline. The same enrichment is now wired into
`run_pipeline()` for OP III, so nightly runs keep it fresh; this script just does the
initial fill immediately.

Cost: ~22 read-only Procore GETs (1 division list + ~21 per-division revision pulls),
then one UPSERT of the 189 sections into their existing master (additive — the scoped
purge only removes sections Procore no longer returns, which is none here).

Run (from sync/, with the venv that has pandas + sqlalchemy):
    ./.venv/Scripts/python.exe backfill_specs_detail.py
"""

import datetime
import logging
import sys

from procore_pipeline import (
    BASE_API_URL,
    MasterTable,
    build_engine,
    enrich_specs_with_detail,
    get_access_token,
    paginated_get,
)

PROJECT_ID = 3051002  # OP III (the only synced project)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


def main() -> None:
    token = get_access_token()
    if not token:
        logging.error('Could not acquire a Procore token — aborting.')
        sys.exit(1)

    specs = paginated_get(token, f'{BASE_API_URL}/rest/v1.0/specification_sections?project_id={PROJECT_ID}')
    if specs is None:
        logging.error('Spec list fetch failed — aborting (no write).')
        sys.exit(1)
    logging.info('Fetched %s sections; enriching with current-revision detail…', len(specs))

    if not enrich_specs_with_detail(token, specs, PROJECT_ID):
        logging.error('Detail enrichment failed (a division fetch returned None) — aborting (no write).')
        sys.exit(1)

    enriched = sum(1 for s in specs if isinstance(s, dict) and s.get('current_revision_url'))
    logging.info('Enriched %s / %s sections with a PDF url. Writing master…', enriched, len(specs))

    run_ts = datetime.datetime.now(datetime.timezone.utc)
    tbl = MasterTable('procore_specification_sections_master', ['id', 'project_id'], 'project')
    tbl.add(specs, PROJECT_ID, run_ts)
    tbl.flush(build_engine())
    logging.info('Backfill complete.')


if __name__ == '__main__':
    main()
