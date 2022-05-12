# Prisma binaries doesn't run on Alpine on ARM yet, so we use Debian instead.
#
# Issue: https://github.com/prisma/prisma/issues/8478
FROM node:16

# TODO(ptr): re-enable when we switch back to Alpine
#RUN apk --no-cache add openssl

WORKDIR /app

COPY package.json .
COPY package-lock.json .
COPY packages/glider-connectors/package.json packages/glider-connectors/package.json
COPY packages/glider-runner/package.json packages/glider-runner/package.json
RUN npm ci

COPY packages/glider-connectors packages/glider-connectors
COPY packages/glider-runner packages/glider-runner

ENTRYPOINT ["node", "packages/glider-runner/dist/app.js"]
