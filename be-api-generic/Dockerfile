FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN bunx prisma generate

# Expose ports
EXPOSE 3000 3001

# Run database migrations and start server
CMD ["sh", "-c", "bunx prisma migrate deploy && bun run src/server.ts"]