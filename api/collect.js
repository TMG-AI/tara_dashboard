import { Redis } from "@upstash/redis";
import Parser from "rss-parser";
import { Resend } from "resend";
import { isBlockedDomain, extractDomain } from "./blocked_domains.js";
import { isInternationalArticle, getBlockReason } from "./international_filter.js";
import { shouldFilterArticle, isStockPriceFocused, isOpinionPiece } from "./content_filters.js";

// ---- clients ----
const redis = new Redis({
  url: process.env.KV3_REST_API_URL,
  token: process.env.KV3_REST_API_TOKEN
});

// Enable YouTube/media fields & add requestOptions for UA
const parser = new Parser({
  customFields: {
    item: [
      ['media:group', 'media', { keepArray: false }],
      ['media:description', 'mediaDescription'],
      ['media:content', 'mediaContent', { keepArray: false }],
      ['media:thumbnail', 'mediaThumb', { keepArray: false }],
    ]
  },
  requestOptions: {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8',
    },
    timeout: 10000
  }
});

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// ---- storage keys ----
const ZSET = "mentions:z";
const SEEN_ID = "mentions:seen";
const SEEN_LINK = "mentions:seen:canon";

// Dynamic retention: 24 hours on weekdays, 72 hours on weekends
function getRetentionHours() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

  // Weekend (Friday evening through Sunday): keep 72 hours
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 72; // Saturday & Sunday: 3 days
  }

  // Weekdays: keep 24 hours
  return 24;
}

// ---- config ----
// Support both old RSS_FEEDS variable and new entity-specific feeds
const RSS_FEEDS = (process.env.RSS_FEEDS || "").split(/[,;]/).map(s => s.trim()).filter(Boolean);

