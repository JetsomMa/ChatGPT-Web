FROM node:lts-alpine as backend

RUN npm install -g pnpm@8.5.1

WORKDIR /app

COPY /package.json /app

COPY /pnpm-lock.yaml /app

RUN pnpm install

COPY ./build ./build

EXPOSE 13002

CMD ["pnpm", "prod"]
