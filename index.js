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

    // Video search endpoint
    if (url.pathname === '/search') {
      try {
        const query = url.searchParams.get('q');
        if (!query) throw new Error('Missing search query');

        // Fetch YouTube with mobile user agent to get cleaner HTML
        const ytResponse = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1' }
        });
        const html = await ytResponse.text();

        // Extract JSON data
        const ytInitialDataRegex = /var ytInitialData = (.*?);<\/script>/;
        const match = html.match(ytInitialDataRegex);
        if (!match) throw new Error('YouTube data parsing failed');

        const data = JSON.parse(match[1]);

        // STRICT video filtering
        const videos = [];
        const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents || [];

        for (const item of contents) {
          // Only process proper video renderers
          if (item.videoRenderer && 
              item.videoRenderer.videoId && 
              !item.videoRenderer.upcomingEventData && // Ignore upcoming/live
              !item.videoRenderer.movingThumbnailRenderer && // Ignore Shorts
              item.videoRenderer.lengthText // Must have duration
          ) {
            videos.push({
              id: item.videoRenderer.videoId,
              title: item.videoRenderer.title?.runs?.[0]?.text || 'No title',
              channel: item.videoRenderer.ownerText?.runs?.[0]?.text || 'Unknown',
              duration: item.videoRenderer.lengthText?.simpleText || 'N/A',
              thumbnail: `https://i.ytimg.com/vi/${item.videoRenderer.videoId}/hqdefault.jpg`
            });
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
