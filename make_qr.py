# make_qr.py — generate a QR for an Algorand address or app_id
import sys
import qrcode
from algosdk import logic

def save_qr(label: str, text: str) -> str:
    img = qrcode.make(text)
    fn = f"{label}_QR.png"
    img.save(fn)
    return fn

def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python make_qr.py ADDRESS")
        print("  python make_qr.py --app APP_ID")
        sys.exit(1)

    if sys.argv[1] == "--app":
        if len(sys.argv) != 3:
            sys.exit("Provide an APP_ID: python make_qr.py --app 123456")
        app_id = int(sys.argv[2])
        addr = logic.get_application_address(app_id)
        fn = save_qr(f"app_{app_id}", addr)
        print(f"App ID: {app_id}\nApp address: {addr}\nSaved: {fn}")
    else:
        addr = sys.argv[1]
        fn = save_qr("address", addr)
        print(f"Address: {addr}\nSaved: {fn}")

if __name__ == "__main__":
    main()
