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
    "--disable-gpu",
  ],
  defaultViewport: { width: 1366, height: 768 },
}


if (!!args['webui']) {
  var express = require("express");
  var app = express();

  puppeteer.launch(options).then(async browser => {
    console.log("Launched puppeteer")
    app.get("/request", async (req, res, next) => {
      let origin = req.query.origin;
      let dest = req.query.dest;
      let date = req.query.date;

      if (!origin || !dest || !date) {
        res.json({'error': 'Required --origin CODE, --dest CODE, and --date MM/DD/YYYY'});
        return;
      }


      res.json(await launch(browser, origin, dest, date, false));
    });
  });

  app.listen(3000, () => {
    console.log("Server running on port 3000");
  });
  
} else {

  if (!args.origin || !args.dest || !args.date) {
    console.error('Required --origin CODE, --dest CODE, and --date MM/DD/YYYY');
    process.exit(1);
  }

  process.stderr.write('Launching puppeteer\n')
  puppeteer.launch(options).then(async browser => {
    await launch(browser, args.origin, args.dest, args.date, true);
    await browser.close()
  })
}

function rand(x, y) {
  return x + Math.random() * (y-x);
}

async function launch(browser, origin, dest, date, toStdout) {
  process.stderr.write('launch(origin='+origin+', dest='+dest+', date='+date+')\n');
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
  process.stderr.write('Page loaded\n')
  
  let btn = await page.evaluate(_ => {
    var btn = document.querySelector('#onetrust-accept-btn-handler');
    if (btn) btn.click()
    return !!btn;
  });
  process.stderr.write('Cookie prompt:'+btn+'\n');
  if (btn) {
    await page.waitForTimeout(150)
  }


  process.stderr.write('Filling form\n')
  
  await page.focus("[data-julie='departdisplay_booking_oneway']")
  await page.keyboard.type(date, {delay: 250});

  let dateOk = await page.evaluate((date) => {
    var btn = document.querySelector("[data-julie='departdisplay_booking_oneway']");
    if (btn && btn.value == date) return true;
    return false;
  }, date);

  if (!dateOk) {
    for (let i=0; i<date.length; i++) {
      await page.keyboard.press('Backspace', {delay: 50});
    }

    await page.keyboard.type(date, {delay: 250});
  }

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
    await page.close();

    if (toStdout) {
      process.stdout.write(JSON.stringify({"error": error}));
      fs.writeFileSync('requests.json', JSON.stringify(allRequests));
    } else {
      return {"error": error};
    }

    return;
  }

  process.stderr.write('Waiting for output\n')

  await page.waitForFunction("!!sessionStorage && !!sessionStorage['searchresults']")

  let res = await page.evaluate(_ => {
    return sessionStorage['searchresults'];
  });

  await page.close();

  if (toStdout) {
    process.stdout.write(res);
    fs.writeFileSync('output.json', res);

    fs.writeFileSync('requests.json', JSON.stringify(allRequests));
  } else {
    process.stderr.write('Done\n');
    return JSON.parse(res);
  }
}
