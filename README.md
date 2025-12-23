# Instagram Post Verification Demo

Verify Instagram post using zkTLS with [Reclaim Protocol](https://reclaimprotocol.org/).

## Overview

This demo application allows users to:

1. **Fetch post owner** - Enter an Instagram post URL to extract the username using zkFetch
2. **Verify post data** - Prove you own the post through Reclaim's verification flow
3. **View verified post** - Display the verified post in an Instagram-style embed

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  - User enters Instagram URL                                 │
│  - zkFetch extracts username with ZK proof                   │
│  - Reclaim JS SDK verifies post                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Express)                        │
│  - Generates session signatures for zkFetch                  │
│  - Keeps APP_SECRET secure on server                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Reclaim Protocol                          │
│  - zkFetch: Fetches data with ZK proofs                      │
│  - JS SDK: Verifies user owns the Instagram account          │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js 18+
- Reclaim Protocol credentials from [dev.reclaimprotocol.org](https://dev.reclaimprotocol.org/)

## Quick Start

```bash
# Install all dependencies
npm run install:all

# Configure environment variables (see below)

# Run both frontend and backend
npm run dev
```

The app will be available at `http://localhost:3000`.

## Setup

### 1. Install dependencies

```bash
# Install all dependencies (root, backend, frontend)
npm run install:all
```

Or install individually:

```bash
npm install                  # Root dependencies
npm install --prefix backend # Backend dependencies
npm install --prefix frontend # Frontend dependencies
```

### 2. Configure environment variables

**Backend** (`backend/.env`):
```env
APP_ID=your_reclaim_app_id
APP_SECRET=your_reclaim_app_secret
PORT=8080
```

**Frontend** (`frontend/.env`):
```env
REACT_APP_RECLAIM_APP_ID=your_reclaim_app_id
REACT_APP_RECLAIM_APP_SECRET=your_reclaim_app_secret
REACT_APP_API_URL=http://localhost:8080
REACT_APP_CUSTOM_SHARE_PAGE_URL=https://portal.reclaimprotocol.org/kernel

# Optional: Disable source map warnings
GENERATE_SOURCEMAP=false
```

### 3. Start the servers

```bash
# Run both frontend and backend together
npm run dev
```

Or run separately:

```bash
npm run dev:backend   # Start only backend (port 8080)
npm run dev:frontend  # Start only frontend (port 3000)
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run backend + frontend concurrently |
| `npm run dev:backend` | Run only backend |
| `npm run dev:frontend` | Run only frontend |
| `npm run install:all` | Install all dependencies |
| `npm run build` | Build frontend for production |

## Project Structure

```
instagram-demo/
├── package.json          # Root scripts (concurrently)
├── README.md
├── backend/
│   ├── index.ts          # Express server with /sign endpoint
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.js        # Main React component
    │   └── App.css       # style UI
    ├── package.json
    └── .env.example
```

## API Endpoints

### Backend

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/sign` | GET | Generate zkFetch session signature |

## How It Works

### Step 1: Fetch Post Owner (zkFetch)

When a user enters an Instagram URL, the app:

1. Requests a session signature from the backend
2. Uses zkFetch to fetch the Instagram embed page
3. Extracts the username using regex pattern matching
4. Generates a ZK proof of the fetched data

```javascript
const data = await reclaim.zkFetch(url, {
  method: 'GET',
  headers: { /* browser headers */ }
}, {
  responseMatches: [{
    type: 'regex',
    value: 'span class="UsernameText">(?<username>[^/]+?)</span>'
  }]
});
```

### Step 2: Verify Post (JS SDK)

After fetching the username, the user can verify they own the post:

1. Initialize ReclaimProofRequest with the Instagram provider
2. Open verification popup for user to authenticate
3. Receive proof with post metadata (likes, comments, image, etc.)

### Step 3: Display Verified Post

The verified proof contains:
- `username` - Post owner's Instagram username
- `caption` - Post caption text
- `image` - Post image URL
- `likes` - Number of likes
- `comments` - Number of comments

This data is displayed in an Instagram-style embed card.

## Technologies

- **Frontend**: React, react-hot-toast
- **Backend**: Express, TypeScript
- **Build Tools**: concurrently, react-app-rewired
- **Verification**: Reclaim Protocol (zkFetch, JS SDK)

## Resources

- [Reclaim Protocol Docs](https://docs.reclaimprotocol.org/)
- [Reclaim Developer Dashboard](https://dev.reclaimprotocol.org/)
- [zkFetch Documentation](https://docs.reclaimprotocol.org/zkfetch)
