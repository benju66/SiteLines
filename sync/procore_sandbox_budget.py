"""Sandbox smoke test — pull budget line items and push them to Supabase.

Secrets come from sync/.env only. The old hardcoded Supabase DB password + pooler
host (research §7) are gone; this reuses the same SUPABASE_DB_* env the main pipeline
uses, so it targets the fresh project once that is provisioned.
"""

import os
import urllib.parse

import pandas as pd
import requests
from dotenv import load_dotenv
from sqlalchemy import create_engine

load_dotenv()

CLIENT_ID = os.getenv('PROCORE_SANDBOX_CLIENT_ID')
CLIENT_SECRET = os.getenv('PROCORE_SANDBOX_CLIENT_SECRET')
COMPANY_ID = os.getenv('PROCORE_SANDBOX_COMPANY_ID')
PROJECT_ID = os.getenv('PROCORE_SANDBOX_PROJECT_ID')

AUTH_URL = 'https://sandbox.procore.com/oauth/token'
BASE_API_URL = 'https://sandbox.procore.com'


def get_access_token():
    print('Requesting fresh sandbox access token...')
    payload = {'grant_type': 'client_credentials', 'client_id': CLIENT_ID, 'client_secret': CLIENT_SECRET}
    response = requests.post(AUTH_URL, data=payload)
    if response.status_code == 200:
        return response.json().get('access_token')
    print(f'Authentication Failed: {response.status_code}')
    return None


def get_budget_line_items(token):
    print(f'Fetching budget line items for Project {PROJECT_ID}...')
    headers = {'Authorization': f'Bearer {token}', 'Procore-Company-Id': str(COMPANY_ID)}
    endpoint = f'{BASE_API_URL}/rest/v1.1/budget_line_items?project_id={PROJECT_ID}'
    response = requests.get(endpoint, headers=headers)
    if response.status_code == 200:
        return response.json()
    print(f'API Request Failed: {response.status_code}')
    print(response.text)
    return None


def build_engine():
    user = os.getenv('SUPABASE_DB_USER')
    password = os.getenv('SUPABASE_DB_PASSWORD')
    host = os.getenv('SUPABASE_DB_HOST')
    port = os.getenv('SUPABASE_DB_PORT', '5432')
    name = os.getenv('SUPABASE_DB_NAME', 'postgres')
    if not (user and password and host):
        raise SystemExit('Set SUPABASE_DB_USER / _PASSWORD / _HOST in sync/.env')
    safe_password = urllib.parse.quote_plus(password)
    uri = f'postgresql://{user}:{safe_password}@{host}:{port}/{name}'
    return create_engine(uri, connect_args={'sslmode': 'require'})


if __name__ == '__main__':
    if not (CLIENT_ID and CLIENT_SECRET and COMPANY_ID and PROJECT_ID):
        raise SystemExit('Set PROCORE_SANDBOX_CLIENT_ID / _SECRET / _COMPANY_ID / _PROJECT_ID in sync/.env')

    token = get_access_token()
    if token:
        budget_data = get_budget_line_items(token)
        if isinstance(budget_data, list) and budget_data:
            df = pd.json_normalize(budget_data)
            print('Connecting to Supabase...')
            engine = build_engine()
            df.to_sql('sandbox_budget', engine, if_exists='replace', index=False)
            print(f'Success! Pushed {len(df)} budget line items to Supabase.')
        else:
            print('No budget line items found.')
