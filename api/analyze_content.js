// Content Quality Analysis - Analyze current Redis articles for filtering improvements
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV3_REST_API_URL,
  token: process.env.KV3_REST_API_TOKEN,
});

const ZSET = "mentions:z";

function toObj(x) {
  if (!x) return null;
  if (typeof x === "object" && x.id) return x;
  try {
    return JSON.parse(x);
  } catch { return null; }
}

export default async function handler(req, res) {
  try {
    // Get all articles from last 24 hours
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - (24 * 60 * 60);

    const raw = await redis.zrange(ZSET, oneDayAgo, now, { byScore: true });
    const articles = raw.map(toObj).filter(Boolean);

    console.log(`Analyzing ${articles.length} articles`);

    // Category patterns to identify
    const patterns = {
      sports: {
        keywords: ['game', 'score', 'playoff', 'championship', 'tournament', 'match', 'win', 'loss', 'defeat', 'beat',
                  'nfl', 'nba', 'mlb', 'nhl', 'mls', 'ncaa', 'football', 'basketball', 'baseball', 'hockey', 'soccer',
                  'coach', 'player', 'team', 'season', 'league'],
        articles: []
      },
      entertainment: {
        keywords: ['movie', 'film', 'actor', 'actress', 'celebrity', 'star', 'tv show', 'series', 'premiere',
                  'red carpet', 'awards', 'grammy', 'emmy', 'oscar', 'golden globe', 'netflix', 'streaming'],
        articles: []
      },
      lifestyle: {
        keywords: ['recipe', 'cooking', 'food', 'restaurant review', 'shopping', 'fashion', 'style', 'beauty',
                  'wellness', 'fitness', 'workout', 'diet', 'home decor', 'gardening', 'diy', 'travel guide'],
        articles: []
      },
      tech_products: {
        keywords: ['review:', 'unboxing', 'hands-on', 'first look', 'iphone', 'android', 'app review',
                  'best phones', 'best laptops', 'tech deals', 'product review', 'gadget review'],
        articles: []
      },
      local_crime: {
        keywords: ['arrested', 'robbery', 'theft', 'burglary', 'assault', 'stabbing', 'shooting', 'murder',
                  'police investigate', 'suspect', 'victim', 'crime scene', 'investigation'],
        articles: []
      },
      weather_traffic: {
        keywords: ['weather', 'forecast', 'temperature', 'storm', 'rain', 'snow', 'traffic', 'commute',
                  'road closure', 'accident on', 'delays'],
        articles: []
      },
      promotional: {
        keywords: ['deals', 'discount', 'sale', 'coupon', 'promo code', 'limited time', 'offer',
                  'buy now', 'shop now', 'save up to', 'best deals', 'price drop'],
        articles: []
      }
    };

    // Categorize articles (skip local news only)
    for (const article of articles) {
      const text = `${article.title} ${article.summary || ''}`.toLowerCase();
      const title = article.title || '';
      const origin = (article.origin || '').toLowerCase();

      // Skip analysis for local news only (DC/MD/VA local news stays unfiltered)
      if (origin === 'wapo_local_rss') {
        continue;
      }

      for (const [category, data] of Object.entries(patterns)) {
        const matchedKeywords = data.keywords.filter(keyword => text.includes(keyword));

        if (matchedKeywords.length > 0) {
          data.articles.push({
            title,
            source: article.source || '',
            origin: article.origin,
            link: article.link || '',
            matched_keywords: matchedKeywords.slice(0, 3) // First 3 matches
          });
        }
      }
    }

    // Generate statistics
    const stats = {
      total_articles: articles.length,
      articles_by_origin: {},
      potential_filter_candidates: 0
    };

    // Count by origin
    for (const article of articles) {
      const origin = article.origin || 'unknown';
      stats.articles_by_origin[origin] = (stats.articles_by_origin[origin] || 0) + 1;
    }

    // Count potential filters
    for (const data of Object.values(patterns)) {
      stats.potential_filter_candidates += data.articles.length;
    }

    // Build detailed report
    const report = {
      summary: {
        total_articles: stats.total_articles,
        articles_by_origin: stats.articles_by_origin,
        potential_filter_candidates: stats.potential_filter_candidates,
        analysis_timestamp: new Date().toISOString()
      },
      categories: {}
    };

    // Add top examples for each category
    for (const [category, data] of Object.entries(patterns)) {
      if (data.articles.length > 0) {
        report.categories[category] = {
          count: data.articles.length,
          examples: data.articles.slice(0, 10), // Top 10 examples
          recommended_keywords: data.keywords.slice(0, 15) // Suggest subset of keywords
        };
      }
    }

    // Generate recommendations
    const recommendations = [];

    if (report.categories.sports) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Sports Coverage',
        issue: `${report.categories.sports.count} sports-related articles found`,
        action: 'Add sports event filter for client feeds (except business news)',
        keywords: ['game', 'score', 'playoff', 'match', 'win', 'loss', 'team']
      });
    }

    if (report.categories.entertainment) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Entertainment News',
        issue: `${report.categories.entertainment.count} entertainment articles found`,
        action: 'Filter entertainment news unless business-related',
        keywords: ['movie', 'celebrity', 'actor', 'tv show', 'premiere']
      });
    }

    if (report.categories.lifestyle) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Lifestyle Content',
        issue: `${report.categories.lifestyle.count} lifestyle articles found`,
        action: 'Filter recipes, shopping guides, fashion content',
        keywords: ['recipe', 'cooking', 'shopping', 'fashion', 'travel guide']
      });
    }

    if (report.categories.tech_products) {
      recommendations.push({
        priority: 'LOW',
        category: 'Tech Product Reviews',
        issue: `${report.categories.tech_products.count} product review articles found`,
        action: 'Filter gadget reviews unless client-related',
        keywords: ['review:', 'unboxing', 'hands-on', 'product review']
      });
    }

    if (report.categories.local_crime) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Local Crime',
        issue: `${report.categories.local_crime.count} local crime articles found`,
        action: 'Filter local crime unless major policy implications',
        keywords: ['arrested', 'robbery', 'stabbing', 'shooting', 'police investigate']
      });
    }

    report.recommendations = recommendations;

    res.status(200).json({
      ok: true,
      report,
      timestamp: new Date().toISOString()
    });

  } catch (e) {
    console.error('Analysis error:', e);
    res.status(500).json({
      ok: false,
      error: e?.message || String(e)
    });
  }
}
