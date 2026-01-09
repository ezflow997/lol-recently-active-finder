#!/bin/bash
# Setup script for GitHub Codespaces

echo "Installing Chrome dependencies..."
sudo apt-get update
sudo apt-get install -y \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpango-1.0-0 \
  libcairo2

echo "Installing npm packages..."
npm install

echo "Installing Chrome browser..."
npx puppeteer browsers install chrome

echo ""
echo "Setup complete! Run 'npm run ui' to start the server."
