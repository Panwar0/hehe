// YouTube Scraper Worker with Pagination Support
const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'; // Current 2025 key
const CLIENT_VERSION = '2.20250101.00.00';

const parseVideoResults = (data) => {
  const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents || [];
  const continuation = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.continuations?.[0]?.nextContinuationData?.continuation;

  const videos = contents.filter(item => item.videoRenderer).map(item => {
    const vid = item.videoRenderer;
    return {
      id: vid.videoId,
      title: vid.title?.runs?.[0]?.text || vid.title?.simpleText || 'No title',
      channel: vid.ownerText?.runs?.[0]?.text || vid.author?.text || 'Unknown',
      duration: vid.lengthText?.simpleText || 'N/A',
      thumbnail: vid.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`
    };
  });

  return { videos, continuation };
};

const searchYouTube = async (requestBody) => {
  const response = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${INNERTUBE_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({
      ...requestBody,
      context: {
        client: {
          hl: 'en',
          gl: 'US',
          clientName: 'WEB',
          clientVersion: CLIENT_VERSION
        }
      }
    })
  });

  if (!response.ok) throw new Error(`YouTube API error: ${response.status}`);
  return parseVideoResults(await response.json());
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

      if (!query && !continuation) {
        throw new Error('Missing search query or continuation token');
      }

      let requestBody;
      if (continuation) {
        requestBody = { continuation };
      } else {
        requestBody = { 
          query,
          params: 'EgIQAQ%3D%3D' // Filters to only videos
        };
      }

      const { videos, continuation: newContinuation } = await searchYouTube(requestBody);

      return new Response(JSON.stringify({ 
        videos,
        continuation: newContinuation 
      }), { headers });

    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error.message,
        videos: []
      }), { 
        status: 500,
        headers 
      });
    }
  }
}
