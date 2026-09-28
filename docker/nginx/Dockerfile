# Multi-stage build: Builds PWA & packages Nginx Reverse Proxy
FROM node:20-alpine AS web-builder

WORKDIR /app

COPY web/package*.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

FROM nginx:alpine

# Copy built frontend PWA assets
COPY --from=web-builder /app/dist /usr/share/nginx/html

# Copy Nginx reverse proxy configuration
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
