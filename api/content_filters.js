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
  const isFinancialSource = financialSources.some(src =>
    source.toLowerCase().includes(src)
  );

  // Filter if it has stock keywords AND is from a financial source
  // Or if the title is clearly about stock movement
  if (hasStockKeywords && isFinancialSource) {
    return true;
  }

  // Check if title is primarily about stock movement
  const titleLower = title.toLowerCase();
  const stockMovementInTitle = [
    'stock up',
    'stock down',
    'shares up',
    'shares down',
    'gains on',
    'drops on'
  ].some(phrase => titleLower.includes(phrase));

  return stockMovementInTitle;
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
 */
export function shouldFilterArticle(origin, title, summary, source, link) {
  const text = `${title} ${summary}`.toLowerCase();
  const titleLower = title.toLowerCase();

  // Apply universal filters first
  if (isStockPriceFocused(title, summary, source)) {
    console.log(`Filtering stock-focused article: "${title}"`);
    return true;
  }

  if (isOpinionPiece(title, summary, source, link)) {
    console.log(`Filtering opinion piece: "${title}"`);
    return true;
  }

  // === ENTITY-SPECIFIC FILTERS ===

  // Delta Air Lines: Exclude airplane incidents and new travel routes
  if (origin === 'delta_air_lines' || origin === 'delta_air_lines_rss') {
    const incidentKeywords = [
      'incident', 'crash', 'emergency', 'accident', 'diverted', 'grounded',
      'delayed', 'cancellation', 'mechanical issue', 'safety concern',
      'investigation', 'turbulence', 'forced landing', 'engine failure',
      'medical emergency', 'unruly passenger'
    ];
    const routeKeywords = [
      'new route', 'adds service', 'launches flight', 'new destination',
      'expands service', 'adds flight', 'inaugural flight', 'direct flight to',
      'nonstop service', 'new nonstop', 'announces service', 'begins service'
    ];

    const hasIncident = incidentKeywords.some(keyword => text.includes(keyword));
    const hasRoute = routeKeywords.some(keyword => text.includes(keyword));

    if (hasIncident || hasRoute) {
      return true;
    }
  }

  // Albemarle: Must be about Albemarle Corporation (not Albemarle County, VA or Albemarle, NC)
  if (origin === 'albemarle' || origin === 'albemarle_rss') {
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
  if (origin === 'tiktok' || origin === 'tiktok_rss') {
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
  if (origin === 'guardant_health' || origin === 'guardant_health_rss') {
    return false; // Accept everything
  }

  // StubHub: Exclude ticket buying guides
  if (origin === 'stubhub' || origin === 'stubhub_rss') {
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
      return true;
    }
  }

  // American Independent Media: Avoid false positives
  if (origin === 'american_independent_media' || origin === 'american_independent_media_rss') {
    // This phrase gets used in non-related contexts frequently
    // Only keep if it mentions "American Bridge" or specific related entities
    const isRelated = text.includes('american bridge') ||
                     text.includes('american bridge foundation') ||
                     text.includes('american bridge 21st century');

    if (!isRelated) {
      return true; // Filter out non-related uses of the phrase
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
