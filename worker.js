export default {
  async fetch(request) {
    const url = new URL(request.url);
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
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

        // 1. Try mobile YouTube first (most reliable)
        let html = await fetchMobileYouTube(query);
        
        // 2. Fallback to desktop if mobile fails
        if (!html) html = await fetchDesktopYouTube(query);
        
        // 3. Multiple parsing attempts
        const videos = parseWithMultipleMethods(html);
        
        if (videos.length === 0) throw new Error('No videos found');

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

// Helper functions
async function fetchMobileYouTube(query) {
  const mobileUA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36';
  const response = await fetch(`https://m.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': mobileUA }
  });
  return await response.text();
}

async function fetchDesktopYouTube(query) {
  const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
  return await response.text();
}

function parseWithMultipleMethods(html) {
  const videos = [];
  
  // Method 1: Modern ytInitialData
  const initialDataMatch = html.match(/var ytInitialData = (.*?);<\/script>/);
  if (initialDataMatch) {
    try {
      const data = JSON.parse(initialDataMatch[1]);
      const contents = findVideosInInitialData(data);
      videos.push(...contents);
    } catch (e) {}
  }
  
  // Method 2: Fallback to ytInitialPlayerResponse
  if (videos.length === 0) {
    const playerResponseMatch = html.match(/ytInitialPlayerResponse = (.*?);var/);
    if (playerResponseMatch) {
      try {
        const data = JSON.parse(playerResponseMatch[1]);
        const contents = findVideosInPlayerResponse(data);
        videos.push(...contents);
      } catch (e) {}
    }
  }
  
  // Method 3: Last resort - direct HTML parsing
  if (videos.length === 0) {
    const videoRegex = /"videoRenderer":\{"videoId":"(.*?)".*?"title":\{"runs":\[\{"text":"(.*?)"\}.*?"ownerText":\{"runs":\[\{"text":"(.*?)"\}/g;
    let match;
    while ((match = videoRegex.exec(html)) !== null) {
      videos.push({
        id: match[1],
        title: match[2],
        channel: match[3],
        duration: 'N/A',
        thumbnail: `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`
      });
    }
  }
  
  return videos;
}

function findVideosInInitialData(data) {
  // Deep search through possible YouTube structures
  const findVideos = (obj) => {
    if (!obj) return [];
    if (obj.videoRenderer) {
      const vid = obj.videoRenderer;
      return [{
        id: vid.videoId,
        title: vid.title?.runs?.[0]?.text || 'No title',
        channel: vid.ownerText?.runs?.[0]?.text || 'Unknown',
        duration: vid.lengthText?.simpleText || 'N/A',
        thumbnail: `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`
      }];
    }
    return Object.values(obj).flatMap(findVideos);
  };
  return findVideos(data);
}
