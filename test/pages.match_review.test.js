const { PAGE_PATHS, TEST_CONFIG, createPageHarness } = require('./pages.shared');

jest.setTimeout(TEST_CONFIG.timeout);

const harness = createPageHarness(PAGE_PATHS.matchReview);

describe('Match Review Page (match_review.html)', () => {
    beforeAll(harness.setup, TEST_CONFIG.timeout);
    afterAll(harness.teardown);

    beforeEach(async () => {
        if (!harness.browserLaunchError) {
            await harness.loadPage();
        }
    });

    test('should have password protection overlay', async () => harness.withBrowser(async () => {
        const passwordOverlay = await harness.page.$('#passwordOverlay');
        expect(passwordOverlay).not.toBeNull();

        const passwordInput = await harness.page.$('#passwordInput');
        expect(passwordInput).not.toBeNull();
    }));

    test('should unlock content with correct password', async () => harness.withBrowser(async () => {
        await harness.page.type('#passwordInput', TEST_CONFIG.password);
        await harness.page.evaluate(() => {
            const btn = document.querySelector('.password-btn');
            if (btn) btn.click();
        });
        await harness.page.waitForSelector('#mainContent.visible', { timeout: 5000 });

        const mainContent = await harness.page.$('#mainContent');
        expect(mainContent).not.toBeNull();
    }));

    test('should have 7 video cards after unlock', async () => harness.withBrowser(async () => {
        await harness.page.type('#passwordInput', TEST_CONFIG.password);
        await harness.page.evaluate(() => {
            const btn = document.querySelector('.password-btn');
            if (btn) btn.click();
        });
        await harness.page.waitForSelector('#mainContent.visible', { timeout: 5000 });

        const videoCards = await harness.page.$$('.video-card');
        expect(videoCards.length).toBe(7);
    }));

    test('should show centered home link in header below match info after unlock', async () => harness.withBrowser(async () => {
        await harness.page.type('#passwordInput', TEST_CONFIG.password);
        await harness.page.evaluate(() => {
            const btn = document.querySelector('.password-btn');
            if (btn) btn.click();
        });
        await harness.page.waitForSelector('#mainContent.visible', { timeout: 5000 });

        const headerLayout = await harness.page.evaluate(() => {
            const header = document.querySelector('#mainContent header');
            const matchInfo = header?.querySelector('.match-info');
            const homeLink = header?.querySelector('.home-link');

            if (!header || !matchInfo || !homeLink) {
                return null;
            }

            const headerStyle = window.getComputedStyle(header);
            const homeLinkStyle = window.getComputedStyle(homeLink);

            return {
                href: homeLink.getAttribute('href'),
                target: homeLink.getAttribute('target'),
                text: homeLink.textContent.trim(),
                isInHeader: homeLink.parentElement === header,
                followsMatchInfo: matchInfo.nextElementSibling === homeLink,
                headerAlign: headerStyle.textAlign,
                homeLinkDisplay: homeLinkStyle.display
            };
        });

        expect(headerLayout).not.toBeNull();
        expect(headerLayout.href).toBe('index.html');
        expect(headerLayout.target).toBe('_self');
        expect(headerLayout.text).toContain('返回首页');
        expect(headerLayout.isInHeader).toBe(true);
        expect(headerLayout.followsMatchInfo).toBe(true);
        expect(headerLayout.headerAlign).toBe('center');
        expect(headerLayout.homeLinkDisplay).toBe('inline-flex');
    }));

    test('should have Google Analytics', async () => harness.withBrowser(async () => {
        const hasGA = await harness.page.evaluate(() => {
            return typeof gtag === 'function' ||
                document.querySelector('script[src*="googletagmanager"]') !== null;
        });
        expect(hasGA).toBe(true);
    }));
});
