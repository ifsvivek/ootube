import ydl from 'youtube-dl-exec';
import { error } from '@sveltejs/kit';

function isValidYouTubeUrl(url) {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})$/;
    return pattern.test(url);
}

function isValidVideoId(id) {
    const pattern = /^[a-zA-Z0-9_-]{11}$/;
    return pattern.test(id);
}

async function getStreamUrl(videoUrl) {
    try {
        // Get video info including formats
        const info = await ydl(videoUrl, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true
        });

        // Get the best audio format
        const audioFormat = info.formats
            .filter(f => f.acodec !== 'none' && f.vcodec === 'none')
            .sort((a, b) => b.abr - a.abr)[0];

        if (!audioFormat) {
            throw new Error('No audio format found');
        }

        return {
            url: audioFormat.url,
            title: info.title,
            contentType: audioFormat.acodec === 'opus' ? 'audio/ogg' : 'audio/mp4'
        };
    } catch (err) {
        console.error('youtube-dl error:', err);
        throw err;
    }
}

export const GET = async ({ url }) => {
    const query = url.searchParams.get('video');

    if (!query) {
        throw error(400, 'Video parameter is required');
    }

    try {
        let videoUrl;
        if (isValidYouTubeUrl(query)) {
            videoUrl = query;
        } else if (isValidVideoId(query)) {
            videoUrl = `https://www.youtube.com/watch?v=${query}`;
        } else {
            throw error(400, 'Invalid YouTube URL or video ID');
        }

        const { url: audioUrl, title, contentType } = await getStreamUrl(videoUrl);

        // Return JSON with URL and title
        return new Response(JSON.stringify({ url: audioUrl, title, contentType }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (err) {
        console.error('Streaming error:', err);
        throw error(500, err.message || 'Failed to stream audio');
    }
};
