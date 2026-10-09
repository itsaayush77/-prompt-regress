FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY client/dist ./client/dist
COPY dist ./dist
COPY examples ./examples
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
CMD ["node", "dist/server.js"]
