FROM node:22-bookworm-slim

# MongoDB
RUN apt-get update && apt-get install -y gnupg curl && \
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg && \
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list && \
    apt-get update && \
    apt-get install -y mongodb-org-server mongodb-mongosh && \
    apt-get clean

WORKDIR /app

# Backend cloud models (source of truth) — needed by backend-local imports
COPY backend/package.json ./backend/package.json
COPY backend/src ./backend/src
COPY backend/tsconfig.json ./backend/tsconfig.json

# Backend local
COPY .local/backend/package.json ./backend-local/package.json
COPY .local/backend/tsconfig.json ./backend-local/tsconfig.json
COPY .local/backend/src ./backend-local/src

RUN cd backend-local && npm install --omit=dev || npm install

# Entrypoint: init replica set, run seed, start server
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 4000 27017

CMD ["/entrypoint.sh"]
