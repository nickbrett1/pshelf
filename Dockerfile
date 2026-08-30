# Multi-stage image for pshelf
# Stage 1 (build): copies the full source tree, installs dependencies and
# builds the application. Stage 2 (runtime): copies only the adapter-node build
# output (self-contained — bundles all app deps; only node:* builtins remain),
# so no production `npm ci` is needed and the image stays small.
#
# The `prepare` script (simple-git-hooks) is dev-only and would fail a runtime
# `npm ci --omit=dev`, so we avoid installing anything in the runtime stage.

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

FROM node:24-slim
# Link the GHCR container package to its GitHub repo (public repo -> public package).
LABEL org.opencontainers.image.source=https://github.com/nickbrett1/pshelf
WORKDIR /app

ENV NODE_ENV=production
COPY --from=build /app/build ./build
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "build/index.js"]
