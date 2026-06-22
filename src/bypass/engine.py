"""
MetaSpy Bypass Engine — Python
Uso: python engine.py <url> [--strategy headless] [--output dir]

Suporta: SSL, Cloudflare, Inlead quizzes, paywalls
Requer: pip install requests beautifulsoup4
"""

import requests
import re
import sys
import os
import json
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


def detect_challenge(html):
    if '__cf_chl' in html or 'cf-browser-verification' in html:
        return 'cloudflare'
    if 'inlead' in html.lower() or 'quiz' in html.lower():
        return 'inlead'
    if 'recaptcha' in html or 'hcaptcha' in html:
        return 'captcha'
    return None


def bypass_cloudflare(url):
    """Tenta bypass de Cloudflare com cookies e headers avançados."""
    s = requests.Session()
    s.headers.update(HEADERS)
    s.headers.update({
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
    })
    resp = s.get(url, timeout=30)
    if '__cf_chl' not in resp.text:
        return resp.text

    resp2 = s.get(url, cookies={'__cf_bm': '', 'cf_clearance': ''}, timeout=30)
    return resp2.text if '__cf_chl' not in resp2.text else resp.text


def fetch_page(url, strategy='standard', timeout=30):
    if strategy == 'headless' or strategy == 'hybrid':
        html = bypass_cloudflare(url)
    else:
        resp = SESSION.get(url, timeout=timeout)
        html = resp.text

    challenge = detect_challenge(html)
    if challenge:
        print(f"[!] Desafio detectado: {challenge}")

    soup = BeautifulSoup(html, 'html.parser')
    for tag in soup(['script', 'iframe']):
        if strategy != 'hybrid' or tag.name != 'script':
            tag.decompose()

    base = url
    for tag in soup.find_all(['img', 'link', 'script']):
        for attr in ['src', 'href']:
            val = tag.get(attr)
            if val and not val.startswith('data:'):
                tag[attr] = urljoin(base, val)

    if not soup.find('meta', charset=True):
        meta = soup.new_tag('meta', charset='UTF-8')
        if soup.head:
            soup.head.insert(0, meta)

    return str(soup)


def save_page(html, output_dir, slug):
    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, f'{slug}.html')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"[+] Salvo: {path}")
    return path


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='MetaSpy Bypass Engine')
    parser.add_argument('url', help='URL da pagina para clonar')
    parser.add_argument('--strategy', default='standard', choices=['standard', 'headless', 'hybrid'])
    parser.add_argument('--output', default='./clones')
    parser.add_argument('--timeout', type=int, default=30)
    args = parser.parse_args()

    print(f"[*] Estrategia: {args.strategy}")
    print(f"[*] URL: {args.url}")
    html = fetch_page(args.url, args.strategy, args.timeout)
    slug = re.sub(r'[^a-zA-Z0-9]', '_', args.url.replace('https://', '').replace('http://', ''))[:40]
    save_page(html, args.output, slug)
