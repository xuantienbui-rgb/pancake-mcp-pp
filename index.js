#!/usr/bin/env node
/**
 * Pancake_MCP PINPOINT
 * Implements Model Context Protocol over stdio (JSON-RPC 2.0)
 * Supports both:
 *   - External API: https://pos.pages.fm/api/v1  (api-key header)
 *   - Internal API: https://pancake.vn/api/v1    (access_token param)
 *
 * Usage:
 *   PANCAKE_API_KEY=your_key PANCAKE_PAGE_ID=your_page_id node index.js
 *
 * Or with JWT token (internal API):
 *   PANCAKE_JWT=your_jwt PANCAKE_PAGE_ID=your_page_id node index.js
 */

const https = require('https');
const readline = require('readline');

// ─── CONFIG ────────────────────────────────────────────────────────────────
const CONFIG = {
  apiKey:    process.env.PANCAKE_API_KEY   || '',
  jwt:       process.env.PANCAKE_JWT       || '',
  pageId:    process.env.PANCAKE_PAGE_ID   || '',
  // External API (official, requires API key from Settings > Application > API KEY)
  extBase:  'pos.pages.fm',
  extPath:  '/api/v1',
  // Internal API (requires JWT from Redux store)
  intBase:  'pancake.vn',
  intPath:  '/api/v1',
};

// Use internal API if JWT provided, otherwise external
const useInternal = () => !!CONFIG.jwt;