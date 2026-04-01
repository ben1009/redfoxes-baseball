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

    beforeAll(async () => {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        await page.setViewport(TEST_CONFIG.viewport);
    }, TEST_CONFIG.timeout);

    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
    });

    async function loginToPage() {
        // Load the page
        const filePath = 'file://' + path.resolve(__dirname, '../index.html');
        await page.goto(filePath, { waitUntil: 'networkidle2' });
        
        // Check if already logged in (main content visible)
        const isLoggedIn = await page.evaluate(() => {
            return document.getElementById('mainContent')?.classList.contains('visible');
        });
        
        if (!isLoggedIn) {
            // Wait for password input
            await page.waitForSelector('#passwordInput', { timeout: 5000 });
            await page.waitForTimeout(100);
            
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
        
        // Wait for iframes
        await page.waitForTimeout(2000);
    }

    test('should have 7 video containers with iframes initially', async () => {
        await loginToPage();
        // Scroll to top to ensure all iframes are loaded (lazy-loading may have removed some)
        await page.evaluate(() => window.scrollTo(0, 0));
        await new Promise(r => setTimeout(r, 1000));
        
        const iframes = await page.$$('.video-container iframe');
        expect(iframes.length).toBe(7);
    });

    test('should detect video visibility with IntersectionObserver', async () => {
        await loginToPage();
        const hasObserverLogic = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script'));
            return scripts.some(s => s.textContent.includes('IntersectionObserver'));
        });
        expect(hasObserverLogic).toBe(true);
    });

    test('should remove iframe when scrolled out of viewport and restore when back', async () => {
        await loginToPage();
        
        // Wait for autopause to initialize
        await new Promise(r => setTimeout(r, 1500));

        // Get first video container
        const containerHandle = await page.$('.video-container');
        
        // Scroll first video into view
        await containerHandle.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await new Promise(r => setTimeout(r, 500));

        // Verify iframe exists before scroll
        const iframeBefore = await containerHandle.$('iframe');
        expect(iframeBefore).not.toBeNull();
        const srcBefore = await iframeBefore.evaluate(el => el.src);
        expect(srcBefore).toContain('bilibili.com');

        // Scroll down to move video out of viewport (triggers iframe removal)
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await new Promise(r => setTimeout(r, 800));

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
        await new Promise(r => setTimeout(r, 800));

        // Verify iframe was restored
        const iframeRestored = await containerHandle.$('iframe');
        expect(iframeRestored).not.toBeNull();
        
        // Verify src is correct
        const srcRestored = await iframeRestored.evaluate(el => el.src);
        expect(srcRestored).toBe(srcBefore);
    });

    test('should maintain video src after scroll', async () => {
        await loginToPage();
        const firstVideo = await page.$('.video-container iframe');
        
        const originalSrc = await firstVideo.evaluate(el => el.src);
        expect(originalSrc).toContain('bilibili.com');

        // Scroll out of view and back
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await new Promise(r => setTimeout(r, 500));

        await page.evaluate(() => {
            window.scrollTo(0, 0);
        });
        await new Promise(r => setTimeout(r, 500));

        const currentSrc = await firstVideo.evaluate(el => el.src);
        expect(currentSrc).toBe(originalSrc);
    });
});
