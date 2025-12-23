/*
 * Environment Variables Required:
 * - REACT_APP_RECLAIM_APP_ID: Reclaim Protocol Application ID
 * - REACT_APP_RECLAIM_APP_SECRET: Reclaim Protocol Application Secret
 *
 * @see https://dev.reclaimprotocol.org/ - Reclaim Developer Dashboard
 */

import { ReclaimClient } from "@reclaimprotocol/zk-fetch";
import { ReclaimProofRequest } from "@reclaimprotocol/js-sdk";
import "./App.css";
import { useState, useEffect, useCallback } from "react";
import { Toaster, toast } from "react-hot-toast";

/** Backend API URL for signing requests */
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

/** Reclaim Provider ID for Instagram post ownership verification */
const INSTAGRAM_PROVIDER_ID = 'af480885-d01c-4e35-89c7-207cd0f70b11';

function App() {
  /** @type {[Object|null, Function]} zkFetch proof data containing extracted username */
  const [proofData, setProofData] = useState(null);

  /** @type {[boolean, Function]} Loading state for initial post fetch */
  const [isFetching, setIsFetching] = useState(false);

  /** @type {[string, Function]} User-entered Instagram post URL */
  const [instagramUrl, setInstagramUrl] = useState("");

  /** @type {[string|null, Function]} Extracted username from the Instagram post */
  const [username, setUsername] = useState(null);

  /** @type {[boolean, Function]} Loading state for ownership verification */
  const [isVerifying, setIsVerifying] = useState(false);

  /** @type {[Array|null, Function]} Verification proof from Reclaim JS SDK */
  const [verificationProof, setVerificationProof] = useState(null);

  /** @type {[Object|null, Function]} ReclaimProofRequest instance for verification */
  const [reclaimProofRequest, setReclaimProofRequest] = useState(null);

  /** @type {[string|null, Function]} Error message from verification process */
  const [verificationError, setVerificationError] = useState(null);

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  /**
   * Extracts the media code from an Instagram URL
   * Supports both /p/ (posts) and /reel/ URL formats
   *
   * @param {string} url - Instagram post URL
   * @returns {string|null} Media code or null if not found
   *
   * @example
   * extractMediaCode('https://instagram.com/p/ABC123/') // 'ABC123'
   * extractMediaCode('https://instagram.com/reel/XYZ789/') // 'XYZ789'
   */
  const extractMediaCode = (url) => {
    const match = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  };

  /**
   * Extracts and parses post data from verification proofs
   * Combines data from multiple proof objects into a single post object
   *
   * @param {Array} proofs - Array of verification proof objects from Reclaim SDK
   * @returns {Object|null} Parsed post data or null if no proofs
   *
   * @typedef {Object} PostData
   * @property {string|null} username - Post owner's Instagram username
   * @property {string|null} caption - Post caption text
   * @property {string|null} image - Post image URL from Instagram CDN
   * @property {string|null} video - Post video URL (if applicable)
   * @property {number} likes - Number of likes on the post
   * @property {number} comments - Number of comments on the post
   * @property {string|null} mediaCode - Instagram media code identifier
   */
  const extractPostData = (proofs) => {
    if (!proofs || proofs.length === 0) return null;

    let postData = {
      username: null,
      caption: null,
      image: null,
      video: null,
      likes: 0,
      comments: 0,
      mediaCode: null
    };

    for (const proof of proofs) {
      // Extract public data (caption, image, video) from proof
      if (proof.publicData) {
        postData.caption = proof.publicData.caption || postData.caption;
        postData.image = proof.publicData.image || postData.image;
        postData.video = proof.publicData.video || postData.video;
      }

      // Parse the context JSON to get extracted parameters
      try {
        const context = typeof proof.claimData?.context === 'string'
          ? JSON.parse(proof.claimData.context)
          : proof.claimData?.context;

        const params = context?.extractedParameters;
        if (params) {
          postData.username = params.username || postData.username;
          postData.mediaCode = params.media_code || postData.mediaCode;

          // Parse like_count from nested JSON structure
          // Format: {"value":{"results":[{"total_value":N}]}}
          if (params.like_count) {
            try {
              const likeData = JSON.parse(params.like_count);
              postData.likes = likeData?.value?.results?.[0]?.total_value || 0;
            } catch (e) { /* Silently handle parse errors */ }
          }

          // Parse comment_count from nested JSON structure
          if (params.comment_count) {
            try {
              const commentData = JSON.parse(params.comment_count);
              postData.comments = commentData?.value?.results?.[0]?.total_value || 0;
            } catch (e) { /* Silently handle parse errors */ }
          }
        }
      } catch (e) {
        console.error("Error parsing proof context:", e);
      }
    }

    return postData;
  };

  /**
   * Normalizes Instagram URL to embed format for zkFetch
   * Converts standard post URLs to embed format required by the API
   *
   * @param {string} url - Raw Instagram post URL
   * @returns {string} Normalized URL with /embed/ suffix
   *
   * @example
   * normalizeInstagramUrl('https://instagram.com/p/ABC123')
   * // 'https://instagram.com/p/ABC123/embed/'
   */
  const normalizeInstagramUrl = (url) => {
    let normalizedUrl = url.trim();

    // Remove trailing slash if present
    if (normalizedUrl.endsWith("/")) {
      normalizedUrl = normalizedUrl.slice(0, -1);
    }

    // Add /embed/ suffix for Instagram's embed API
    if (!normalizedUrl.includes("/embed")) {
      normalizedUrl = normalizedUrl + "/embed/";
    } else if (!normalizedUrl.endsWith("/")) {
      normalizedUrl = normalizedUrl + "/";
    }

    return normalizedUrl;
  };

  // ============================================
  // RECLAIM VERIFICATION FUNCTIONS
  // ============================================

  /**
   * Initializes the ReclaimProofRequest for post ownership verification
   * Called automatically when username is extracted from zkFetch
   *
   * Uses the Instagram provider to verify the user owns the post
   * by having them authenticate through Instagram in a popup
   */
  const initializeReclaimProofRequest = useCallback(async () => {
    const mediaCode = extractMediaCode(instagramUrl);
    if (!mediaCode) {
      setVerificationError("Could not extract media code from URL.");
      return;
    }

    try {
      // Initialize proof request with Reclaim credentials
      const proofRequest = await ReclaimProofRequest.init(
        process.env.REACT_APP_RECLAIM_APP_ID,
        process.env.REACT_APP_RECLAIM_APP_SECRET,
        INSTAGRAM_PROVIDER_ID,
        {
          useAppClip: false,
          log: true,
          customSharePageUrl: process.env.REACT_APP_CUSTOM_SHARE_PAGE_URL,
        }
      );

      // Set the media code parameter for the provider
      proofRequest.setParams({ media_code: mediaCode });
      setReclaimProofRequest(proofRequest);
    } catch (error) {
      console.error("Error initializing ReclaimProofRequest:", error);
      setVerificationError("Failed to initialize verification. Please try again.");
    }
  }, [instagramUrl]);

  // Auto-initialize verification when username is fetched
  useEffect(() => {
    if (username) {
      initializeReclaimProofRequest();
    }
  }, [username, initializeReclaimProofRequest]);

  /**
   * Starts the verification flow in a popup window
   * Opens a new tab with the Reclaim verification page
   *
   * Handles popup blockers and Safari compatibility issues
   */
  const startVerification = async () => {
    if (!reclaimProofRequest) {
      setVerificationError("Verification not initialized. Please refresh the page.");
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);

    let proofWindow = null;

    try {
      // Pre-emptively open a blank tab for iOS Safari + localhost compatibility
      // This prevents popup blockers from blocking the verification page
      proofWindow = window.open("about:blank", "_blank");

      if (!proofWindow || proofWindow.closed) {
        setIsVerifying(false);
        setVerificationError("Popup was blocked. Please allow popups for this site and try again.");
        return;
      }

      // Get the verification URL from Reclaim
      const requestUrlLink = await reclaimProofRequest.getRequestUrl();

      if (!proofWindow || proofWindow.closed) {
        setIsVerifying(false);
        setVerificationError("Popup window was closed before loading. Please try again.");
        return;
      }

      // Navigate the popup to the verification URL
      proofWindow.location.href = requestUrlLink;

      // Start the Reclaim session and listen for callbacks
      await reclaimProofRequest.startSession({
        onSuccess: (proof) => {
          setIsVerifying(false);
          if (proof && typeof proof !== "string") {
            // Normalize proof to array format
            setVerificationProof(Array.isArray(proof) ? proof : [proof]);
            toast.success("Post verified successfully!");
          } else {
            setVerificationError("Received invalid proof response.");
          }
        },
        onError: (error) => {
          setIsVerifying(false);
          setVerificationError(`Verification error: ${error.message}`);
          if (proofWindow && !proofWindow.closed) {
            proofWindow.close();
          }
        },
      });
    } catch (error) {
      setIsVerifying(false);
      setVerificationError("Failed to start verification. Please try again.");
      if (proofWindow && !proofWindow.closed) {
        try {
          proofWindow.close();
        } catch (e) {
          console.log("Could not close popup window");
        }
      }
    }
  };

  /**
   * Resets all state to initial values
   * Used when starting a new post verification
   */
  const resetAll = () => {
    setProofData(null);
    setUsername(null);
    setVerificationProof(null);
    setVerificationError(null);
    setReclaimProofRequest(null);
    setInstagramUrl("");
  };

  // ============================================
  // ZKFETCH FUNCTIONS
  // ============================================

  /**
   * Generates a ZK proof by fetching Instagram post data
   *
   * Uses zkFetch to:
   * 1. Fetch the Instagram embed page
   * 2. Extract the username using regex
   * 3. Generate a ZK proof of the data
   *
   * The proof can be verified on-chain or off-chain
   */
  const generateProof = async () => {
    if (!instagramUrl) {
      toast.error("Please enter an Instagram URL");
      return;
    }

    setIsFetching(true);
    setUsername(null);

    try {
      // Get session signature from backend
      const getToken = await fetch(`${API_URL}/sign`);
      const tokenData = await getToken.json();

      // Initialize zkFetch client with app credentials
      const reclaim = new ReclaimClient(
        process.env.REACT_APP_RECLAIM_APP_ID,
        tokenData.token
      );

      const url = normalizeInstagramUrl(instagramUrl);
      console.log("Fetching URL:", url);

      // Fetch Instagram embed page with ZK proof generation
      const data = await reclaim.zkFetch(url, {
        method: 'GET',
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Upgrade-Insecure-Requests": "1"
        },
        context: {
          contextAddress: "0x0",
          contextMessage: "instagram_verification"
        },
      }, {
        // Extract username from the HTML response using regex
        responseMatches: [
          {
            type: 'regex',
            value: "span class=\\\"UsernameText\\\">(?<username>[^/]+?)</span>"
          }
        ]
      });

      console.log("zkFetch response:", data);
      setProofData(data);

      // Extract username from the proof's extracted values
      if (data?.extractedParameterValues?.username) {
        setUsername(data.extractedParameterValues.username);
      }

      setIsFetching(false);
      return data;
    } catch (error) {
      setIsFetching(false);
      toast.error(`${error?.message}`);
      console.error("zkFetch error:", error);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      <main className="app">
        <div className="container">
          {/* Header */}
          <header className="header">
            <h1 className="logo">Instagram Demo</h1>
            <p className="subtitle">
              Verify Instagram post ownership with Reclaim Protocol
            </p>
          </header>

          {/* URL Input Card */}
          <div className="card">
            <div className="input-group">
              <input
                type="text"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="Paste Instagram post URL"
                className="input"
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={generateProof}
              disabled={isFetching || !instagramUrl}
            >
              {isFetching ? (
                <>
                  <span className="spinner"></span>
                  Fetching...
                </>
              ) : (
                "Get Post Owner"
              )}
            </button>
          </div>

          {/* Username Result Card - Shows after zkFetch */}
          {username && !isFetching && !verificationProof && (
            <div className="card result-card">
              <p className="result-label">Post Owner</p>
              <p className="username">@{username}</p>

              <button
                className="btn btn-primary"
                onClick={startVerification}
                disabled={isVerifying || !reclaimProofRequest}
              >
                {isVerifying ? (
                  <>
                    <span className="spinner"></span>
                    Verifying...
                  </>
                ) : (
                  "Verify Ownership"
                )}
              </button>

              {!reclaimProofRequest && !verificationError && (
                <p className="status-text">Initializing verification...</p>
              )}
            </div>
          )}

          {/* Error Display */}
          {verificationError && (
            <div className="card error-card">
              <p className="error-text">{verificationError}</p>
            </div>
          )}

          {/* Verified Post Embed - Instagram-style card */}
          {verificationProof && verificationProof.length > 0 && (() => {
            const postData = extractPostData(verificationProof);
            return (
              <div className="embed">
                {/* Post Header */}
                <div className="embed-header">
                  <div className="embed-avatar">
                    {(postData?.username || username)?.charAt(0).toUpperCase()}
                  </div>
                  <div className="embed-user-info">
                    <span className="embed-username">{postData?.username || username}</span>
                  </div>
                </div>

                {/* Post Image */}
                {postData?.image && (
                  <div className="embed-image">
                    <img src={postData.image} alt="Post" />
                  </div>
                )}

                {/* Action Icons */}
                <div className="embed-actions">
                  <div className="embed-action">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </div>
                  <div className="embed-action">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                </div>

                {/* Engagement Stats */}
                <div className="embed-stats">
                  <span className="embed-likes">{postData?.likes || 0} likes</span>
                  <span className="embed-comments">{postData?.comments || 0} comments</span>
                </div>

                {/* Caption */}
                {postData?.caption && (
                  <div className="embed-caption">
                    <span className="embed-caption-user">{postData?.username || username}</span>
                    {' '}{postData.caption}
                  </div>
                )}

                {/* Verification Badge */}
                <div className="embed-footer">
                  <div className="embed-verified-banner">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    Verified with ZK Proof
                  </div>
                </div>

                <button className="btn btn-secondary" onClick={resetAll} style={{ marginTop: '16px' }}>
                  Verify Another Post
                </button>
              </div>
            );
          })()}

          {/* Debug: zkFetch Proof Data */}
          {proofData && !isFetching && (
            <details className="details">
              <summary>zkFetch Proof Data</summary>
              <div className="details-content">
                {JSON.stringify(proofData, null, 2)}
              </div>
            </details>
          )}

          {/* Debug: Verification Proof Data */}
          {verificationProof && verificationProof.length > 0 && (
            <details className="details">
              <summary>Verification Proof Data</summary>
              <div className="details-content">
                {JSON.stringify(verificationProof, null, 2)}
              </div>
            </details>
          )}
        </div>
      </main>
    </>
  );
}

export default App;
