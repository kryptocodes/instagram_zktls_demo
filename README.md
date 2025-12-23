# Instagram Post Verification Demo

Verify Instagram post ownership using zkTLS [Reclaim Protocol](https://reclaimprotocol.org/).

## Overview

This demo application allows users to:

1. **Fetch post owner** - Enter an Instagram post URL to extract the username using zkFetch
2. **Verify ownership** - Prove you own the post through Reclaim's verification flow
3. **View verified post** - Display the verified post in an Instagram-style embed

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  - User enters Instagram URL                                 │
│  - zkFetch extracts username with ZK proof                   │
│  - Reclaim JS SDK verifies post ownership                    │
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

## Setup

### 1. Clone and install dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
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
REACT_APP_CUSTOM_SHARE_PAGE_URL=SHARE_PAGE_URL
```

### 3. Start the servers

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm start
```

The app will be available at `http://localhost:3000`.

## Project Structure

```
instagram_demo/
├── backend/
│   ├── index.ts          # Express server with /sign endpoint
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.js        # Main React component
│   │   └── App.css       # Instagram-style UI
│   ├── package.json
│   └── .env
└── README.md
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

### Step 2: Verify Ownership (JS SDK)

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
- **Verification**: Reclaim Protocol (zkFetch, JS SDK)

## Resources

- [Reclaim Protocol Docs](https://docs.reclaimprotocol.org/)
- [Reclaim Developer Dashboard](https://dev.reclaimprotocol.org/)
- [zkFetch Documentation](https://docs.reclaimprotocol.org/zk-fetch)
