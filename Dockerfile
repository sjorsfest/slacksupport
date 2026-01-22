FROM node:20-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:20-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
WORKDIR /app
# Include tsx for running server.ts in production
RUN npm ci --omit=dev && npm install tsx

FROM node:20-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

FROM node:20-alpine
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
# Copy server.ts and app folder for Discord Gateway and BullMQ workers
COPY ./server.ts /app/
COPY ./app /app/app
# Copy prisma schema (needed for Prisma client)
COPY ./prisma /app/prisma
WORKDIR /app
# Use custom server that initializes Discord Gateway and job workers
CMD ["npm", "run", "start:custom"]