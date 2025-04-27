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

      // Fetch mobile YouTube with modern user agent
      const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
      const ytResponse = await fetch(`https://m.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': mobileUA }
      });
      const html = await ytResponse.text();

      // Try multiple JSON extraction methods
      let data;
      const initialDataMatch = html.match(/var ytInitialData = (.*?);<\/script>/);
      const playerResponseMatch = html.match(/ytInitialPlayerResponse = (.*?);var/);

      if (initialDataMatch) data = JSON.parse(initialDataMatch[1]);
      else if (playerResponseMatch) data = JSON.parse(playerResponseMatch[1]);
      else throw new Error('YouTube data pattern not found');

      // Modern video extraction
      const videos = [];
      const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents || [];
      
      for (const item of contents) {
        if (item.videoRenderer?.videoId) {
          videos.push({
            id: item.videoRenderer.videoId,
            title: item.videoRenderer.title?.runs?.[0]?.text || 'No title',
            channel: item.videoRenderer.ownerText?.runs?.[0]?.text || 'Unknown',
            thumbnail: `https://i.ytimg.com/vi/${item.videoRenderer.videoId}/hqdefault.jpg`
          });
        }
      }

      if (videos.length === 0) throw new Error('No videos found');
      return new Response(JSON.stringify({ videos }), { headers });

    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error.message,
        videos: [] 
      }), { headers, status: 500 });
    }
  }
};
