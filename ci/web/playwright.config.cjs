// Playwright configuration for a static website, written by aqaa. It serves the site (the current directory) with
// http-server on 127.0.0.1 and runs two projects in Chromium: "unit" (tests/unit: page checks) and "e2e" (tests/e2e:
// user journeys). Tests use relative URLs (page.goto('/about.html')); the base URL is also in AQAA_BASE_URL.
// The repository needs no package.json: @playwright/test and http-server are installed globally (NODE_PATH).
const path = require('path');
const os = require('os');

const root = process.env.AQAA_WEB_ROOT || process.cwd();
const port = Number(process.env.AQAA_WEB_PORT || 8123);
const baseURL = `http://127.0.0.1:${port}`;
process.env.AQAA_BASE_URL = baseURL;

module.exports = {
  testDir: path.join(root, 'tests'),
  testMatch: '**/*.spec.{js,ts}',
  outputDir: process.env.AQAA_WEB_OUT || path.join(os.tmpdir(), 'aqaa-web-results'),
  fullyParallel: true,
  retries: 0,
  use: { baseURL, browserName: 'chromium', trace: 'off', screenshot: 'off', video: 'off' },
  webServer: {
    command: `http-server ${JSON.stringify(root)} -a 127.0.0.1 -p ${port} -s -c-1`,
    url: `${baseURL}/`,
    reuseExistingServer: true,
    timeout: 30000,
  },
  projects: [
    { name: 'unit', testDir: path.join(root, 'tests', 'unit') },
    { name: 'e2e', testDir: path.join(root, 'tests', 'e2e') },
  ],
};
