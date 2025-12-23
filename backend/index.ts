/**
 * Instagram Verification Backend Server
 *
 * This Express server provides session signature generation for the
 * Reclaim Protocol zkFetch client. It acts as a secure intermediary
 * that signs requests without exposing the app secret to the frontend.
 *
 * Endpoints:
 * - GET /       : Health check endpoint
 * - GET /sign   : Generate session signature for zkFetch
 *
 * Environment Variables Required:
 * - APP_ID      : Reclaim Protocol Application ID
 * - APP_SECRET  : Reclaim Protocol Application Secret
 * - PORT        : Server port (optional, defaults to 8080)
 *
 * @see https://dev.reclaimprotocol.org/ - Reclaim Developer Dashboard
 */

import express, { Request, Response } from 'express';
import { generateSessionSignature } from '@reclaimprotocol/zk-fetch';
import dotenv from 'dotenv';
import cors from 'cors';

// Load environment variables from .env file
dotenv.config();

const PORT = process.env.PORT || 8080;

/** Reclaim Application ID from environment */
const APP_ID = process.env.APP_ID!;
/** Reclaim Application Secret from environment */
const APP_SECRET = process.env.APP_SECRET!;

/**
 * Allowed URL patterns for zkFetch requests
 * These patterns determine which URLs the signed token can access
 */
const ALLOWED_URLS = [
  'https://www.instagram.com/p/*',    // Instagram posts
  'https://www.instagram.com/reel/*'  // Instagram reels
];

/** Session token expiry time in seconds (1 hour) */
const TOKEN_EXPIRY_SECONDS = 3600;

// ============================================
// EXPRESS APP SETUP
// ============================================

const app = express();

// Enable CORS for frontend requests
// In production, restrict this to your frontend domain
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// ============================================
// ROUTES
// ============================================

/**
 * Health Check Endpoint
 *
 * @route GET /
 * @returns {string} Simple health check message
 *
 * @example
 * curl http://localhost:8080/
 * // Response: "gm gm! api is running"
 */
app.get('/', (_req: Request, res: Response) => {
  res.send('gm gm! api is running');
});

/**
 * Generate Session Signature
 *
 * Creates a signed session token that the frontend can use with zkFetch.
 * The token is time-limited and restricted to specific URL patterns.
 *
 * This endpoint keeps the APP_SECRET secure on the backend while
 * allowing the frontend to make authenticated zkFetch requests.
 *
 * @route GET /sign
 * @returns {Object} JSON object containing the session token
 * @returns {string} token - Signed session signature for zkFetch
 *
 * @example
 * curl http://localhost:8080/sign
 * // Response: { "token": "eyJhbGciOiJIUzI1NiIs..." }
 *
 * @throws {500} If signature generation fails
 */
app.get('/sign', async (_req: Request, res: Response) => {
  try {
    // Generate a time-limited session signature
    const signature = await generateSessionSignature({
      applicationId: APP_ID,
      applicationSecret: APP_SECRET,
      allowedUrls: ALLOWED_URLS,
      expiresAt: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS
    });

    return res.status(200).json({ token: signature });
  } catch (error) {
    console.error('Error generating session signature:', error);
    return res.status(500).json({
      error: 'Failed to generate session signature',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
