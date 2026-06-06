FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy frontend and build it
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci && VITE_API_URL=/api npm run build

# Copy rest of source
COPY . .
RUN rm -rf frontend/node_modules frontend/src frontend/public

EXPOSE 8080
ENV NODE_ENV=production
ENV TESS_PATH=tesseract
ENV PDFTOPPM_PATH=pdftoppm

CMD ["node", "server.js"]
