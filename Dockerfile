FROM node:18-alpine AS builder-frontend

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:18-alpine AS builder-backend

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./

FROM node:18-alpine

WORKDIR /app

COPY --from=builder-frontend /app/frontend/dist ./frontend/dist
COPY --from=builder-backend /app/backend ./backend

WORKDIR /app/backend

EXPOSE 3001

CMD ["node", "src/server.js"]
