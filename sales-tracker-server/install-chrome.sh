#!/bin/bash
set -e

echo "Installing Chrome for Puppeteer..."

# Install Chrome using puppeteer
npx puppeteer browsers install chrome

echo "Chrome installation complete!"
