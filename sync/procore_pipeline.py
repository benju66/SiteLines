"""Sitelines sync — Procore → Supabase operational cache.

PURPOSE / COMPLIANCE FRAMING (see Notes/research/Procore-API-Integration-Research.md §4):
    This pipeline maintains a *scoped, synchronized operational cache* that powers
    Sitelines' live, day-to-day project operations — the "complementary" use Procore's
    API Terms permit. It is NOT a wholesale mirror, a data warehouse, or an analytics
    export. STANDING BOUNDARY: data synced here must never feed model training,
    benchmarking, or long-term historical archives detached from app operation.

WHAT CHANGED FROM THE ORIGINAL (the compliance refactor, 2026-07-02):
    1. paginated_get / get_json distinguish FAILURE (None) from GENUINELY-EMPTY ([]).
       This is load-bearing: a failed fetch must never be read as "everything was
       deleted upstream" and trigger a purge. (research §5.3 — fixed FIRST.)
    2. ACTIVE_PROJECT_IDS allowlist gates the deep per-project loop (defense-in-depth
       on top of the DMSA's permitted-projects list). Company-wide discovery stays
       global. (research §5.1)
    3. Writes moved from pandas `if_exists='replace'` (which invented schemas nightly
       and clobbered the whole table) to real, keyed DDL + staging + UPSERT + a
       SCOPED PURGE that only ever touches projects successfully synced this run.
       (research §5.2 / §5.4) DDL lives in sync/migrations/.
    4. Request jitter between paginated pages, so pagination loops don't trip the
       10-second spike rate-limit window. (research §7)
    5. Fail-loud: the process exits non-zero on failure so a scheduler notices.
    6. Secrets come only from .env (never hardcoded, never committed).

DATA MODEL (raw-JSONB-first — see sync/migrations/0001_init_procore_master.sql):
    Each `procore_*_master` table stores its declared key column(s) + a `raw jsonb`
    holding the full cleaned record + a `synced_at` timestamp. The Procore→contract
    *mapping* is done downstream in Supabase views (Data Seam Phase 2), not here.
    This keeps ingestion drift-proof: a new Procore field just lands inside `raw`.
"""

import json
import logging
import math
import os
import random
import re
import sys
import time
import urllib.parse
from datetime import datetime, timezone

import pandas as pd
import requests
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# --- 1. SETUP -------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
load_dotenv()

CLIENT_ID = os.getenv('PROCORE_CLIENT_ID')
CLIENT_SECRET = os.getenv('PROCORE_CLIENT_SECRET')
COMPANY_ID = os.getenv('PROCORE_COMPANY_ID')

BASE_API_URL = 'https://api.procore.com'
AUTH_URL = 'https://login.procore.com/oauth/token'

# (connect, read) timeouts in seconds. Without these a stalled socket hangs the
# whole nightly run forever (and it never fails loud). A timeout instead surfaces
# as a retryable failure → eventually a failed fetch (None) → that fetch is skipped.
REQUEST_TIMEOUT = (10, 60)


def _parse_active_project_ids() -> set:
    """Allowlist of project ids the deep loop may fetch (defense-in-depth).

    Procore ids are ints; env values are strings — coerce so membership tests work
    (research §5.1 'type trap'). Empty/unset is treated as "not configured" and
    aborts the run rather than silently syncing every discoverable project.
    """
    raw = os.getenv('ACTIVE_PROJECT_IDS', '')
    ids = set()
    for chunk in raw.replace(';', ',').split(','):
        chunk = chunk.strip()
        if not chunk:
            continue
        try:
            ids.add(int(chunk))
        except ValueError:
            logging.warning('Ignoring non-integer ACTIVE_PROJECT_IDS entry: %r', chunk)
    return ids


ACTIVE_PROJECT_IDS = _parse_active_project_ids()


# --- 2. CORE EXTRACTION ---------------------------------------------------------

