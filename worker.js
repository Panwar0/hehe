// WORKING YOUTUBE SCRAPER - DEPLOYMENT TESTED
const BRAIN = {
  detectVideoPatterns: (html) => {
    const videos = [];
    
    // Method 1: Modern JSON parsing
    try {
      const jsonMatch = html.match(/var ytInitialData = (.*?);<\/script>/s);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1]);
        const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents || [];
        
        for (const item of contents) {
          if (item.videoRenderer?.videoId) {
            const vid = item.videoRenderer;
            videos.push({
              id: vid.videoId,
              title: vid.title?.runs?.[0]?.text || 'No title',
              channel: vid.ownerText?.runs?.[0]?.text || 'Unknown',
              thumbnail: `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`,
              duration: vid.lengthText?.simpleText || 'N/A'
            });
          }
        }
      }
    } catch (e) {}

    // Method 2: Fallback HTML parsing
    if (videos.length === 0) {
      const videoRegex = /"videoId":"([^"]{11})".*?"title":\{"runs":\[\{"text":"([^"]+)".*?"ownerText":\{"runs":\[\{"text":"([^"]+)"/gs;
      let match;
      
      while ((match = videoRegex.exec(html)) !== null) {
        videos.push({
          id: match[1],
          title: match[2].replace(/\\u([\dA-F]{4})/gi, (_, code) => 
            String.fromCharCode(parseInt(code, 16))),
          channel: match[3],
          thumbnail: `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`,
          duration: 'N/A'
        });
      }
    }

    return videos.slice(0, 20);
  }
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    };

    try {
      const query = url.searchParams.get('q');
      if (!query) throw new Error('Missing search query');

      const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': 'CONSENT=YES+'
        }
      });
      
      const html = await response.text();
      const videos = BRAIN.detectVideoPatterns(html);

      return new Response(JSON.stringify({ videos }), { headers });

    } catch (e) {
      return new Response(JSON.stringify({ 
        error: e.message,
        videos: []
      }), { 
        status: 500,
        headers 
      });
    }
  }
};
