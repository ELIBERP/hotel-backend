FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source code
COPY . .
ENV NODE_ENV=production PORT=10000

# Do NOT copy .env; Render mounts it at /etc/secrets/.env
# Start the server
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

# Expose API port
EXPOSE 3000

# Run the app
CMD ["node", "index.js"]