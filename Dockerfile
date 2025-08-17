# Use official Node.js runtime as base image
FROM node:20-alpine

# Set working directory in container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nosuser -u 1001

# Change ownership of app directory
RUN chown -R nosuser:nodejs /app
USER nosuser

# Expose port
EXPOSE 4015

# Start the application
CMD ["npm", "start"]