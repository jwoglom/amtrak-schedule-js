// puppeteer-extra is a drop-in replacement for puppeteer,
// it augments the installed puppeteer with plugin functionality
const puppeteer = require('puppeteer-extra')

// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

const request_client = require('request-promise-native');

const fs = require('fs');


// puppeteer usage as normal
puppeteer.launch({ headless: false }).then(async browser => {
  await launch(browser, 'NYP', 'BOS', '5/24/2023')
})

function rand(x, y) {
  return x + Math.random() * (y-x);
}

async function launch(browser, origin, dest, date) {
  console.log('launch('+origin+', '+dest+', '+date+')');
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(0);

  await page.setRequestInterception(true);

  let journeyRequest = null;
  let allRequests = [];
  page.on('request', request => {
    request_client({
      uri: request.url(),
      resolveWithFullResponse: true,
    }).then(response => {
      let req = {
        'success': true,
        'request_url': request.url(),
        'request_headers': request.headers(),
        'request_post_data': request.postData(),
        'response_headers': response.headers,
        'response_size': response.headers['content-length'],
        'response_body': response.body,
      };

      if (req['request_url'].endsWith('/dotcom/journey-solution-option')) {
        journeyRequest = req;
      }

      console.log('REQ:', req['request_url']);
      allRequests.push(req);

      request.continue();
    }).catch(error => {
      let req = {
        'success': false,
        'request_url': request.url(),
        'request_headers': request.headers(),
        'request_post_data': request.postData(),
        'response_body': error.error,
        'status_code': error.statusCode,
      };

      if (req['request_url'].endsWith('/dotcom/journey-solution-option')) {
        journeyRequest = req;
      }
      allRequests.push(req);

      request.continue();
      //request.abort();
    });
  });

  await page.goto('https://www.amtrak.com/home.html')
  await page.waitForNetworkIdle(500);
  
  await page.focus("[data-julie='departdisplay_booking_oneway']")
  await page.keyboard.type(date, {delay: 100});
  await page.waitForTimeout(rand(250, 750));

  await page.focus("[data-julie='fromfield_booking']")
  await page.keyboard.type(origin, {delay: 100});
  await page.focus("[data-julie='departdisplay_booking_oneway']")
  await page.waitForSelector('.from-station [amt-auto-test-id="refine-search-from&to"]', {visible: true})
  await page.waitForTimeout(rand(250, 750));
  
  await page.focus("[data-julie='tofield_booking']")
  await page.keyboard.type(dest, {delay: 100});
  await page.focus("[data-julie='departdisplay_booking_oneway']")
  await page.waitForSelector('.to-station [amt-auto-test-id="refine-search-from&to"]', {visible: true})
  await page.waitForTimeout(rand(750, 1250));


  await page.click("[amt-auto-test-id='fare-finder-findtrains-button']")
  console.log('Submitting form')

  await Promise.any([
    page.waitForSelector('#amtrak_error_id'),
    page.waitForNavigation()
  ]);

  let error = await page.$eval('#amtrak_error_id', (el) => el.innerText).catch(() => null);
  if (error) {
    console.warn("AMTRAK ERROR:", error);

    console.log(journeyRequest);
    await browser.close();
    fs.writeFileSync('requests.json', JSON.stringify(allRequests));

    return;
  }

  await page.waitForNetworkIdle(500);

  console.log(journeyRequest);

  await browser.close()
  fs.writeFileSync('requests.json', JSON.stringify(allRequests));
  console.log(`All done`)
}
