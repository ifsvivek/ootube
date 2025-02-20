import { error } from '@sveltejs/kit';

export const GET = async ({ url }) => {
    const audioUrl = url.searchParams.get('url');
    if (!audioUrl) {
        throw error(400, 'URL parameter is required');
    }

    try {
        const response = await fetch(audioUrl);
        
        if (!response.ok) {
            throw error(response.status, 'Failed to fetch audio');
        }

        // Forward the audio stream with appropriate headers
        return new Response(response.body, {
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'audio/webm',
                'Content-Length': response.headers.get('Content-Length'),
                'Accept-Ranges': 'bytes',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache',
            }
        });
    } catch (err) {
        console.error('Proxy error:', err);
        throw error(500, 'Failed to proxy audio stream');
    }
};
