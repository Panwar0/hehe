const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

const parseVideos = (html) => {
  const videos = [];
  
  // Modern mobile JSON parsing
  try {
    const json = html.split('ytInitialData = ')[1].split(';</script>')[0];
    const data = JSON.parse(json);
    const contents = data.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents;
    
    for (const item of contents) {
      if (item.videoRenderer) {
        const vid = item.videoRenderer;
        videos.push({
          id: vid.videoId,
          title: vid.title?.runs?.[0]?.text || 'No title',
          channel: vid.ownerText?.runs?.[0]?.text || 'Unknown',
          duration: vid.lengthText?.simpleText || 'N/A',
          thumbnail: `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`
        });
      }
    }
  } catch (e) {
    // Fallback to HTML scraping
    const regex = /<a[^>]+href="\/watch\?v=([^"]+)"[^>]+title="([^"]+)[^>]+><div[^>]+><div[^>]+><span[^>]+>([^<]+)/g;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      videos.push({
        id: match[1],
        title: match[2].replace(/&#(\d+);/g, (m, code) => String.fromCharCode(code)),
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

      // Force mobile version with proper headers
      const response = await fetch(`https://m.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&persist_hl=1`, {
        headers: {
          'User-Agent': MOBILE_UA,
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': 'CONSENT=YES+cb.20250101-00-p0.en+FX+700'
        }
      });

      const html = await response.text();
      const videos = parseVideos(html);

      return new Response(JSON.stringify({ videos }), { headers });

    } catch (e) {
      return new Response(JSON.stringify({ 
        error: `Search failed: ${e.message}`,
        videos: [],
        _debug: btoa(html?.slice(0, 2000) || '') // HTML snippet for debugging
      }), { 
        status: 500,
        headers 
      });
    }
  }
};
