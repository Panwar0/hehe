const BRAIN = {
  detectVideoPatterns: (html) => {
    // Enhanced 2025 patterns
    const patterns = [
      // New pattern for JSON data
      /"videoId":"([^"]{11})".*?"title":\{"runs":\[\{"text":"([^"]+?)\}.*?"ownerText":\{"runs":\[\{"text":"([^"]+)/g,
      
      // Fallback pattern for HTML
      /<a[^>]+href="\/watch\?v=([^"]{11})"[^>]+title="([^"]+)[^>]+>\s*<[^>]+>\s*<span[^>]+>([^<]+)/g
    ];

    const videos = new Map();

    try {
      // First try JSON parsing
      const jsonMatch = html.match(/var ytInitialData = (.*?);<\/script>/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1]);
        const items = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents || [];
        items.forEach(item => {
          if (item.videoRenderer?.videoId) {
            const vid = item.videoRenderer;
            videos.set(vid.videoId, {
              id: vid.videoId,
              title: vid.title?.runs?.[0]?.text || 'No title',
              channel: vid.ownerText?.runs?.[0]?.text || 'Unknown',
              thumbnail: `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`,
              duration: vid.lengthText?.simpleText || 'N/A'
            });
          }
        });
      }
    } catch (e) {}

    // Fallback to raw pattern matching
    if (videos.size === 0) {
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(html)) {
          const [_, id, title, channel] = match;
          if (id?.length === 11) {
            videos.set(id, {
              id,
              title: title.replace(/\\u([\dA-F]{4})/gi, (m, g) => 
                String.fromCharCode(parseInt(g, 16))),
              channel: channel?.replace(/\\/g, '') || 'Unknown',
              thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
              duration: 'N/A'
            });
          }
        }
      });
    }

    return Array.from(videos.values());
  }
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:125.0) Gecko/20100101 Firefox/125.0'
    };

    try {
      const query = url.searchParams.get('q');
      if (!query) throw new Error('Missing query parameter');

      const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
        headers: {
          'Accept-Language': 'en-US,en;q=0.5',
          'Cookie': 'CONSENT=YES+cb.20250101-00-p0.en-GB+FX+700'
        }
      });

      const html = await response.text();
      const videos = BRAIN.detectVideoPatterns(html).slice(0, 20);

      return new Response(JSON.stringify({ videos }), { headers });

    } catch (e) {
      return new Response(JSON.stringify({ 
        error: "Search failed: " + e.message,
        videos: []
      }), { status: 500, headers });
    }
  }
};
