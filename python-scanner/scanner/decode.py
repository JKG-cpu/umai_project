import base64
import io
import tempfile
from pathlib import Path
from PIL import Image
from pyzbar.pyzbar import decode as pyzbar_decode


def decode_barcode(image_path: str) -> list[dict]:
    img = Image.open(image_path)
    img = img.convert("RGBA")
    barcodes = pyzbar_decode(img)
    results = []
    for barcode in barcodes:
        results.append({
            "data": barcode.data.decode("utf-8"),
            "type": barcode.type,
        })
    return results


def decode_barcode_from_bytes(image_bytes: bytes) -> list[dict]:
    buf = io.BytesIO(image_bytes)
    img = Image.open(buf)
    img = img.convert("RGBA")
    barcodes = pyzbar_decode(img)
    results = []
    for barcode in barcodes:
        results.append({
            "data": barcode.data.decode("utf-8"),
            "type": barcode.type,
        })
    return results


def decode_barcode_from_base64(b64_str: str) -> list[dict]:
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    image_bytes = base64.b64decode(b64_str)
    return decode_barcode_from_bytes(image_bytes)
