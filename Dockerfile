FROM node:14

ENV TZ=Europe/Berlin

USER node
WORKDIR /home/node/app

COPY --chown=node package.json package-lock.json ./
RUN npm install

COPY --chown=node . ./
RUN npx tsc --strict *.ts

CMD ["node", "index.js"]