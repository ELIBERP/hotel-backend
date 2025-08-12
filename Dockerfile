FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source code
COPY . .

# Create .env file if needed (can be overridden by volume)
RUN touch .env

# Expose API port
EXPOSE 3000

# Run the app
CMD ["node", "index.js"]
