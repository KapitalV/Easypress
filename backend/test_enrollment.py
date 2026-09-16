import io
import json
import urllib.request
from PIL import Image, ImageDraw

import random
# Create photo with realistic photographic entropy (gradients + details)
photo = Image.new('RGB', (1200, 1600), color=(180, 200, 230))
draw = ImageDraw.Draw(photo)
for y in range(0, 1600, 10):
    for x in range(0, 1200, 10):
        c = (x % 255, y % 255, (x * y) % 255)
        draw.point((x, y), fill=c)
draw.ellipse([400, 400, 800, 900], fill=(230, 190, 160))
photo_buf = io.BytesIO()
photo.save(photo_buf, format='PNG')
photo_bytes = photo_buf.getvalue()

sign = Image.new('RGBA', (800, 300), color=(255, 255, 255, 0))
sdraw = ImageDraw.Draw(sign)
sdraw.line([(50, 150), (250, 80), (450, 200), (750, 100)], fill=(0, 0, 120, 255), width=10)
sign_buf = io.BytesIO()
sign.save(sign_buf, format='PNG')
sign_bytes = sign_buf.getvalue()

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
body = io.BytesIO()

def add_file(name, filename, data, mime):
    body.write(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{filename}"\r\nContent-Type: {mime}\r\n\r\n'.encode())
    body.write(data)
    body.write(b'\r\n')

def add_field(name, value):
    body.write(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())

add_file('photo', 'sample_photo.png', photo_bytes, 'image/png')
add_file('signature', 'sample_sign.png', sign_bytes, 'image/png')
add_field('prefix', 'ravi')
body.write(f'--{boundary}--\r\n'.encode())

req = urllib.request.Request('http://127.0.0.1:8000/api/v1/jobs/enrollment', data=body.getvalue())
req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')

with urllib.request.urlopen(req) as resp:
    print('STATUS_CODE:', resp.status)
    res_data = json.loads(resp.read().decode())
    print('PHOTO_NAME:', res_data['photo']['output_filename'])
    print('PHOTO_KB:', round(res_data['photo']['compressed_size'] / 1024, 1))
    print('SIGN_NAME:', res_data['signature']['output_filename'])
    print('SIGN_KB:', round(res_data['signature']['compressed_size'] / 1024, 1))
    print('PHOTO_DOWNLOAD_URL:', res_data['photo_download_url'])
    print('SIGN_DOWNLOAD_URL:', res_data['sign_download_url'])
    print('ZIP_DOWNLOAD_URL:', res_data['zip_download_url'])
