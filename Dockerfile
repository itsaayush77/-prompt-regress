# ---- build stage: compile API + UI ----
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY examples ./examples
RUN npm run build
COPY client/package*.json ./client/
RUN npm ci --prefix client
COPY client ./client
RUN npm run build --prefix client
RUN npm prune --omit=dev

# ---- runtime: prod deps + compiled output only ----
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=4000 DEMO_MODE=true
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/examples ./examples
EXPOSE 4000
CMD ["node", "dist/server.js"]
