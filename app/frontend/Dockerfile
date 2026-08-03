FROM node:20-slim

WORKDIR /app

COPY app/frontend/package.json app/frontend/package-lock.json* ./
RUN npm install

COPY app/frontend/ .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
