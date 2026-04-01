const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    const filePath = 'file://' + path.resolve(__dirname, '../index.html');
    await page.goto(filePath, { waitUntil: 'networkidle2' });
    
    // Login
    await page.type('#passwordInput', '1972');
    await page.evaluate(() => document.querySelector('.password-btn').click());
    await page.waitForSelector('#mainContent.visible');
    await new Promise(r => setTimeout(r, 2000));
    
    // Check if pause signals are being tracked
    const signals = await page.evaluate(() => window._videoPauseSignals);
    console.log('Pause signals before scroll:', signals.length);
    
    // Scroll to trigger
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 1000));
    
    const signalsAfter = await page.evaluate(() => window._videoPauseSignals);
    console.log('Pause signals after scroll:', signalsAfter.length);
    console.log('Signals:', JSON.stringify(signalsAfter, null, 2));
    
    await browser.close();
})();
