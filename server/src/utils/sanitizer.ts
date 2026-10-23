const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extracts an 11-character YouTube video ID from various YouTube URL formats or returns the ID directly.
 * Formats supported:
 * - youtube.com/watch?v=ID
 * - youtu.be/ID
 * - youtube.com/embed/ID
 * - youtube.com/shorts/ID
 * - raw 11-char ID
 */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // If already a valid 11-char ID
  if (YOUTUBE_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace(/^www\./, '');

    // youtu.be/ID
    if (hostname === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0].split('?')[0];
      return YOUTUBE_ID_REGEX.test(id) ? id : null;
    }

    // youtube.com or youtube-nocookie.com
    if (hostname === 'youtube.com' || hostname === 'youtube-nocookie.com') {
      // /watch?v=ID
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v');
        return id && YOUTUBE_ID_REGEX.test(id) ? id : null;
      }

      // /embed/ID
      if (url.pathname.startsWith('/embed/')) {
        const id = url.pathname.split('/')[2];
        return id && YOUTUBE_ID_REGEX.test(id) ? id : null;
      }

      // /shorts/ID
      if (url.pathname.startsWith('/shorts/')) {
        const id = url.pathname.split('/')[2];
        return id && YOUTUBE_ID_REGEX.test(id) ? id : null;
      }
    }
  } catch {
    // Not a valid URL, test regex directly
  }

  return null;
}

/**
 * Strips HTML tags and controls max length
 */
export function sanitizeUsername(username: string): string {
  if (!username) return 'Anonymous';
  const stripped = username.replace(/<[^>]*>?/gm, '').trim();
  return stripped.slice(0, 24);
}

/**
 * Escapes HTML entities for chat security (prevent XSS)
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.slice(0, 300).replace(/[&<>"']/g, (m) => map[m]);
}