def get_access_token() -> str:
    payload = {'grant_type': 'client_credentials', 'client_id': CLIENT_ID, 'client_secret': CLIENT_SECRET}
    response = requests.post(AUTH_URL, data=payload, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json().get('access_token')


def _normalize_page_body(data):
    """Normalize list responses: raw array, {data: [...]}, or tool-specific keys."""
    if data is None:
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if isinstance(data.get('data'), list):
            return data['data']
        for key in ('commitments', 'prime_contracts', 'requisitions', 'results', 'items', 'records'):
            if isinstance(data.get(key), list):
                return data[key]
    return []


def clean_procore_text(raw_text):
    if not raw_text:
        return ''
    text_val = str(raw_text)
    text_val = re.sub(r'<[^>]+>', ' ', text_val)   # strip HTML tags
    text_val = text_val.replace('null', '')         # literal 'null' strings
    text_val = text_val.replace('_x000D_', ' ')     # Procore carriage-return artifact
    text_val = re.sub(r'\s+', ' ', text_val).strip()
    return text_val


# Procore enum tokens → display labels.
procore_label_map = {
    'in_scope': 'In Scope', 'out_of_scope': 'Out of Scope', 'tbd': 'TBD',
    'approved': 'Approved', 'draft': 'Draft', 'proceeding': 'Proceeding',
    'under_review': 'Under Review', 'closed': 'Closed', 'void': 'Void',
    'subcontractor_invoice': 'Subcontractor Invoice', 'payroll': 'Payroll', 'expense': 'Expense',
}


def clean_record_labels(rec: dict) -> dict:
    """In-place cleaning applied to each record before it is serialized into `raw`.

    Mirrors the original apply_procore_label_map: map known enum tokens on the
    label columns, and HTML-strip the heavy text columns. Only touches scalar
    string fields, so nested objects are left untouched.
    """
    for col in ('event_scope', 'status', 'direct_cost_type'):
        v = rec.get(col)
        if isinstance(v, str) and v in procore_label_map:
            rec[col] = procore_label_map[v]
    for col in ('description', 'inclusions', 'exclusions'):
        if isinstance(rec.get(col), str):
            rec[col] = clean_procore_text(rec[col])
    return rec


def handle_rate_limit(response) -> bool:
    """On 429, sleep until X-Rate-Limit-Reset and signal a retry."""
    if response.status_code == 429:
        reset_time_str = response.headers.get('X-Rate-Limit-Reset')
        if reset_time_str:
            sleep_duration = max(0, math.ceil(int(reset_time_str) - time.time())) + 1
            logging.warning('Rate limit hit. Sleeping for %s seconds...', sleep_duration)
            time.sleep(sleep_duration)
            return True
    return False


def get_json(token: str, url: str, max_retries: int = 3):
    """Single GET → parsed JSON on success, or None on failure.

    None means "the request failed"; callers must NOT treat that as empty data.
    """
    headers = {'Authorization': f'Bearer {token}', 'Procore-Company-Id': str(COMPANY_ID)}
    retries = 0
    while retries < max_retries:
        try:
            response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
        except requests.RequestException as exc:
            logging.warning('GET %s failed (%s); retry %s/%s', url, exc, retries + 1, max_retries)
            retries += 1
            continue
        if handle_rate_limit(response):
            retries += 1
            continue
        if response.status_code != 200:
            logging.warning('GET %s -> %s', url, response.status_code)
            return None
        return response.json()
    logging.error('Max retries exceeded for GET %s', url)
    return None


def paginated_get(token: str, endpoint: str, max_retries: int = 3):
    """Fetch all pages of a list endpoint.

    Returns:
        list  — the full result set on success (possibly an empty list if the
                endpoint genuinely has no records).
        None  — if ANY page failed (non-200 after retries, or retries exhausted).

    ☠️ CRITICAL (research §5.3): the original returned [] for BOTH "empty" and
    "failed", which under upsert+purge would purge a project's data whenever a
    request errored. Returning None on failure keeps the two cases distinguishable
    so the caller can skip the purge for that fetch.
    """
    headers = {'Authorization': f'Bearer {token}', 'Procore-Company-Id': str(COMPANY_ID)}
    all_data = []

    separator = '&' if '?' in endpoint else '?'
    current_url = f'{endpoint}{separator}page=1&per_page=100'
    first_page = True

    while current_url:
        # Jitter between pages (never before the first) so pagination loops don't
        # trip the 10-second spike rate-limit window. research §7.
        if not first_page:
            time.sleep(random.uniform(0.5, 1.5))
        first_page = False

        retries = 0
        response = None
        success = False
        while retries < max_retries:
            try:
                response = requests.get(current_url, headers=headers, timeout=REQUEST_TIMEOUT)
            except requests.RequestException as exc:
                logging.warning('GET %s failed (%s); retry %s/%s', current_url, exc, retries + 1, max_retries)
                retries += 1
                continue
            if handle_rate_limit(response):
                retries += 1
                continue
            if response.status_code != 200:
                logging.warning('GET %s -> %s', current_url, response.status_code)
                return None  # failure — distinguishable from an empty result set
            success = True
            break

        if not success:
            logging.error('Max retries exceeded for GET %s', current_url)
            return None

        chunk = _normalize_page_body(response.json())
        if chunk:
            all_data.extend(chunk)

        # Follow the Link header's rel="next", if any.
        next_url = None
        link_header = response.headers.get('Link', '')
        if link_header:
            for link in link_header.split(','):
                if 'rel="next"' in link:
                    next_url = link[link.find('<') + 1: link.find('>')]
                    break
        current_url = next_url

    return all_data


# --- 3. NESTED-CHILD FLATTENING (unchanged value-add from the original) ---------

def accumulate_change_event_line_items(events, out_rows: list, project_id) -> None:
    """Flatten nested change_event_line_items into out_rows (tagged with project_id);
    mutate each event to remove that key so it doesn't bloat the parent's `raw`."""
    if not events:
        return
    for event in events:
        line_items = event.get('change_event_line_items', [])
        if isinstance(line_items, str):
            try:
                line_items = json.loads(line_items)
            except json.JSONDecodeError:
                line_items = []
        if not isinstance(line_items, list):
            line_items = []

        for item in line_items:
            if not isinstance(item, dict):
                continue
            cost_code = item.get('cost_code') or {}
            contract = item.get('contract') or {}
            if not isinstance(cost_code, dict):
                cost_code = {}
            if not isinstance(contract, dict):
                contract = {}
            out_rows.append({
                'line_item_id': item.get('id'),
                'project_id': project_id,
                'change_event_id': event.get('id'),
                'estimated_cost_amount': float(item.get('estimated_cost_amount') or 0.0),
                'description': clean_procore_text(item.get('description')),
                'cost_code_id': cost_code.get('id'),
                'cost_code_name': cost_code.get('name'),
                'cost_code_number': cost_code.get('full_code'),
                'contract_id': contract.get('id'),
                'contract_number': contract.get('number'),
            })

        if 'change_event_line_items' in event:
            del event['change_event_line_items']


def accumulate_submittal_approvers(submittals, out_rows: list, project_id) -> None:
    """Flatten nested approvers into out_rows (tagged with project_id); mutate each
    submittal to remove that key."""
    if not submittals:
        return
    for submittal in submittals:
        approvers = submittal.get('approvers', [])
        if isinstance(approvers, str):
            try:
                approvers = json.loads(approvers)
            except json.JSONDecodeError:
                approvers = []
        if not isinstance(approvers, list):
            approvers = []

        for app in approvers:
            if not isinstance(app, dict):
                continue
            user_info = app.get('user') or {}
            response_info = app.get('response') or {}
            if not isinstance(user_info, dict):
                user_info = {}
            if not isinstance(response_info, dict):
                response_info = {}
            out_rows.append({
                'approver_record_id': app.get('id'),
                'project_id': project_id,
                'submittal_id': submittal.get('id'),
                'approver_name': user_info.get('name'),
                'response': response_info.get('name'),
                'comment': clean_procore_text(app.get('comment')),
                'sent_date': app.get('sent_date'),
                'returned_date': app.get('returned_date'),
                'due_date': app.get('due_date'),
                'workflow_group': app.get('workflow_group_number'),
            })

        if 'approvers' in submittal:
            del submittal['approvers']


def flatten_ball_in_court_for_records(records) -> None:
    """Replace ball_in_court list/JSON with a comma-separated name string (Submittals)."""
    if not records:
        return
    for record in records:
        if not isinstance(record, dict):
            continue
        bic = record.get('ball_in_court', [])
        if isinstance(bic, str):
            try:
                bic = json.loads(bic)
            except json.JSONDecodeError:
                bic = []
        if isinstance(bic, list) and bic:
            names = [p.get('name') for p in bic if isinstance(p, dict) and p.get('name')]
            record['ball_in_court'] = ', '.join(names) if names else None
        else:
            record['ball_in_court'] = None


def clean_rfi_assignees_and_ball_in_court(rfis) -> None:
    """Flatten assignees, ball_in_courts, and questions on raw RFI payloads."""
    if not rfis:
        return
    for rfi in rfis:
        if not isinstance(rfi, dict):
            continue

        assignees = rfi.get('assignees', [])
        if isinstance(assignees, str):
            try:
                assignees = json.loads(assignees)
            except json.JSONDecodeError:
                assignees = []
        if isinstance(assignees, list) and assignees:
            names = [p.get('name') for p in assignees if isinstance(p, dict) and p.get('name')]
            rfi['assignees'] = ', '.join(names) if names else None
        else:
            rfi['assignees'] = None

        # RFIs use the plural 'ball_in_courts'.
        bic = rfi.get('ball_in_courts', [])
        if isinstance(bic, str):
            try:
                bic = json.loads(bic)
            except json.JSONDecodeError:
                bic = []
        if isinstance(bic, list) and bic:
            names = [p.get('name') for p in bic if isinstance(p, dict) and p.get('name')]
            rfi['ball_in_courts'] = ', '.join(names) if names else None
        else:
            rfi['ball_in_courts'] = None

        questions = rfi.get('questions', [])
        if isinstance(questions, str):
            try:
                questions = json.loads(questions)
            except json.JSONDecodeError:
                questions = []
        if isinstance(questions, list) and questions:
            bodies = [q.get('body') for q in questions if isinstance(q, dict) and q.get('body')]
            cleaned = [clean_procore_text(b) for b in bodies]
            rfi['questions'] = '\n\n'.join(cleaned) if cleaned else None
        else:
            rfi['questions'] = None


# --- 4. KEYED STAGING + UPSERT + SCOPED PURGE -----------------------------------

class MasterTable:
    """Accumulates cleaned records for one `procore_*_master` table and writes them
    with UPSERT + a purge scoped to only the projects successfully synced this run.

    scope='project'  → keyed by (…, project_id); purge is per-synced-project.
    scope='company'  → keyed by (id); purge is a full diff, but only if the single
                       company-wide fetch succeeded.
    """

    def __init__(self, name: str, key_cols: list, scope: str):
        self.name = name
        self.key_cols = key_cols
        self.scope = scope
        self.rows: list = []
        self.synced_project_ids: set = set()  # projects whose fetch SUCCEEDED
        self.company_ok = False               # company-scope: did the fetch succeed?

    def add(self, records, project_id=None, run_ts=None) -> None:
        """Record a SUCCESSFUL fetch (records may be an empty list). Never call this
        for a failed fetch — that's what keeps a project out of the purge scope."""
        if self.scope == 'project':
            self.synced_project_ids.add(int(project_id))
        else:
            self.company_ok = True

        for rec in records or []:
            if not isinstance(rec, dict):
                continue
            clean_record_labels(rec)
            row = {}
            for k in self.key_cols:
                if k == 'project_id' and project_id is not None:
                    row[k] = int(project_id)
                else:
                    row[k] = rec.get(k)
            if any(row.get(k) is None for k in self.key_cols):
                logging.warning('Skipping %s row missing key %s', self.name, self.key_cols)
                continue
            row['raw'] = json.dumps(rec, default=str)
            row['synced_at'] = run_ts
            self.rows.append(row)

    def flush(self, engine) -> None:
        """One transaction: rebuild staging → UPSERT → scoped purge → drop staging."""
        if self.scope == 'project':
            pids = sorted(self.synced_project_ids)
            if not pids:
                logging.warning('%s: no project synced this run — skipping (no upsert, no purge).', self.name)
                return
        elif not self.company_ok:
            logging.warning('%s: company fetch failed — skipping (no upsert, no purge).', self.name)
            return

        cols = self.key_cols + ['raw', 'synced_at']
        stg = f'_stg_{self.name}'
        key_match = ' AND '.join(f't.{k} = s.{k}' for k in self.key_cols)

        with engine.begin() as conn:
            if self.rows:
                df = pd.DataFrame(self.rows).drop_duplicates(subset=self.key_cols, keep='last')
                df.to_sql(stg, conn, if_exists='replace', index=False)

                collist = ', '.join(cols)
                select_cast = ', '.join(f'{c}::jsonb' if c == 'raw' else c for c in cols)
                conflict = ', '.join(self.key_cols)
                conn.execute(text(
                    f'INSERT INTO {self.name} ({collist}) '
                    f'SELECT {select_cast} FROM {stg} '
                    f'ON CONFLICT ({conflict}) DO UPDATE '
                    f'SET raw = EXCLUDED.raw, synced_at = EXCLUDED.synced_at'
                ))

                if self.scope == 'project':
                    conn.execute(text(
                        f'DELETE FROM {self.name} t WHERE t.project_id = ANY(:pids) '
                        f'AND NOT EXISTS (SELECT 1 FROM {stg} s WHERE {key_match})'
                    ), {'pids': pids})
                else:
                    conn.execute(text(
                        f'DELETE FROM {self.name} t '
                        f'WHERE NOT EXISTS (SELECT 1 FROM {stg} s WHERE {key_match})'
                    ))

                conn.execute(text(f'DROP TABLE IF EXISTS {stg}'))
            else:
                # Fetch(es) succeeded but returned zero rows → the scope is genuinely
                # empty upstream; purge everything in that (synced) scope.
                if self.scope == 'project':
                    conn.execute(text(f'DELETE FROM {self.name} WHERE project_id = ANY(:pids)'), {'pids': pids})
                else:
                    conn.execute(text(f'DELETE FROM {self.name}'))

        logging.info('Synced %s (%s rows upserted).', self.name, len(self.rows))


def build_engine():
    """Build the Supabase Postgres engine strictly from env (no hardcoded creds)."""
    user = os.getenv('SUPABASE_DB_USER')
    password = os.getenv('SUPABASE_DB_PASSWORD')
    host = os.getenv('SUPABASE_DB_HOST')
    port = os.getenv('SUPABASE_DB_PORT', '5432')
    name = os.getenv('SUPABASE_DB_NAME', 'postgres')
    if not (user and password and host):
        raise RuntimeError(
            'Supabase DB env vars missing. Set SUPABASE_DB_USER / SUPABASE_DB_PASSWORD / '
            'SUPABASE_DB_HOST in sync/.env (see sync/.env.example).'
        )
    safe_password = urllib.parse.quote_plus(password)
    uri = f'postgresql://{user}:{safe_password}@{host}:{port}/{name}'
    return create_engine(uri, connect_args={'sslmode': 'require'})


# --- 5. THE MASTER LOOP ---------------------------------------------------------

def run_pipeline() -> None:
    run_ts = datetime.now(timezone.utc)
    token = get_access_token()
    logging.info('Connected to Procore. Fetching master directories...')

    # -- Company-wide discovery (stays global — not gated by the allowlist) --
    projects = paginated_get(token, f'{BASE_API_URL}/rest/v1.0/projects?company_id={COMPANY_ID}')
    if projects is None:
        raise RuntimeError('Project discovery failed — aborting run (no data written, no purge performed).')

    for p in projects:
        logging.info('Discovered project: %s (id: %s)', p.get('name'), p.get('id'))

    if not ACTIVE_PROJECT_IDS:
        raise RuntimeError(
            'ACTIVE_PROJECT_IDS is empty. Copy the project id(s) logged above into '
            'ACTIVE_PROJECT_IDS in sync/.env, then re-run. (Deep per-project fetching is '
            'gated on this allowlist by design — see the compliance spec.)'
        )

    # -- Table registry (name, key columns, scope) --
    projects_tbl = MasterTable('procore_projects_master', ['id'], 'company')
    co_statuses_tbl = MasterTable('procore_change_order_statuses_master', ['id'], 'company')
    # Directory is scoped PER PROJECT (not the whole company) — minimum-necessary retrieval.
    vendors_tbl = MasterTable('procore_vendors_master', ['id', 'project_id'], 'project')
    users_tbl = MasterTable('procore_users_master', ['id', 'project_id'], 'project')

    budgets_tbl = MasterTable('procore_budgets_master', ['id', 'project_id'], 'project')
    budget_mods_tbl = MasterTable('procore_budget_modifications_master', ['id', 'project_id'], 'project')
    budget_meta_tbl = MasterTable('procore_budget_meta_master', ['project_id'], 'project')
    change_events_tbl = MasterTable('procore_change_events_master', ['id', 'project_id'], 'project')
    ce_line_items_tbl = MasterTable('procore_change_event_line_items_master', ['line_item_id', 'project_id'], 'project')
    co_packages_tbl = MasterTable('procore_change_order_packages_master', ['id', 'project_id'], 'project')
    cors_tbl = MasterTable('procore_change_order_requests_master', ['id', 'project_id'], 'project')
    commitments_tbl = MasterTable('procore_commitments_master', ['id', 'project_id'], 'project')
    ccos_tbl = MasterTable('procore_commitment_change_orders_master', ['id', 'project_id'], 'project')
    prime_contracts_tbl = MasterTable('procore_prime_contracts_master', ['id', 'project_id'], 'project')
    pay_apps_tbl = MasterTable('procore_payment_applications_master', ['id', 'project_id'], 'project')
    pccos_tbl = MasterTable('procore_prime_change_orders_master', ['id', 'project_id'], 'project')
    pcos_tbl = MasterTable('procore_potential_change_orders_master', ['id', 'project_id'], 'project')
    requisitions_tbl = MasterTable('procore_requisitions_master', ['id', 'project_id'], 'project')
    direct_costs_tbl = MasterTable('procore_direct_costs_master', ['id', 'project_id'], 'project')
    rfis_tbl = MasterTable('procore_rfis_master', ['id', 'project_id'], 'project')
    submittals_tbl = MasterTable('procore_submittals_master', ['id', 'project_id'], 'project')
    submittal_approvers_tbl = MasterTable('procore_submittal_approvers', ['approver_record_id', 'project_id'], 'project')

    company_tables = [projects_tbl, co_statuses_tbl]
    project_tables = [
        vendors_tbl, users_tbl,
        budgets_tbl, budget_mods_tbl, budget_meta_tbl, change_events_tbl, ce_line_items_tbl,
        co_packages_tbl, cors_tbl, commitments_tbl, ccos_tbl, prime_contracts_tbl, pay_apps_tbl,
        pccos_tbl, pcos_tbl, requisitions_tbl, direct_costs_tbl, rfis_tbl, submittals_tbl,
        submittal_approvers_tbl,
    ]

    # projects discovery already succeeded — record it.
    projects_tbl.add(projects, run_ts=run_ts)

    # CO status vocabulary is company-level config (tiny). The vendor/user DIRECTORY is
    # NOT pulled company-wide — it is fetched per allowlisted project inside the loop below.
    co_statuses = paginated_get(token, f'{BASE_API_URL}/rest/v1.0/change_order/statuses?company_id={COMPANY_ID}')
    if co_statuses is not None:
        co_statuses_tbl.add(co_statuses, run_ts=run_ts)

    logging.info(
        'Discovered %s projects; %s allowlisted for deep extraction.',
        len(projects), sum(1 for p in projects if int(p.get('id')) in ACTIVE_PROJECT_IDS),
    )

    # -- Deep per-project extraction (GATED by the allowlist) --
    for proj in projects:
        p_id = proj.get('id')
        p_name = proj.get('name')
        if p_id is None or int(p_id) not in ACTIVE_PROJECT_IDS:
            logging.info('Skipping deep fetch for %s (id %s) — not in ACTIVE_PROJECT_IDS.', p_name, p_id)
            continue
        p_id = int(p_id)
        logging.info('Processing: %s (id: %s)', p_name, p_id)

        # Project directory — scoped to THIS project (not the whole company directory).
        pvendors = paginated_get(token, f'{BASE_API_URL}/rest/v1.0/projects/{p_id}/vendors')
        if pvendors is not None:
            vendors_tbl.add(pvendors, p_id, run_ts)

        pusers = paginated_get(token, f'{BASE_API_URL}/rest/v1.0/projects/{p_id}/users')
        if pusers is not None:
            users_tbl.add(pusers, p_id, run_ts)

        # Budget
        bli = paginated_get(token, f'{BASE_API_URL}/rest/v1.1/budget_line_items?project_id={p_id}')
        if bli is not None:
            budgets_tbl.add(bli, p_id, run_ts)

        bmods = paginated_get(token, f'{BASE_API_URL}/rest/v1.0/projects/{p_id}/budget_modifications')
        if bmods is not None:
            budget_mods_tbl.add(bmods, p_id, run_ts)

        bmeta = get_json(token, f'{BASE_API_URL}/rest/v1.0/projects/{p_id}/budget')
        if bmeta is not None:
            budget_meta_tbl.add([bmeta], p_id, run_ts)

        # Change events (+ flattened line items share the parent's success)
        ces = paginated_get(token, f'{BASE_API_URL}/rest/v1.0/change_events?project_id={p_id}')
        if ces is not None:
            li_rows: list = []
            accumulate_change_event_line_items(ces, li_rows, p_id)
            change_events_tbl.add(ces, p_id, run_ts)
            ce_line_items_tbl.add(li_rows, p_id, run_ts)

        copkgs = paginated_get(token, f'{BASE_API_URL}/rest/v1.0/change_order_packages?project_id={p_id}')
        if copkgs is not None:
            co_packages_tbl.add(copkgs, p_id, run_ts)

        # Commitments & CCOs
        com = paginated_get(token, f'{BASE_API_URL}/rest/v1.0/commitments?project_id={p_id}')
        if com is not None:
            commitments_tbl.add(com, p_id, run_ts)

        ccos = paginated_get(token, f'{BASE_API_URL}/rest/v1.0/projects/{p_id}/commitment_change_orders')
        if ccos is not None:
            ccos_tbl.add(ccos, p_id, run_ts)

        # Prime contracts & owner pay apps
        pcs = paginated_get(token, f'{BASE_API_URL}/rest/v1.0/prime_contracts?project_id={p_id}')
        if pcs is not None:
            prime_contracts_tbl.add(pcs, p_id, run_ts)

        # Pay apps: only mark the table synced if EVERY prime's fetch succeeded, so
        # one failed sub-fetch can't purge another prime's pay apps.
        if pcs is not None:
            pay_apps_all: list = []
            pay_apps_ok = True
            for pc in pcs:
                pc_id = pc.get('id')
                if not pc_id:
                    continue
                pay_apps = paginated_get(
                    token,
                    f'{BASE_API_URL}/rest/v1.0/prime_contracts/{pc_id}/payment_applications?project_id={p_id}',
                )
                if pay_apps is None:
                    pay_apps_ok = False
                    break
                for rec in pay_apps:
                    if isinstance(rec, dict):
                        rec.setdefault('prime_contract_id', pc_id)
                    pay_apps_all.append(rec)
            if pay_apps_ok:
                pay_apps_tbl.add(pay_apps_all, p_id, run_ts)

        # Prime change orders (PCCO) & potential change orders (PCO)
        pcos = paginated_get(token, f'{BASE_API_URL}/rest/v1.0/projects/{p_id}/prime_change_orders')
        if pcos is not None:
            pccos_tbl.add(pcos, p_id, run_ts)

        pot = paginated_get(token, f'{BASE_API_URL}/rest/v1.0/potential_change_orders?project_id={p_id}')
        if pot is not None:
            pcos_tbl.add(pot, p_id, run_ts)

        # Requisitions & direct costs
        reqs = paginated_get(token, f'{BASE_API_URL}/rest/v1.1/requisitions?project_id={p_id}')
        if reqs is not None:
            requisitions_tbl.add(reqs, p_id, run_ts)

        dc = paginated_get(token, f'{BASE_API_URL}/rest/v1.1/projects/{p_id}/direct_costs')
        if dc is not None:
            direct_costs_tbl.add(dc, p_id, run_ts)

        # Change order requests require a contract_id — pull per prime + per commitment.
        # Only mark the table synced if EVERY contract's fetch succeeded.
        cors_all: list = []
        cors_ok = True
        for contract_list, contract_type in ((pcs, 'prime_contract'), (com, 'commitment')):
            if contract_list is None:
                cors_ok = False
                continue
            for c in contract_list:
                cid = c.get('id')
                if not cid:
                    continue
                cors = paginated_get(
                    token,
                    f'{BASE_API_URL}/rest/v1.0/change_order_requests?project_id={p_id}&contract_id={cid}',
                )
                if cors is None:
                    cors_ok = False
                    break
                for rec in cors:
                    if isinstance(rec, dict):
                        rec.setdefault('contract_type', contract_type)
                        rec.setdefault('contract_id', cid)
                    cors_all.append(rec)
        if cors_ok:
            cors_tbl.add(cors_all, p_id, run_ts)

        # RFIs
        rfis = paginated_get(token, f'{BASE_API_URL}/rest/v1.0/projects/{p_id}/rfis')
        if rfis is not None:
            clean_rfi_assignees_and_ball_in_court(rfis)
            rfis_tbl.add(rfis, p_id, run_ts)

        # Submittals (+ flattened approvers share the parent's success)
        subs = paginated_get(token, f'{BASE_API_URL}/rest/v1.1/projects/{p_id}/submittals')
        if subs is not None:
            appr_rows: list = []
            flatten_ball_in_court_for_records(subs)
            accumulate_submittal_approvers(subs, appr_rows, p_id)
            submittals_tbl.add(subs, p_id, run_ts)
            submittal_approvers_tbl.add(appr_rows, p_id, run_ts)

    # -- Write everything: staging → UPSERT → scoped purge, one txn per table --
    logging.info('Connecting to Supabase and writing masters...')
    engine = build_engine()
    for tbl in company_tables + project_tables:
        tbl.flush(engine)

    logging.info('SUCCESS — sync complete for run %s.', run_ts.isoformat())


if __name__ == '__main__':
    try:
        run_pipeline()
    except Exception as exc:  # fail-loud: a scheduler must see a non-zero exit.
        logging.error('Pipeline failed: %s', exc)
        sys.exit(1)
