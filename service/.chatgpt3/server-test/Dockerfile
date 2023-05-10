FROM node:lts-alpine as backend

RUN npm install pnpm -g

WORKDIR /app

COPY /package.json /app

COPY /pnpm-lock.yaml /app

RUN pnpm install

COPY ./build ./build

EXPOSE 33002

CMD ["pnpm", "prod"]
