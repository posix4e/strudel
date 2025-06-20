import puppeteer from 'puppeteer';
import { existsSync } from 'fs';

class BrowserManager {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async getBrowser(options = {}) {
    const { headless = false } = options;
    
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    // Try to use system Chrome on macOS if available
    const executablePath = process.platform === 'darwin' && 
      existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ?
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined;

    this.browser = await puppeteer.launch({
      headless: headless ? 'new' : false,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--autoplay-policy=no-user-gesture-required',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream'
      ],
      timeout: 60000,
      protocolTimeout: 240000
    });

    return this.browser;
  }

  async getPage(options = {}) {
    const browser = await this.getBrowser(options);
    
    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    this.page = await browser.newPage();
    return this.page;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

// Singleton instance
export const browserManager = new BrowserManager();