FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY hang-store.js hang-persist.js stats-store.js server.js ./
COPY public ./public
ENV HOST=0.0.0.0
ENV PORT=8080
ENV STATS_DB=/data/stats.sqlite
RUN mkdir -p /data
EXPOSE 8080
# root so the Fly volume at /data is writable
USER root
CMD ["node", "server.js"]
