const { PAGE_PATHS, TEST_CONFIG, createPageHarness } = require('./pages.shared');

jest.setTimeout(TEST_CONFIG.timeout);

const harness = createPageHarness(PAGE_PATHS.sponsor);

async function waitForSponsorCount() {
    await harness.page.waitForFunction(() => {
        const countEl = document.querySelector('.like-count');
        return countEl && /^\d+$/.test(countEl.textContent);
    }, undefined, { timeout: 5000 });
}

async function resetSponsorState() {
    await harness.page.evaluate(() => {
        localStorage.removeItem('sponsor_me_liked_v1');
        localStorage.removeItem('sponsor_me_count_fallback');
    });
    await harness.loadPage();
}

describe('Sponsor Page (sponsor_me.html)', () => {
    beforeAll(harness.setup, TEST_CONFIG.timeout);
    afterAll(harness.teardown);

    beforeEach(async () => {
        if (!harness.browserLaunchError) {
            await harness.loadPage();
        }
    });

    test('should have correct page title', async () => harness.withBrowser(async () => {
        const title = await harness.page.title();
        expect(title).toContain('赞助赤狐');
    }));

    test('should show sponsor qr code and CTA copy', async () => harness.withBrowser(async () => {
        const qrImage = await harness.page.$('img[src*="sponsor_me.png"]');
        expect(qrImage).not.toBeNull();

        const qrCaption = await harness.page.$('.qr-caption');
        expect(qrCaption).not.toBeNull();

        const qrText = await qrCaption.evaluate(el => el.textContent);
        expect(qrText).toContain('扫码进入赤狐补给站');
    }));

    test('should render support offer cards', async () => harness.withBrowser(async () => {
        const offerCards = await harness.page.$$('.offer-card');
        expect(offerCards.length).toBe(3);

        const offerTitles = await harness.page.$$eval('.offer-card h2', nodes =>
            nodes.map(node => node.textContent.trim())
        );
        expect(offerTitles).toEqual(
            expect.arrayContaining(['一颗球计划', '加餐暴击包', '记录后勤补给包'])
        );
    }));

    test('should provide a zoom modal for sponsor item images', async () => harness.withBrowser(async () => {
        const zoomableImages = await harness.page.$$('[data-zoomable]');
        expect(zoomableImages.length).toBe(3);

        const modal = await harness.page.$('#imageModal');
        expect(modal).not.toBeNull();

        const zoomableAccessibility = await harness.page.$$eval('[data-zoomable]', (images) =>
            images.map((img) => ({
                tabindex: img.getAttribute('tabindex'),
                role: img.getAttribute('role'),
            }))
        );
        zoomableAccessibility.forEach((img) => {
            expect(img.tabindex).toBe('0');
            expect(img.role).toBe('button');
        });
    }));

    test('should open and close the sponsor image zoom modal', async () => harness.withBrowser(async () => {
        const firstZoomableImage = await harness.page.$('[data-zoomable]');
        expect(firstZoomableImage).not.toBeNull();

        const expectedSrc = await firstZoomableImage.evaluate((img) => img.src);
        await firstZoomableImage.click();

        await harness.page.waitForSelector('#imageModal.open');

        const modalImageSrc = await harness.page.$eval('#imageModalImg', (img) => img.src);
        expect(modalImageSrc).toBe(expectedSrc);

        await harness.page.click('#imageModalClose');

        const modalIsOpen = await harness.page.$eval('#imageModal', (modal) =>
            modal.classList.contains('open')
        );
        expect(modalIsOpen).toBe(false);
    }));

    test('should support keyboard zoom access and restore focus after closing', async () => harness.withBrowser(async () => {
        await harness.page.focus('[data-zoomable]');
        await harness.page.keyboard.press('Enter');

        await harness.page.waitForSelector('#imageModal.open');

        const activeElementId = await harness.page.evaluate(() => document.activeElement.id);
        expect(activeElementId).toBe('imageModalClose');

        const bodyOverflow = await harness.page.evaluate(() => document.body.style.overflow);
        expect(bodyOverflow).toBe('hidden');

        await harness.page.keyboard.press('Escape');

        const modalIsOpen = await harness.page.$eval('#imageModal', (modal) =>
            modal.classList.contains('open')
        );
        expect(modalIsOpen).toBe(false);

        const focusedZoomableSrc = await harness.page.evaluate(() => document.activeElement.getAttribute('src'));
        expect(focusedZoomableSrc).toBe('./img/350.png');

        const restoredBodyOverflow = await harness.page.evaluate(() => document.body.style.overflow);
        expect(restoredBodyOverflow).toBe('');
    }));

    test('should render all 16 floating background stickers', async () => harness.withBrowser(async () => {
        const floatingStickers = await harness.page.$$('.floating-sticker');
        expect(floatingStickers.length).toBe(16);

        const stickerSources = await harness.page.$$eval('.floating-sticker img', nodes =>
            nodes.map(node => node.getAttribute('src'))
        );
        expect(stickerSources).toContain('./img/01_homerun.png');
        expect(stickerSources).toContain('./img/16_champion.png');
    }));

    test('should include sticker rally and timeline sections', async () => harness.withBrowser(async () => {
        const rallyCards = await harness.page.$$('.sticker-card');
        expect(rallyCards.length).toBe(3);

        const timelineItems = await harness.page.$$('.timeline li');
        expect(timelineItems.length).toBe(4);
    }));

    test('should not include floating baseball assets', async () => harness.withBrowser(async () => {
        const hasBaseballFloatCss = await harness.page.evaluate(() => {
            return document.querySelector('link[rel="stylesheet"][href="baseball_floats.css"]') !== null;
        });
        const hasBaseballFloatJs = await harness.page.evaluate(() => {
            return document.querySelector('script[src="baseball_floats.js"]') !== null;
        });

        expect(hasBaseballFloatCss).toBe(false);
        expect(hasBaseballFloatJs).toBe(false);
    }));

    test('should have a like widget with button and label', async () => harness.withBrowser(async () => {
        const likeWidget = await harness.page.$('.like-widget');
        expect(likeWidget).not.toBeNull();

        const likeBtn = await harness.page.$('.like-btn');
        expect(likeBtn).not.toBeNull();

        const likeCount = await harness.page.$('.like-count');
        expect(likeCount).not.toBeNull();

        const likeLabel = await harness.page.$('.like-label');
        expect(likeLabel).not.toBeNull();
    }));

    test('should show initial like count and unliked state', async () => harness.withBrowser(async () => {
        const likeBtn = await harness.page.$('.like-btn');
        const likeCount = await harness.page.$('.like-count');

        await waitForSponsorCount();

        const countText = await likeCount.evaluate(el => el.textContent);
        expect(countText).toMatch(/^\d+$/);

        const isLiked = await likeBtn.evaluate(el => el.classList.contains('liked'));
        expect(isLiked).toBe(false);

        const ariaPressed = await likeBtn.evaluate(el => el.getAttribute('aria-pressed'));
        expect(ariaPressed).toBe('false');
    }));

    test('should toggle liked state on click', async () => harness.withBrowser(async () => {
        await resetSponsorState();
        await waitForSponsorCount();

        const likeBtn = await harness.page.$('.like-btn');
        expect(likeBtn).not.toBeNull();

        let isLiked = await likeBtn.evaluate(el => el.classList.contains('liked'));
        expect(isLiked).toBe(false);

        await likeBtn.click();
        await harness.page.waitForFunction(() => {
            const btn = document.querySelector('.like-btn');
            return btn && btn.classList.contains('liked');
        }, undefined, { timeout: 5000 });

        isLiked = await likeBtn.evaluate(el => el.classList.contains('liked'));
        expect(isLiked).toBe(true);

        const ariaPressed = await likeBtn.evaluate(el => el.getAttribute('aria-pressed'));
        expect(ariaPressed).toBe('true');

        await likeBtn.click();
        await harness.page.waitForFunction(() => {
            const btn = document.querySelector('.like-btn');
            return btn && !btn.classList.contains('liked');
        }, undefined, { timeout: 5000 });

        isLiked = await likeBtn.evaluate(el => el.classList.contains('liked'));
        expect(isLiked).toBe(false);
    }));

    test('should not double-count on rapid clicks', async () => harness.withBrowser(async () => {
        await harness.page.addInitScript(() => {
            window.__testLikeCount = 0;
            const origFetch = window.fetch;
            window.fetch = async (url, opts) => {
                if (typeof url === 'string' && url.includes('sponsor-likes')) {
                    if (opts && opts.method === 'POST' && url.endsWith('/like')) {
                        window.__testLikeCount++;
                    } else if (opts && opts.method === 'POST' && url.endsWith('/unlike')) {
                        window.__testLikeCount = Math.max(0, window.__testLikeCount - 1);
                    }
                    return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                }
                return origFetch(url, opts);
            };
        });

        await resetSponsorState();
        await waitForSponsorCount();

        const likeBtn = await harness.page.$('.like-btn');
        const initialCount = parseInt(await harness.page.$eval('.like-count', el => el.textContent), 10);

        for (let i = 0; i < 5; i++) {
            await likeBtn.click();
        }

        await harness.page.waitForTimeout(1000);

        const finalCount = parseInt(await harness.page.$eval('.like-count', el => el.textContent), 10);
        expect(Math.abs(finalCount - initialCount)).toBeLessThanOrEqual(1);
    }));

    test('should persist liked state in localStorage', async () => harness.withBrowser(async () => {
        await harness.page.addInitScript(() => {
            window.__testLikeCount = 0;
            const origFetch = window.fetch;
            window.fetch = async (url, opts) => {
                if (typeof url === 'string' && url.includes('sponsor-likes')) {
                    if (opts && opts.method === 'POST' && url.endsWith('/like')) {
                        window.__testLikeCount++;
                    } else if (opts && opts.method === 'POST' && url.endsWith('/unlike')) {
                        window.__testLikeCount = Math.max(0, window.__testLikeCount - 1);
                    }
                    return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                }
                return origFetch(url, opts);
            };
        });

        await resetSponsorState();
        await waitForSponsorCount();

        const likeBtn = await harness.page.$('.like-btn');

        await likeBtn.click();
        await harness.page.waitForFunction(() => {
            const btn = document.querySelector('.like-btn');
            return btn && btn.classList.contains('liked');
        }, undefined, { timeout: 5000 });

        const stored = await harness.page.evaluate(() => localStorage.getItem('sponsor_me_liked_v1'));
        expect(stored).toBe('true');

        await harness.loadPage();
        await waitForSponsorCount();

        const reloadedBtn = await harness.page.$('.like-btn');
        const isLiked = await reloadedBtn.evaluate(el => el.classList.contains('liked'));
        expect(isLiked).toBe(true);
    }));

    test('should not toggle state on rate-limited response', async () => harness.withBrowser(async () => {
        await harness.page.addInitScript(() => {
            window.__testLikeCount = 0;
            const origFetch = window.fetch;
            window.fetch = async (url, opts) => {
                if (typeof url === 'string' && url.includes('sponsor-likes')) {
                    if (opts && opts.method === 'POST') {
                        if (url.endsWith('/like')) {
                            window.__testLikeCount++;
                            return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                        }
                        if (url.endsWith('/unlike')) {
                            return { ok: true, json: async () => ({ count: window.__testLikeCount, rateLimited: true }) };
                        }
                    }
                    return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                }
                return origFetch(url, opts);
            };
        });

        await resetSponsorState();
        await waitForSponsorCount();

        const likeBtn = await harness.page.$('.like-btn');

        expect(await likeBtn.evaluate(el => el.classList.contains('liked'))).toBe(false);

        await likeBtn.click();
        await harness.page.waitForFunction(() => {
            const btn = document.querySelector('.like-btn');
            return btn && btn.classList.contains('liked');
        }, undefined, { timeout: 5000 });
        expect(await likeBtn.evaluate(el => el.classList.contains('liked'))).toBe(true);

        await likeBtn.click();
        await harness.page.waitForTimeout(600);
        expect(await likeBtn.evaluate(el => el.classList.contains('liked'))).toBe(true);

        const countText = await harness.page.$eval('.like-count', el => el.textContent);
        expect(parseInt(countText, 10)).toBe(1);
    }));

    test('should animate only on successful like', async () => harness.withBrowser(async () => {
        await harness.page.addInitScript(() => {
            window.__testLikeCount = 0;
            window.__actionAttempts = 0;
            const origFetch = window.fetch;
            window.fetch = async (url, opts) => {
                if (typeof url === 'string' && url.includes('sponsor-likes')) {
                    if (opts && opts.method === 'POST') {
                        window.__actionAttempts++;
                        if (window.__actionAttempts === 1) {
                            window.__testLikeCount++;
                            return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                        }
                        return { ok: true, json: async () => ({ count: window.__testLikeCount, rateLimited: true }) };
                    }
                    return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                }
                return origFetch(url, opts);
            };
        });

        await resetSponsorState();
        await waitForSponsorCount();

        const likeBtn = await harness.page.$('.like-btn');

        await likeBtn.click();
        await harness.page.waitForFunction(() => {
            const btn = document.querySelector('.like-btn');
            return btn && btn.classList.contains('liked');
        }, undefined, { timeout: 5000 });

        const hadPopAfterSuccess = await harness.page.evaluate(() => {
            const icon = document.querySelector('.like-icon');
            return icon && icon.classList.contains('pop');
        });
        expect(hadPopAfterSuccess).toBe(true);

        await harness.page.waitForTimeout(300);
        await harness.page.evaluate(() => {
            const icon = document.querySelector('.like-icon');
            if (icon) icon.classList.remove('pop');
        });

        await likeBtn.click();
        await harness.page.waitForTimeout(300);

        const hasPopAfterRateLimit = await harness.page.evaluate(() => {
            const icon = document.querySelector('.like-icon');
            return icon && icon.classList.contains('pop');
        });
        expect(hasPopAfterRateLimit).toBe(false);
    }));

    test('should not animate when post falls back after API failure', async () => harness.withBrowser(async () => {
        await harness.page.addInitScript(() => {
            window.__testLikeCount = 0;
            window.__actionAttempts = 0;
            const origFetch = window.fetch;
            window.fetch = async (url, opts) => {
                if (typeof url === 'string' && url.includes('sponsor-likes')) {
                    if (opts && opts.method === 'POST') {
                        window.__actionAttempts++;
                        if (window.__actionAttempts === 1) {
                            throw new Error('network failed');
                        }
                        window.__testLikeCount = Math.max(0, window.__testLikeCount - 1);
                        return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                    }
                    return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                }
                return origFetch(url, opts);
            };
        });

        await resetSponsorState();
        await waitForSponsorCount();

        const likeBtn = await harness.page.$('.like-btn');

        await likeBtn.click();
        await harness.page.waitForFunction(() => {
            const btn = document.querySelector('.like-btn');
            return btn && btn.classList.contains('liked');
        }, undefined, { timeout: 5000 });

        const hasPopAfterFallback = await harness.page.evaluate(() => {
            const icon = document.querySelector('.like-icon');
            return icon && icon.classList.contains('pop');
        });
        expect(hasPopAfterFallback).toBe(false);

        const stored = await harness.page.evaluate(() => ({
            liked: localStorage.getItem('sponsor_me_liked_v1'),
            count: localStorage.getItem('sponsor_me_count_fallback')
        }));
        expect(stored.liked).toBe('true');
        expect(stored.count).toBe('1');
    }));

    test('should not animate when apiFailed early fallback is used', async () => harness.withBrowser(async () => {
        await harness.page.addInitScript(() => {
            window.__testLikeCount = 0;
            const origFetch = window.fetch;
            window.fetch = async (url, opts) => {
                if (typeof url === 'string' && url.includes('sponsor-likes')) {
                    if (opts && opts.method === 'POST') {
                        window.__testLikeCount++;
                        return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                    }
                    throw new Error('network failed');
                }
                return origFetch(url, opts);
            };
        });

        await resetSponsorState();
        await waitForSponsorCount();

        const likeBtn = await harness.page.$('.like-btn');

        await likeBtn.click();
        await harness.page.waitForFunction(() => {
            const btn = document.querySelector('.like-btn');
            return btn && btn.classList.contains('liked');
        }, undefined, { timeout: 5000 });

        const hasPopAfterApiFailedFallback = await harness.page.evaluate(() => {
            const icon = document.querySelector('.like-icon');
            return icon && icon.classList.contains('pop');
        });
        expect(hasPopAfterApiFailedFallback).toBe(false);

        const stored = await harness.page.evaluate(() => ({
            liked: localStorage.getItem('sponsor_me_liked_v1'),
            count: localStorage.getItem('sponsor_me_count_fallback')
        }));
        expect(stored.liked).toBe('true');
        expect(stored.count).toBe('1');
    }));
});
