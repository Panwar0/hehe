// Latest 2025 YouTube Scraper for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response('OK', { headers, status: 200 });
    }

    // Search endpoint
    if (url.pathname === '/search') {
      try {
        const query = url.searchParams.get('q');
        if (!query) throw new Error('Missing search query');

        // Try multiple YouTube domains
        const domains = ['www.youtube.com', 'm.youtube.com', 'music.youtube.com'];
        let videos = [];
        
        for (const domain of domains) {
          try {
            const html = await fetchYouTubeHTML(domain, query);
            videos = parseVideos(html);
            if (videos.length > 0) break;
          } catch (e) {
            console.log(`Failed on ${domain}, trying next...`);
          }
        }

        if (videos.length === 0) {
          throw new Error('YouTube structure changed - try again later');
        }

        return new Response(JSON.stringify({ videos }), { headers });

      } catch (error) {
        return new Response(JSON.stringify({ 
          error: error.message,
          videos: [] 
        }), { 
          headers,
          status: 500 
        });
      }
    }

    return new Response(JSON.stringify({ videos: [] }), { 
      headers,
      status: 404 
    });
  }
}

// ======================
// 2025 Helper Functions
// ======================

async function fetchYouTubeHTML(domain, query) {
  // Modern 2025 headers
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-CH-UA-Platform': '"Windows"',
    'X-YouTube-Client-Name': '72',
    'X-YouTube-Client-Version': '2.20250720.00.00'
  };

  const response = await fetch(`https://${domain}/results?search_query=${encodeURIComponent(query)}`, {
    headers,
    cf: {
      cacheTtl: 300,
      cacheEverything: true
    }
  });
  
  if (!response.ok) throw new Error(`Failed to fetch from ${domain}`);
  return await response.text();
}

function parseVideos(html) {
  const videos = [];
  
  // Method 1: Modern JSON parsing (2025 pattern)
  const jsonMatch = html.match(/window\.__INITIAL_DATA__\s*=\s*({.*?});/s);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      findVideosDeep(data, videos);
    } catch (e) {
      console.error('JSON parse error:', e.message);
    }
  }
  
  // Method 2: Shadow DOM component parsing
  if (videos.length === 0) {
    const shadowComponents = html.match(/<ytd-video-renderer[^>]*>.*?<\/ytd-video-renderer>/gs) || [];
    for (const component of shadowComponents) {
      try {
        const video = parseShadowComponent(component);
        if (video) videos.push(video);
      } catch (e) {}
    }
  }
  
  // Method 3: Raw HTML scanning (last resort)
  if (videos.length === 0) {
    const rawVideos = html.match(/"videoId":"([^"]+)".*?"title":\{"runs":\[\{"text":"([^"]+)".*?"ownerText":\{"runs":\[\{"text":"([^"]+)"/gs) || [];
    for (const match of rawVideos) {
      const video = parseRawMatch(match);
      if (video) videos.push(video);
    }
  }
  
  return videos;
}

function parseShadowComponent(html) {
  const id = html.match(/videoId":"([^"]+)/)?.[1];
  const title = html.match(/title":\{"runs":\[\{"text":"([^"]+)/)?.[1];
  const channel = html.match(/ownerText":\{"runs":\[\{"text":"([^"]+)/)?.[1];
  
  if (!id) return null;
  
  return {
    id,
    title: title ? decodeURIComponent(title) : 'No title',
    channel: channel || 'Unknown',
    duration: 'N/A',
    thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
  };
}

function parseRawMatch(match) {
  const id = match.match(/"videoId":"([^"]+)"/)?.[1];
  const title = match.match(/"text":"([^"]+)"/)?.[1];
  const channel = match.match(/"runs":\[\{"text":"([^"]+)"/)?.[1];
  
  if (!id) return null;
  
  return {
    id,
    title: title ? decodeURIComponent(title) : 'No title',
    channel: channel || 'Unknown',
    duration: 'N/A',
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  };
}

function findVideosDeep(obj, videos) {
  if (!obj || typeof obj !== 'object') return;
  
  if (obj.videoRenderer?.videoId) {
    const vid = obj.videoRenderer;
    videos.push({
      id: vid.videoId,
      title: vid.title?.runs?.[0]?.text || vid.title?.simpleText || 'No title',
      channel: vid.ownerText?.runs?.[0]?.text || vid.author?.text || 'Unknown',
      duration: vid.lengthText?.simpleText || 'N/A',
      thumbnail: `https://i.ytimg.com/vi/${vid.videoId}/maxresdefault.jpg`
    });
  }
  
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      findVideosDeep(obj[key], videos);
    }
  }
}
