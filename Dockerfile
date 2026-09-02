FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node package.json hang-store.js server.js ./
COPY --chown=node:node public ./public
ENV PORT=8080
ENV HOST=0.0.0.0
ENV NODE_ENV=production
EXPOSE 8080
USER node
CMD ["node", "server.js"]
