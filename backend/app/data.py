"""Shared travel dataset, exported from the TypeScript source of truth.

Regenerate with:  npx tsx scripts/export-data.ts
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "travel-data.json"


@lru_cache(maxsize=1)
def load() -> dict[str, Any]:
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def destinations() -> list[dict[str, Any]]:
    return load()["destinations"]


@lru_cache(maxsize=1)
def _by_id() -> dict[str, dict[str, Any]]:
    return {d["id"]: d for d in destinations()}


def destination_by_id(dest_id: str) -> dict[str, Any] | None:
    return _by_id().get(dest_id)


def stays_for(dest_id: str) -> list[dict[str, Any]]:
    return load()["stays"].get(dest_id, [])


def entry_fee(dest_id: str) -> str | None:
    return load()["entryFees"].get(dest_id)


def gateway_airport(dest_id: str) -> dict[str, str] | None:
    return load()["gatewayAirports"].get(dest_id)


def origin_hubs() -> list[dict[str, Any]]:
    return load()["originHubs"]


def regional_airlines(region: str) -> list[str]:
    return load()["regionalAirlines"].get(region, [])
