const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

const parseVideos = (html) => {
  const videos = [];
  
  // New 2025 JSON pattern
  const jsonPatterns = [
    /ytInitialData\s*=\s*({.*?});<\/script>/s,
    /window\.__INITIAL_DATA__\s*=\s*({.*?});/s,
    /var ytInitialData\s*=\s*({.*?});/s
  ];

  // Try all JSON patterns
  for (const pattern of jsonPatterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents || [];
        
        for (const item of contents) {
          if (item.videoRenderer?.videoId) {
            const vid = item.videoRenderer;
            videos.push({
              id: vid.videoId,
              title: vid.title?.runs?.[0]?.text || vid.title?.simpleText || 'No title',
              channel: vid.ownerText?.runs?.[0]?.text || vid.author?.text || 'Unknown',
              duration: vid.lengthText?.simpleText || 'N/A',
              thumbnail: `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`
            });
          }
        }
        if (videos.length > 0) break;
      } catch (e) {}
    }
  }

  // Fallback to modern HTML scraping
  if (videos.length === 0) {
    const videoRegex = /<a[^>]+href="\/watch\?v=([^"]{11})"[^>]+title="([^"]+)[^>]+><div[^>]+><div[^>]+><span[^>]+>([^<]+)/g;
    let match;
    
    while ((match = videoRegex.exec(html)) !== null) {
      videos.push({
        id: match[1],
        title: match[2].replace(/&quot;|&#39;/g, m => m === '&quot;' ? '"' : "'"),
        channel: match[3],
        duration: 'N/A',
        thumbnail: `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`
      });
    }
  }

  return videos.slice(0, 20);
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

      // Force Indian YouTube version with new cookies
      const response = await fetch(`https://m.youtube.com/results?search_query=${encodeURIComponent(query)}&gl=IN&hl=en`, {
        headers: {
          'User-Agent': MOBILE_UA,
          'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,hi;q=0.7',
          'Cookie': 'CONSENT=YES+IN.en+20250101-00-0; PREF=tz=Asia.Kolkata'
        },
        cf: {
          cacheTtl: 300,
          cacheEverything: true
        }
      });

      const html = await response.text();
      const videos = parseVideos(html);

      return new Response(JSON.stringify({ videos }), { headers });

    } catch (e) {
      return new Response(JSON.stringify({ 
        error: `Search failed: ${e.message}`,
        videos: [],
        _debug: btoa(html?.slice(0, 5000) || '')
      }), { 
        status: 500,
        headers 
      });
    }
  }
};
