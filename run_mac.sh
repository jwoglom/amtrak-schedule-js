#!/bin/bash
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true PUPPETEER_EXECUTABLE_PATH=`which chromium` node amtrak.js "$@"