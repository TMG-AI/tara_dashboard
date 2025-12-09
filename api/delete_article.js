// Delete a specific article from Redis by title match
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV4_REST_API_URL,
  token: process.env.KV4_REST_API_TOKEN,
});

const ZSET = "mentions:z";

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const titleMatch = url.searchParams.get("title") || "";

    if (!titleMatch) {
      return res.status(400).json({ error: "Provide ?title= parameter" });
    }

    // Get all items
    const now = Math.floor(Date.now() / 1000);
    const twoWeeksAgo = now - (14 * 24 * 60 * 60);
    const raw = await redis.zrange(ZSET, twoWeeksAgo, now, { byScore: true, withScores: false });

    let deleted = 0;
    const deletedItems = [];

    for (const item of raw) {
      try {
        const parsed = typeof item === 'string' ? JSON.parse(item) : item;
        if (parsed.title && parsed.title.toLowerCase().includes(titleMatch.toLowerCase())) {
          // Remove this item from the sorted set
          await redis.zrem(ZSET, typeof item === 'string' ? item : JSON.stringify(item));
          deleted++;
          deletedItems.push(parsed.title);
        }
      } catch (e) {
        // Skip unparseable items
      }
    }

    res.status(200).json({
      ok: true,
      deleted,
      deleted_items: deletedItems,
      search_term: titleMatch
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
