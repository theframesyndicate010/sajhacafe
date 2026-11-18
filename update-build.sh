#!/usr/bin/env bash
set -Eeuo pipefail

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$project_dir"

echo "Pulling latest code..."
git pull --ff-only

echo "Installing backend dependencies..."
(cd backend && npm ci)

echo "Generating Prisma client..."
(cd backend && npm run prisma:generate)

echo "Applying Prisma migrations..."
(cd backend && npx prisma migrate deploy)

echo "Building backend..."
(cd backend && npm run build)

echo "Backend build and migrations completed. Frontend was not changed or built."
