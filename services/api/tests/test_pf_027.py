"""Keep the published API inventory aligned with generated routes, without new schemas."""

import json
import re
from pathlib import Path


def test_documented_endpoint_inventory_matches_generated_contract():
    root = Path(__file__).resolve().parents[3]
    contract = json.loads((root / 'contracts/openapi.json').read_text(encoding='utf-8'))
    expected = {
        (method.upper(), path, operation['operationId'])
        for path, methods in contract['paths'].items()
        for method, operation in methods.items()
        if method in {'get', 'post', 'put', 'patch', 'delete'}
    }
    rows = re.findall(
        r'^\| (GET|POST|PUT|PATCH|DELETE) \| `([^`]+)` \| `([^`]+)` \|',
        (root / 'docs/API.md').read_text(encoding='utf-8'), re.MULTILINE,
    )
    assert len(rows) == len(set(rows)), 'Duplicate documented API operations'
    assert set(rows) == expected, 'Published API inventory has missing/stale operations'
