const { chromium } = require('playwright');

const BROWSER_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-crash-reporter',
    '--disable-crashpad-for-testing'
];

function getChromiumExecutablePath() {
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
        return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    }
    return chromium.executablePath();
}

async function launchBrowser() {
    return chromium.launch({
        headless: true,
        chromiumSandbox: false,
        executablePath: getChromiumExecutablePath(),
        args: BROWSER_ARGS
    });
}

module.exports = {
    chromium,
    launchBrowser
};
