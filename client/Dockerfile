FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY public/ ./public
COPY src/ ./src
RUN npm run build
RUN npm install -g serve
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
