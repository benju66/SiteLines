"""Sandbox smoke test — list projects from the Procore Developer Sandbox.

Secrets come from sync/.env only (PROCORE_SANDBOX_*), never hardcoded. See §7 of
Notes/research/Procore-API-Integration-Research.md for the sandbox auth/base-URL caveat.
"""

import os

import pandas as pd
import requests
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv('PROCORE_SANDBOX_CLIENT_ID')
CLIENT_SECRET = os.getenv('PROCORE_SANDBOX_CLIENT_SECRET')
COMPANY_ID = os.getenv('PROCORE_SANDBOX_COMPANY_ID')

# ⚠️ The developer sandbox historically authenticated at sandbox.procore.com, while
# the docs point auth at login-sandbox.procore.com. Verify which is current if this
# starts failing (research §6).
AUTH_URL = 'https://sandbox.procore.com/oauth/token'
BASE_API_URL = 'https://sandbox.procore.com'


def get_access_token():
    print('Requesting fresh sandbox access token...')
    payload = {'grant_type': 'client_credentials', 'client_id': CLIENT_ID, 'client_secret': CLIENT_SECRET}
    response = requests.post(AUTH_URL, data=payload)
    if response.status_code == 200:
        print('Authentication successful!')
        return response.json().get('access_token')
    print(f'Authentication Failed: {response.status_code}')
    print(response.text)
    return None


def get_projects(token):
    print('Fetching sandbox project data...')
    headers = {'Authorization': f'Bearer {token}', 'Procore-Company-Id': str(COMPANY_ID)}
    endpoint = f'{BASE_API_URL}/rest/v1.0/projects?company_id={COMPANY_ID}'
    response = requests.get(endpoint, headers=headers)
    if response.status_code == 200:
        return response.json()
    print(f'API Request Failed: {response.status_code}')
    print(response.text)
    return None


if __name__ == '__main__':
    if not (CLIENT_ID and CLIENT_SECRET and COMPANY_ID):
        raise SystemExit('Set PROCORE_SANDBOX_CLIENT_ID / _SECRET / _COMPANY_ID in sync/.env')

    token = get_access_token()
    if token:
        projects_data = get_projects(token)
        if projects_data:
            df = pd.DataFrame(projects_data)
            columns_to_keep = ['id', 'name', 'project_number', 'status', 'stage']
            df = df[[c for c in columns_to_keep if c in df.columns]]
            filename = 'Sandbox_Project_List.csv'
            df.to_csv(filename, index=False)
            print(f'Success! Exported {len(df)} sandbox projects to {filename}')
