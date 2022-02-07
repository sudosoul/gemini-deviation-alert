FROM node:17.4.0-alpine3.15

ARG SERVER_PORT
ENV SERVER_PORT=$SERVER_PORT

WORKDIR /usr/src/app
COPY . .
RUN npm ci --only=prod

CMD node server.mjs
