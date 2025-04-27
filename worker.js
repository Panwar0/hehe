const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20250720.00.00';

const parseVideoResults = (data) => {
  // 1. Extract videos
  const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
  const videos = contents.filter(item => item.videoRenderer).map(item => {
    const vid = item.videoRenderer;
    return {
      id: vid.videoId,
      title: vid.title?.runs?.[0]?.text || vid.title?.simpleText || 'No title',
      channel: vid.ownerText?.runs?.[0]?.text || vid.author?.text || 'Unknown',
      duration: vid.lengthText?.simpleText || 'N/A',
      thumbnail: vid.thumbnail?.thumbnails?.[0]?.url.replace('=s0', '=s500') || `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`
    };
  });

  // 2. Extract continuation token (updated 2025 path)
  const continuation = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[1]?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;

  return { 
    videos: videos.slice(0, 20), // Force 20 results per page
    continuation 
  };
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
      const continuation = url.searchParams.get('continuation');

      const response = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${INNERTUBE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: {
              hl: 'en',
              gl: 'US',
              clientName: 'WEB',
              clientVersion: CLIENT_VERSION
            }
          },
          ...(continuation ? { continuation } : { query, params: 'EgIQAQ%3D%3D' })
        })
      });

      const data = await response.json();
      const result = parseVideoResults(data);

      return new Response(JSON.stringify(result), { headers });

    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error.message,
        videos: []
      }), { status: 500, headers });
    }
  }
}
