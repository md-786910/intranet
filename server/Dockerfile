# ---- Base ----
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./

# ---- Development ----
FROM base AS development
RUN npm install
COPY . .
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["docker-entrypoint.sh"]

# ---- Production ----
FROM base AS production
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
USER node
EXPOSE 4000
CMD ["node", "src/server.js"]
