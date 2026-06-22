<?php
/**
 * MetaSpy Bypass Engine — PHP
 * Uso: php engine.php <url> [--strategy standard] [--output ./clones]
 *
 * Suporta: SSL, Cloudflare, Inlead quizzes, paywalls
 * Requer: PHP 8+, ext-curl, ext-dom
 */

function fetch_page(string $url, string $strategy = 'standard', int $timeout = 30): string {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        CURLOPT_HTTPHEADER => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: pt-BR,pt;q=0.9,en;q=0.8',
            'Cache-Control: no-cache',
            'Upgrade-Insecure-Requests: 1',
        ],
    ]);

    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($html === false) {
        throw new \RuntimeException('Falha ao buscar URL: ' . curl_error($ch));
    }

    // Detecta desafios
    $challenge = null;
    if (str_contains($html, '__cf_chl') || str_contains($html, 'cf-browser-verification')) {
        $challenge = 'cloudflare';
    } elseif (str_contains(strtolower($html), 'inlead') || str_contains(strtolower($html), 'quiz')) {
        $challenge = 'inlead';
    }

    if ($challenge) {
        fwrite(STDERR, "[!] Desafio detectado: $challenge\n");
    }

    // Processa HTML
    $doc = new DOMDocument();
    @$doc->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
    $xpath = new DOMXPath($doc);

    // Resolve URLs relativas
    $base = $url;
    foreach (['img' => 'src', 'script' => 'src', 'link' => 'href', 'a' => 'href'] as $tag => $attr) {
        foreach ($xpath->query("//{$tag}[@{$attr}]") as $node) {
            $val = $node->getAttribute($attr);
            if ($val && !str_starts_with($val, 'data:') && !str_starts_with($val, '#')) {
                $resolved = resolve_url($base, $val);
                $node->setAttribute($attr, $resolved);
            }
        }
    }

    // Remove scripts no modo standard
    if ($strategy !== 'hybrid') {
        while ($doc->getElementsByTagName('script')->length > 0) {
            $s = $doc->getElementsByTagName('script')->item(0);
            $s->parentNode->removeChild($s);
        }
    }

    // Adiciona charset se nao existir
    $head = $doc->getElementsByTagName('head')->item(0);
    if ($head) {
        $metaCharset = $xpath->query('//meta[@charset]');
        if ($metaCharset->length === 0) {
            $meta = $doc->createElement('meta');
            $meta->setAttribute('charset', 'UTF-8');
            $head->insertBefore($meta, $head->firstChild);
        }
    }

    $html = $doc->saveHTML();
    return $html;
}

function resolve_url(string $base, string $rel): string {
    if (parse_url($rel, PHP_URL_SCHEME) !== null) return $rel;
    $baseParts = parse_url($base);
    $scheme = $baseParts['scheme'] ?? 'https';
    $host = $baseParts['host'] ?? '';
    $path = dirname($baseParts['path'] ?? '/');
    return "$scheme://$host" . ($path === '/' ? '' : $path) . '/' . ltrim($rel, '/');
}

function save_page(string $html, string $dir, string $slug): string {
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $path = rtrim($dir, '/') . "/{$slug}.html";
    file_put_contents($path, $html);
    echo "[+] Salvo: $path\n";
    return $path;
}

// CLI
$options = getopt('', ['strategy::', 'output::'], $optind);
$args = array_slice($argv, $optind);
$url = $args[0] ?? null;

if (!$url) {
    die("Uso: php engine.php <url> [--strategy standard|headless|hybrid] [--output ./clones]\n");
}

$strategy = $options['strategy'] ?? 'standard';
$output = $options['output'] ?? './clones';
$slug = preg_replace('/[^a-zA-Z0-9]/', '_', substr(preg_replace('#https?://#', '', $url), 0, 40));

echo "[*] Estrategia: $strategy\n";
echo "[*] URL: $url\n";

try {
    $html = fetch_page($url, $strategy);
    save_page($html, $output, $slug);
} catch (\Throwable $e) {
    fwrite(STDERR, "[!] Erro: {$e->getMessage()}\n");
    exit(1);
}
