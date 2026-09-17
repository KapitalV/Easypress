import urllib.request
import re
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://easypress.vishalsahu.tech', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx) as r:
    html = r.read().decode()

print('Live HTML length:', len(html))

# Check if Sparkles exists in HTML
print('Sparkles in live HTML?', 'Sparkles' in html or 'lucide-sparkles' in html)

js_files = re.findall(r'src="(/_next/static/[^"]+\.js)"', html)
print('Found JS files:', len(js_files))

found_api_urls = set()
for js in js_files:
    jreq = urllib.request.Request(f'https://easypress.vishalsahu.tech{js}', headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(jreq, context=ctx) as jr:
            content = jr.read().decode('utf-8', errors='ignore')
            matches = re.findall(r'https?://[a-zA-Z0-9.\-]+(?::\d+)?(?:/api)?', content)
            for m in matches:
                if 'localhost' in m or 'api' in m or 'vishalsahu' in m:
                    found_api_urls.add(m)
    except Exception as e:
        print('Error fetching JS:', js, e)

print('API / Host URLs found in live scripts:', found_api_urls)
