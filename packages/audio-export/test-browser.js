import puppeteer from 'puppeteer';

console.log('Testing Puppeteer browser launch...');

try {
  // Try to find Chrome on macOS
  const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  console.log('Browser launched successfully');
  
  const page = await browser.newPage();
  console.log('Page created');
  
  await page.goto('https://strudel.cc');
  console.log('Navigated to strudel.cc');
  
  const title = await page.title();
  console.log('Page title:', title);
  
  await browser.close();
  console.log('Browser closed successfully');
  
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}