FROM node:20-alpine

RUN apk add --no-cache tzdata && cp /usr/share/zoneinfo/Europe/Amsterdam /etc/localtime && echo "Europe/Amsterdam" > /etc/timezone

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src

ENV NODE_ENV=production
ENV TZ=Europe/Amsterdam
ENV PORT=3001
ENV SERVER_API_KEY=""

EXPOSE 3001

CMD ["node", "src/index.js"]
