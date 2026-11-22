# Naan

A modern, glassmorphism browser chat application built with React, TypeScript, and Tailwind CSS — designed to work both as a **single self-contained HTML file** on **GitHub Pages** (with zero backend required) and with an optional Node.js WebSocket server.

---

## Key Features

- **Direct Real-Time Cross-Device Chat**
  - **GitHub Pages / Static Hosting (`E2EE Relay`)**: Automatically detects static environments (no Node backend required) and connects over WebSockets using **SHA-256 derived topics** and **256-bit AES-GCM (Web Crypto)** room encryption.
  - **Self-Hosted WebSocket Mode**: Automatically switches to the built-in `/ws` Express + `ws` server when running on Node.js (or any custom WebSocket URL configured in room settings).
  - **Instant Room Invites**: Share a 6-character room code or `?room=CODE` invite link to sync participants, online presence, typing indicators, messages, polls, and checklists live.
- **Clean Workspace & Contacts Management**
  - Starts completely clean with **zero predefined contacts or groups**.
  - Add contacts by `@username` or unique ID, search across contacts, mark favorites, edit your own profile, and launch direct chats.
- **Rich Messaging & Productivity**
  - **Formatting & Media**: Markdown toolbar (bold, italic, inline code, code blocks, quotes, links), file attachments, voice notes, and an interactive drawing/sketch whiteboard.
  - **Interactive Content**: Single/multi-choice live polls, shared checklists, custom stickers, visual effects (confetti, sparkle), replies, edits, pins, emoji reactions, and starred/bookmarked messages.
  - **Local Sync & Export**: Persistent local storage via **IndexedDB**, instant multi-tab sync via **BroadcastChannel**, encrypted `#sync=` sharing packets, and standalone HTML chat archive exports.
- **6 Glassmorphism Themes**
  - **Aurora Cobalt**, **Sunset Coral**, **Jade Breeze**, **Sapphire Night**, **Amethyst Cosmos**, and **Slate Glass** (light and dark modes) with smooth Framer Motion transitions and `Mona Sans` / `Plus Jakarta Sans` / `JetBrains Mono` typography.
- **7 Languages with Automatic RTL**
  - Switch live between **Catalan**, **Spanish**, **English**, **Portuguese**, **German**, **Chinese**, and **Arabic** (with automatic `RTL` layout direction).

---

## Deploying to GitHub Pages

### Option A: Automatic Deployment with GitHub Actions (Recommended)
This repository includes a preconfigured workflow at `.github/workflows/deploy.yml`:

1. Push or upload the repository files (including `.github/workflows/deploy.yml` and `src/`) to GitHub.
2. Open your repository **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. The workflow will build the single-file bundle and publish it automatically on every push to `main` or `master` (or manually via the **Actions** tab).

### Option B: Manual Single-File Upload
Because Vite is configured to inline all JS and CSS assets into a single file (`base: './'`):

```bash
npm install
npm run build
```

Upload the generated single `dist/index.html` file to any static host (or a GitHub Pages branch root) and it works out of the box.

---

## Running Locally (Optional Full-Stack Server)

Requirements: **Node.js 20+**

```bash
# Install dependencies
npm install

# Start the development server + WebSocket backend on http://localhost:3000
npm run dev
```

Other useful scripts:

```bash
# Type-check with TypeScript
npm run lint

# Build single-file production bundle (dist/index.html)
npm run build

# Start production Node + WebSocket server
npm start

# Run unit tests
npx tsx --test src/utils/chatLogic.test.ts src/utils/mqttRelay.test.ts src/i18n/translations.test.ts
```

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion (`motion/react`), Lucide Icons
- **Crypto & Storage**: Web Crypto API (AES-GCM & SHA-256), IndexedDB, BroadcastChannel
- **Realtime**: Pure-TypeScript MQTT 3.1.1 over WSS relay + Node.js Express & `ws` WebSocket server
- **Bundler**: Vite (single-file HTML inline build)
