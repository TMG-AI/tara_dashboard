// OpenAI Chat API - Ask questions about articles
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV4_REST_API_URL,
  token: process.env.KV4_REST_API_TOKEN,
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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: "Question is required" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OpenAI API key not configured" });
    }

    // Get all articles from last 24 hours (matches retention policy)
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - (24 * 60 * 60);

    const raw = await redis.zrange(ZSET, oneDayAgo, now, { byScore: true });
    const articles = raw.map(toObj).filter(Boolean);

    console.log(`Chat: Loading ${articles.length} articles for context`);

    // Prepare article context with numbered citations
    const articleContext = articles.map((a, idx) => ({
      id: idx + 1, // Citation number [1], [2], [3], etc.
      title: a.title,
      source: a.source,
      published: a.published,
      origin: a.origin,
      link: a.link,
      summary: a.summary?.substring(0, 200) // Limit summary length
    }));

    // Count articles by origin
    const originCounts = articles.reduce((acc, a) => {
      const origin = a.origin || 'unknown';
      acc[origin] = (acc[origin] || 0) + 1;
      return acc;
    }, {});

    // Create OpenAI chat completion
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a senior communications analyst at The Messina Group creating executive summaries of Daily News Clips. You have access to ${articles.length} recent articles from the past 24 hours.

FORMAT REQUIREMENTS:
- Start with "Executive Summary: Daily News Clips - [DATE]"
- Organize by impact level and theme, not by original sections
- Use clear section headers: **Top Stories**, **Government & Policy**, **TMG & Client News**, **Business & Markets**, **Stories to Watch**
- Keep the entire summary to 300-500 words
- Use bullet points for key takeaways
- End with "Stories to Watch" for developing situations

CONTENT EXCLUSIONS - DO NOT INCLUDE:
- Stock prices, share prices, or market trading activity
- Cryptocurrency prices or trading movements (Bitcoin, Ethereum, etc.)
- Financial market analysis or investment advice
- Stock analyst ratings or price targets
- Earnings per share (EPS) or quarterly financial results
- Opinion pieces, editorials, or commentary
- Press releases or corporate announcements (unless major news)
- International news (non-US)
- Airline route announcements or flight schedules
- Social media trends or influencer content
- Ticket prices or buying guides

CONTENT GUIDELINES:
1. PRIORITIZE by impact and relevance:
   - Stories affecting TMG operations or clients
   - Major political/policy developments
   - Stories with potential business implications (NOT stock prices)
   - Relevant industry news (NOT financial markets)

2. IDENTIFY THEMES AND CONNECTIONS:
   - Group related stories together (e.g., government shutdown affecting FAA + SNAP benefits)
   - Note how stories might intersect or compound
   - Highlight unusual or significant developments

3. CAPTURE KEY DETAILS:
   - Names, dates, numbers that matter
   - Actions taken or decisions made
   - Next steps or deadlines
   - Geographic scope

4. WRITE FOR BUSY EXECUTIVES:
   - Lead with "what you need to know"
   - Skip background information unless critical
   - Focus on implications, not just facts
   - Flag items requiring follow-up or monitoring

STYLE REQUIREMENTS:
- Use active, direct language
- Write in complete sentences within bullets
- Avoid jargon and acronyms unless widely known
- Maintain professional, neutral tone
- Be concise but not cryptic

CITATION REQUIREMENTS:
- Use inline citations [1], [2], [3] to reference specific articles
- Place citations immediately after statements that reference article content
- Multiple articles can be cited in one sentence: [1][2][3]

Available articles:
${JSON.stringify(articleContext, null, 2)}`
          },
          {
            role: 'user',
            content: question
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, error);
      return res.status(500).json({
        error: `OpenAI API error: ${openaiResponse.status}`,
        details: error
      });
    }

    const data = await openaiResponse.json();
    const answer = data.choices[0]?.message?.content || "No response generated";

    res.status(200).json({
      ok: true,
      question,
      answer,
      articles_analyzed: articles.length,
      sources: articleContext, // Return sources for citation rendering
      timestamp: new Date().toISOString()
    });

  } catch (e) {
    console.error('Chat error:', e);
    res.status(500).json({
      ok: false,
      error: e?.message || String(e)
    });
  }
}
