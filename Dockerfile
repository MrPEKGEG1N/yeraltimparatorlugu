FROM node:18-bullseye
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV PERSISTENT_DATA_PATH=/data

COPY package*.json ./
RUN npm install --build-from-source

COPY . .

RUN mkdir -p /data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
