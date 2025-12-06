// Debug endpoint to check newsletters in Redis
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV4_REST_API_URL,
  token: process.env.KV4_REST_API_TOKEN,
});

const ZSET = "mentions:z";

export default async function handler(req, res) {
  try {
    // Get all items from last 14 days
    const now = Math.floor(Date.now() / 1000);
    const twoWeeksAgo = now - (14 * 24 * 60 * 60);

    const raw = await redis.zrange(ZSET, twoWeeksAgo, now, { byScore: true });

    const items = raw.map(x => {
      try {
        return JSON.parse(x);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Filter for newsletters only
    const newsletters = items.filter(m => (m.origin || "").toLowerCase() === "newsletter");

    // Get all unique origins to see what we have
    const allOrigins = {};
    items.forEach(item => {
      const origin = item.origin || 'unknown';
      allOrigins[origin] = (allOrigins[origin] || 0) + 1;
    });

    res.status(200).json({
      total_items: items.length,
      total_newsletters: newsletters.length,
      newsletters: newsletters.map(n => ({
        id: n.id,
        title: n.title,
        source: n.source,
        origin: n.origin,
        published: n.published,
        published_ts: n.published_ts,
        age_hours: Math.round((now - n.published_ts) / 3600)
      })),
      all_origins: allOrigins,
      timestamp_now: now,
      timestamp_14days_ago: twoWeeksAgo,
      date_now: new Date(now * 1000).toISOString(),
      date_14days_ago: new Date(twoWeeksAgo * 1000).toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
