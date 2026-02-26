FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=3004

EXPOSE 3004

CMD ["node", "dist/server/index.js"]
