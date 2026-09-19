# ==============================================================================
# Multi-stage Dockerfile for Production Deployment
# ==============================================================================

# Stage 1: Build the Vite frontend and bundle the Express server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install all dependencies (including devDependencies for build tools)
RUN npm install

# Copy application source code
COPY . .

# Build Vite client and esbuild server.cjs
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Create whatsapp session storage directory
RUN mkdir -p whatsapp_session logs

# Expose standard application port
EXPOSE 3000

# Start server
CMD ["node", "dist/server.cjs"]
