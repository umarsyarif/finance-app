FROM node:20

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install

COPY . .
RUN npx prisma generate

CMD ["yarn", "start"]