// Entity-specific RSS feeds
const ENTITY_FEEDS = {
  // General News Feeds
  'nyt_top_news_rss': process.env.NYT_TOP_NEWS_RSS,
  'wapo_national_news_rss': process.env.WAPO_NATIONAL_NEWS_RSS,
  'wapo_politics_rss': process.env.WAPO_POLITICS_RSS,
  'politico_rss': process.env.POLITICO_RSS,
  'wapo_local_rss': process.env.WAPO_LOCAL_RSS,

  // Client RSS Feeds
  'adelanto_healthcare_ventures_rss': process.env.ADELANTO_HEALTHCARE_VENTURES_RSS,
  'albemarle_rss': process.env.ALBEMARLE_RSS,
  'albertsons_rss': process.env.ALBERTSONS_RSS,
  'american_bridge_rss': process.env.AMERICAN_BRIDGE_RSS,
  'american_independent_media_rss': process.env.AMERICAN_INDEPENDENT_MEDIA_RSS,
  'arizona_public_service_rss': process.env.ARIZONA_PUBLIC_SERVICE_RSS,
  'ascension_health_services_rss': process.env.ASCENSION_HEALTH_SERVICES_RSS,
  'barclays_rss': process.env.BARCLAYS_RSS,
  'blockchain_com_rss': process.env.BLOCKCHAIN_COM_RSS,
  'capturerx_sisurx_rss': process.env.CAPTURERX_SISURX_RSS,
  'christen_democratisch_appel_rss': process.env.CHRISTEN_DEMOCRATISCH_APPEL_RSS,
  'davita_rss': process.env.DAVITA_RSS,
  'delta_air_lines_rss': process.env.DELTA_AIR_LINES_RSS,
  'democracy_matters_rss': process.env.DEMOCRACY_MATTERS_RSS,
  'duke_energy_rss': process.env.DUKE_ENERGY_RSS,
  'eigen_labs_rss': process.env.EIGEN_LABS_RSS,
  'evgo_rss': process.env.EVGO_RSS,
  'front_financial_mesh_rss': process.env.FRONT_FINANCIAL_MESH_RSS,
  'general_intelligence_agency_mongolia_rss': process.env.GENERAL_INTELLIGENCE_AGENCY_MONGOLIA_RSS,
  'genesis_digital_assets_rss': process.env.GENESIS_DIGITAL_ASSETS_RSS,
  'google_rss': process.env.GOOGLE_RSS,
  'guardant_health_rss': process.env.GUARDANT_HEALTH_RSS,
  'hongshan_capital_advisors_rss': process.env.HONGSHAN_CAPITAL_ADVISORS_RSS,
  'jim_messina_rss': process.env.JIM_MESSINA_RSS,
  'jones_walker_rss': process.env.JONES_WALKER_RSS,
  'keep_americans_covered_rss': process.env.KEEP_AMERICANS_COVERED_RSS,
  'kelvin_zero_rss': process.env.KELVIN_ZERO_RSS,
  'mayday_health_rss': process.env.MAYDAY_HEALTH_RSS,
  'methodic_labs_rss': process.env.METHODIC_LABS_RSS,
  'online_lenders_alliance_rss': process.env.ONLINE_LENDERS_ALLIANCE_RSS,
  'portland_general_electric_rss': process.env.PORTLAND_GENERAL_ELECTRIC_RSS,
  'public_first_rss': process.env.PUBLIC_FIRST_RSS,
  'roland_berger_rss': process.env.ROLAND_BERGER_RSS,
  'rowland_huelin_phil_romeril_rss': process.env.ROWLAND_HUELIN_PHIL_ROMERIL_RSS,
  'santander_rss': process.env.SANTANDER_RSS,
  'sequence_inc_rss': process.env.SEQUENCE_INC_RSS,
  'sharrow_marine_rss': process.env.SHARROW_MARINE_RSS,
  'signum_global_advisors_rss': process.env.SIGNUM_GLOBAL_ADVISORS_RSS,
  'simpson_thatcher_bartlett_rss': process.env.SIMPSON_THATCHER_BARTLETT_RSS,
  'skydance_rss': process.env.SKYDANCE_RSS,
  'sphinx_investment_corp_rss': process.env.SPHINX_INVESTMENT_CORP_RSS,
  'stonington_global_rss': process.env.STONINGTON_GLOBAL_RSS,
  'strand_partners_rss': process.env.STRAND_PARTNERS_RSS,
  'stretto_rss': process.env.STRETTO_RSS,
  'stubhub_rss': process.env.STUBHUB_RSS,
  'sui_foundation_rss': process.env.SUI_FOUNDATION_RSS,
  'suno_rss': process.env.SUNO_RSS,
  'the_messina_group_rss': process.env.THE_MESSINA_GROUP_RSS,
  'tidjane_thiam_rss': process.env.TIDJANE_THIAM_RSS,
  'tiktok_rss': process.env.TIKTOK_RSS,
  'trousdale_ventures_rss': process.env.TROUSDALE_VENTURES_RSS,
  'viz_ai_rss': process.env.VIZ_AI_RSS,
  'bank_of_ny_sullivan_cromwell_rss': process.env.BANK_OF_NY_SULLIVAN_CROMWELL_RSS,
  'braemar_hotels_resorts_rss': process.env.BRAEMAR_HOTELS_RESORTS_RSS,
  'coinbase_rss': process.env.COINBASE_RSS,
  'davidson_kempner_capital_rss': process.env.DAVIDSON_KEMPNER_CAPITAL_RSS,
  'lyft_rss': process.env.LYFT_RSS,
  'sascc_rss': process.env.SASCC_RSS,
  'us_soccer_foundation_rss': process.env.US_SOCCER_FOUNDATION_RSS,
  'viagogo_rss': process.env.VIAGOGO_RSS,
  'carlos_zafarini_jr_rss': process.env.CARLOS_ZAFARINI_JR_RSS
};

// Build feed list with entity tags
const ALL_FEEDS = [];

// Add entity-specific feeds
for (const [entity, url] of Object.entries(ENTITY_FEEDS)) {
  if (url && url.trim()) {
    ALL_FEEDS.push({ url: url.trim(), origin: entity, section: entity.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) });
  }
}

// Add legacy RSS_FEEDS with default origin
for (const url of RSS_FEEDS) {
  ALL_FEEDS.push({ url, origin: 'google_alerts', section: 'Google Alerts' });
}

