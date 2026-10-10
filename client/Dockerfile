# Build Client SPA
FROM node:20-alpine AS builder

WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm install
RUN ln -s /app/client/node_modules /app/node_modules

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

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml font/woff2 font/woff;

    location ~* \.(?:css|js|woff2?|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
}
EOF

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
