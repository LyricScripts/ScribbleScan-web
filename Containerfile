FROM docker.io/library/node:24.22.0-alpine AS build
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM docker.io/library/node:24.22.0-alpine AS runner
WORKDIR /web
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /web/public ./public
COPY --from=build /web/.next/standalone ./
COPY --from=build /web/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
