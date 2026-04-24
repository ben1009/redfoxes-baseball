/**
 * @fileoverview Browser launcher helper for tests
 * Attempts to use Obscura (lightweight headless browser) via CDP,
 * falling back to Puppeteer + Chrome if Obscura is not available.
 */

const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const net = require('net');

const OBSCURA_DEFAULT_PORT = 9222;
const OBSCURA_LAUNCH_TIMEOUT = 5000;

function findFreePort(startPort = OBSCURA_DEFAULT_PORT) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                findFreePort(startPort + 1).then(resolve, reject);
            } else {
                reject(err);
            }
        });
        server.listen(startPort, '127.0.0.1', () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
    });
}

function waitForCdp(port, timeout = OBSCURA_LAUNCH_TIMEOUT) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const tryConnect = () => {
            const client = new net.Socket();
            client.setTimeout(200);
            client.once('connect', () => {
                client.destroy();
                resolve();
            });
            client.once('error', () => {
                client.destroy();
                if (Date.now() - start > timeout) {
                    reject(new Error('Timeout waiting for Obscura CDP'));
                } else {
                    setTimeout(tryConnect, 100);
                }
            });
            client.once('timeout', () => {
                client.destroy();
                if (Date.now() - start > timeout) {
                    reject(new Error('Timeout waiting for Obscura CDP'));
                } else {
                    setTimeout(tryConnect, 100);
                }
            });
            client.connect(port, '127.0.0.1');
        };
        tryConnect();
    });
}

async function launchObscura(port) {
    return new Promise((resolve, reject) => {
        const proc = spawn('obscura', ['serve', '--cdp-port', String(port)], {
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        proc.on('error', (err) => {
            reject(err);
        });

        waitForCdp(port)
            .then(() => resolve(proc))
            .catch((err) => {
                proc.kill();
                reject(err);
            });
    });
}

async function launchBrowser(options = {}) {
    // Try Obscura first
    try {
        const port = await findFreePort();
        const obscuraProc = await launchObscura(port);
        const browser = await puppeteer.connect({
            browserWSEndpoint: `ws://127.0.0.1:${port}`,
            ...options
        });
        // Tag the browser so cleanup can kill the Obscura process
        browser.__obscuraProc = obscuraProc;
        return browser;
    } catch (obscuraErr) {
        // Fall back to Puppeteer + Chrome
        const launchOpts = {
            headless: 'new',
            pipe: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            ...options
        };
        return puppeteer.launch(launchOpts);
    }
}

async function closeBrowser(browser) {
    if (!browser) return;
    try {
        await browser.close();
    } catch (_) {
        // ignore
    }
    if (browser.__obscuraProc) {
        try {
            browser.__obscuraProc.kill('SIGTERM');
        } catch (_) {
            // ignore
        }
    }
}

function isBrowserAvailable() {
    try {
        puppeteer.executablePath();
        return true;
    } catch (_) {
        return false;
    }
}

module.exports = {
    launchBrowser,
    closeBrowser,
    isBrowserAvailable
};
