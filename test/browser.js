const { chromium } = require('playwright');
const fs = require('fs');

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

    const headlessPath = chromium.executablePath();
    const fullBrowserPath = headlessPath.replace(
        /chromium_headless_shell-(\d+)\/chrome-headless-shell-linux64\/chrome-headless-shell$/,
        'chromium-$1/chrome-linux64/chrome'
    );

    if (fullBrowserPath !== headlessPath && fs.existsSync(fullBrowserPath)) {
        return fullBrowserPath;
    }

    return headlessPath;
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