// ---- helpers ----
function normalizeUrl(u) {
  try {
    const url = new URL(u);
    url.hash = "";
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","utm_id",
     "mc_cid","mc_eid","ref","fbclid","gclid","igshid"].forEach(p => url.searchParams.delete(p));
    if ([...url.searchParams.keys()].length === 0) url.search = "";
    url.hostname = url.hostname.toLowerCase();
    let s = url.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return (u || "").trim();
  }
}
function hostOf(u) { try { return new URL(u).hostname.toLowerCase(); } catch { return ""; } }
function normalizeHost(h) { return (h || "").toLowerCase().replace(/^www\./, "").replace(/^amp\./, ""); }
function unwrapGoogleAlert(u) {
  try {
    const url = new URL(u);
    if (url.hostname.endsWith("google.com") && url.pathname === "/url") {
      return url.searchParams.get("q") || url.searchParams.get("url") || u;
    }
    return u;
  } catch { return u; }
}
function displaySource(link, fallback) { const h = normalizeHost(hostOf(link)); return h || (fallback || ""); }
function buildYouTubeWatchUrl(s) {
  s = (s || "").trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return `https://www.youtube.com/watch?v=${s}`;
  return s;
}
function extractItemLink(e) {
  let raw =
    (e.link && typeof e.link === "object" && e.link.href) ? e.link.href :
    (Array.isArray(e.link) && e.link[0]?.href)            ? e.link[0].href :
    (e.links && e.links[0]?.href)                         ? e.links[0].href :
    (typeof e.link === "string" ? e.link : "") ||
    (typeof e.id === "string" ? e.id : "");

  raw = unwrapGoogleAlert(raw);

  const ytId =
    e["yt:videoId"] ||
    e.videoId ||
    (typeof e.id === "string" && e.id.startsWith("yt:video:") ? e.id.split("yt:video:")[1] : "");

  if (!/^https?:\/\//i.test(raw) && ytId) raw = buildYouTubeWatchUrl(ytId);
  else {
    const h = hostOf(raw);
    if (h.includes("youtube.com") || h.includes("youtu.be")) raw = buildYouTubeWatchUrl(raw);
  }
  return (raw || "").trim();
}
function idFromCanonical(c) { let h=0; for (let i=0;i<c.length;i++) h=(h*31+c.charCodeAt(i))>>>0; return `m_${h.toString(16)}`; }
function toEpoch(d){ const t=Date.parse(d); return Number.isFinite(t)?Math.floor(t/1000):Math.floor(Date.now()/1000); }

// Filter out press releases
function isPressRelease(title, summary, source) {
  const text = `${title} ${summary} ${source}`.toLowerCase();
  const pressReleaseKeywords = [
    'prnewswire', 'pr newswire', 'business wire', 'businesswire',
    'pr web', 'prweb', 'globenewswire', 'globe newswire',
    'accesswire', 'press release', 'news release'
  ];
  return pressReleaseKeywords.some(keyword => text.includes(keyword));
}

// Normalize text for similarity comparison
function normalizeText(text) {
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'has', 'have', 'had', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can'];

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.includes(word))
    .join(' ');
}

