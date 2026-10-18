# The web app as a small image: Caddy serving the built files from /srv/web.
# Build: podman build -t scribblescan-web .
# On the server, Caddy also routes /v1 to the API and handles HTTPS; that Caddyfile
# lives with the deployment (ScribbleScan repo, deploy/Caddyfile) and is mounted in.

FROM docker.io/library/node:24.22.0-alpine AS build
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM docker.io/library/caddy:2.11.7-alpine
COPY --from=build /web/dist /srv/web
