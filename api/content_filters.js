// content_filters.js
// Content quality and relevance filters for article collection
// Based on editorial guidelines to exclude low-value content

/**
 * Detect if an article is primarily focused on stock prices/financial metrics
 * Should be excluded per editorial guidelines
 */
export function isStockPriceFocused(title, summary, source) {
  const text = `${title} ${summary}`.toLowerCase();

  // Stock price indicators
  const stockKeywords = [
    'stock price',
    'share price',
    'stock soars',
    'stock plunges',
    'stock drops',
    'stock rises',
    'shares surge',
    'shares fall',
    'shares drop',
    'shares gain',
    'trading at',
    'market cap',
    'stock hits',
    'price target',
    'analyst rating',
    'buy rating',
    'sell rating',
    'earnings per share',
    'eps of',
    'stock ticker',
    'nasdaq:',
    'nyse:',
    'up/down today',
    'percentage gain',
    'percentage loss',
    'stock watch',
    'market watch',
    'pre-market',
    'after-hours trading'
  ];

  // Cryptocurrency keywords - financial trading content to exclude
  const cryptoKeywords = [
    'bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'cryptocurrency',
    'dogecoin', 'doge', 'ripple', 'xrp', 'litecoin', 'ltc',
    'blockchain price', 'altcoin', 'token price', 'crypto market',
    'crypto price', 'crypto trading', 'digital currency', 'digital asset',
    'coinbase', 'binance', 'crypto exchange', 'nft price',
    'crypto soars', 'crypto plunges', 'crypto drops', 'crypto rises',
    'crypto surge', 'crypto falls', 'crypto hits', 'crypto rallies',
    'bitcoin hits', 'ethereum hits', 'token hits'
  ];

  // Financial news sources that often focus on stock prices
  const financialSources = [
    'morningstar',
    'seekingalpha',
    'marketwatch',
    'barrons',
    'investopedia',
    'motley fool',
    'zacks',
    'tipranks',
    'gurufocus'
  ];

  const hasStockKeywords = stockKeywords.some(keyword => text.includes(keyword));
  const hasCryptoKeywords = cryptoKeywords.some(keyword => text.includes(keyword));
  const isFinancialSource = financialSources.some(src =>
    source.toLowerCase().includes(src)
  );

  // Filter if it has stock keywords AND is from a financial source
  // Or if the title is clearly about stock movement
  if (hasStockKeywords && isFinancialSource) {
    return true;
  }

  // Filter if it has crypto keywords (from any source)
  // BUT this filter is NOT applied to specific client feeds in shouldFilterArticle()
  if (hasCryptoKeywords) {
    return true;
  }

  // Check if title is primarily about stock movement or stock analysis
  const titleLower = title.toLowerCase();
  const stockFocusedInTitle = [
    'stock up',
    'stock down',
    'shares up',
    'shares down',
    'gains on',
    'drops on',
    'stock cheap',
    'stock expensive',
    'stock performs',
    'stock performance',
    'stock move',
    'stock climbs',
    'stock falls',
    'stock outlook',
    'stock forecast',
    'stock analysis',
    'stock valuation'
  ].some(phrase => titleLower.includes(phrase));

  return stockFocusedInTitle;
}

/**
 * Detect if an article is an op-ed or opinion piece
 * Should be excluded per editorial guidelines
 */
export function isOpinionPiece(title, summary, source, link) {
  const text = `${title} ${summary}`.toLowerCase();
  const titleLower = title.toLowerCase();

  // Opinion indicators in title
  const opinionIndicators = [
    'opinion:',
    'op-ed:',
    'commentary:',
    'editorial:',
    'column:',
    'guest column',
    'my view:',
    'viewpoint:',
    'perspective:',
    'letter to',
    'letters:',
    'i believe',
    'in my opinion',
    'we need to',
    'it\'s time to',
    'why we should',
    'why we must'
  ];

  const hasOpinionMarker = opinionIndicators.some(indicator =>
    titleLower.includes(indicator)
  );

  // Opinion section URLs
  const opinionUrlPatterns = [
    '/opinion/',
    '/commentary/',
    '/op-ed/',
    '/editorial/',
    '/columns/',
    '/viewpoint/',
    '/perspective/'
  ];

  const isOpinionUrl = link && opinionUrlPatterns.some(pattern =>
    link.toLowerCase().includes(pattern)
  );

  // Byline indicators (often signal opinion pieces)
  const bylineIndicators = [
    'guest essay',
    'guest commentary',
    'opinion by',
    'editorial board'
  ];

  const hasOpinionByline = bylineIndicators.some(indicator =>
    text.includes(indicator)
  );

  return hasOpinionMarker || isOpinionUrl || hasOpinionByline;
}

