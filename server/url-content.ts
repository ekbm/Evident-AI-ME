import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface UrlContent {
  title: string;
  text: string;
  url: string;
  type: "webpage" | "youtube";
}

function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com\/(watch|shorts)|youtu\.be\/)/i.test(url);
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchYouTubeTranscript(url: string): Promise<UrlContent | null> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    console.log(`[UrlContent] Could not extract YouTube video ID from: ${url}`);
    return null;
  }

  console.log(`[UrlContent] Fetching YouTube transcript for video: ${videoId}`);

  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    if (!response.ok) {
      console.log(`[UrlContent] YouTube page fetch failed: ${response.status}`);
      return null;
    }

    const html = await response.text();

    const titleMatch = html.match(/<title>([^<]*)<\/title>/);
    const title = titleMatch
      ? titleMatch[1].replace(" - YouTube", "").trim()
      : `YouTube Video ${videoId}`;

    const captionMatch = html.match(/"captions":\s*(\{[^}]*"playerCaptionsTracklistRenderer"[^}]*\})/);
    if (!captionMatch) {
      const timedTextMatch = html.match(/"captionTracks":\s*\[([^\]]*)\]/);
      if (timedTextMatch) {
        const urlMatch = timedTextMatch[1].match(/"baseUrl":\s*"([^"]*)"/);
        if (urlMatch) {
          const captionUrl = urlMatch[1].replace(/\\u0026/g, "&");
          const captionResponse = await fetch(captionUrl);
          if (captionResponse.ok) {
            const captionXml = await captionResponse.text();
            const textSegments = captionXml.match(/<text[^>]*>([^<]*)<\/text>/g);
            if (textSegments && textSegments.length > 0) {
              const transcript = textSegments
                .map((seg) => {
                  const textMatch = seg.match(/>([^<]*)</);
                  return textMatch
                    ? textMatch[1]
                        .replace(/&amp;/g, "&")
                        .replace(/&lt;/g, "<")
                        .replace(/&gt;/g, ">")
                        .replace(/&#39;/g, "'")
                        .replace(/&quot;/g, '"')
                    : "";
                })
                .filter((t) => t.trim())
                .join(" ");

              console.log(
                `[UrlContent] YouTube transcript extracted: ${transcript.length} chars`
              );
              return {
                title,
                text: transcript.slice(0, 50000),
                url,
                type: "youtube",
              };
            }
          }
        }
      }

      console.log(`[UrlContent] No captions found for video: ${videoId}`);
      return {
        title,
        text: `[YouTube Video: "${title}" — No transcript available. The video may not have captions enabled.]`,
        url,
        type: "youtube",
      };
    }

    const allCaptionUrls = html.match(/"baseUrl":\s*"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]*)"/g);
    if (allCaptionUrls && allCaptionUrls.length > 0) {
      const captionUrl = allCaptionUrls[0]
        .match(/"baseUrl":\s*"([^"]*)"/)![1]
        .replace(/\\u0026/g, "&");

      const captionResponse = await fetch(captionUrl);
      if (captionResponse.ok) {
        const captionXml = await captionResponse.text();
        const textSegments = captionXml.match(/<text[^>]*>([^<]*)<\/text>/g);
        if (textSegments && textSegments.length > 0) {
          const transcript = textSegments
            .map((seg) => {
              const textMatch = seg.match(/>([^<]*)</);
              return textMatch
                ? textMatch[1]
                    .replace(/&amp;/g, "&")
                    .replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">")
                    .replace(/&#39;/g, "'")
                    .replace(/&quot;/g, '"')
                : "";
            })
            .filter((t) => t.trim())
            .join(" ");

          console.log(
            `[UrlContent] YouTube transcript extracted: ${transcript.length} chars`
          );
          return {
            title,
            text: transcript.slice(0, 50000),
            url,
            type: "youtube",
          };
        }
      }
    }

    return {
      title,
      text: `[YouTube Video: "${title}" — Transcript could not be extracted. The video may not have captions.]`,
      url,
      type: "youtube",
    };
  } catch (error) {
    console.error(`[UrlContent] YouTube transcript error:`, error);
    return null;
  }
}

async function fetchWebpageContent(url: string): Promise<UrlContent | null> {
  console.log(`[UrlContent] Fetching webpage: ${url}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; EvidentBot/1.0; +https://evident.app)",
        Accept: "text/html,application/xhtml+xml,text/plain",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[UrlContent] Webpage fetch failed: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    ) {
      console.log(`[UrlContent] Unsupported content type: ${contentType}`);
      return null;
    }

    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;

    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();

    text = text.slice(0, 50000);

    console.log(
      `[UrlContent] Webpage content extracted: ${text.length} chars from ${title}`
    );
    return { title, text, url, type: "webpage" };
  } catch (error) {
    console.error(`[UrlContent] Webpage fetch error:`, error);
    return null;
  }
}

export async function fetchUrlContent(
  url: string
): Promise<UrlContent | null> {
  if (!url || !url.trim()) return null;

  const cleanUrl = url.trim();

  try {
    new URL(cleanUrl);
  } catch {
    console.log(`[UrlContent] Invalid URL: ${cleanUrl}`);
    return null;
  }

  if (isYouTubeUrl(cleanUrl)) {
    return fetchYouTubeTranscript(cleanUrl);
  }

  return fetchWebpageContent(cleanUrl);
}
