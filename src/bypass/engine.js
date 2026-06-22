/**
 * MetaSpy Bypass Engine — Node.js
 * Uso: node engine.js <url> [--strategy headless] [--output ./clones]
 *
 * Suporta: SSL, Cloudflare, Inlead quizzes, paywalls
 * Requer: npm install node-fetch cheerio
 */

import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
};

function detectChallenge(html) {
  if (html.includes('__cf_chl') || html.includes('cf-browser-verification')) return 'cloudflare';
  if (html.toLowerCase().includes('inlead') || html.toLowerCase().includes('quiz')) return 'inlead';
  if (html.includes('recaptcha') || html.includes('hcaptcha')) return 'captcha';
  return null;
}

async function bypassCloudflare(url) {
  const resp = await fetch(url, {
    headers: { ...HEADERS, 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none' }
  });
  let html = await resp.text();
  if (!html.includes('__cf_chl')) return html;

  const resp2 = await fetch(url, {
    headers: HEADERS,
    redirect: 'follow'
  });
  return await resp2.text();
}

function resolveUrls(html, baseUrl) {
  const dom = new JSDOM(html, { url: baseUrl });
  const doc = dom.window.document;

  ['img', 'script', 'link'].forEach(tagName => {
    doc.querySelectorAll(`${tagName}[src], ${tagName}[href]`).forEach(el => {
      const attr = el.hasAttribute('src') ? 'src' : 'href';
      try {
        el.setAttribute(attr, new URL(el.getAttribute(attr), baseUrl).href);
      } catch {}
    });
  });

  if (!doc.querySelector('meta[charset]')) {
    const meta = doc.createElement('meta');
    meta.setAttribute('charset', 'UTF-8');
    doc.head?.insertBefore(meta, doc.head.firstChild);
  }

  return dom.serialize();
}

async function fetchPage(url, strategy = 'standard', timeout = 30000) {
  let html;

  if (strategy === 'headless' || strategy === 'hybrid') {
    html = await bypassCloudflare(url);
  } else {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const resp = await fetch(url, { headers: HEADERS, signal: controller.signal });
    clearTimeout(id);
    html = await resp.text();
  }

  const challenge = detectChallenge(html);
  if (challenge) process.stderr.write(`[!] Desafio detectado: ${challenge}\n`);

  if (strategy === 'hybrid') {
    const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
    await new Promise(r => setTimeout(r, 2000));
    html = dom.serialize();
  }

  html = resolveUrls(html, url);

  if (strategy !== 'hybrid') {
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  }

  return html;
}

function savePage(html, outputDir, slug) {
  fs.mkdirSync(outputDir, { recursive: true });
  const filePath = path.join(outputDir, `${slug}.html`);
  fs.writeFileSync(filePath, html, 'utf-8');
  console.log(`[+] Salvo: ${filePath}`);
  return filePath;
}

// CLI
const args = process.argv.slice(2);
const url = args[0];
const strategyIdx = args.indexOf('--strategy');
const strategy = strategyIdx >= 0 ? args[strategyIdx + 1] : 'standard';
const outputIdx = args.indexOf('--output');
const output = outputIdx >= 0 ? args[outputIdx + 1] : './clones';

if (!url) {
  console.error('Uso: node engine.js <url> [--strategy standard|headless|hybrid] [--output ./clones]');
  process.exit(1);
}

const slug = url.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);

fetchPage(url, strategy)
  .then(html => savePage(html, output, slug))
  .catch(err => { console.error(`[!] Erro: ${err.message}`); process.exit(1); });
