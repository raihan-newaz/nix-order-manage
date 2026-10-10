# Build Client SPA
FROM node:20-alpine AS builder

WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm ci

# Copy required server modules for shared builder core types and client source
COPY server/src/modules/builder/core ./server/src/modules/builder/core
COPY client ./client
WORKDIR /app/client
RUN npm run build

# Serve with lightweight Nginx
FROM nginx:alpine
COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
