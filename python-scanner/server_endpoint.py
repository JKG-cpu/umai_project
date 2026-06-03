import json
import sys
import argparse
from scanner.decode import decode_barcode_from_base64
from scanner.lookup import lookup_barcode, extract_expiry_from_barcode


def _safe_decode(b64_str: str) -> list[dict] | None:
    try:
        return decode_barcode_from_base64(b64_str)
    except Exception as e:
        return None


def run_mode_product(b64_str: str) -> dict:
    barcodes = _safe_decode(b64_str)
    if not barcodes:
        return {"success": False, "error": "No barcode found"}

    first = barcodes[0]
    result = {
        "success": True,
        "barcode": first["data"],
        "format": first["type"],
        "product_name": None,
        "brands": None,
        "quantity": None,
        "categories": None,
        "expiration_date": None,
    }

    expiry = extract_expiry_from_barcode(first["data"])
    if expiry:
        result["expiration_date"] = expiry

    product = lookup_barcode(first["data"])
    if product:
        result["product_name"] = product.get("product_name")
        result["brands"] = product.get("brands")
        result["quantity"] = product.get("quantity")
        result["categories"] = product.get("categories")
        if not result["expiration_date"]:
            result["expiration_date"] = product.get("expiration_date")

    return result


def run_mode_expiry(b64_str: str) -> dict:
    barcodes = _safe_decode(b64_str)
    if not barcodes:
        return {"success": False, "error": "No barcode found"}

    for b in barcodes:
        expiry = extract_expiry_from_barcode(b["data"])
        if expiry:
            return {
                "success": True,
                "barcode": b["data"],
                "format": b["type"],
                "expiration_date": expiry,
            }

    return {"success": False, "error": "No expiration date found in barcode"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["product", "expiry"], default="product")
    parser.add_argument("--image", help="Base64-encoded image (with or without data URI prefix)")
    args = parser.parse_args()

    b64_str = args.image

    if not b64_str:
        line = sys.stdin.read()
        b64_str = line.strip()

    if not b64_str:
        print(json.dumps({"success": False, "error": "No image data provided"}))
        sys.exit(1)

    if args.mode == "expiry":
        result = run_mode_expiry(b64_str)
    else:
        result = run_mode_product(b64_str)

    print(json.dumps(result))
    if not result.get("success"):
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
