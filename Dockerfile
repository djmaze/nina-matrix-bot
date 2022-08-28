FROM node:14

ENV TZ=Europe/Berlin

RUN mkdir /home/node/app && chown node /home/node/app
USER node
WORKDIR /home/node/app

COPY --chown=node package.json package-lock.json ./
RUN npm install

COPY --chown=node . ./
RUN npm run build

CMD ["npm", "start"]
