// Remove a specific article from Redis by ID
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV4_REST_API_URL,
  token: process.env.KV4_REST_API_TOKEN
});

const ZSET = "mentions:z";
const SEEN_ID = "mentions:seen";
const SEEN_LINK = "mentions:seen:canon";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const { article_id } = req.body;

    if (!article_id) {
      return res.status(400).json({ error: "article_id required" });
    }

    // Get all articles from ZSET
    const raw = await redis.zrange(ZSET, 0, -1);
    const articles = raw.map(x => {
      try {
        return JSON.parse(x);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Find the article to remove
    const articleToRemove = articles.find(a => a.id === article_id);

    if (!articleToRemove) {
      return res.status(404).json({ error: "Article not found", article_id });
    }

    // Remove from ZSET (sorted set)
    await redis.zrem(ZSET, JSON.stringify(articleToRemove));

    // Remove from SEEN_ID set
    await redis.srem(SEEN_ID, article_id);

    // Remove from SEEN_LINK set if canon exists
    if (articleToRemove.canon) {
      await redis.srem(SEEN_LINK, articleToRemove.canon);
    }

    console.log(`Removed article: ${article_id} - "${articleToRemove.title}"`);

    return res.status(200).json({
      ok: true,
      message: "Article removed",
      removed: {
        id: articleToRemove.id,
        title: articleToRemove.title,
        origin: articleToRemove.origin
      }
    });

  } catch (e) {
    console.error("Remove article error:", e);
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e)
    });
  }
}
