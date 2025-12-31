FROM node:18-alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --production
COPY . .
RUN mkdir -p /usr/src/app/data
ENV PORT=3000
EXPOSE 3000
CMD ["node", "app.js"]
