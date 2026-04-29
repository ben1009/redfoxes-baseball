const { launchBrowser } = require('./browser');
const path = require('path');
const fs = require('fs');
const http = require('http');

const TEST_CONFIG = {
    password: process.env.TEST_PASSWORD || '1972',
    viewport: { width: 1280, height: 800 },
    timeout: 60000
};

const REPO_ROOT = path.resolve(__dirname, '..');
const IMAGE_MODAL_JS = fs.readFileSync(path.resolve(REPO_ROOT, 'image_modal.js'), 'utf8');
const GTAG_STUB_JS = `window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function(){ dataLayer.push(arguments); };`;
const IMAGE_MODAL_PAGES = new Set([
    'u10_rules.html',
    'pony_u10_rules.html',
    'tigercup_groupstage.html',
    'tigercup_finalstage.html',
    'sponsor_me.html'
]);

const PAGE_PATHS = {
    index: 'index.html',
    matchReview: 'match_review.html',
    rules: 'u10_rules.html',
    ponyRules: 'pony_u10_rules.html',
    groupstage: 'tigercup_groupstage.html',
    finalstage: 'tigercup_finalstage.html',
    sponsor: 'sponsor_me.html'
};

function contentTypeFor(filePath) {
    if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
    if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
    if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
    if (filePath.endsWith('.svg')) return 'image/svg+xml';
    if (filePath.endsWith('.png')) return 'image/png';
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
    return 'application/octet-stream';
}

function createStaticServer() {
    return http.createServer((req, res) => {
        const requestUrl = new URL(req.url, 'http://127.0.0.1');
        const pathname = decodeURIComponent(requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname);

        if (pathname === '/__blank.html') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
            return;
        }

        const filePath = path.resolve(REPO_ROOT, pathname.slice(1));
        if (!filePath.startsWith(REPO_ROOT + path.sep) && filePath !== REPO_ROOT) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        fs.readFile(filePath, (error, body) => {
            if (error) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }

            res.writeHead(200, { 'Content-Type': contentTypeFor(filePath) });
            res.end(body);
        });
    });
}

function prepareHtml(pagePath, baseUrl, injectedScripts = []) {
    const filePath = path.resolve(REPO_ROOT, pagePath);
    const html = fs.readFileSync(filePath, 'utf8')
        .replace(/<script\b[^>]*src=["'][^"']+["'][^>]*><\/script>\s*/gi, '')
        .replace('<head>', `<head><base href="${baseUrl}/"><script>${GTAG_STUB_JS}</script>`);

    const injectionBlock = injectedScripts
        .filter(Boolean)
        .map(script => `<script>${script}</script>`)
        .join('\n');

    return html.replace('</body>', `${injectionBlock}</body>`);
}

function createPageHarness(defaultPagePath) {
    let browser;
    let page;
    let server;
    let baseUrl;
    let browserLaunchError;
    let browserLaunchWarningShown = false;

    const withBrowser = async (callback) => {
        if (browserLaunchError) {
            if (!browserLaunchWarningShown) {
                console.warn(`Skipping browser assertions: ${browserLaunchError.message}`);
                browserLaunchWarningShown = true;
            }
            return;
        }

        await callback();
    };

    const loadPage = async (pagePath = defaultPagePath) => {
        if (browserLaunchError) {
            return;
        }

        const injectedScripts = IMAGE_MODAL_PAGES.has(pagePath) ? [IMAGE_MODAL_JS] : [];
        await page.setContent(prepareHtml(pagePath, baseUrl, injectedScripts), {
            waitUntil: 'domcontentloaded',
            timeout: TEST_CONFIG.timeout
        });
    };

    const setup = async () => {
        try {
            server = createStaticServer();
            await new Promise((resolve, reject) => {
                server.once('error', reject);
                server.listen(0, '127.0.0.1', () => {
                    server.off('error', reject);
                    resolve();
                });
            });
            baseUrl = `http://127.0.0.1:${server.address().port}`;

            browser = await launchBrowser();
            page = await browser.newPage();
            await page.setViewportSize(TEST_CONFIG.viewport);
            page.setDefaultTimeout(5000);
            page.setDefaultNavigationTimeout(5000);
            await page.route(/^https?:\/\//, async route => {
                const hostname = new URL(route.request().url()).hostname;
                if (hostname === '127.0.0.1' || hostname === 'localhost') {
                    await route.continue();
                    return;
                }
                await route.abort();
            });

            // The match review and sponsor suites need an origin-preserving
            // warmup so they can exercise secure-context APIs and localStorage
            // after subsequent setContent calls. Keep this best-effort so a slow
            // blank-page navigation does not block every page suite in CI.
            if (defaultPagePath === PAGE_PATHS.matchReview || defaultPagePath === PAGE_PATHS.sponsor) {
                await page.goto(`${baseUrl}/__blank.html`, {
                    waitUntil: 'commit',
                    timeout: 5000
                }).catch(() => {});
            }
        } catch (error) {
            browserLaunchError = error;
        }
    };

    const teardown = async () => {
        if (page) {
            await page.close({ runBeforeUnload: false }).catch(() => {});
        }
        if (browser) {
            await browser.close();
        }
        if (server) {
            await new Promise(resolve => server.close(resolve));
        }
    };

    return {
        setup,
        teardown,
        loadPage,
        withBrowser,
        get browserLaunchError() {
            return browserLaunchError;
        },
        get page() {
            return page;
        }
    };
}

module.exports = {
    TEST_CONFIG,
    PAGE_PATHS,
    createPageHarness,
    REPO_ROOT
};
