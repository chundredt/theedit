// Turns dist-single/index.html into a fragment for the claude.ai Artifact viewer (which adds its own <html>/<head>/<body>).
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist-single/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>|<link rel="(manifest|apple-touch-icon)"[^>]*>|<meta name="(apple-mobile-web-app|mobile-web-app)[^>]*>/g, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const title = head.match(/<title>.*?<\/title>/)[0];
writeFileSync(process.argv[2], `${title}\n${head.replace(title, '')}\n${body}`);