// Calculate similarity between two texts
function textSimilarity(text1, text2) {
  const words1 = new Set(text1.split(' '));
  const words2 = new Set(text2.split(' '));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

// Check if a similar story already exists
async function isDuplicateStory(title, summary, origin) {
  try {
    const normalizedContent = normalizeText(`${title} ${summary}`);

    // Get articles from the last 48 hours for this entity
    const twoDaysAgo = Math.floor(Date.now() / 1000) - (48 * 60 * 60);
    const recentArticles = await redis.zrange(ZSET, twoDaysAgo, '+inf', { byScore: true });

    for (const articleJson of recentArticles) {
      try {
        const article = JSON.parse(articleJson);

        // Only compare within the same entity
        if (article.origin !== origin) continue;

        const existingContent = normalizeText(`${article.title} ${article.summary || ''}`);
        const similarity = textSimilarity(normalizedContent, existingContent);

        // If 60% or more of key words match, consider it a duplicate story
        if (similarity >= 0.6) {
          console.log(`Duplicate story detected: "${title}" similar to "${article.title}" (${Math.round(similarity * 100)}% match)`);
          return true;
        }
      } catch (e) {
        continue;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking duplicate story:', error);
    return false;
  }
}
const ENABLE_SENTIMENT = (process.env.ENABLE_SENTIMENT || "").toLowerCase() === "true";
const POS = ["win","surge","rally","gain","positive","bull","record","secure","approve","partnership"];
const NEG = ["hack","breach","lawsuit","fine","down","drop","negative","bear","investigate","halt","outage","delay","ban"];
function sentimentScore(text){
  const t = (text||"").toLowerCase();
  let s = 0;
  for (const w of POS) if (t.includes(w)) s += 1;
  for (const w of NEG) if (t.includes(w)) s -= 1;
  return s;
}
async function sendEmail(m){
  if(!resend || !process.env.ALERT_EMAIL_FROM || !process.env.ALERT_EMAIL_TO) return;
  const to = process.env.ALERT_EMAIL_TO.split(",").map(s=>s.trim()).filter(Boolean);
  if(!to.length) return;
  await resend.emails.send({
    from: process.env.ALERT_EMAIL_FROM,
    to,
    subject: `[URGENT] ${m.title}`,
    html: `<p><b>${m.title}</b></p>
           <p>Source: ${m.source} · ${m.published}</p>
           <p>Section: ${m.section}</p>
           <p><a href="${m.link}">Open article</a></p>`
  });
}

// Entity-specific content filters are now in content_filters.js
// Imported at top of file

// ---- handler ----
export default async function handler(req, res) {
  try {
    let found = 0, stored = 0, emailed = 0, errors = [];

    // Check if RSS feeds are configured
    if (!ALL_FEEDS.length) {
      console.log('No RSS feeds configured - skipping RSS collection');
      res.status(200).json({
        ok: true,
        message: "RSS collection disabled - no feeds configured",
        found: 0,
        stored: 0,
        emailed: 0,
        errors: [],
        rss_disabled: true,
        generated_at: new Date().toISOString()
      });
      return;
    }

    // No keyword filtering - RSS feeds are entity-specific
    console.log(`RSS collection starting: ${ALL_FEEDS.length} feeds (${Object.keys(ENTITY_FEEDS).filter(k => ENTITY_FEEDS[k]).length} entities), no keyword filtering`);

    // Process feeds in parallel batches of 10 to avoid timeout
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < ALL_FEEDS.length; i += BATCH_SIZE) {
      batches.push(ALL_FEEDS.slice(i, i + BATCH_SIZE));
    }

    console.log(`Processing ${ALL_FEEDS.length} feeds in ${batches.length} batches of ${BATCH_SIZE}`);

    for (const batch of batches) {
      const batchPromises = batch.map(async (feedConfig) => {
        const { url, origin, section } = feedConfig;
        try {
          const feed = await parser.parseURL(url);
          const feedTitle = feed?.title || url;

          for (const e of feed?.items || []) {
          // Safely extract title (handle cases where title might be an object)
          const title = String(e.title || "").trim();
          const ytDesc = e.mediaDescription || e?.media?.description || e?.mediaContent?.description || "";
          const sum = String(ytDesc || e.contentSnippet || e.content || e.summary || "");
          const link = extractItemLink(e);
          const source = displaySource(link, feedTitle);

          // Filter out press releases
          if (isPressRelease(title, sum, source)) {
            console.log(`Skipping press release: "${title}" from ${source}`);
            continue;
          }

          // Filter out blocked domains (MFA sites)
          if (isBlockedDomain(link)) {
            console.log(`Skipping blocked domain: "${title}" from ${extractDomain(link)}`);
            continue;
          }

          // Filter out international articles
          if (isInternationalArticle(title, sum, link, source)) {
            console.log(`Skipping international article: "${title}" - ${getBlockReason(title, sum, link, source)}`);
            continue;
          }

          // Apply entity-specific and content quality filters
          if (shouldFilterArticle(origin, title, sum, source, link)) {
            console.log(`Skipping filtered article for ${origin}: "${title}"`);
            continue;
          }

          // Check for duplicate stories (same story from different sources)
          if (await isDuplicateStory(title, sum, origin)) {
            console.log(`Skipping duplicate story for ${origin}: "${title}"`);
            found++; // Count it as found but don't store
            continue;
          }

          // No keyword filtering - accept all articles from Google Alerts RSS
          const canon = normalizeUrl(link || title);
          if (!canon) continue;

          const addCanon = await redis.sadd(SEEN_LINK, canon);
          if (addCanon !== 1) continue;

          const mid = idFromCanonical(canon);
          await redis.sadd(SEEN_ID, mid);

          const ts = toEpoch(e.isoDate || e.pubDate || e.published || e.updated);

          const m = {
            id: mid,
            canon,
            section: section,
            title: title || "(untitled)",
            link,
            source,
            summary: sum,
            origin: origin,
            published_ts: ts,
            published: new Date(ts * 1000).toISOString()
          };

          if (ENABLE_SENTIMENT) m.sentiment = sentimentScore(`${title} ${sum}`);
          await redis.zadd(ZSET, { score: ts, member: JSON.stringify(m) });

          // Trim articles based on retention policy (24h weekdays, 72h weekends)
          const retentionHours = getRetentionHours();
          const cutoffTimestamp = Math.floor(Date.now() / 1000) - (retentionHours * 60 * 60);
          await redis.zremrangebyscore(ZSET, '-inf', cutoffTimestamp);

          found++; stored++;
        }
        } catch (err) {
          errors.push({ url, error: err?.message || String(err) });
        }
      });

      // Wait for all feeds in this batch to complete
      await Promise.allSettled(batchPromises);
    }

    res.status(200).json({ ok:true, feeds: ALL_FEEDS.length, found, stored, emailed, errors, entities_configured: Object.keys(ENTITY_FEEDS).filter(k => ENTITY_FEEDS[k]).length });
  } catch (e) {
    res.status(500).json({ ok:false, error:`collect failed: ${e?.message || e}` });
  }
}
