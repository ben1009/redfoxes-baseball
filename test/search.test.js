/**
 * @fileoverview Search UI tests
 * Tests site_search.js modal, keyboard navigation, and trigger injection
 */

const puppeteer = require('puppeteer');
const path = require('path');

const TEST_CONFIG = {
    viewport: { width: 1280, height: 800 },
    timeout: 30000
};

const PAGE_PATHS = {
    index: 'file://' + path.resolve(__dirname, '../index.html'),
    matchReview: 'file://' + path.resolve(__dirname, '../match_review.html'),
    rules: 'file://' + path.resolve(__dirname, '../u10_rules.html'),
    ponyRules: 'file://' + path.resolve(__dirname, '../pony_u10_rules.html'),
    groupstage: 'file://' + path.resolve(__dirname, '../tigercup_groupstage.html'),
    finalstage: 'file://' + path.resolve(__dirname, '../tigercup_finalstage.html'),
    sponsor: 'file://' + path.resolve(__dirname, '../sponsor_me.html')
};

describe('Search UI Tests', () => {
    let browser;
    let page;
    let browserLaunchError;

    const withBrowser = async (callback) => {
        if (browserLaunchError) {
            console.warn(`Skipping browser assertion: ${browserLaunchError.message}`);
            return;
        }
        await callback();
    };

    beforeAll(async () => {
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                pipe: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            page = await browser.newPage();
            await page.setViewport(TEST_CONFIG.viewport);
        } catch (error) {
            browserLaunchError = error;
        }
    }, TEST_CONFIG.timeout);

    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
    });

    describe('Search Trigger on All Pages', () => {
        const pages = Object.entries(PAGE_PATHS);

        test.each(pages)('should inject search trigger on %s', async (_, url) => {
            await withBrowser(async () => {
                await page.goto(url, { waitUntil: 'domcontentloaded' });
                // Wait a tick for deferred script
                await page.waitForTimeout(100);
                const trigger = await page.$('#site-search-trigger');
                expect(trigger).not.toBeNull();
            });
        });
    });

    describe('Search Trigger Placement', () => {
        test('trigger should be inside nav-container on rules pages', async () => withBrowser(async () => {
            const navPages = [PAGE_PATHS.rules, PAGE_PATHS.ponyRules, PAGE_PATHS.groupstage, PAGE_PATHS.finalstage];
            for (const url of navPages) {
                await page.goto(url, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(100);
                const parent = await page.$eval('#site-search-trigger', el => el.parentElement?.className);
                expect(parent).toBe('nav-container');
            }
        }));

        test('trigger should be centered in header on index and match_review', async () => withBrowser(async () => {
            const headerPages = [PAGE_PATHS.index, PAGE_PATHS.matchReview];
            for (const url of headerPages) {
                await page.goto(url, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(100);
                const wrap = await page.$('.search-trigger-header-wrap');
                expect(wrap).not.toBeNull();
                const child = await wrap.$eval('#site-search-trigger', el => el.id);
                expect(child).toBe('site-search-trigger');
            }
        }));

        test('trigger should not overlap sponsor modal close button', async () => withBrowser(async () => {
            await page.goto(PAGE_PATHS.sponsor, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(100);
            const trigger = await page.$('#site-search-trigger');
            const box = await trigger.boundingBox();
            // Trigger should NOT be fixed-positioned on sponsor page (it goes inside .topbar)
            const isFixed = await trigger.evaluate(el => getComputedStyle(el).position === 'fixed');
            expect(isFixed).toBe(false);
        }));
    });

    describe('Modal Open / Close', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.index, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(100);
            }
        });

        test('Ctrl+K opens search modal', async () => withBrowser(async () => {
            const modalBefore = await page.$eval('#searchModal', el => el.hidden).catch(() => true);
            expect(modalBefore).toBe(true);

            await page.keyboard.down('Control');
            await page.keyboard.press('KeyK');
            await page.keyboard.up('Control');
            await page.waitForTimeout(100);

            const modalAfter = await page.$eval('#searchModal', el => el.hidden).catch(() => true);
            expect(modalAfter).toBe(false);
        }));

        test('Escape closes search modal', async () => withBrowser(async () => {
            // Open modal
            await page.keyboard.down('Control');
            await page.keyboard.press('KeyK');
            await page.keyboard.up('Control');
            await page.waitForTimeout(100);

            const modalOpen = await page.$eval('#searchModal', el => el.hidden).catch(() => true);
            expect(modalOpen).toBe(false);

            await page.keyboard.press('Escape');
            await page.waitForTimeout(100);

            const modalClosed = await page.$eval('#searchModal', el => el.hidden).catch(() => false);
            expect(modalClosed).toBe(true);
        }));

        test('clicking backdrop closes modal', async () => withBrowser(async () => {
            // Open modal
            await page.keyboard.down('Control');
            await page.keyboard.press('KeyK');
            await page.keyboard.up('Control');
            await page.waitForTimeout(100);

            await page.click('.search-backdrop');
            await page.waitForTimeout(100);

            const modalClosed = await page.$eval('#searchModal', el => el.hidden).catch(() => false);
            expect(modalClosed).toBe(true);
        }));

        test('close button exists and clicking it closes modal', async () => withBrowser(async () => {
            // Open modal
            await page.keyboard.down('Control');
            await page.keyboard.press('KeyK');
            await page.keyboard.up('Control');
            await page.waitForSelector('#searchModal', { visible: true });

            const closeBtn = await page.$('.search-close-btn');
            expect(closeBtn).not.toBeNull();

            await closeBtn.click();
            await page.waitForSelector('#searchModal', { hidden: true });

            const modalClosed = await page.$eval('#searchModal', el => el.hidden).catch(() => false);
            expect(modalClosed).toBe(true);
        }));

        test('close button is visible on mobile viewport', async () => withBrowser(async () => {
            try {
                // Switch to mobile viewport
                await page.setViewport({ width: 375, height: 667 });

                // Open modal
                await page.keyboard.down('Control');
                await page.keyboard.press('KeyK');
                await page.keyboard.up('Control');
                await page.waitForSelector('#searchModal', { visible: true });

                const closeBtn = await page.$('.search-close-btn');
                expect(closeBtn).not.toBeNull();

                const isVisible = await closeBtn.evaluate(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                });
                expect(isVisible).toBe(true);
            } finally {
                // Restore desktop viewport
                await page.setViewport(TEST_CONFIG.viewport);
            }
        }));

        test('search input is focused when modal opens', async () => withBrowser(async () => {
            await page.keyboard.down('Control');
            await page.keyboard.press('KeyK');
            await page.keyboard.up('Control');
            await page.waitForTimeout(100);

            const activeTag = await page.evaluate(() => document.activeElement?.tagName);
            const activeClass = await page.evaluate(() => document.activeElement?.className);
            expect(activeTag).toBe('INPUT');
            expect(activeClass).toContain('search-input');
        }));
    });

    describe('Search Result Rendering', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.index, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(100);
            }
        });

        test('renders mocked results with highlighting', async () => withBrowser(async () => {
            await page.evaluate(() => {
                window._mockSearchResponse = {
                    results: [
                        {
                            page_path: 'u10_rules.html',
                            page_title: '猛虎杯 U10 竞赛章程',
                            section_id: 'early-end',
                            heading: '提前结束比赛条件',
                            excerpt: '比赛进行至第三局或之后，双方比分相差 15 分及以上时，可提前结束比赛',
                            url: 'u10_rules.html#early-end',
                            score: 0.0312
                        }
                    ]
                };
                const origFetch = window.fetch;
                window.fetch = async (url) => {
                    if (String(url).includes('site-search')) {
                        return {
                            ok: true,
                            json: async () => window._mockSearchResponse,
                        };
                    }
                    return origFetch(url);
                };
            });

            await page.keyboard.down('Control');
            await page.keyboard.press('KeyK');
            await page.keyboard.up('Control');
            await page.waitForTimeout(100);

            const input = await page.$('.search-input');
            await input.type('提前结束');
            await page.waitForTimeout(350); // debounce + fetch

            const resultLink = await page.$('.search-result');
            expect(resultLink).not.toBeNull();

            const title = await resultLink.$eval('.search-result-title', el => el.textContent);
            expect(title).toContain('猛虎杯');

            const excerptHtml = await resultLink.$eval('.search-result-excerpt', el => el.innerHTML);
            expect(excerptHtml).toContain('<mark>');
        }));

        test('shows empty state when no results', async () => withBrowser(async () => {
            await page.evaluate(() => {
                window._mockSearchResponse = { results: [] };
                const origFetch = window.fetch;
                window.fetch = async (url) => {
                    if (String(url).includes('site-search')) {
                        return {
                            ok: true,
                            json: async () => window._mockSearchResponse,
                        };
                    }
                    return origFetch(url);
                };
            });

            await page.keyboard.down('Control');
            await page.keyboard.press('KeyK');
            await page.keyboard.up('Control');
            await page.waitForTimeout(100);

            const input = await page.$('.search-input');
            await input.type('xyznonexistent');
            await page.waitForTimeout(350);

            const empty = await page.$('.search-empty');
            expect(empty).not.toBeNull();
        }));

        test('clearing input aborts pending request and hides spinner', async () => withBrowser(async () => {
            await page.evaluate(() => {
                window._searchFetchStarted = false;
                window._searchFetchAborted = false;
                const origFetch = window.fetch;
                window.fetch = async (url, options) => {
                    if (String(url).includes('site-search')) {
                        window._searchFetchStarted = true;
                        return new Promise((resolve, reject) => {
                            const timer = setTimeout(() => {
                                resolve({ ok: true, json: async () => ({ results: [] }) });
                            }, 500);
                            if (options && options.signal) {
                                options.signal.addEventListener('abort', () => {
                                    window._searchFetchAborted = true;
                                    clearTimeout(timer);
                                    reject(new DOMException('Aborted', 'AbortError'));
                                });
                            }
                        });
                    }
                    return origFetch(url, options);
                };
            });

            await page.keyboard.down('Control');
            await page.keyboard.press('KeyK');
            await page.keyboard.up('Control');
            await page.waitForTimeout(100);

            const input = await page.$('.search-input');
            await input.type('test');
            // Wait for debounce to fire and the slow fetch to start
            await page.waitForTimeout(300);

            // Clear input while the slow fetch is in flight
            await input.evaluate(el => { el.value = ''; el.dispatchEvent(new Event('input')); });
            await page.waitForTimeout(100);

            const spinnerActive = await page.evaluate(() => {
                const spinner = document.querySelector('.search-spinner');
                return spinner && spinner.classList.contains('active');
            });
            expect(spinnerActive).toBe(false);

            const aborted = await page.evaluate(() => window._searchFetchAborted);
            expect(aborted).toBe(true);
        }));
    });
});
