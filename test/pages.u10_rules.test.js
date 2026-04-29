const { PAGE_PATHS, TEST_CONFIG, createPageHarness } = require('./pages.shared');

jest.setTimeout(TEST_CONFIG.timeout);

const harness = createPageHarness(PAGE_PATHS.rules);

describe('U10 Rules Page (u10_rules.html)', () => {
    beforeAll(harness.setup, TEST_CONFIG.timeout);
    afterAll(harness.teardown);

    beforeEach(async () => {
        if (!harness.browserLaunchError) {
            await harness.loadPage();
        }
    });

    test('should have correct page title', async () => harness.withBrowser(async () => {
        const title = await harness.page.title();
        expect(title).toContain('猛虎杯');
        expect(title).toContain('U10');
    }));

    test('should have sticky navigation', async () => harness.withBrowser(async () => {
        const nav = await harness.page.$('.page-nav');
        expect(nav).not.toBeNull();

        const navLinks = await harness.page.$$('.nav-link');
        expect(navLinks.length).toBeGreaterThan(5);
    }));

    test('should have tournament schedule section', async () => harness.withBrowser(async () => {
        const scheduleSection = await harness.page.$('#schedule');
        expect(scheduleSection).not.toBeNull();
    }));

    test('should have image containers with lightbox functionality', async () => harness.withBrowser(async () => {
        const imageContainers = await harness.page.$$('.image-container');
        expect(imageContainers.length).toBeGreaterThan(0);

        const modal = await harness.page.$('#imageModal');
        expect(modal).not.toBeNull();
    }));

    test('should support keyboard access for shared lightbox images', async () => harness.withBrowser(async () => {
        const imageState = await harness.page.evaluate(() => {
            const image = document.querySelector('.image-container img');
            const modal = document.getElementById('imageModal');
            const modalImage = document.getElementById('modalImage');

            if (!image || !modal || !modalImage) {
                return null;
            }

            image.focus();
            image.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true
            }));

            const opened = modal.classList.contains('active');
            const modalSrc = modalImage.getAttribute('src');

            document.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true
            }));

            return {
                tabIndex: image.getAttribute('tabindex'),
                role: image.getAttribute('role'),
                opened,
                modalSrc
            };
        });

        expect(imageState).not.toBeNull();
        expect(imageState.tabIndex).toBe('0');
        expect(imageState.role).toBe('button');
        expect(imageState.opened).toBe(true);
        expect(imageState.modalSrc).toContain('img/');
    }));

    test('should have key metrics cards', async () => harness.withBrowser(async () => {
        const metricCards = await harness.page.$$('.metric-card');
        expect(metricCards.length).toBeGreaterThan(0);
    }));
});
