import urllib.request
import re

req = urllib.request.urlopen("http://localhost:3000")
html = req.read().decode()
print("Main page status:", req.status)

# Find CSS and JS asset links
assets = re.findall(r'(?:href|src)="(/_next/[^"]+)"', html)
print(f"Found {len(assets)} Next.js assets linked in HTML.")

import html as html_lib

failed = 0
for raw_asset in set(assets):
    asset = html_lib.unescape(raw_asset)
    try:
        aresp = urllib.request.urlopen(f"http://localhost:3000{asset}")
        if aresp.status != 200:
            print(f"FAILED asset: {asset} -> {aresp.status}")
            failed += 1
    except Exception as e:
        print(f"ERROR asset: {asset} -> {e}")
        failed += 1

# Check public assets
try:
    lresp = urllib.request.urlopen("http://localhost:3000/easypress_logo.png")
    print(f"Logo asset status: {lresp.status}, {len(lresp.read())} bytes")
except Exception as e:
    print("Logo asset error:", e)
    failed += 1

print(f"Asset verification done. Total assets tested: {len(set(assets)) + 1}. Failed: {failed}")
if failed == 0:
    print("ALL FRONTEND ASSETS AND CHUNKS LOAD WITH 200 OK!")
