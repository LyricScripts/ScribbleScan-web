# The ScribbleScan web app image: the Next.js standalone server.
# Build: podman build -t scribblescan-web .
# Two stages: the first installs the dependencies and builds, the second keeps
# only the standalone server and runs it as a non-root user.

FROM docker.io/library/node:24.22.0-alpine AS build
WORKDIR /web
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM docker.io/library/node:24.22.0-alpine AS runner
WORKDIR /web
ENV NODE_ENV=production
ENV PORT=3000
# Podman sets HOSTNAME to the container id. The standalone server would then bind
# that name instead of every interface, which fails on hosts without IPv6 (the
# same reason the zitadel-login unit sets this).
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /web/public ./public
COPY --from=build --chown=node:node /web/.next/standalone ./
COPY --from=build --chown=node:node /web/.next/static ./.next/static
# The server caches rendered pages and optimized images here, so it must be
# writable by the user it runs as.
RUN mkdir -p .next/cache && chown -R node:node .next
USER node
EXPOSE 3000
CMD ["node", "server.js"]
