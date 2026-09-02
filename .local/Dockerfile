FROM node:22-bookworm-slim

# MongoDB
RUN apt-get update && apt-get install -y gnupg curl && \
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg && \
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list && \
    apt-get update && \
    apt-get install -y mongodb-org-server mongodb-mongosh && \
    apt-get clean

WORKDIR /app

# Backend locale
COPY .local/backend/package.json ./backend-local/package.json
COPY .local/backend/tsconfig.json ./backend-local/tsconfig.json
COPY .local/backend/src ./backend-local/src

# Frontend locale — build statica
COPY .local/frontend/package.json ./frontend/package.json
COPY .local/frontend/tsconfig.json ./frontend/tsconfig.json
COPY .local/frontend/vite.config.ts ./frontend/vite.config.ts
COPY .local/frontend/index.html ./frontend/index.html
COPY .local/frontend/src ./frontend/src
RUN cd frontend && npm install && npm run build && mkdir -p ../backend-local/public && cp -r dist/* ../backend-local/public/

# Install backend with full deps (tsx needed at runtime by entrypoint)
RUN cd backend-local && npm install

# Entrypoint: init replica set, run seed, start server
COPY .local/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 4000 27017

CMD ["/entrypoint.sh"]
