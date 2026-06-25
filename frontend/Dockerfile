# Frontend: Next.js (pages router)
FROM node:22-slim AS builder

WORKDIR /app

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3301
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Sub-path the app is served under behind a reverse proxy (e.g. /feed). Empty = root.
ARG NEXT_PUBLIC_BASE_PATH=
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

# Next.js freezes rewrite destinations into the build manifest at build time,
# so the server-side backend proxy target must be baked here too.
ARG BACKEND_INTERNAL_URL=http://backend:3001
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---- Runtime ----
FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# next start needs the build output, deps, public assets and config
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/next-i18next.config.js ./next-i18next.config.js

EXPOSE 3000

CMD ["npm", "start"]
