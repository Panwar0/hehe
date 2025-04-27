// FINAL WORKING VERSION
const BRAIN = {
  detectVideoPatterns: (html) => {
    const videoSignatures = [
      { 
        id: /videoId["']?:["']([^"'{},]+)/, 
        title: /(?:title|name|content)["']?\s*:\s*["']([^"'{},]+)/i,
        channel: /(?:author|channel|owner)["']?\s*:\s*["']([^"'{},]+)/i
      },
      {
        id: /watch\?v=([^"&]+)/,
        title: /<a[^>]+title="([^"]+)"[^>]+href="\/watch\?v=/,
        channel: /<a[^>]+href="\/@([^"]+)"/
      }
    ];

    const results = new Set();
    const text = html.slice(0, 50000) + html.slice(-50000);

    for (const {id, title, channel} of videoSignatures) {
      const ids = [...new Set(text.match(id) || [])];
      const titles = text.match(title) || [];
      const channels = text.match(channel) || [];

      ids.forEach((vid, i) => {
        if (vid.length === 11) {
          results.add(JSON.stringify({
            id: vid,
            title: decodeURIComponent(titles[i] || 'N/A')
              .replace(/\\u[\dA-F]{4}/gi, m => 
                String.fromCharCode(parseInt(m.replace(/\\u/g, ''), 16)),
            channel: (channels[i] || '').replace(/\\/g, '') || 'Unknown',
            thumbnail: `https://i.ytimg.com/vi/${vid}/maxresdefault.jpg`,
            duration: 'N/A'
          }));
        }
      });
    }

    return [...results].map(JSON.parse);
  }
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    try {
      const query = url.searchParams.get('q');
      if (!query) throw new Error('Missing search query');

      const html = await fetch(`https://www.youtube.com/results?q=${encodeURIComponent(query)}`)
        .then(res => res.text());

      const videos = BRAIN.detectVideoPatterns(html)
        .filter(v => v.id)
        .slice(0, 20);

      return new Response(JSON.stringify({ videos }), { headers });

    } catch (e) {
      return new Response(JSON.stringify({ 
        error: `YouTube ${e.message}`,
        videos: []
      }), { status: 500, headers });
    }
  }
};
