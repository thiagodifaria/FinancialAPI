FROM node:24-alpine AS builder

WORKDIR /app

COPY service-typescript/package*.json ./
RUN npm ci

COPY service-typescript/ ./
COPY data/proto/ ./proto/

RUN npm run build

FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/proto ./proto

EXPOSE 5000

CMD ["node", "dist/index.js"]
