FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY hang-store.js server.js ./
COPY public ./public
ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server.js"]
