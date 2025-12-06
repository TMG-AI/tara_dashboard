// Webhook to receive newsletter summaries from n8n
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV4_REST_API_URL,
  token: process.env.KV4_REST_API_TOKEN,
});

const ZSET = "mentions:z";
const SEEN_ID = "mentions:seen";
const SEEN_LINK = "mentions:seen:canon";
const RETENTION_HOURS = 336; // Keep articles for 2 weeks (14 days)

function idFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return `newsletter_summary_${h.toString(16)}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    console.log("=== NEWSLETTER WEBHOOK START ===");
    console.log("Request method:", req.method);
    console.log("Content-Type:", req.headers['content-type']);

    const webhookSecret = process.env.NEWSLETTER_SUMMARY_WEBHOOK_SECRET;

    // Optional: Verify webhook secret if configured
    if (webhookSecret) {
      const authHeader = req.headers.authorization;
      // Also check query param for secret
      const url = new URL(req.url, 'http://localhost');
      const querySecret = url.searchParams.get('key') || url.searchParams.get('secret');

      if ((!authHeader || authHeader !== `Bearer ${webhookSecret}`) && querySecret !== webhookSecret) {
        console.error("Unauthorized webhook attempt - no valid auth header or query param");
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    let body = req.body;

    // Handle string body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
        console.log("Parsed string body to JSON");
      } catch (e) {
        console.error("Failed to parse body as JSON:", e.message);
        return res.status(400).json({ error: "Invalid JSON body" });
      }
    }

    console.log("Body type:", typeof body);
    console.log("Body keys:", Object.keys(body || {}));
    console.log("Newsletter summary webhook received:", JSON.stringify(body).substring(0, 1000));

    // Expected format from n8n:
    // {
    //   "newsletterDetails": [
    //     {
    //       "name": "Newsletter Name",
    //       "articles": [
    //         {
    //           "headline": "Article headline",
    //           "summary": "Article summary",
    //           "index": 0
    //         }
    //       ]
    //     }
    //   ],
    //   "totalNewsletters": 2,
    //   "totalArticles": 5,
    //   "generatedAt": "2025-01-13T...",
    //   "generatedDate": "Monday, January 13, 2025"
    // }

    const newsletters = body.newsletterDetails || body.newsletters || [];

    if (!Array.isArray(newsletters) || newsletters.length === 0) {
      return res.status(400).json({
        error: "Invalid format. Expected 'newsletterDetails' or 'newsletters' array"
      });
    }

    let stored = 0;
    const now = Math.floor(Date.now() / 1000);
    const errors = [];

    // Get today's date for deduplication
    const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Process each newsletter
    for (const newsletter of newsletters) {
      const newsletterName = newsletter.name || newsletter.title || "Unknown Newsletter";
      const articles = newsletter.articles || [];

      // Check if newsletter has a direct summary (not individual articles)
      const directSummary = newsletter.summary || newsletter.content || newsletter.text || newsletter.bullets || "";

      console.log(`Processing newsletter: ${newsletterName}, articles: ${articles.length}, has direct summary: ${!!directSummary}`);
      console.log(`Newsletter object keys:`, Object.keys(newsletter));

      // If there are individual articles, process them
      if (articles.length > 0) {
        for (const article of articles) {
          try {
            console.log(`Article fields from n8n:`, Object.keys(article));

            const title = article.headline || article.title || article.name || "Newsletter Article";
            const summary = article.summary || "";
            const link = article.link || article.url || null;

            console.log(`Parsed title: "${title}" from newsletter: ${newsletterName}`);

            const uniqueStr = `${newsletterName}_${title}_${body.generatedDate || body.date || todayDate}`;
            const articleId = idFromString(uniqueStr);

            const addId = await redis.sadd(SEEN_ID, articleId);
            if (addId !== 1) {
              console.log(`Skipping duplicate: ${title}`);
              continue;
            }

            if (link && link.startsWith('http')) {
              const addLink = await redis.sadd(SEEN_LINK, link);
              if (addLink !== 1) {
                console.log(`Skipping duplicate link: ${link}`);
                continue;
              }
            }

            const cleanTitle = title.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();

            const m = {
              id: articleId,
              title: cleanTitle,
              link: link && link.startsWith('http') ? link : null,
              source: newsletterName,
              provider: newsletterName,
              summary: summary,
              origin: "newsletter",
              section: "Newsletter",
              published_ts: now,
              published: new Date(now * 1000).toISOString(),
              reach: 0,
              newsletter_summary: true,
              no_link: !link || !link.startsWith('http')
            };

            await redis.zadd(ZSET, { score: now, member: JSON.stringify(m) });
            stored++;
            console.log(`Stored article: ${m.title}`);
          } catch (err) {
            console.error(`Error processing article "${article.headline || article.title}":`, err);
            errors.push({
              newsletter: newsletterName,
              article: article.headline || article.title,
              error: err?.message || String(err)
            });
          }
        }
      }
      // If no articles array but has a direct summary, store the whole newsletter as one entry
      else if (directSummary) {
        try {
          const cleanName = newsletterName.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|📧|📊|🧠|🤖/gu, '').trim();

          // Use date in ID to allow one entry per newsletter per day
          const uniqueStr = `${cleanName}_${todayDate}`;
          const articleId = idFromString(uniqueStr);

          const addId = await redis.sadd(SEEN_ID, articleId);
          if (addId !== 1) {
            console.log(`Skipping duplicate newsletter summary: ${cleanName}`);
            continue;
          }

          const m = {
            id: articleId,
            title: `${cleanName} - Daily Summary`,
            link: null,
            source: cleanName,
            provider: cleanName,
            summary: directSummary,
            origin: "newsletter",
            section: "Newsletter",
            published_ts: now,
            published: new Date(now * 1000).toISOString(),
            reach: 0,
            newsletter_summary: true,
            no_link: true
          };

          await redis.zadd(ZSET, { score: now, member: JSON.stringify(m) });
          stored++;
          console.log(`Stored newsletter summary: ${cleanName}`);
        } catch (err) {
          console.error(`Error processing newsletter summary "${newsletterName}":`, err);
          errors.push({
            newsletter: newsletterName,
            error: err?.message || String(err)
          });
        }
      } else {
        console.log(`Newsletter ${newsletterName} has no articles and no summary - skipping`);
      }
    }

    // Cleanup old articles
    const cutoffTimestamp = now - (RETENTION_HOURS * 60 * 60);
    await redis.zremrangebyscore(ZSET, '-inf', cutoffTimestamp);

    console.log(`Newsletter summary webhook complete: ${stored} articles stored`);

    return res.status(200).json({
      ok: true,
      message: `Stored ${stored} newsletter summary articles`,
      stored,
      date: body.generatedDate || body.date,
      newsletters_processed: newsletters.length,
      total_articles: body.totalArticles || body.total_articles,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    });

  } catch (e) {
    console.error("Newsletter summary webhook error:", e);
    res.status(500).json({
      ok: false,
      error: e?.message || String(e)
    });
  }
}
