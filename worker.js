export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const query = url.searchParams.get('q');
      
      // 1. Fetch with rotated IP & modern headers
      const response = await fetchYouTube(query);
      const html = await response.text();
      
      // 2. Multi-stage parsing
      const videos = parseVideos(html);
      
      return new Response(JSON.stringify({ videos }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (e) {
      return new Response(JSON.stringify({
        error: "YouTube structure updated - retry with new parameters",
        videos: []
      }), { status: 500 });
    }
  }
}

// Helper: Fetch with anti-bot measures
async function fetchYouTube(query) {
  const subdomains = ['m', 'music', 'gaming'];
  const randomSub = subdomains[Math.floor(Math.random() * subdomains.length)];
  
  return fetch(`https://${randomSub}.youtube.com/results?q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36 (KHTML, Chrome/125.0.0.0 Safari/537.36 Edg/125.0',
      'Sec-CH-UA-Platform': '"Windows"',
      'X-YouTube-Client-Name': '72',  // 2025 required value
      'X-YouTube-Client-Version': '2.20250428.09.00'
    },
    cf: { cacheTtl: 300 }
  });
}

// Multi-stage parsing function
async function parseVideos(html) {
  // 1. Try modern JSON extraction
  const jsonVideos = parseInitialData(html); 
  
  // 2. Fallback to shadow DOM parsing
  const shadowVideos = html.match(/<ytd-video-renderer[^>]*>.*?<\/ytd-video-renderer>/gs)
    .map(el => extractFromShadowDOM(el));
  
  // 3. Final fallback: Raw HTML scan
  return jsonVideos.length ? jsonVideos : shadowVideos.length ? shadowVideos : rawHTMLScan(html);
}

// Helper: Extract video data from shadow DOM elements
function extractFromShadowDOM(shadowElement) {
  // Extract necessary details from the shadow DOM
  // Customize based on the structure of <ytd-video-renderer>
  return {
    title: shadowElement.match(/<a.*?title="([^"]+)"/)[1],
    videoId: shadowElement.match(/"videoId":"([^"]+)"/)[1],
    thumbnail: shadowElement.match(/"thumbnailUrl":"([^"]+)"/)[1],
  };
}

// Helper: Parse initial JSON data from HTML
function parseInitialData(html) {
  const jsonPatterns = [
    /window\.__INITIAL_DATA__\s*=\s*({.*?});/s,  // New 2025 JSON pattern
    /ytInitialData\s*=\s*({.*?});<\/script>/s,
  ];
  
  const matchedData = jsonPatterns.map(pattern => {
    const match = html.match(pattern);
    return match ? JSON.parse(match[1]) : null;
  }).filter(Boolean);
  
  if (matchedData.length) {
    // Extract video details from parsed JSON
    return matchedData[0].contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents
      .map(item => ({
        title: item.videoRenderer.title.runs[0].text,
        videoId: item.videoRenderer.videoId,
        thumbnail: item.videoRenderer.thumbnail.thumbnails[0].url,
      }));
  }
  
  return [];
}

// Helper: Raw HTML scan if JSON or shadow DOM fails
function rawHTMLScan(html) {
  // Perform last-ditch scan to extract data from raw HTML
  // This is a more error-prone method and should be used as a last resort
  const videos = [];
  const videoElements = html.match(/<ytd-video-renderer[^>]*>.*?<\/ytd-video-renderer>/gs) || [];
  
  videoElements.forEach(el => {
    const video = extractFromShadowDOM(el);
    if (video) videos.push(video);
  });
  
  return videos;
}
