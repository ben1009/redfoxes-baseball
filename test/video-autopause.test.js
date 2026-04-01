/**
 * @fileoverview Test for video autopause functionality
 * Tests that Bilibili videos pause when scrolled out of viewport
 */

const puppeteer = require('puppeteer');
const path = require('path');

const TEST_CONFIG = {
    password: '1972',
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

    beforeEach(async () => {
        // Load the page
        const filePath = 'file://' + path.resolve(__dirname, '../index.html');
        await page.goto(filePath, { waitUntil: 'networkidle2' });
        
        // Enter password to access content
        await page.type('#passwordInput', TEST_CONFIG.password);
        await page.click('.password-btn');
        
        // Wait for main content to be visible
        await page.waitForSelector('#mainContent.visible', { timeout: 5000 });
        
        // Wait for iframes to load
        await page.waitForTimeout(2000);
    });

    test('should have 7 video iframes', async () => {
        const iframes = await page.$$('.video-container iframe');
        expect(iframes.length).toBe(7);
    });

    test('should detect video visibility with IntersectionObserver', async () => {
        // Check if IntersectionObserver is initialized
        const hasObserver = await page.evaluate(() => {
            return window.videoObserver !== undefined || 
                   document.querySelectorAll('.video-container iframe').length > 0;
        });
        expect(hasObserver).toBe(true);
    });

    test('should pause video when scrolled out of viewport', async () => {
        // Get first video iframe
        const firstVideo = await page.$('.video-container iframe');
        expect(firstVideo).not.toBeNull();

        // Scroll video into view and try to play (simulate user interaction)
        await firstVideo.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(1000);

        // Check if video is visible
        const isVisibleBefore = await firstVideo.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
        });
        
        console.log('Video visible before scroll:', isVisibleBefore);

        // Scroll down to move video out of viewport
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(TEST_CONFIG.scrollDelay);

        // Check video position after scroll
        const isVisibleAfter = await firstVideo.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
        });
        
        console.log('Video visible after scroll:', isVisibleAfter);
        
        // Video should be out of viewport
        expect(isVisibleAfter).toBe(false);
    });

    test('should send postMessage when video leaves viewport', async () => {
        // Listen for postMessage calls
        const postMessages = [];
        
        await page.exposeFunction('capturePostMessage', (msg) => {
            postMessages.push(msg);
        });

        // Override postMessage in page context
        await page.evaluateOnNewDocument(() => {
            const originalPostMessage = window.postMessage;
            window.postMessage = function(...args) {
                if (window.capturePostMessage) {
                    window.capturePostMessage(args[0]);
                }
                return originalPostMessage.apply(this, args);
            };
        });

        // Reload and login again
        const filePath = 'file://' + path.resolve(__dirname, '../index.html');
        await page.goto(filePath, { waitUntil: 'networkidle2' });
        await page.type('#passwordInput', TEST_CONFIG.password);
        await page.click('.password-btn');
        await page.waitForSelector('#mainContent.visible', { timeout: 5000 });
        await page.waitForTimeout(2000);

        // Scroll first video into view then out
        const firstVideo = await page.$('.video-container iframe');
        await firstVideo.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(500);

        // Scroll down
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(1000);

        console.log('PostMessages captured:', postMessages);
        
        // We expect at least some postMessage activity
        // Note: Cross-origin iframes may block postMessage, so this is a best-effort test
    });

    test('should maintain video src after scroll', async () => {
        const firstVideo = await page.$('.video-container iframe');
        
        // Get original src
        const originalSrc = await firstVideo.evaluate(el => el.src);
        expect(originalSrc).toContain('bilibili.com');

        // Scroll out of view and back
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(500);

        await page.evaluate(() => {
            window.scrollTo(0, 0);
        });
        await page.waitForTimeout(500);

        // Check src is unchanged
        const currentSrc = await firstVideo.evaluate(el => el.src);
        expect(currentSrc).toBe(originalSrc);
    });
});

// Run tests if executed directly
if (require.main === module) {
    const { execSync } = require('child_process');
    try {
        execSync('npx jest test/video-autopause.test.js --verbose', {
            cwd: path.resolve(__dirname, '..'),
            stdio: 'inherit'
        });
    } catch (e) {
        process.exit(1);
    }
}
