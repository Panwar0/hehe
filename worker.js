export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
      'X-YouTube-Client-Name': '67', // 2025 required header
      'X-YouTube-Client-Version': '2.20250720.00.00'
    };

    // Health check
    if (url.pathname === '/health') {
      return new Response('OK', { headers, status: 200 });
    }

    // Search endpoint
    if (url.pathname === '/search') {
      try {
        const query = url.searchParams.get('q');
        if (!query) throw new Error('Missing search query');

        // 1. Try with modern headers and IP rotation
        let videos = await fetchVideos(query, true);
        
        // 2. Fallback to alternative methods
        if (videos.length === 0) {
          videos = await fetchVideos(query, false);
          
          // 3. Last resort - raw HTML scanning
          if (videos.length === 0) {
            const html = await fetchYouTubeHTML(query);
            videos = parseVideosFromRawHTML(html);
          }
        }

        if (videos.length === 0) throw new Error('YouTube structure changed - please update scraper');

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

async function fetchVideos(query, useModern) {
  const html = await fetchYouTubeHTML(query, useModern);
  
  // Method 1: Modern JSON parsing
  const jsonVideos = parseInitialData(html);
  if (jsonVideos.length > 0) return jsonVideos;
  
  // Method 2: Shadow DOM parsing
  const shadowVideos = parseShadowDOM(html);
  if (shadowVideos.length > 0) return shadowVideos;
  
  return [];
}

async function fetchYouTubeHTML(query, useModern) {
  const subdomains = ['www', 'm', 'music', 'gaming'];
  const randomSub = subdomains[Math.floor(Math.random() * subdomains.length)];
  
  const headers = {
    'User-Agent': useModern 
      ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
      : 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-CH-UA-Platform': '"Windows"'
  };

  const response = await fetch(`https://${randomSub}.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en`, {
    headers,
    cf: {
      cacheTtl: 300,
      cacheEverything: true
    }
  });
  
  return await response.text();
}

function parseInitialData(html) {
  const videos = [];
  
  // 2025 JSON patterns
  const patterns = [
    /ytInitialData\s*=\s*({.*?});<\/script>/s,
    /window\.__INITIAL_DATA__\s*=\s*({.*?});/s,
    /var ytInitialData\s*=\s*({.*?});/s
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        findVideosDeep(data, videos);
        if (videos.length > 0) break;
      } catch (e) {}
    }
  }
  
  return videos;
}

function parseShadowDOM(html) {
  const videos = [];
  const videoElements = html.match(/<ytd-video-renderer[^>]*>.*?<\/ytd-video-renderer>/gs) || [];
  
  for (const el of videoElements) {
    try {
      const id = el.match(/videoId":"([^"]+)/)?.[1];
      const title = el.match(/title":\{"runs":\[\{"text":"([^"]+)/)?.[1];
      const channel = el.match(/ownerText":\{"runs":\[\{"text":"([^"]+)/)?.[1];
      
      if (id) {
        videos.push({
          id,
          title: title ? decodeURIComponent(title) : 'No title',
          channel: channel || 'Unknown',
          duration: 'N/A',
          thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
        });
      }
    } catch (e) {}
  }
  
  return videos;
}

function parseVideosFromRawHTML(html) {
  const videos = [];
  const videoRegex = /"videoId":"([^"]+)".*?"title":\{"runs":\[\{"text":"([^"]+)".*?"ownerText":\{"runs":\[\{"text":"([^"]+)"/gs;
  
  let match;
  while ((match = videoRegex.exec(html)) !== null) {
    videos.push({
      id: match[1],
      title: match[2].replace(/\\u([\dA-F]{4})/gi, (_, code) => 
        String.fromCharCode(parseInt(code, 16))),
      channel: match[3],
      duration: 'N/A',
      thumbnail: `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`
    });
  }
  
  return videos;
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
