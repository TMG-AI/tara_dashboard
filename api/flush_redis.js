// One-time endpoint to flush old data from Redis
// Call this once to remove all articles and start fresh with filtered data
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV4_REST_API_URL,
  token: process.env.KV4_REST_API_TOKEN,
});

const ZSET = "mentions:z";
const SEEN_ID = "mentions:seen";
const SEEN_LINK = "mentions:seen:canon";

export default async function handler(req, res) {
  try {
    console.log('Starting Redis flush...');

    // Get counts before deletion
    const beforeCount = await redis.zcard(ZSET);
    const beforeSeenIds = await redis.scard(SEEN_ID);
    const beforeSeenLinks = await redis.scard(SEEN_LINK);

    console.log(`Before flush: ${beforeCount} articles, ${beforeSeenIds} seen IDs, ${beforeSeenLinks} seen links`);

    // Delete all keys
    await redis.del(ZSET);
    await redis.del(SEEN_ID);
    await redis.del(SEEN_LINK);

    console.log('Redis flush complete!');

    res.status(200).json({
      ok: true,
      message: 'Redis flushed successfully - all old data removed',
      deleted: {
        articles: beforeCount,
        seen_ids: beforeSeenIds,
        seen_links: beforeSeenLinks
      },
      next_steps: 'Click "Get Latest News" to collect fresh filtered articles',
      timestamp: new Date().toISOString()
    });

  } catch (e) {
    console.error('Flush error:', e);
    res.status(500).json({
      ok: false,
      error: e?.message || String(e)
    });
  }
}
