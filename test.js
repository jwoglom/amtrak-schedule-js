// puppeteer-extra is a drop-in replacement for puppeteer,
// it augments the installed puppeteer with plugin functionality
const puppeteer = require('puppeteer-extra')

// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

const request_client = require('request-promise-native');


// puppeteer usage as normal
puppeteer.launch({ headless: false }).then(async browser => {
  await launch(browser);
})

function rand(x, y) {
  return x + Math.random() * (y-x);
}

async function launch(browser) {
  console.log('launch()');
  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => {
    
  })


  await page.goto('https://bot.sannysoft.com/')
  await browser.waitForTarget(() => false);

  await browser.close()
  console.log(`All done`)
}
