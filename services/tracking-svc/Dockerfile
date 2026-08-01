FROM node:20-alpine
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN NODE_OPTIONS="--max-old-space-size=512" npm ci
COPY src/ ./src
RUN NODE_OPTIONS="--max-old-space-size=512" npx tsc
EXPOSE 4002
CMD ["node", "dist/index.js"]
