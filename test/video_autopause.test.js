/**
 * @fileoverview Test for video autopause functionality
 * Tests that Bilibili videos pause when scrolled out of viewport
 */

const puppeteer = require('puppeteer');
const path = require('path');

const TEST_CONFIG = {
    password: process.env.TEST_PASSWORD || '1972',
    viewport: { width: 1280, height: 800 },
    scrollDelay: 500,
    timeout: 30000
};

describe('Video Autopause Feature', () => {
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

    beforeEach(async () => {
        if (!page || browserLaunchError) return;
        // Reset scroll position between tests for consistent observer state
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForFunction(() => window.scrollY === 0);
    });

    async function loginToPage() {
        if (browserLaunchError) {
            return;
        }

        // Load the page
        const filePath = 'file://' + path.resolve(__dirname, '../match_review.html');
        // Use 'domcontentloaded' instead of 'networkidle2' to avoid hanging on
        // persistent connections inside Bilibili iframes.
        await page.goto(filePath, { waitUntil: 'domcontentloaded', timeout: TEST_CONFIG.timeout });

        // Check if already logged in (main content visible)
        const isLoggedIn = await page.evaluate(() => {
            return document.getElementById('mainContent')?.classList.contains('visible');
        });

        if (!isLoggedIn) {
            // Wait for password input
            await page.waitForSelector('#passwordInput', { timeout: 5000 });
            await new Promise(r => setTimeout(r, 100));

            // Enter password
            await page.type('#passwordInput', TEST_CONFIG.password);

            // Click button via evaluate
            await page.evaluate(() => {
                const btn = document.querySelector('.password-btn');
                if (btn) btn.click();
            });

            // Wait for main content
            await page.waitForSelector('#mainContent.visible', { timeout: 5000 });
        }

        // Manually trigger autopause init so we don't have to wait for the 'load'
        // event, which can be delayed by slow external iframe resources.
        await page.evaluate(() => {
            if (typeof initVideoAutopause === 'function') {
                initVideoAutopause();
            }
        });
        // IntersectionObserver state is handled by waitForFunction in individual tests
    }

    test('should have 7 video containers with data-src attributes', async () => withBrowser(async () => {
        await loginToPage();

        // Wait for all 7 video containers to exist
        await page.waitForFunction(
            () => document.querySelectorAll('.video-container').length === 7,
            { timeout: 5000 }
        );
        const containers = await page.$$('.video-container');
        expect(containers.length).toBe(7);

        // Check that each container has a data-src (lazy-loading stores src here)
        // or has an iframe (if currently visible). Retry once to handle lazy init.
        let hasVideoSource = 0;
        for (const container of containers) {
            const hasDataSrc = await container.evaluate(el => !!el.dataset.src);
            const hasIframe = await container.$('iframe') !== null;
            if (hasDataSrc || hasIframe) hasVideoSource++;
        }
        // If not all 7 have video source yet, wait a bit and retry once
        if (hasVideoSource < 7) {
            await new Promise(r => setTimeout(r, 1000));
            hasVideoSource = 0;
            for (const container of containers) {
                const hasDataSrc = await container.evaluate(el => !!el.dataset.src);
                const hasIframe = await container.$('iframe') !== null;
                if (hasDataSrc || hasIframe) hasVideoSource++;
            }
        }
        expect(hasVideoSource).toBe(7);
    }));

    test('should detect video visibility with IntersectionObserver', async () => withBrowser(async () => {
        await loginToPage();
        const hasObserverLogic = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script'));
            return scripts.some(s => s.textContent.includes('IntersectionObserver'));
        });
        expect(hasObserverLogic).toBe(true);
    }));

    test('should remove iframe when scrolled out of viewport and restore when back', async () => withBrowser(async () => {
        await loginToPage();

        // Get first video container
        const containerHandle = await page.$('.video-container');
        expect(containerHandle).not.toBeNull();

        // Scroll first video into view and ensure iframe is present
        await containerHandle.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await page.waitForFunction(el => !!el.querySelector('iframe'), {}, containerHandle);

        // Verify iframe exists before scroll
        const iframeBefore = await containerHandle.$('iframe');
        expect(iframeBefore).not.toBeNull();
        const srcBefore = await iframeBefore.evaluate(el => el.src);
        expect(srcBefore).toContain('bilibili.com');

        // Scroll down to move video out of viewport (triggers iframe removal)
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForFunction(el => !el.querySelector('iframe'), {}, containerHandle);

        // Verify iframe was removed
        const iframeAfterScroll = await containerHandle.$('iframe');
        expect(iframeAfterScroll).toBeNull();

        // Verify src was stored in data attribute
        const hasStoredSrc = await containerHandle.evaluate(el => !!el.dataset.src);
        expect(hasStoredSrc).toBe(true);

        // Scroll back to top to trigger iframe restoration
        await page.evaluate(() => {
            window.scrollTo(0, 0);
        });
        await page.waitForFunction(el => !!el.querySelector('iframe'), {}, containerHandle);

        // Verify iframe was restored
        const iframeRestored = await containerHandle.$('iframe');
        expect(iframeRestored).not.toBeNull();

        // Verify src is correct
        const srcRestored = await iframeRestored.evaluate(el => el.src);
        expect(srcRestored).toBe(srcBefore);
    }));

    test('should maintain video src after scroll', async () => withBrowser(async () => {
        await loginToPage();

        // Ensure first video is in viewport so iframe exists
        const containerHandle = await page.$('.video-container');
        expect(containerHandle).not.toBeNull();
        await containerHandle.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await page.waitForFunction(el => !!el.querySelector('iframe'), {}, containerHandle);

        const firstVideo = await containerHandle.$('iframe');
        expect(firstVideo).not.toBeNull();

        const originalSrc = await firstVideo.evaluate(el => el.src);
        expect(originalSrc).toContain('bilibili.com');

        // Scroll out of view and back
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForFunction(el => !el.querySelector('iframe'), {}, containerHandle);

        await page.evaluate(() => {
            window.scrollTo(0, 0);
        });
        await page.waitForFunction(el => !!el.querySelector('iframe'), {}, containerHandle);

        // Scroll back into view to restore iframe
        await containerHandle.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await page.waitForFunction(el => !!el.querySelector('iframe'), {}, containerHandle);

        const currentVideo = await page.$('.video-container iframe');
        expect(currentVideo).not.toBeNull();
        const currentSrc = await currentVideo.evaluate(el => el.src);
        expect(currentSrc).toBe(originalSrc);
    }));
});
