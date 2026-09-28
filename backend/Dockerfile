# Stage 1: Build TypeScript
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Stage 2: Development
FROM node:20-bookworm-slim AS development

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Stage 3: Production
FROM node:20-bookworm-slim AS production

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/database/migrations ./dist/database/migrations

EXPOSE 3000

CMD ["node", "dist/index.js"]
