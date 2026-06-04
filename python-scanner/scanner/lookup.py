import os
import re

import requests

_TIMEOUT = 10
_HEADERS = {"User-Agent": "Python-Scanner/0.2.0"}
_FDC_API_KEY = os.environ.get("FDC_API_KEY")

_API_BASES = [
    "https://world.openfoodfacts.org/api/v3/product/{}.json",
    "https://world.openbeautyfacts.org/api/v3/product/{}.json",
    "https://world.openpetfoodfacts.org/api/v3/product/{}.json",
]


# ── GS1 Application Identifier expiry parsing ──────────────────────────

def _parse_expiration_date(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = raw.strip()
    for fmt in (
        r"^(\d{4})-(\d{2})-(\d{2})$",
        r"^(\d{2})/(\d{2})/(\d{4})$",
        r"^(\d{2})\.(\d{2})\.(\d{4})$",
    ):
        m = re.match(fmt, raw)
        if m:
            parts = m.groups()
            if fmt.startswith(r"^(\d{4})"):
                return f"{parts[2]}/{parts[1]}/{parts[0]}"
            else:
                return f"{parts[0]}/{parts[1]}/{parts[2]}"
    return raw


_GS1_AI_LENGTHS: dict[str, int] = {
    "00": 18, "01": 14, "02": 14,
    "10": -1, "11": 6, "12": 6, "13": 6, "15": 6, "16": 6, "17": 6,
    "20": 2, "21": -1,
    "30": -1,
    "310": 6, "311": 6, "320": 6, "321": 6, "330": 6, "331": 6,
    "37": -1,
    "390": -1, "391": -1,
    "400": -1, "401": -1, "402": 17, "403": -1, "410": 13, "411": 13,
    "412": 13, "413": 13, "414": 13, "415": 13, "420": -1, "421": -1,
    "422": 3, "423": -1, "424": 3, "425": 3, "426": 3,
    "7001": 3, "7002": -1, "7003": 10,
    "8001": 14, "8002": -1, "8003": 14, "8004": -1, "8005": 6,
    "8006": 18, "8007": -1, "8008": 12,
    "8018": 18, "8020": -1,
    "8100": 6, "8101": 10, "8102": 2, "8110": -1, "8200": -1,
}


def _gs1_ai_length(ai: str) -> int | None:
    if ai in _GS1_AI_LENGTHS:
        return _GS1_AI_LENGTHS[ai]
    if len(ai) >= 3 and ai[:3] in _GS1_AI_LENGTHS:
        return _GS1_AI_LENGTHS[ai[:3]]
    return None


def _decode_gs1_expiry(barcode_data: str) -> str | None:
    i = 0
    while i < len(barcode_data):
        if barcode_data[i] == "\x1d":
            i += 1
            continue
        ai_start = i
        ai = barcode_data[i:i+2]
        ai_len = _gs1_ai_length(ai)

        if ai_len is None:
            ai = barcode_data[i:i+3]
            ai_len = _gs1_ai_length(ai)
            if ai_len is None:
                break

        if ai_len == -1:
            data_start = i + len(ai)
            j = data_start
            while j < len(barcode_data) and barcode_data[j] != "\x1d":
                j += 1
            value = barcode_data[data_start:j]
            if ai == "17" and len(value) == 6 and value.isdigit():
                yy, mm, dd = int(value[:2]), value[2:4], value[4:6]
                full_year = 2000 + yy if yy < 50 else 1900 + yy
                return f"{dd}/{mm}/{full_year}"
            i = j + 1 if j < len(barcode_data) and barcode_data[j] == "\x1d" else j
        else:
            data_end = i + len(ai) + ai_len
            if data_end > len(barcode_data):
                break
            value = barcode_data[i+len(ai):data_end]
            if ai == "17":
                yy, mm, dd = int(value[:2]), value[2:4], value[4:6]
                full_year = 2000 + yy if yy < 50 else 1900 + yy
                return f"{dd}/{mm}/{full_year}"
            i = data_end

    return None


def extract_expiry_from_barcode(barcode_data: str) -> str | None:
    return _decode_gs1_expiry(barcode_data)


# ── Product database lookups ──────────────────────────────────────────

def _lookup_openfoodfacts(barcode: str, url_template: str) -> dict | None:
    url = url_template.format(barcode)
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException:
        return None

    data = resp.json()
    status = data.get("status")
    if status not in (1, "success"):
        return None

    product = data.get("product", {})
    return {
        "product_name": product.get("product_name"),
        "brands": product.get("brands"),
        "quantity": product.get("quantity"),
        "categories": product.get("categories"),
        "expiration_date": _parse_expiration_date(product.get("expiration_date")),
        "source": "Open Food Facts",
    }


def _lookup_upcitemdb(barcode: str) -> dict | None:
    url = f"https://api.upcitemdb.com/prod/trial/lookup?upc={barcode}"
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException:
        return None

    data = resp.json()
    items = data.get("items", [])
    if not items:
        return None

    item = items[0]
    return {
        "product_name": item.get("title"),
        "brands": item.get("brand"),
        "quantity": None,
        "categories": item.get("category"),
        "expiration_date": None,
        "source": "UPCitemdb",
    }


def _lookup_gtinsearch(barcode: str) -> dict | None:
    url = f"https://www.gtinsearch.org/api/items/{barcode}"
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException:
        return None

    data = resp.json()
    if not data or data.get("gtin") != barcode:
        return None

    return {
        "product_name": data.get("name"),
        "brands": data.get("brand"),
        "quantity": data.get("size"),
        "categories": data.get("category"),
        "expiration_date": None,
        "source": "GTINsearch",
    }


def _lookup_usda(barcode: str) -> dict | None:
    if not _FDC_API_KEY:
        return None

    url = "https://api.nal.usda.gov/fdc/v1/foods/search"
    params = {
        "query": barcode,
        "api_key": _FDC_API_KEY,
        "dataType": "Branded",
        "pageSize": 1,
    }
    try:
        resp = requests.get(url, params=params, headers=_HEADERS, timeout=_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException:
        return None

    data = resp.json()
    foods = data.get("foods", [])
    if not foods:
        return None

    food = foods[0]
    return {
        "product_name": food.get("description"),
        "brands": food.get("brandName") or food.get("brandOwner"),
        "quantity": food.get("packageWeight"),
        "categories": food.get("foodCategory"),
        "expiration_date": None,
        "source": "USDA FoodData Central",
    }


def lookup_barcode(barcode: str) -> dict | None:
    for template in _API_BASES:
        result = _lookup_openfoodfacts(barcode, template)
        if result:
            return result

    for func in (_lookup_upcitemdb, _lookup_gtinsearch, _lookup_usda):
        result = func(barcode)
        if result:
            return result

    return None
