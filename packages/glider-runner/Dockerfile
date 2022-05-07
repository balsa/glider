FROM node:16-alpine

WORKDIR /app

COPY package.json .
COPY package-lock.json .
COPY packages/glider-connectors/package.json packages/glider-connectors/package.json
COPY packages/glider-runner/package.json packages/glider-runner/package.json
RUN npm ci

COPY tsconfig.json .
COPY tsconfig.build.json .

COPY packages/glider-connectors packages/glider-connectors
COPY packages/glider-runner packages/glider-runner

RUN npm run build

ENTRYPOINT ["node", "packages/glider-runner/dist/app.js"]
