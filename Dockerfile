FROM zenika/alpine-chrome:with-node AS app

COPY package.json .
COPY amtrak.js .
COPY postprocess.sh .
RUN npm install

ENTRYPOINT ["node", "amtrak.js"]