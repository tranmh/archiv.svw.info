import http from 'k6/http';
import { check } from 'k6';

const WEB = (__ENV.AQAA_APP_WEB_URL || 'http://localhost:8080').replace(/\/+$/, '');
const VUS = Math.min(parseInt(__ENV.AQAA_LOAD_VUS || '10', 10) || 10, 10);
const DURATION = __ENV.AQAA_LOAD_DURATION || '30s';

export const options = {
  scenarios: {
    load: { executor: 'constant-vus', vus: VUS, duration: DURATION },
  },
};

// Static files of the site; offset pages exist for 0..13.
const OFFSETS = Array.from({ length: 14 }, (_, i) => i);

const ENDPOINTS = [
  { path: '/index.html', weight: 15 },
  { path: '/archiv.html', weight: 10 },
  { path: '/archivsuche.html', weight: 8 },
  { path: '/schachinwuerttemberg.html', weight: 8 },
  { path: '/schachinwuerttemberg_offset_<n>.html', weight: 10,
    url: () => `/schachinwuerttemberg_offset_${OFFSETS[Math.floor(Math.random() * OFFSETS.length)]}.html` },
  { path: '/rochade.html', weight: 6 },
  { path: '/rochade/index.html', weight: 5 },
  { path: '/wuerttembergrochade.html', weight: 5 },
  { path: '/willkommen.html', weight: 5 },
  { path: '/mitmachen.html', weight: 4 },
  { path: '/year_sections.html', weight: 4 },
  { path: '/modules/Archiv.html', weight: 3 },
  { path: '/css/svwarchiv.css', weight: 6 },
  { path: '/css/selectize.css', weight: 3 },
  { path: '/css/jquery2.min.js', weight: 4 },
  { path: '/css/selectize.min.js', weight: 3 },
  { path: '/svwlogo.gif', weight: 5 },
  { path: '/favicon.ico', weight: 3 },
  { path: '/sitemap.xml', weight: 2 },
  { path: '/robots.txt', weight: 1 },
];

const TOTAL = ENDPOINTS.reduce((s, e) => s + e.weight, 0);

function pick() {
  let r = Math.random() * TOTAL;
  for (const e of ENDPOINTS) {
    r -= e.weight;
    if (r < 0) return e;
  }
  return ENDPOINTS[ENDPOINTS.length - 1];
}

export default function () {
  const e = pick();
  const name = `web GET ${e.path}`;
  const url = WEB + (e.url ? e.url() : e.path);
  const res = http.get(url, { tags: { endpoint: name } });
  check(res, { 'status is 200': (r) => r.status === 200 }, { endpoint: name });
}
