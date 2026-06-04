import base64
import io

import cv2
import numpy as np
from PIL import Image
from pyzbar.pyzbar import decode as pyzbar_decode


def _preprocess_pipelines(img_bgr: np.ndarray) -> list[np.ndarray]:
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    pipelines = []

    pipelines.append(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))

    pipelines.append(gray)

    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
    pipelines.append(thresh)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    gradient = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, kernel)
    pipelines.append(gradient)

    denoised = cv2.bilateralFilter(gray, 9, 75, 75)
    pipelines.append(denoised)

    gauss = cv2.GaussianBlur(gray, (0, 0), 3.0)
    sharpened = cv2.addWeighted(gray, 1.5, gauss, -0.5, 0)
    pipelines.append(sharpened)

    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    clahe_img = clahe.apply(gray)
    pipelines.append(clahe_img)

    _, otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    pipelines.append(otsu)

    if max(h, w) < 2000:
        upscaled = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
        pipelines.append(upscaled)

    inverted = cv2.bitwise_not(gray)
    pipelines.append(inverted)

    return pipelines


def _decode_any(img_bgr: np.ndarray) -> list[dict]:
    seen = set()
    results = []

    for processed in _preprocess_pipelines(img_bgr):
        barcodes = pyzbar_decode(processed)
        for barcode in barcodes:
            data = barcode.data.decode("utf-8")
            if data not in seen:
                seen.add(data)
                results.append({
                    "data": data,
                    "type": barcode.type,
                })

    return results


def decode_barcode(image_path: str) -> list[dict]:
    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        img = Image.open(image_path)
        img_bgr = cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR)
    return _decode_any(img_bgr)


def decode_barcode_from_bytes(image_bytes: bytes) -> list[dict]:
    buf = io.BytesIO(image_bytes)
    img = Image.open(buf)
    img_bgr = cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR)
    return _decode_any(img_bgr)


def decode_barcode_from_base64(b64_str: str) -> list[dict]:
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    image_bytes = base64.b64decode(b64_str)
    return decode_barcode_from_bytes(image_bytes)
