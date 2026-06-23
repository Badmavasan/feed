# Backend: Node.js + Express + Prisma
FROM node:22-slim

# Prisma needs OpenSSL at runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies (postinstall runs `prisma generate`, so schema must be present)
COPY package*.json ./
COPY prisma ./prisma
RUN npm install

# Copy application source
COPY . .

# Entrypoint syncs the schema + seeds the DB, then launches the server
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "app.js"]
