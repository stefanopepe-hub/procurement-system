FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# VITE_API_URL viene iniettato da Railway come build argument
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Rimuovi ARG VITE_API_URL — ora è runtime via config.js
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-custom-entrypoint.sh
RUN chmod +x /docker-custom-entrypoint.sh

ENV PORT=80
EXPOSE 80
ENTRYPOINT ["/docker-custom-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