/**
 * Enhanced entity-specific content filters
 * Based on client-specific editorial guidelines
 *
 * IMPORTANT: Filters only apply to client alert feeds, NOT to general/top/local news feeds
 */
export function shouldFilterArticle(origin, title, summary, source, link) {
  // Skip ALL filtering for general/top/local news feeds
  const generalNewsFeeds = [
    'nyt_top_news_rss',
    'wapo_national_news_rss',
    'wapo_politics_rss',
    'politico_rss',
    'wapo_local_rss'
  ];

  if (generalNewsFeeds.includes(origin?.toLowerCase())) {
    return false; // Don't filter any general news articles
  }

  const text = `${title} ${summary}`.toLowerCase();
  const titleLower = title.toLowerCase();

  // Apply universal filters (only for client feeds)

  // Special handling for Coinbase: Skip crypto filtering but still filter stock prices
  const isCoinbaseFeed = origin === 'coinbase_rss';

  if (isStockPriceFocused(title, summary, source)) {
    // For Coinbase feed, check if it's crypto-related (should keep)
    if (isCoinbaseFeed) {
      const text = `${title} ${summary}`.toLowerCase();
      const cryptoKeywords = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'cryptocurrency',
        'dogecoin', 'doge', 'ripple', 'xrp', 'litecoin', 'ltc', 'blockchain', 'altcoin',
        'token', 'coinbase', 'binance', 'crypto exchange', 'nft'];
      const isCryptoRelated = cryptoKeywords.some(keyword => text.includes(keyword));

      if (isCryptoRelated) {
        console.log(`Keeping crypto article for Coinbase feed: "${title}"`);
        return false; // Don't filter - keep crypto news for Coinbase
      }
    }

    console.log(`Filtering stock-focused article: "${title}"`);
    return true;
  }

  if (isOpinionPiece(title, summary, source, link)) {
    console.log(`Filtering opinion piece: "${title}"`);
    return true;
  }

  // === ENTITY-SPECIFIC FILTERS (Client Feeds Only) ===

  // Delta Air Lines: Exclude airplane incidents and new travel routes
  if (origin === 'delta_air_lines_rss') {
    const incidentKeywords = [
      'incident', 'crash', 'emergency', 'accident', 'diverted', 'grounded',
      'delayed', 'cancellation', 'mechanical issue', 'safety concern',
      'investigation', 'turbulence', 'forced landing', 'engine failure',
      'medical emergency', 'unruly passenger'
    ];
    const routeKeywords = [
      'new route', 'adds service', 'launches flight', 'new destination',
      'expands service', 'adds flight', 'inaugural flight', 'direct flight to',
      'nonstop service', 'new nonstop', 'announces service', 'begins service',
      'new service to', 'daily flights to', 'seasonal flights',
      'expanding service', 'adding service', 'route expansion', 'flight schedule',
      'begins flying', 'starts flying', 'will fly to', 'flying to'
    ];

    const hasIncident = incidentKeywords.some(keyword => text.includes(keyword));
    const hasRoute = routeKeywords.some(keyword => text.includes(keyword));

    if (hasIncident) {
      console.log(`Filtering Delta incident article: "${title}"`);
      return true;
    }
    if (hasRoute) {
      console.log(`Filtering Delta route article: "${title}"`);
      return true;
    }
  }

  // Front Financial Mesh: Must be about Mesh the fintech company (not mesh fabric/products)
  if (origin === 'front_financial_mesh_rss') {
    // Product/material false positives to exclude
    const productKeywords = [
      'mesh fabric', 'mesh material', 'mesh shoes', 'mesh sneakers',
      'mesh upper', 'mesh panel', 'mesh construction',
      'mesh pocket', 'mesh bag', 'mesh case', 'mesh cover',
      'wire mesh', 'screen mesh', 'mesh filter', 'mesh guard',
      'mesh design', 'breathable mesh', 'lightweight mesh',
      'restaurant', 'menu', 'dining', 'chef', 'food service'
    ];

    const isProductMaterial = productKeywords.some(keyword => text.includes(keyword));
    if (isProductMaterial) {
      console.log(`Filtering Mesh product/material article: "${title}"`);
      return true; // Filter out mesh fabric/products
    }

    // Must mention fintech/finance/crypto/digital assets business indicators
    const isFintech = text.includes('fintech') ||
                     text.includes('front finance') ||
                     text.includes('mesh connect') ||
                     text.includes('meshconnect') ||
                     text.includes('digital assets') ||
                     text.includes('crypto') ||
                     text.includes('embedded finance') ||
                     text.includes('financial platform') ||
                     text.includes('payment platform') ||
                     text.includes('bam azizi') || // CEO
                     text.includes('series a') ||
                     text.includes('funding round') ||
                     text.includes('money forward'); // Lead investor

    if (!isFintech) {
      console.log(`Filtering non-fintech Mesh article: "${title}"`);
      return true; // Filter out if not about the fintech company
    }
  }

  // Albemarle: Must be about Albemarle Corporation (not Albemarle County, VA or Albemarle, NC)
  if (origin === 'albemarle_rss') {
    // Geographic false positives to exclude
    const geographicKeywords = [
      'albemarle county',
      'albemarle, nc',
      'albemarle north carolina',
      'city of albemarle',
      'charlottesville', // County seat of Albemarle County, VA
      'albemarle sound' // Body of water in NC
    ];

    const isGeographic = geographicKeywords.some(keyword => text.includes(keyword));
    if (isGeographic) {
      return true; // Filter out geographic references
    }

    // Must mention corporation/business indicators
    const isCorporation = text.includes('corporation') ||
                         text.includes('corp.') ||
                         text.includes('company') ||
                         text.includes('albemarle corp') ||
                         text.includes('alb') || // Stock ticker
                         text.includes('lithium') || // Their main business
                         text.includes('chemical') ||
                         text.includes('kings mountain') || // Mine location
                         text.includes('charlotte') && text.includes('based'); // HQ

    if (!isCorporation) {
      return true; // Filter out if not about the corporation
    }
  }

  // Albertsons: Avoid duplicative local coverage - commented out for now
  // Note: User wants to avoid duplicative articles in local outlets, but this requires
  // more sophisticated duplicate detection than simple keyword matching

  // TikTok: Exclude influencer trends and creator content
  if (origin === 'tiktok_rss') {
    const influencerKeywords = [
      'tiktok trend',
      'viral tiktok',
      'tiktok challenge',
      'tiktok star',
      'tiktok influencer',
      'tiktok creator',
      'tiktok video shows',
      'tiktok users are',
      'on tiktok',
      'tiktok sensation',
      'tiktok famous',
      'tiktok personality',
      'went viral',
      'trending on tiktok'
    ];

    const isInfluencerContent = influencerKeywords.some(keyword => text.includes(keyword));
    if (isInfluencerContent) {
      return true;
    }

    // Keep only corporate/regulatory/legal news about TikTok
    const isSubstantiveNews = text.includes('ban') ||
                             text.includes('regulation') ||
                             text.includes('lawsuit') ||
                             text.includes('congress') ||
                             text.includes('data privacy') ||
                             text.includes('security') ||
                             text.includes('bytedance') ||
                             text.includes('acquisition') ||
                             text.includes('policy');

    // If it's not substantive news about the company, filter it out
    if (!isSubstantiveNews) {
      return true;
    }
  }

  // Guardant Health: Accept all news (including stock/financial per instructions)
  if (origin === 'guardant_health_rss') {
    return false; // Accept everything
  }

  // StubHub: Exclude ticket buying guides and event-focused articles
  if (origin === 'stubhub_rss') {
    const ticketBuyingKeywords = [
      'how to get tickets',
      'how to buy',
      'where to buy tickets',
      'ticket prices for',
      'cheapest tickets',
      'ticket deals',
      'get tickets to'
    ];

    const isTicketGuide = ticketBuyingKeywords.some(keyword => text.includes(keyword));
    if (isTicketGuide) {
      console.log(`Filtering StubHub ticket buying guide: "${title}"`);
      return true;
    }

    // Event-focused content indicators (sports/concerts)
    const eventFocusedKeywords = [
      // Sports event indicators
      'game preview', 'game recap', 'match preview', 'match recap',
      'starting lineup', 'injury report', 'game day', 'matchup',
      'vs.', 'vs ', ' v ', ' @ ', // Common game notation (Lakers vs Celtics)
      'score', 'final score', 'box score', 'play-by-play',
      'postgame', 'pregame', 'halftime', 'overtime',
      'wins', 'loses', 'defeats', 'beats',
      'touchdown', 'home run', 'goal', 'basket',
      'playoff', 'championship game', 'world series', 'super bowl',
      'nba game', 'nfl game', 'mlb game', 'nhl game', 'mls game',

      // Concert/music event indicators
      'concert review', 'concert recap', 'setlist',
      'performs at', 'performed at', 'performance at',
      'takes the stage', 'opening act', 'headliner',
      'tour stops', 'tour date', 'concert venue',
      'live performance', 'live show', 'sold out show',
      'encore', 'acoustic set',

      // General event coverage
      'event recap', 'event review', 'event highlights',
      'what happened at', 'photos from', 'watch highlights'
    ];

    // StubHub business indicators (keep these articles)
    const businessKeywords = [
      'stubhub', 'fees', 'pricing', 'service charge', 'platform',
      'marketplace', 'resale', 'secondary market', 'ticket sales',
      'ticket platform', 'ticket marketplace', 'dynamic pricing',
      'all-in pricing', 'transparency', 'price guarantee',
      'ticket protection', 'fanprotect', 'customer service',
      'refund policy', 'ticket delivery', 'mobile tickets',
      'stubhub ceo', 'stubhub lawsuit', 'stubhub settlement',
      'stubhub acquisition', 'stubhub merger', 'stubhub revenue'
    ];

    const isEventFocused = eventFocusedKeywords.some(keyword => text.includes(keyword));
    const isBusinessNews = businessKeywords.some(keyword => text.includes(keyword));

    // Filter if it's event-focused AND NOT business news
    if (isEventFocused && !isBusinessNews) {
      console.log(`Filtering StubHub event-focused article: "${title}"`);
      return true;
    }
  }

  // American Independent Media: Avoid false positives
  if (origin === 'american_independent_media_rss') {
    // This phrase gets used in non-related contexts frequently
    // Only keep if it mentions "American Bridge" or specific related entities
    const isRelated = text.includes('american bridge') ||
                     text.includes('american bridge foundation') ||
                     text.includes('american bridge 21st century');

    if (!isRelated) {
      return true; // Filter out non-related uses of the phrase
    }
  }

  // Jim Messina: Exclude musician, only include political consultant
  if (origin === 'jim_messina_rss') {
    const jimMessinaText = text.includes('jim messina') || text.includes('messina');

    if (jimMessinaText) {
      // Musician indicators (filter these out)
      const musicianKeywords = [
        'guitar', 'guitarist', 'concert', 'tour', 'touring', 'album', 'music',
        'band', 'poco', 'loggins', 'loggins and messina', 'musician', 'singer',
        'song', 'performance', 'setlist', 'venue', 'tickets', 'show', 'gig',
        'record', 'recording', 'country rock', 'rock band', 'buffalo springfield'
      ];

      const isMusician = musicianKeywords.some(keyword => text.includes(keyword));

      if (isMusician) {
        console.log(`Filtering Jim Messina musician article: "${title}"`);
        return true; // Filter out musician articles
      }

      // Political consultant indicators (keep these)
      const politicalKeywords = [
        'messina group', 'obama', 'campaign', 'politics', 'political',
        'consultant', 'chief of staff', 'white house', 'democratic',
        'election', 'strategy', 'strategist', 'biden', 'dnc'
      ];

      const isPolitical = politicalKeywords.some(keyword => text.includes(keyword));

      if (!isPolitical) {
        // If it mentions Jim Messina but has no political context, filter it out
        console.log(`Filtering ambiguous Jim Messina article (no political context): "${title}"`);
        return true;
      }
    }
  }

  // Default: Don't filter
  return false;
}

/**
 * Detect if source is a known content reposter (should be blocked)
 * This supplements the blocked_domains.js list
 */
export function isReposterSite(source, link) {
  const reposters = [
    'yahoo',
    'msn',
    'aol',
    'newsbreak',
    'apple news',
    'flipboard',
    'pocket',
    'feedly'
  ];

  const sourceLower = source.toLowerCase();
  const linkLower = link ? link.toLowerCase() : '';

  return reposters.some(reposter =>
    sourceLower.includes(reposter) || linkLower.includes(reposter)
  );
}
