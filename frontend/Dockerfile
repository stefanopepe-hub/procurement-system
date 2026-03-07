FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

ENV PORT=80
EXPOSE 80
CMD ["/bin/sh", "-c", "export BACKEND_URL=\"${BACKEND_URL:-http://backend:8000}\"; echo \"window.__API_URL__ = '${VITE_API_URL}';\" > /usr/share/nginx/html/config.js && /docker-entrypoint.sh nginx -g 'daemon off;'"]
