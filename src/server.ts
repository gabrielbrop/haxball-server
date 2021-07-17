import puppeteer from 'puppeteer-core';

const selectorFrame = 'body > iframe';
const selectorRoomLink = '#roomlink > p > a';

const blockedRes = [
	'*/favicon.ico',
	'.css',
	'.jpg',
	'.jpeg',
	'.png',
	'.svg',
	'.woff',
  
	'*.optimizely.com',
	'everesttech.net',
	'userzoom.com',
	'doubleclick.net',
	'googleadservices.com',
	'adservice.google.com/*',
	'connect.facebook.com',
	'connect.facebook.net',
	'sp.analytics.yahoo.com'
];


interface ServerConfig {
    proxyEnabled?: boolean,
    proxyServers?: string[],
    execPath: string
}

export class Server {
    browsers: puppeteer.Browser[] = [];

    private _unnamedCount = 1;

    private _proxyEnabled: boolean;
    private _proxyServers: string[];
    private _execPath: string;

    constructor(config: ServerConfig) {
        this._proxyEnabled = config?.proxyEnabled ?? false;
        this._proxyServers = config?.proxyServers ?? [];
        this._execPath = config.execPath;
    }

    private async _createNewBrowser() {
        const args = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--single-process",
            "--disable-gpu",
            "--incognito"
        ];
        
        let proxyServer = "";

        if (this._proxyEnabled) {
            let availableProxies = this._proxyServers.filter(s => {
                let a = 0;

                for (const browser of this.browsers) {
                    console.log(browser["proxyServer"], s)
                    if (browser["proxyServer"] === s) {
                        a++;
                    }
                }

                return a < 2; 
            });

            if (availableProxies.length === 0) {
                proxyServer = this._proxyServers[this._proxyServers.length - 1];
            } else {
                proxyServer = availableProxies[0];
            }
            
            args.push("--proxy-server=" + proxyServer);
        }

        const browser = await puppeteer.launch({
            headless: true,
            args: args,
            executablePath: this._execPath
        });

        if (proxyServer != "") browser["proxyServer"] = proxyServer;

        this.browsers.push(browser);

        browser.on("disconnected", () => {
            this.browsers = this.browsers.filter(b => {
                const isConnected = b.isConnected();

                if (!isConnected) b.close();

                return isConnected;
            });
        });

        return browser;
    }

    private async _openRoom(page: puppeteer.Page, script: string, token: string): Promise<string> {
        page
		.on('pageerror', ({ message }) => console.log(message))
		.on('response', response => console.log(`${response.status()} : ${response.url()}`))
		.on('requestfailed', request => console.log(`${request.failure()?.errorText} : ${request.url()}`));

        await page.setCacheEnabled(false);

        const client = await page.target().createCDPSession();

        const scripts = `
            window["ServerData"] = {
                Token: "${token}"
            }`;

        await client.send('Network.setBlockedURLs', { urls: blockedRes });
        await page.goto('https://www.haxball.com/headless', { waitUntil: 'networkidle2' });

        const isTokenOk = await page.evaluate(async (token) => {
            return await new Promise((resolve) => {
                const server = new WebSocket(`wss://p2p2.haxball.com/host?token=${token}`);

                server.onopen = function() {
                    resolve(true);
                };
                
                server.onerror = function() {
                    resolve(false);
                };
            });
        }, token);

        if (!isTokenOk) throw new Error("Invalid token.");

        await page.addScriptTag({ content: scripts });
        await page.addScriptTag({ content: script });
        await page.addScriptTag({ content: `document.title = window["RoomData"]?.name ?? "Unnamed room ${this._unnamedCount++}";` })
        await page.waitForSelector("iframe");

        const elementHandle = await page.$(selectorFrame);
        const frame = await elementHandle!.contentFrame();

        await frame!.waitForSelector(selectorRoomLink);

        const roomLinkElement = await frame!.$(selectorRoomLink);
        const link = await frame!.evaluate(el => el.textContent, roomLinkElement)

        return link;
    }

    async open(script: string, token: string) {
        const browser = await this._createNewBrowser();
        const pid = browser?.process()?.pid;
        const [ page ] = await browser.pages();

        try {
            const link = await this._openRoom(page, script, token);

            return { link, pid };
        } catch (e) {
            this.close(pid as number);

            throw e;
        }
    }

    async close(pidOrTitle: string | number) {
        let success = false;
        let pOT: number | string | undefined = pidOrTitle;

        for (const browser of this.browsers) {
            const title = await (await browser.pages())[0].title();

            if (title == pOT) pOT = browser?.process()?.pid;
        }

        this.browsers = this.browsers.filter(b => {
            const pid = b?.process()?.pid;

            if (pid == pOT) {
                b.close();
                success = true;
            }

            return pid != pOT;
        });

        return success;
    }
}