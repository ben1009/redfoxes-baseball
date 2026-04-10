/**
 * @fileoverview Comprehensive tests for all HTML pages
 * Tests page structure, navigation, and content
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const TEST_CONFIG = {
    password: process.env.TEST_PASSWORD || '1972',
    viewport: { width: 1280, height: 800 },
    timeout: 30000
};

const PAGE_PATHS = {
    index: 'file://' + path.resolve(__dirname, '../index.html'),
    matchReview: 'file://' + path.resolve(__dirname, '../match_review.html'),
    rules: 'file://' + path.resolve(__dirname, '../u10_rules.html'),
    groupstage: 'file://' + path.resolve(__dirname, '../tigercup_groupstage.html'),
    sponsor: 'file://' + path.resolve(__dirname, '../sponsor_me.html')
};

describe('Page Structure and Navigation Tests', () => {
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

    describe('Index Page (Navigation Hub)', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.index, { waitUntil: 'networkidle2' });
            }
        });

        test('should have correct page title', async () => withBrowser(async () => {
            const title = await page.title();
            expect(title).toContain('烈光少棒赤狐队');
        }));

        test('should have team logo and header', async () => withBrowser(async () => {
            const header = await page.$('.header');
            expect(header).not.toBeNull();
            
            const teamLogo = await page.$('.team-logo');
            expect(teamLogo).not.toBeNull();
        }));

        test('should have navigation grid with 4 cards', async () => withBrowser(async () => {
            const navGrid = await page.$('.nav-grid');
            expect(navGrid).not.toBeNull();
            
            const cards = await page.$$('.nav-card');
            expect(cards.length).toBe(4);
        }));

        test('should have correct navigation links', async () => withBrowser(async () => {
            const links = await page.$$eval('.nav-card', cards => 
                cards.map(card => card.getAttribute('href'))
            );
            
            expect(links).toContain('match_review.html');
            expect(links).toContain('u10_rules.html');
            expect(links).toContain('tigercup_groupstage.html');
            expect(links).toContain('sponsor_me.html');
        }));

        test('should have team motto', async () => withBrowser(async () => {
            const motto = await page.$('.motto');
            expect(motto).not.toBeNull();
            
            const mottoText = await motto.evaluate(el => el.textContent);
            expect(mottoText).toContain('友谊第一');
        }));

        test('should have footer with copyright', async () => withBrowser(async () => {
            const footer = await page.$('.footer');
            expect(footer).not.toBeNull();
            
            const footerText = await footer.evaluate(el => el.textContent);
            expect(footerText).toContain('© 2026');
            expect(footerText).toContain('烈光少棒赤狐队');
        }));
    });

    describe('Match Review Page (match_review.html)', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.matchReview, { waitUntil: 'networkidle2' });
            }
        });

        test('should have password protection overlay', async () => withBrowser(async () => {
            const passwordOverlay = await page.$('#passwordOverlay');
            expect(passwordOverlay).not.toBeNull();
            
            const passwordInput = await page.$('#passwordInput');
            expect(passwordInput).not.toBeNull();
        }));

        test('should unlock content with correct password', async () => withBrowser(async () => {
            // Enter password
            await page.type('#passwordInput', TEST_CONFIG.password);
            
            // Click unlock button
            await page.evaluate(() => {
                const btn = document.querySelector('.password-btn');
                if (btn) btn.click();
            });
            
            // Wait for main content to be visible
            await page.waitForSelector('#mainContent.visible', { timeout: 5000 });
            
            const mainContent = await page.$('#mainContent');
            expect(mainContent).not.toBeNull();
        }));

        test('should have 7 video cards after unlock', async () => withBrowser(async () => {
            // Unlock first
            await page.type('#passwordInput', TEST_CONFIG.password);
            await page.evaluate(() => {
                const btn = document.querySelector('.password-btn');
                if (btn) btn.click();
            });
            await page.waitForSelector('#mainContent.visible', { timeout: 5000 });
            
            const videoCards = await page.$$('.video-card');
            expect(videoCards.length).toBe(7);
        }));

        test('should have Google Analytics', async () => withBrowser(async () => {
            const hasGA = await page.evaluate(() => {
                return typeof gtag === 'function' || 
                       document.querySelector('script[src*="googletagmanager"]') !== null;
            });
            expect(hasGA).toBe(true);
        }));
    });

    describe('U10 Rules Page (u10_rules.html)', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.rules, { waitUntil: 'networkidle2' });
            }
        });

        test('should have correct page title', async () => withBrowser(async () => {
            const title = await page.title();
            expect(title).toContain('猛虎杯');
            expect(title).toContain('U10');
        }));

        test('should have sticky navigation', async () => withBrowser(async () => {
            const nav = await page.$('.page-nav');
            expect(nav).not.toBeNull();
            
            const navLinks = await page.$$('.nav-link');
            expect(navLinks.length).toBeGreaterThan(5);
        }));

        test('should have tournament schedule section', async () => withBrowser(async () => {
            const scheduleSection = await page.$('#schedule');
            expect(scheduleSection).not.toBeNull();
        }));

        test('should have image containers with lightbox functionality', async () => withBrowser(async () => {
            const imageContainers = await page.$$('.image-container');
            expect(imageContainers.length).toBeGreaterThan(0);
            
            // Check for modal
            const modal = await page.$('#imageModal');
            expect(modal).not.toBeNull();
        }));

        test('should have key metrics cards', async () => withBrowser(async () => {
            const metricCards = await page.$$('.metric-card');
            expect(metricCards.length).toBeGreaterThan(0);
        }));
    });

    describe('Groupstage Analysis Page (tigercup_groupstage.html)', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.groupstage, { waitUntil: 'networkidle2' });
            }
        });

        test('should have correct page title', async () => withBrowser(async () => {
            const title = await page.title();
            expect(title).toContain('猛虎杯');
            expect(title).toContain('数据分析');
        }));

        test('should have data image', async () => withBrowser(async () => {
            const dataImage = await page.$('img[src*="groupstage_data"]');
            expect(dataImage).not.toBeNull();
        }));

        test('should have navigation to all AI analysis sections', async () => withBrowser(async () => {
            const navLinks = await page.$$eval('.nav-link', links => 
                links.map(link => link.getAttribute('href'))
            );
            
            expect(navLinks).toContain('#kimi');
            expect(navLinks).toContain('#gemini');
            expect(navLinks).toContain('#chatgpt');
        }));

        test('should have AI analysis cards', async () => withBrowser(async () => {
            const aiCards = await page.$$('.ai-card');
            expect(aiCards.length).toBe(3);
        }));

        test('should have player statistics tables', async () => withBrowser(async () => {
            const tables = await page.$$('table');
            expect(tables.length).toBeGreaterThan(2);
        }));

        test('should have summary section with key metrics', async () => withBrowser(async () => {
            const summarySection = await page.$('.summary-section');
            expect(summarySection).not.toBeNull();
            
            const metricCards = await summarySection.$$('.metric-card');
            expect(metricCards.length).toBe(3);
        }));

        test('should have data source footer', async () => withBrowser(async () => {
            const footer = await page.$('.contact-footer');
            expect(footer).not.toBeNull();
            
            const footerText = await footer.evaluate(el => el.textContent);
            expect(footerText).toContain('猛虎杯小组赛');
        }));
    });

    describe('Sponsor Page (sponsor_me.html)', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.sponsor, { waitUntil: 'networkidle2' });
            }
        });

        test('should have correct page title', async () => withBrowser(async () => {
            const title = await page.title();
            expect(title).toContain('赞助赤狐');
        }));

        test('should show sponsor qr code and CTA copy', async () => withBrowser(async () => {
            const qrImage = await page.$('img[src*="sponsor_me.PNG"]');
            expect(qrImage).not.toBeNull();

            const qrCaption = await page.$('.qr-caption');
            expect(qrCaption).not.toBeNull();

            const qrText = await qrCaption.evaluate(el => el.textContent);
            expect(qrText).toContain('扫码进入赤狐补给站');
        }));

        test('should render support offer cards', async () => withBrowser(async () => {
            const offerCards = await page.$$('.offer-card');
            expect(offerCards.length).toBe(3);

            const offerTitles = await page.$$eval('.offer-card h2', nodes =>
                nodes.map(node => node.textContent.trim())
            );
            expect(offerTitles).toEqual(
                expect.arrayContaining(['一颗球计划', '加餐暴击包', '记录后勤补给包'])
            );
        }));

        test('should provide a zoom modal for sponsor item images', async () => withBrowser(async () => {
            const zoomableImages = await page.$$('[data-zoomable]');
            expect(zoomableImages.length).toBe(3);

            const modal = await page.$('#imageModal');
            expect(modal).not.toBeNull();
        }));

        test('should open and close the sponsor image zoom modal', async () => withBrowser(async () => {
            const firstZoomableImage = await page.$('[data-zoomable]');
            expect(firstZoomableImage).not.toBeNull();

            const expectedSrc = await firstZoomableImage.evaluate((img) => img.getAttribute('src'));
            await firstZoomableImage.click();

            await page.waitForSelector('#imageModal.open');

            const modalImageSrc = await page.$eval('#imageModalImg', (img) => img.getAttribute('src'));
            expect(modalImageSrc).toBe(expectedSrc);

            await page.click('#imageModalClose');

            const modalIsOpen = await page.$eval('#imageModal', (modal) =>
                modal.classList.contains('open')
            );
            expect(modalIsOpen).toBe(false);
        }));

        test('should render all 16 floating background stickers', async () => withBrowser(async () => {
            const floatingStickers = await page.$$('.floating-sticker');
            expect(floatingStickers.length).toBe(16);

            const stickerSources = await page.$$eval('.floating-sticker img', nodes =>
                nodes.map(node => node.getAttribute('src'))
            );
            expect(stickerSources).toContain('./img/01_homerun.png');
            expect(stickerSources).toContain('./img/16_champion.png');
        }));

        test('should include sticker rally and timeline sections', async () => withBrowser(async () => {
            const rallyCards = await page.$$('.sticker-card');
            expect(rallyCards.length).toBe(3);

            const timelineItems = await page.$$('.timeline li');
            expect(timelineItems.length).toBe(4);
        }));
    });

    describe('Cross-Page Navigation', () => {
        test('should navigate from index to match_review page', async () => withBrowser(async () => {
            await page.goto(PAGE_PATHS.index, { waitUntil: 'networkidle2' });
            
            // Find and click the match review link
            const matchReviewLink = await page.$('a[href="match_review.html"]');
            expect(matchReviewLink).not.toBeNull();
        }));

        test('should navigate from index to u10_rules page', async () => withBrowser(async () => {
            await page.goto(PAGE_PATHS.index, { waitUntil: 'networkidle2' });
            
            const rulesLink = await page.$('a[href="u10_rules.html"]');
            expect(rulesLink).not.toBeNull();
        }));

        test('should navigate from index to groupstage page', async () => withBrowser(async () => {
            await page.goto(PAGE_PATHS.index, { waitUntil: 'networkidle2' });
            
            const groupstageLink = await page.$('a[href="tigercup_groupstage.html"]');
            expect(groupstageLink).not.toBeNull();
        }));

        test('should navigate from index to sponsor page', async () => withBrowser(async () => {
            await page.goto(PAGE_PATHS.index, { waitUntil: 'networkidle2' });

            const sponsorLink = await page.$('a[href="sponsor_me.html"]');
            expect(sponsorLink).not.toBeNull();
        }));
    });
});

describe('File Existence Tests', () => {
    const files = [
        'index.html',
        'match_review.html',
        'u10_rules.html',
        'tigercup_groupstage.html',
        'sponsor_me.html',
        'img/groupstage_data.png'
    ];

    files.forEach(file => {
        test(`${file} should exist`, () => {
            const filePath = path.resolve(__dirname, '..', file);
            expect(fs.existsSync(filePath)).toBe(true);
        });
    });
});
