# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Daily News Dashboard** - a media monitoring and alerting system that:
- Collects news for specific clients from RSS feeds and Google Alerts
- Monitors news for: Waymo, Delta Air Lines, Google, StubHub, TikTok, and U.S. Soccer
- Tracks general news from top national outlets (NYT, Washington Post, Politico)
- Stores and deduplicates articles in Redis (Upstash)
- Provides a web dashboard with client-specific filtering
- Features clickable client cards for easy navigation to client-specific articles
- Runs automated collection via Vercel cron jobs
- Filters out press releases, opinion pieces, stock-focused articles, and low-quality content

## Architecture

**Serverless Functions** (`/api/` directory):
- Each `.js` file is a Vercel serverless function
- Uses Node.js ES modules (`"type": "module"` in package.json)
- All functions connect to Upstash Redis for data storage

**Key Components**:
- `collect.js` - Main RSS collection cron job (runs every 4 hours via vercel.json)
- `newsletter_rss_collect.js` - Newsletter RSS collector with AI/legal keyword filtering (runs every 4 hours)
- `meltwater_collect.js` - Meltwater API collector for searchid 27864701 (runs every 4 hours)
- `meltwater_webhook.js` - Receives real-time Meltwater alerts (webhook)
- `ga_webhook.js` - Receives Google Alerts via webhook
- `summary.js` - API endpoint that returns dashboard data
- `meltwater_summary.js` - API endpoint for Meltwater searchid 27864701 data
- `index.html` - Main dashboard frontend (no build step)
- `meltwater.html` - Dedicated Meltwater dashboard for searchid 27864701

**Data Storage**:
- Uses Upstash Redis with sorted sets for time-ordered mentions
- Primary key: `mentions:z` (sorted set by timestamp)
- Deduplication via `mentions:seen:canon` (canonical URLs)
- Additional sets for sentiment analysis and spike detection

## Environment Variables

Required for production:
- `KV4_REST_API_URL` - Upstash Redis URL
- `KV4_REST_API_TOKEN` - Upstash Redis token

Client-specific RSS feeds (Google Alerts or similar):
- `WAYMO_RSS` - RSS feed URL for Waymo articles
- `DELTA_AIR_LINES_RSS` - RSS feed URL for Delta Air Lines articles
- `GOOGLE_RSS` - RSS feed URL for Google articles
- `STUBHUB_RSS` - RSS feed URL for StubHub articles
- `TIKTOK_RSS` - RSS feed URL for TikTok articles
- `US_SOCCER_FOUNDATION_RSS` - RSS feed URL for U.S. Soccer Foundation articles
- `CINDY_PARLOW_CONE_RSS` - RSS feed URL for Cindy Parlow Cone articles (displays combined with US Soccer card)

General news RSS feeds:
- `NYT_TOP_NEWS_RSS` - New York Times top news feed
- `WAPO_NATIONAL_NEWS_RSS` - Washington Post national news feed
- `WAPO_POLITICS_RSS` - Washington Post politics feed
- `POLITICO_RSS` - Politico news feed

Legacy/Optional:
- `RSS_FEEDS` - Semicolon or comma-separated list of RSS feed URLs (fallback for non-entity feeds)
- `RESEND_API_KEY` - For email notifications (optional)
- `GA_WEBHOOK_SECRET` - Google Alerts webhook auth (optional)

## Development Commands

**No build process required** - this is a static site with serverless functions.

**Local development**:
```bash
# Install dependencies
npm install

# Run locally with Vercel CLI
vercel dev
```

**Testing**:
- Test individual API endpoints: `node api/[filename].js` (if modified for local execution)
- Test RSS collection: Hit `/api/collect` endpoint
- Test webhooks: POST to `/api/meltwater_webhook` or `/api/ga_webhook`

## Key Files to Understand

**Core Logic**:
- `api/collect.js:1-100` - RSS parsing, keyword matching, Redis storage
- `api/summary.js:1-50` - Dashboard data aggregation and time windows
- `api/meltwater_webhook.js:25-50` - Meltwater data transformation

**Configuration**:
- `vercel.json` - Cron schedule and CORS headers
- `package.json` - Minimal dependencies (Redis, RSS parser, Resend)

**Frontend**:
- `index.html` - Complete dashboard UI with vanilla JavaScript
- No framework - uses fetch() API to load data from `/api/summary`

## Deployment

Deployed on Vercel with:
- Automatic cron job execution (`/api/collect` every 5 minutes)
- Environment variables set in Vercel dashboard
- Redis storage via Upstash integration

## Data Flow

1. **RSS Collection**: Cron job fetches feeds → parses articles → matches keywords → stores in Redis
2. **Webhook Ingestion**: External services POST to webhook endpoints → transform data → store in Redis
3. **Dashboard**: Frontend fetches from `/api/get_mentions` → displays mentions by time period and source
4. **Deduplication**: All mentions checked against canonical URL set to prevent duplicates

## Recent Changes (2025-12-02)

### Added: Product/Feature Announcement Filter
- **Purpose**: COO managing corporate clients needs strategic, regulatory, and business news - not product launches or feature updates
- **Implementation** (`api/content_filters.js:117-218`):
  - New `isProductAnnouncement()` function filters articles about:
    - Product launches ("launches new", "unveils new", "introduces new", etc.)
    - Feature updates ("new feature", "now available", "gets new", etc.)
    - Tech tutorials ("how to use", "getting started with", etc.)
  - **Business-critical exceptions**: Articles mentioning antitrust, lawsuits, regulation, CEO, layoffs, acquisitions, earnings, data breaches, etc. are NOT filtered even if they mention "new"
  - Filter only applies to client feeds (Waymo, Delta, Google, StubHub, TikTok, US Soccer) - NOT to general news (NYT, WaPo, Politico)

### Fixed: Summary Card Counts Not Loading (2025-12-01)
- **Issue**: The client and category card counts at the top of the dashboard were showing "—" instead of numbers, even though articles were loading in the list
- **Root cause**: The `refreshStats()` function was making a redundant API call that could fail silently, and error handling didn't update the UI
- **Fix** (`index.html:1030-1111`):
  - `refreshStats()` now reuses the `allMentions` array already loaded by `loadMentions()` instead of making a separate API call
  - Added extensive console logging for debugging
  - On error, now sets all counts to `'0'` instead of leaving them as `'—'`
  - Better validation that data is an array before processing