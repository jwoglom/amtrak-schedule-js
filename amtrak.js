// puppeteer-extra is a drop-in replacement for puppeteer,
// it augments the installed puppeteer with plugin functionality
const puppeteer = require('puppeteer-extra')

// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

const request_client = require('request-promise-native');
const fs = require('fs');

const args = require('yargs').argv;

const options = {
  headless: args['nonheadless'] ? false : 'new',
  ignoreHTTPSErrors: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-sync",
    "--ignore-certificate-errors",
    "--lang=en-US,en;q=0.9",
  ],
  defaultViewport: { width: 1366, height: 768 },
}

if (!args.origin || !args.dest || !args.date) {
  console.error('Required --origin CODE, --dest CODE, and --date MM/DD/YYYY');
  process.exit(1);
}

function checkDateFormat(dateString) {
  const pattern = /^([1-9]|0[1-9]|1[0-2])\/([1-9]|[12][0-9]|3[01])\/\d{4}$/;
  return pattern.test(dateString);
}

if (!checkDateFormat(args.date)) {
  console.error('Invalid date format: expected MM/DD/YYYY or M/D/YYYY');
  process.exit(1);
}

process.stderr.write('Launching puppeteer\n')
puppeteer.launch(options).then(async browser => {
  await launch(browser, args.origin, args.dest, args.date);
})

function rand(x, y) {
  return x + Math.random() * (y-x);
}

async function launch(browser, origin, dest, date) {
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(0);

  await page.setRequestInterception(true);

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

      allRequests.push(req);

      request.continue();
    });
  });
  process.stderr.write('Opening Amtrak\n')
  await page.goto('https://www.amtrak.com/home.html', { waitUntil: 'networkidle2' });
  process.stderr.write('Filling form\n')
  
  await page.focus("[data-julie='departdisplay_booking_oneway']")
  await page.keyboard.type(date, {delay: 100});
  await page.waitForTimeout(rand(150, 750));

  await page.focus("[data-julie='fromfield_booking']")
  await page.keyboard.type(origin, {delay: 100});
  await page.focus("[data-julie='departdisplay_booking_oneway']")
  await page.waitForSelector('.from-station [amt-auto-test-id="refine-search-from&to"]', {visible: true})
  await page.waitForTimeout(rand(150, 750));
  
  await page.focus("[data-julie='tofield_booking']")
  await page.keyboard.type(dest, {delay: 100});
  await page.focus("[data-julie='departdisplay_booking_oneway']")
  await page.waitForSelector('.to-station [amt-auto-test-id="refine-search-from&to"]', {visible: true})
  await page.waitForTimeout(rand(150, 750));

  process.stderr.write('Submitting form\n')
  await page.click("[amt-auto-test-id='fare-finder-findtrains-button']")

  await Promise.any([
    page.waitForSelector('#amtrak_error_id'),
    page.waitForNavigation()
  ]);

  let error = await page.$eval('#amtrak_error_id', (el) => el.innerText).catch(() => null);
  if (error) {
    process.stderr.write('Amtrak error:\n'+error+'\n')
    process.stdout.write(JSON.stringify({"error": error}));

    await browser.close();
    fs.writeFileSync('requests.json', JSON.stringify(allRequests));

    return;
  }

  process.stderr.write('Waiting for output\n')

  await page.waitForFunction("!!sessionStorage && !!sessionStorage['searchresults']")

  let res = await page.evaluate(_ => {
    return sessionStorage['searchresults'];
  });

  process.stdout.write(res);
  fs.writeFileSync('output.json', res);

  await browser.close()
  fs.writeFileSync('requests.json', JSON.stringify(allRequests));
}
