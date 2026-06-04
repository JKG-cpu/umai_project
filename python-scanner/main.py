import sys

from scanner.decode import decode_barcode
from scanner.lookup import lookup_barcode


def main():
    if len(sys.argv) < 2:
        print("Usage: python main.py <path-to-barcode-image>")
        sys.exit(1)

    image_path = sys.argv[1]

    try:
        barcodes = decode_barcode(image_path)
    except FileNotFoundError:
        print(f"Error: file not found: {image_path}")
        sys.exit(1)
    except Exception as e:
        print(f"Error reading image: {e}")
        sys.exit(1)

    if not barcodes:
        print("No barcode found in image.")
        sys.exit(1)

    for barcode in barcodes:
        print(f"Barcode: {barcode['data']}")
        print(f"Format:  {barcode['type']}")

        result = lookup_barcode(barcode["data"])
        if result and result["product_name"]:
            if result["product_name"]:
                print(f"Product: {result['product_name']}")
            if result["brands"]:
                print(f"Brand:   {result['brands']}")
            if result["quantity"]:
                print(f"Qty:     {result['quantity']}")
        else:
            print(f"Product: (not found in any database)")

        print()


if __name__ == "__main__":
    main()
