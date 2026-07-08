FROM node:20-alpine
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src
RUN npx tsc
EXPOSE 4003
CMD ["node", "dist/index.js"]
