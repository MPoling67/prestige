export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const userMessage = req.body.messages?.[0]?.content || '';

    // Only trigger scrape enrichment for the Phase 1 call.
    // Phase 2 calls contain URLs inside JSON but should pass through untouched.
    const isPhase1Call = userMessage.trim().startsWith('Generate a Prestige Score Report');

    let bodyToSend = req.body;

    if (isPhase1Call) {
      const urlMatch = userMessage.match(/https?:\/\/[^\s.]+\.[^\s]+/);
      let pageContent = '';

      if (urlMatch) {
        try {
          const pageRes = await fetch(urlMatch[0], {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }
          });
          const html = await pageRes.text();
          pageContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 8000);
        } catch (e) {
          pageContent = 'Could not fetch page content.';
        }

        bodyToSend = {
          ...req.body,
          messages: [
            {
              role: 'user',
              content: `Here is the actual current content scraped from the website ${urlMatch[0]}:\n\n${pageContent}\n\nUsing ONLY the above content, generate the Prestige Score JSON.`
            }
          ]
        };
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify(bodyToSend)
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (error) {
    return res.status(500).json({ error: 'API request failed', details: error.message });
  }
}
