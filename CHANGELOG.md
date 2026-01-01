# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-01-01

### Features

- **Temporary Email Service**
  - Receive emails with multiple domain support
  - 24-hour automatic cleanup
  - Email history management

- **AI Intelligent Analysis** (Cloudflare Workers AI)
  - Automatic verification code extraction
  - Email summary generation (Chinese/English)
  - Spam detection
  - Multi-language translation (zh, en, ja, ko, fr, de, es, ru)
  - URL safety detection

- **Short Link Service**
  - URL shortening with custom codes
  - Click statistics
  - Expiration support
  - Safety warning

- **GitHub Proxy**
  - Git clone acceleration
  - File download proxy
  - Rate limiting protection

- **File Acceleration**
  - Any HTTPS file download
  - Range request support
  - No file size limit

- **Send Email**
  - Send emails via Resend API
  - IP geolocation logging

### Technical

- Cloudflare Workers for edge deployment
- MySQL backend with Node.js Express
- ES Module format for Workers AI support
- ModelScope API as AI fallback
- Responsive dark theme UI

### Configuration

- `API_BASE` - Backend API URL
- `ADMIN_KEY` - Admin authentication key
- `AI` binding - Cloudflare Workers AI
- `MODELSCOPE_KEY` - ModelScope API key (optional)

## [0.9.0] - 2025-12-30

### Initial Release

- Basic email receiving functionality
- Domain management
- GitHub proxy
- File download proxy

