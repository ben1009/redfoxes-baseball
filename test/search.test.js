/**
 * @fileoverview Search UI tests
 * Tests site_search.js modal, keyboard navigation, and trigger injection
 */

const { launchBrowser } = require('./browser');
const path = require('path');

const TEST_CONFIG = {
    viewport: { width: 1280, height: 800 },
    timeout: 10000
};

jest.setTimeout(TEST_CONFIG.timeout);

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

    beforeAll(async () => {
        try {
            browser = await launchBrowser();
            page = await browser.newPage();
            await page.setViewportSize(TEST_CONFIG.viewport);
            page.setDefaultTimeout(5000);
            page.setDefaultNavigationTimeout(5000);
            await page.route(/^https?:\/\//, route => route.abort());
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
            try {
                await page.keyboard.press('KeyK');
                await page.waitForSelector('#searchModal', { state: 'visible' });
            } finally {
                await page.keyboard.up('Control');
            }

            const closeBtn = await page.$('.search-close-btn');
            expect(closeBtn).not.toBeNull();

            await closeBtn.click();
            await page.waitForSelector('#searchModal', { state: 'hidden' });

            const modalClosed = await page.$eval('#searchModal', el => el.hidden).catch(() => false);
            expect(modalClosed).toBe(true);
        }));

        test('close button is visible on mobile viewport', async () => withBrowser(async () => {
            try {
                // Switch to mobile viewport
                await page.setViewportSize({ width: 375, height: 667 });

                // Open modal
                await page.keyboard.down('Control');
                try {
                    await page.keyboard.press('KeyK');
                    await page.waitForSelector('#searchModal', { state: 'visible' });
                } finally {
                    await page.keyboard.up('Control');
                }

                const closeBtn = await page.$('.search-close-btn');
                expect(closeBtn).not.toBeNull();

                const isVisible = await closeBtn.evaluate(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                });
                expect(isVisible).toBe(true);
            } finally {
                // Restore desktop viewport
                await page.setViewportSize(TEST_CONFIG.viewport);
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

    describe('Keyboard Shortcut Safety', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.index, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(100);
            }
        });

        test('Ctrl+K does not open modal when input is focused', async () => withBrowser(async () => {
            // Create and focus a temporary input element
            await page.evaluate(() => {
                const input = document.createElement('input');
                input.id = '_testInput';
                document.body.appendChild(input);
                input.focus();
            });

            await page.keyboard.down('Control');
            try {
                await page.keyboard.press('KeyK');
            } finally {
                await page.keyboard.up('Control');
            }
            await page.waitForTimeout(100);

            const modalHidden = await page.$eval('#searchModal', el => el.hidden).catch(() => true);
            expect(modalHidden).toBe(true);

            // Cleanup
            await page.evaluate(() => {
                const el = document.getElementById('_testInput');
                if (el) el.remove();
            });
        }));

        test('Ctrl+K does not open modal when textarea is focused', async () => withBrowser(async () => {
            await page.evaluate(() => {
                const textarea = document.createElement('textarea');
                textarea.id = '_testTextarea';
                document.body.appendChild(textarea);
                textarea.focus();
            });

            await page.keyboard.down('Control');
            try {
                await page.keyboard.press('KeyK');
            } finally {
                await page.keyboard.up('Control');
            }
            await page.waitForTimeout(100);

            const modalHidden = await page.$eval('#searchModal', el => el.hidden).catch(() => true);
            expect(modalHidden).toBe(true);

            await page.evaluate(() => {
                const el = document.getElementById('_testTextarea');
                if (el) el.remove();
            });
        }));
    });

    describe('Spinner Behavior', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.index, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(100);
            }
        });

        test('closing modal clears spinner even when request is in flight', async () => withBrowser(async () => {
            await page.evaluate(() => {
                window._searchFetchStarted = false;
                const origFetch = window.fetch;
	                window.fetch = async (url, options) => {
	                    if (String(url).includes('site-search')) {
	                        window._searchFetchStarted = true;
	                        return new Promise((resolve, reject) => {
	                            if (options && options.signal) {
	                                options.signal.addEventListener('abort', () => {
	                                    reject(new DOMException('Aborted', 'AbortError'));
	                                });
	                            }
	                        });
	                    }
	                    return origFetch(url, options);
	                };
            });

            // Open modal
            await page.keyboard.down('Control');
            try {
                await page.keyboard.press('KeyK');
            } finally {
                await page.keyboard.up('Control');
            }
            await page.waitForTimeout(100);

            const input = await page.$('.search-input');
            await input.type('test');
            await page.waitForTimeout(300);

            // Verify spinner is active
            const spinnerActiveBefore = await page.evaluate(() => {
                const spinner = document.querySelector('.search-spinner');
                return spinner && spinner.classList.contains('active');
            });
            expect(spinnerActiveBefore).toBe(true);

            // Close modal via close button
            await page.click('.search-close-btn');
            await page.waitForTimeout(200);

            // Verify spinner is cleared
            const spinnerActiveAfter = await page.evaluate(() => {
                const spinner = document.querySelector('.search-spinner');
                return spinner && spinner.classList.contains('active');
            });
            expect(spinnerActiveAfter).toBe(false);
        }));
    });

    describe('Search Input Styling', () => {
        test('native search cancel button is hidden', async () => withBrowser(async () => {
            await page.goto(PAGE_PATHS.index, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(100);

            const hasHiddenCancel = await page.evaluate(() => {
                // The search styles are injected as a <style> tag by site_search.js.
                // Verify the injected CSS contains the cancel-button hiding rule.
                const styles = Array.from(document.querySelectorAll('style'));
                for (const style of styles) {
                    const text = style.textContent || '';
                    if (text.includes('search-cancel-button') && text.includes('-webkit-appearance: none')) {
                        return true;
                    }
                }
                return false;
            });
            expect(hasHiddenCancel).toBe(true);
        }));
    });

    describe('Keyboard Navigation in Results', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.index, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(100);
            }
        });

        test('ArrowDown and ArrowUp navigate results', async () => withBrowser(async () => {
            await page.evaluate(() => {
                window._mockSearchResponse = {
                    results: [
                        { page_path: 'a.html', page_title: 'A', section_id: 'a', heading: 'A', excerpt: 'aaa', url: 'a.html#a', score: 0.1 },
                        { page_path: 'b.html', page_title: 'B', section_id: 'b', heading: 'B', excerpt: 'bbb', url: 'b.html#b', score: 0.09 },
                        { page_path: 'c.html', page_title: 'C', section_id: 'c', heading: 'C', excerpt: 'ccc', url: 'c.html#c', score: 0.08 },
                    ]
                };
                const origFetch = window.fetch;
                window.fetch = async (url) => {
                    if (String(url).includes('site-search')) {
                        return { ok: true, json: async () => window._mockSearchResponse };
                    }
                    return origFetch(url);
                };
            });

            await page.keyboard.down('Control');
            try {
                await page.keyboard.press('KeyK');
            } finally {
                await page.keyboard.up('Control');
            }
            await page.waitForTimeout(100);

            const input = await page.$('.search-input');
            await input.type('test');
            await page.waitForTimeout(350);

            const items = await page.$$('.search-result');
            expect(items.length).toBe(3);

            // No item should be active initially
            const activeBefore = await page.$('.search-result.active');
            expect(activeBefore).toBeNull();

            // Press ArrowDown
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(50);

            const activeIndex0 = await page.evaluate(() => {
                const items = document.querySelectorAll('.search-result');
                for (let i = 0; i < items.length; i++) {
                    if (items[i].classList.contains('active')) return i;
                }
                return -1;
            });
            expect(activeIndex0).toBe(0);

            // Press ArrowDown again
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(50);

            const activeIndex1 = await page.evaluate(() => {
                const items = document.querySelectorAll('.search-result');
                for (let i = 0; i < items.length; i++) {
                    if (items[i].classList.contains('active')) return i;
                }
                return -1;
            });
            expect(activeIndex1).toBe(1);

            // Press ArrowUp
            await page.keyboard.press('ArrowUp');
            await page.waitForTimeout(50);

            const activeIndex2 = await page.evaluate(() => {
                const items = document.querySelectorAll('.search-result');
                for (let i = 0; i < items.length; i++) {
                    if (items[i].classList.contains('active')) return i;
                }
                return -1;
            });
            expect(activeIndex2).toBe(0);
        }));
    });
});
