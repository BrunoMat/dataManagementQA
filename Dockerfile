# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy monorepo root package files
COPY package.json package-lock.json ./

# Copy packages and apps package files for better caching
# (We need to recreate the structure for npm install to work with workspaces)
COPY apps/management-test/package.json ./apps/management-test/
COPY packages/salesforce/package.json ./packages/salesforce/
COPY packages/db/package.json ./packages/db/
COPY packages/ui-kit/package.json ./packages/ui-kit/

# Install dependencies (workspaces will be handled by npm)
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Start the application using the workspace script
CMD ["npm", "run", "mt"]
