const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'; // Current 2025 key
const CLIENT_VERSION = '2.20250101.00.00';

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

      // Direct API request to YouTube's internal endpoint
      const apiResponse = await fetch('https://www.youtube.com/youtubei/v1/search?key=' + INNERTUBE_API_KEY, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Content-Type': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        body: JSON.stringify({
          context: {
            client: {
              hl: 'en',
              gl: 'US',
              clientName: 'WEB',
              clientVersion: CLIENT_VERSION
            }
          },
          query: query,
          params: 'EgIQAQ%3D%3D' // Search filter
        })
      });

      const data = await apiResponse.json();
      
      // Parse video results from API response
      const videos = [];
      const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents || [];

      for (const item of contents) {
        if (item.videoRenderer?.videoId) {
          const vid = item.videoRenderer;
          videos.push({
            id: vid.videoId,
            title: vid.title?.runs?.[0]?.text || 'No title',
            channel: vid.ownerText?.runs?.[0]?.text || 'Unknown',
            duration: vid.lengthText?.simpleText || 'N/A',
            thumbnail: vid.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`
          });
        }
      }

      return new Response(JSON.stringify({ videos: videos.slice(0, 20) }), { headers });

    } catch (e) {
      return new Response(JSON.stringify({ 
        error: `Search failed: ${e.message}`,
        videos: []
      }), { 
        status: 500,
        headers 
      });
    }
  }
}
