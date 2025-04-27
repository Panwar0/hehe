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

    // Main search endpoint
    if (url.pathname === '/search') {
      try {
        const query = url.searchParams.get('q');
        if (!query) throw new Error('Missing search query');

        // First try mobile version
        let videos = [];
        const mobileResult = await fetchAndParseYouTube(query, true);
        videos = mobileResult.videos;
        
        // Fallback to desktop if mobile fails
        if (videos.length === 0) {
          const desktopResult = await fetchAndParseYouTube(query, false);
          videos = desktopResult.videos;
          
          if (videos.length === 0) {
            throw new Error('No videos found after trying all methods');
          }
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
// Helper Functions
// ======================

async function fetchAndParseYouTube(query, useMobile) {
  const html = await fetchYouTube(query, useMobile);
  const videos = parseYouTubeResults(html);
  return { html, videos };
}

async function fetchYouTube(query, useMobile) {
  const baseUrl = useMobile 
    ? 'https://m.youtube.com' 
    : 'https://www.youtube.com';

  const userAgents = [
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
  ];
  
  const headers = {
    'Accept-Language': 'en-US,en;q=0.9'
  };

  if (useMobile) {
    headers['User-Agent'] = userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  const response = await fetch(`${baseUrl}/results?search_query=${encodeURIComponent(query)}`, {
    headers
  });
  
  return await response.text();
}

function parseYouTubeResults(html) {
  const videos = [];
  
  // Method 1: Modern ytInitialData pattern
  const initialDataMatch = html.match(/ytInitialData\s*=\s*({.*?});<\/script>/s);
  if (initialDataMatch) {
    try {
      const data = JSON.parse(initialDataMatch[1]);
      findVideosDeep(data, videos);
    } catch (e) {
      console.error('InitialData parse error:', e.message);
    }
  }
  
  // Method 2: Legacy pattern
  if (videos.length === 0) {
    const legacyMatch = html.match(/var ytInitialData\s*=\s*({.*?});/s);
    if (legacyMatch) {
      try {
        const data = JSON.parse(legacyMatch[1]);
        findVideosDeep(data, videos);
      } catch (e) {
        console.error('Legacy parse error:', e.message);
      }
    }
  }
  
  // Method 3: Raw HTML scraping as last resort
  if (videos.length === 0) {
    const videoRegex = /"videoRenderer":\{"videoId":"([^"]+)".*?"title":\{"runs":\[\{"text":"([^"]+)".*?"ownerText":\{"runs":\[\{"text":"([^"]+)"/gs;
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
  }
  
  return videos;
}

function findVideosDeep(obj, videos) {
  if (!obj || typeof obj !== 'object') return;
  
  // Check if current object is a video
  if (obj.videoRenderer?.videoId) {
    const vid = obj.videoRenderer;
    videos.push({
      id: vid.videoId,
      title: vid.title?.runs?.[0]?.text || vid.title?.simpleText || 'No title',
      channel: vid.ownerText?.runs?.[0]?.text || vid.author?.text || 'Unknown',
      duration: vid.lengthText?.simpleText || 'N/A',
      thumbnail: `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`
    });
  }
  
  // Recursively search through all object properties
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      findVideosDeep(obj[key], videos);
    }
  }
}
