FROM docker.io/library/node:24.22.0-alpine AS build
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM docker.io/library/node:24.22.0-alpine AS runner
WORKDIR /web
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /web/public ./public
COPY --from=build --chown=node:node /web/.next/standalone ./
COPY --from=build --chown=node:node /web/.next/static ./.next/static
RUN mkdir -p .next/cache && chown -R node:node .next
USER node
EXPOSE 3000
CMD ["node", "server.js"]
