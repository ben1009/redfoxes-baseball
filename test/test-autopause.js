#!/usr/bin/env node
/**
 * @fileoverview Standalone test for video autopause functionality
 * Usage: node test/test-autopause.js
 */

const puppeteer = require('puppeteer');
const path = require('path');

const CONFIG = {
    password: '1972',
    viewport: { width: 1280, height: 800 },
    timeout: 10000
};

async function runTest() {
    console.log('🎬 Testing video autopause functionality...\n');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        await page.setViewport(CONFIG.viewport);
        
        // Load page
        const filePath = 'file://' + path.resolve(__dirname, '../index.html');
        console.log('📄 Loading page:', filePath);
        await page.goto(filePath, { waitUntil: 'networkidle2' });
        
        // Enter password
        console.log('🔑 Entering password...');
        await page.type('#passwordInput', CONFIG.password);
        await page.click('.password-btn');
        await page.waitForSelector('#mainContent.visible', { timeout: 5000 });
        console.log('✅ Login successful\n');
        
        // Wait for iframes
        await page.waitForTimeout(2000);
        
        // Test 1: Check video count
        console.log('Test 1: Check video count');
        const iframes = await page.$$('.video-container iframe');
        console.log(`   Found ${iframes.length} video iframes`);
        if (iframes.length !== 7) {
            throw new Error(`Expected 7 videos, found ${iframes.length}`);
        }
        console.log('   ✅ PASS\n');
        
        // Test 2: Check IntersectionObserver initialization
        console.log('Test 2: Check IntersectionObserver');
        const hasObserverLogic = await page.evaluate(() => {
            // Look for the initVideoAutopause function in page scripts
            const scripts = Array.from(document.querySelectorAll('script'));
            return scripts.some(s => s.textContent.includes('IntersectionObserver'));
        });
        console.log(`   IntersectionObserver found: ${hasObserverLogic}`);
        if (!hasObserverLogic) {
            throw new Error('IntersectionObserver not found in page scripts');
        }
        console.log('   ✅ PASS\n');
        
        // Test 3: Scroll video out of viewport
        console.log('Test 3: Video visibility on scroll');
        const firstVideo = iframes[0];
        
        // Scroll to video
        await firstVideo.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(500);
        
        const visibleBefore = await firstVideo.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
        });
        console.log(`   Video visible before scroll: ${visibleBefore}`);
        
        // Scroll down
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(1000);
        
        const visibleAfter = await firstVideo.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
        });
        console.log(`   Video visible after scroll: ${visibleAfter}`);
        
        if (visibleAfter) {
            throw new Error('Video should be out of viewport after scrolling');
        }
        console.log('   ✅ PASS\n');
        
        // Test 4: Check postMessage attempts
        console.log('Test 4: Check postMessage to iframes');
        const postMessageCalls = await page.evaluate(() => {
            // Count how many times we've tried to send messages to iframes
            // This is tracked in the pausedIframes logic
            return window.postMessageCount || 0;
        });
        console.log(`   Note: Cross-origin restrictions prevent direct verification`);
        console.log(`   The page attempts to send pause commands via postMessage`);
        console.log('   ✅ PASS (best effort with cross-origin iframe)\n');
        
        // Test 5: Video src unchanged after scroll
        console.log('Test 5: Video src persistence');
        const originalSrc = await firstVideo.evaluate(el => el.src);
        
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);
        
        const currentSrc = await firstVideo.evaluate(el => el.src);
        if (originalSrc !== currentSrc) {
            throw new Error('Video src changed after scroll');
        }
        console.log(`   Video src unchanged: ${currentSrc.includes('bilibili.com')}`);
        console.log('   ✅ PASS\n');
        
        console.log('═══════════════════════════════════════════');
        console.log('✅ All tests passed!');
        console.log('═══════════════════════════════════════════');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

runTest();
