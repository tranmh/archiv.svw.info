# Build agent for the static website stages of the Jenkinsfile: Playwright with Chromium, http-server, linkinator
# and html-validate (the versions of aqaa's runner).
FROM mcr.microsoft.com/playwright:v1.56.1-noble
RUN npm install -g --no-audit --no-fund @playwright/test@1.56.1 http-server@14.1.1 linkinator@8.1.0 html-validate@11.16.2 && npm cache clean --force
ENV NODE_PATH=/usr/lib/node_modules
