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
  // Skip ALL filtering for general/top news feeds
  const generalNewsFeeds = [
    'nyt_top_news_rss',
    'wapo_national_news_rss',
    'wapo_politics_rss',
    'politico_rss'
  ];

  if (generalNewsFeeds.includes(origin?.toLowerCase())) {
    return false; // Don't filter any general news articles
  }

  const text = `${title} ${summary}`.toLowerCase();
  const titleLower = title.toLowerCase();

  // Apply universal filters (only for client feeds)

  // Filter syndicated "Earnings Snapshot" articles (AP wire content)
  if (title.includes('Earnings Snapshot') || title.includes('Q3 Earnings Snapshot') || title.includes('Q4 Earnings Snapshot') || title.includes('Q1 Earnings Snapshot') || title.includes('Q2 Earnings Snapshot')) {
    console.log(`Filtering syndicated earnings snapshot: "${title}"`);
    return true;
  }

  if (isStockPriceFocused(title, summary, source)) {
    console.log(`Filtering stock-focused article: "${title}"`);
    return true;
  }

  if (isOpinionPiece(title, summary, source, link)) {
    console.log(`Filtering opinion piece: "${title}"`);
    return true;
  }

  // === UNIVERSAL CONTENT QUALITY FILTERS (Client Feeds Only) ===

  // Filter: Local crime with no policy/political angle
  const localCrimeKeywords = [
    'arrested for robbery',
    'arrested for burglary',
    'arrested for theft',
    'arrested for assault',
    'arrested for murder',
    'stabbing victim',
    'shooting victim',
    'robbery suspect',
    'burglary suspect'
  ];

  const politicalKeywords = [
    'congress', 'congressional', 'investigation', 'federal', 'policy',
    'lawsuit', 'senate', 'house', 'department of justice', 'fbi',
    'regulatory', 'regulation', 'government', 'administration'
  ];

  const hasLocalCrime = localCrimeKeywords.some(keyword => text.includes(keyword));
  const hasPoliticalContext = politicalKeywords.some(keyword => text.includes(keyword));

  if (hasLocalCrime && !hasPoliticalContext) {
    console.log(`Filtering local crime article: "${title}"`);
    return true;
  }

  // Filter: Shopping/Product listings
  const shoppingKeywords = [
    'shoes on sale',
    'on sale for',
    'buy now and save',
    'limited time offer',
    'shop the collection',
    'shop now',
    'save up to',
    'discount code',
    'promo code',
    'coupon code',
    'free shipping',
    'best deals',
    'price drop'
  ];

  // Check for price patterns in title (e.g., "$19.99", "$229")
  const hasPriceInTitle = /\$\d+(\.\d{2})?/.test(titleLower);

  const hasShopping = shoppingKeywords.some(keyword => text.includes(keyword));

  if (hasShopping || hasPriceInTitle) {
    console.log(`Filtering shopping/product listing: "${title}"`);
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

  // U.S. Soccer: Exclude game scores, match previews, routine player transfers, and international soccer
  if (origin === 'us_soccer_foundation_rss' || origin === 'cindy_parlow_cone_rss') {
    // Filter international soccer organizations (false positives from Google Alerts)
    const internationalKeywords = [
      'canada soccer', 'canadian soccer', 'mexico soccer', 'mexican soccer',
      'fifa', 'uefa', 'premier league', 'la liga', 'bundesliga', 'serie a',
      'champions league', 'europa league', 'world cup qualifier',
      'england national team', 'spain national team', 'france national team',
      'germany national team', 'brazil national team', 'argentina national team'
    ];

    const hasInternational = internationalKeywords.some(keyword => text.includes(keyword));
    if (hasInternational) {
      console.log(`Filtering international soccer article: "${title}"`);
      return true;
    }

    // Filter routine match coverage
    const matchKeywords = [
      'game preview', 'match preview', 'game recap', 'match recap',
      'starting lineup', 'injury report', 'game day', 'matchup',
      'vs.', 'vs ', ' v ', ' @ ', // Game notation
      'score', 'final score', 'box score', 'postgame', 'pregame',
      'wins', 'loses', 'defeats', 'beats', 'ties',
      'goal in', 'goals in', 'hat trick', 'penalty kick',
      'nwsl standings', 'mls standings', 'table',
      'playoff bracket', 'playoff preview'
    ];

    const hasMatchCoverage = matchKeywords.some(keyword => text.includes(keyword));

    // Filter routine player transfers
    const transferKeywords = [
      'signs with', 'transferred to', 'joins club', 'loan deal',
      'transfer window', 'free agent signing', 'contract extension',
      're-signs with', 'waived by', 'traded to', 'acquired by'
    ];

    const hasTransfer = transferKeywords.some(keyword => text.includes(keyword));

    // Keep governance, leadership, and policy news
    const governanceKeywords = [
      'us soccer foundation', 'ussf', 'board of directors', 'president',
      'executive', 'leadership', 'governance', 'policy', 'lawsuit',
      'investigation', 'controversy', 'congress', 'regulatory',
      'equal pay', 'labor dispute', 'cba', 'collective bargaining',
      'cindy parlow cone', 'parlow cone'
    ];

    const isGovernanceNews = governanceKeywords.some(keyword => text.includes(keyword));

    // Filter if it's match/transfer news AND NOT governance
    if ((hasMatchCoverage || hasTransfer) && !isGovernanceNews) {
      console.log(`Filtering U.S. Soccer routine coverage: "${title}"`);
      return true;
    }
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

  // Google: Filter consumer product reviews and minor app updates
  if (origin === 'google_rss') {
    // Filter consumer product reviews
    const consumerProductKeywords = [
      'pixel review', 'pixel phone review', 'nest review', 'chromecast review',
      'google home review', 'fitbit review', 'pixel watch review',
      'pixel buds review', 'pixelbook review', 'stadia review',
      'review:', 'hands-on:', 'unboxing', 'first look:',
      'best pixel cases', 'best pixel accessories', 'tips and tricks'
    ];

    const hasConsumerReview = consumerProductKeywords.some(keyword => text.includes(keyword));
    if (hasConsumerReview) {
      console.log(`Filtering Google consumer product review: "${title}"`);
      return true;
    }

    // Filter minor app/feature updates
    const minorUpdateKeywords = [
      'google maps adds', 'google maps update', 'new google maps feature',
      'gmail adds', 'gmail update', 'new gmail feature',
      'google photos adds', 'google photos update',
      'google drive adds', 'google drive update',
      'chrome adds', 'chrome update', 'new chrome feature',
      'google search adds', 'google search now lets',
      'google app update', 'google play store update',
      'android update available', 'new emoji', 'new stickers',
      'google doodle', 'shopping tab', 'inspirational images tab'
    ];

    const hasMinorUpdate = minorUpdateKeywords.some(keyword => text.includes(keyword));

    // Keep major AI, regulatory, and business news
    const majorNewsKeywords = [
      'antitrust', 'lawsuit', 'department of justice', 'doj', 'ftc',
      'regulation', 'regulatory', 'congress', 'senate', 'house',
      'ai policy', 'gemini', 'google ai', 'deepmind', 'openai',
      'acquisition', 'merger', 'partnership', 'earnings', 'revenue',
      'layoff', 'restructuring', 'ceo', 'executive', 'sundar pichai',
      'privacy', 'data breach', 'security', 'investigation'
    ];

    const isMajorNews = majorNewsKeywords.some(keyword => text.includes(keyword));

    // Filter if it's a minor update AND NOT major news
    if (hasMinorUpdate && !isMajorNews) {
      console.log(`Filtering Google minor update: "${title}"`);
      return true;
    }
  }

  // Waymo: Filter minor incidents, product reviews, and test drives
  if (origin === 'waymo_rss') {
    // Filter minor incidents and accidents
    const minorIncidentKeywords = [
      'kills cat', 'killed cat', 'hit cat', 'struck cat',
      'kills dog', 'killed dog', 'hit dog', 'struck dog',
      'minor accident', 'minor collision', 'fender bender',
      'traffic cone', 'construction cone', 'blocked by',
      'confused by', 'stuck in traffic', 'blocking traffic',
      'honking at', 'honked at', 'drives too slow'
    ];

    const hasMinorIncident = minorIncidentKeywords.some(keyword => text.includes(keyword));
    if (hasMinorIncident) {
      console.log(`Filtering Waymo minor incident: "${title}"`);
      return true;
    }

    // Filter product reviews and test drive content
    const reviewKeywords = [
      'review:', 'hands-on:', 'first ride:', 'we rode in',
      'i rode in', 'test drive', 'test ride', 'my experience',
      'what it\'s like', 'pros and cons', 'impressions',
      'video review', 'ride along', 'demonstration'
    ];

    const hasReview = reviewKeywords.some(keyword => text.includes(keyword));

    // Keep regulatory, expansion, and major business news
    const majorWaymoNews = [
      'permit', 'approval', 'regulatory', 'dmv', 'cpuc',
      'expansion', 'launch', 'new city', 'new market',
      'partnership', 'acquisition', 'funding', 'investment',
      'lawsuit', 'investigation', 'crash', 'fatality',
      'freeway', 'highway', 'autonomous vehicle regulation',
      'safety report', 'disengagement report', 'audit'
    ];

    const isMajorWaymoNews = majorWaymoNews.some(keyword => text.includes(keyword));

    // Filter if it's a review AND NOT major news
    if (hasReview && !isMajorWaymoNews) {
      console.log(`Filtering Waymo product review: "${title}"`);
      return true;
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
