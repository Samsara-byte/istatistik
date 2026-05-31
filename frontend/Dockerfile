# ── 1. Aşama: Build ──────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json ./
RUN npm install && npm install xlsx

COPY . .
RUN npx vite build

# ── 2. Aşama: Nginx ile Serve ─────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]