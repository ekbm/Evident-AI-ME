import OpenAI from "openai";
import { TRUSTED_SOURCES_CONFIG, type Citation, type EnrichmentResult, type PexelsImage } from "./config/trustedSources";
import { metrics } from "./metrics";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Perplexity API for real web search with citations
async function searchWithPerplexity(
  question: string,
  documentContext: string,
  style: "normal" | "eli5" | "detailed",
  isComparison: boolean,
  compareWith?: string
): Promise<{ content: string; citations: string[] } | null> {
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  if (!perplexityKey) {
    return null;
  }

  try {
    const styleInstructions = {
      normal: "Provide a clear, professional explanation.",
      eli5: "Explain like talking to a curious 10-year-old with simple words and analogies.",
      detailed: "Provide comprehensive, detailed explanation with examples."
    };

    const systemPrompt = isComparison
      ? `You are a research assistant comparing products and brands. Be objective and factual.`
      : `You are a research assistant providing external context. ${styleInstructions[style]} Focus on helpful, accurate information.`;

    const userPrompt = isComparison
      ? `Compare this product/brand information: ${documentContext.slice(0, 1500)} with: "${compareWith}". Highlight key differences and similarities.`
      : `The user asked: "${question}".

${documentContext ? `Their documents contain this context:\n${documentContext.slice(0, 1500)}` : "No document context was provided."}

INSTRUCTIONS:
1. Your answer MUST be directly relevant to the user's question: "${question}"
2. If document context is provided, use it to understand what specific topic/product/subject the user is asking about
3. Do NOT return information about unrelated topics, products, or subjects
4. If you cannot find relevant information for the exact question asked, say so clearly rather than substituting with different topics
5. Focus your research on: "${question}"`;

    console.log(`[ExternalEnrichment] Sending to Perplexity - Question: "${question.substring(0, 50)}..." Context preview: "${(documentContext || "").substring(0, 200)}..."`);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.4,
        return_citations: true,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const citations = data.citations || [];
      
      // Record Perplexity API cost
      metrics.recordApiCost('perplexity');
      
      console.log(`[ExternalEnrichment] Perplexity returned ${citations.length} real citations`);
      return { content, citations };
    }
  } catch (error) {
    console.error("[ExternalEnrichment] Perplexity error:", error);
  }
  
  return null;
}

const enrichmentCache = new Map<string, { result: EnrichmentResult; timestamp: number }>();
const imageCache = new Map<string, { images: PexelsImage[]; timestamp: number }>();
const searchTermCache = new Map<string, { terms: string; timestamp: number }>();

const PEXELS_CACHE_MINUTES = 60;
const SEARCH_TERM_CACHE_MINUTES = 120;

// Clear cache for a specific user (call on login/logout)
export function clearUserCache(userId: string | number): void {
  const userPrefix = `${userId}:`;
  let cleared = 0;
  const keysToDelete: string[] = [];
  
  enrichmentCache.forEach((_, key) => {
    if (key.startsWith(userPrefix)) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => {
    enrichmentCache.delete(key);
    cleared++;
  });
  
  console.log(`[ExternalEnrichment] Cleared ${cleared} cache entries for user ${userId}`);
}

// Log cache operations for monitoring
export async function logCacheOperation(
  userId: string | number,
  operation: "hit" | "miss" | "set" | "clear",
  cacheKey: string,
  metadata?: Record<string, any>
): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`[CacheMonitor] ${timestamp} | user:${userId} | op:${operation} | key:${cacheKey.substring(0, 50)}...`);
  
  // Could also log to database for persistent monitoring
  // This is intentionally kept simple for now - can be extended to store in DB
}

async function generateImageSearchTerms(query: string): Promise<string> {
  const cacheKey = query.toLowerCase().trim().substring(0, 100);
  const cached = searchTermCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SEARCH_TERM_CACHE_MINUTES * 60 * 1000) {
    console.log(`[ImageSearch] Cache hit for search terms: "${cached.terms}"`);
    return cached.terms;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a visual search expert. Given a user's question or topic, extract 2-4 keywords that would find relevant, visually helpful stock photos.

Rules:
- Focus on the VISUAL subject, not abstract concepts
- Remove action words (simplify, explain, summarize)
- Add descriptive context (e.g., "paint" → "painted walls interior", "cornice" → "decorative ceiling cornice molding")
- For technical/industry terms, describe what they look like visually
- Return ONLY the search terms, nothing else
- Keep it under 6 words

Examples:
- "simplify building paint options" → "painted walls interior colors"
- "what is a cornice" → "decorative ceiling cornice molding"
- "explain GDPR compliance" → "data privacy security digital"
- "summarize employment contract" → "business contract signing office"
- "roofing materials" → "roof tiles shingles house exterior"`
        },
        {
          role: "user",
          content: query
        }
      ],
      max_tokens: 30,
      temperature: 0.3
    });

    const terms = response.choices[0]?.message?.content?.trim() || '';
    if (terms && terms.length > 2) {
      searchTermCache.set(cacheKey, { terms, timestamp: Date.now() });
      console.log(`[ImageSearch] AI generated terms: "${terms}" (from: "${query.substring(0, 40)}...")`);
      return terms;
    }
  } catch (error) {
    console.error("[ImageSearch] AI term generation failed:", error);
  }

  // Fallback: filter action words manually
  const actionWords = new Set([
    'simplify', 'summarize', 'explain', 'describe', 'tell', 'show', 'what', 'how',
    'why', 'when', 'where', 'who', 'is', 'are', 'the', 'a', 'an', 'this', 'that',
    'me', 'about', 'please', 'can', 'could', 'would', 'should', 'give', 'help'
  ]);
  const words = query.toLowerCase().split(/\s+/).filter(w => !actionWords.has(w) && w.length > 2);
  return words.slice(0, 4).join(' ') || query.split(' ').slice(0, 3).join(' ');
}

async function searchPexelsImages(query: string, limit: number = 3): Promise<PexelsImage[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.log("[Pexels] No API key configured");
    return [];
  }

  const cacheKey = query.toLowerCase().trim();
  
  if (cacheKey.length < 2) {
    console.log("[Pexels] Query too short, skipping");
    return [];
  }
  const cached = imageCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < PEXELS_CACHE_MINUTES * 60 * 1000) {
    console.log(`[Pexels] Cache hit for "${query}"`);
    return cached.images;
  }

  try {
    // Use AI to generate visually relevant search terms
    const searchTerms = await generateImageSearchTerms(query);
    
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerms)}&per_page=${limit}&orientation=landscape`;
    
    console.log(`[Pexels] Searching for "${searchTerms}" (from: "${query.substring(0, 50)}"...)`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': apiKey
      }
    });

    if (!response.ok) {
      console.error(`[Pexels] API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    const images: PexelsImage[] = (data.photos || []).map((photo: any) => ({
      id: photo.id,
      url: photo.url,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      src: {
        medium: photo.src.medium,
        small: photo.src.small,
        landscape: photo.src.landscape
      },
      alt: photo.alt || query
    }));

    imageCache.set(cacheKey, { images, timestamp: Date.now() });
    console.log(`[Pexels] Found ${images.length} images for "${query}"`);
    
    return images;
  } catch (error) {
    console.error("[Pexels] Search error:", error);
    return [];
  }
}

function getCacheKey(question: string, style: string, userId?: string | number, documentContext?: string): string {
  // Use a simple hash of the full document context to avoid cache collisions
  // when different documents have similar first 100 characters
  let contextHash = "";
  if (documentContext) {
    let hash = 0;
    for (let i = 0; i < documentContext.length; i++) {
      const char = documentContext.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    contextHash = hash.toString();
  }
  return `${userId || "anon"}:${question.toLowerCase().trim()}:${style}:${contextHash}`;
}

function isCacheValid(timestamp: number): boolean {
  const cacheMs = TRUSTED_SOURCES_CONFIG.cacheMinutes * 60 * 1000;
  return Date.now() - timestamp < cacheMs;
}

// Extract meaningful keywords from text for relevance matching
// Includes single words AND multi-word phrases (product names, models)
function extractRelevanceKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
    'those', 'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why',
    'about', 'with', 'from', 'into', 'for', 'of', 'on', 'at', 'by', 'to',
    'and', 'or', 'but', 'not', 'so', 'if', 'then', 'than', 'more', 'less',
    'all', 'any', 'some', 'each', 'every', 'both', 'few', 'many', 'much',
    'other', 'another', 'such', 'only', 'own', 'same', 'just', 'also',
    'very', 'most', 'even', 'still', 'already', 'now', 'here', 'there',
    'tell', 'me', 'you', 'your', 'my', 'our', 'their', 'its', 'his', 'her',
    'document', 'file', 'image', 'explain', 'describe', 'show', 'give'
  ]);
  
  const keywords: string[] = [];
  const textLower = text.toLowerCase();
  
  // Extract product/brand names with model numbers (e.g., "model y", "sealion 7", "iphone 15")
  const productPatterns = [
    /\b([a-z]+\s+\d+[a-z]*)\b/gi,  // "sealion 7", "model 3"
    /\b([a-z]+\s+[a-z]\s*\d*)\b/gi,  // "model y", "model s"
    /\b(byd|tesla|apple|samsung|google|microsoft|amazon|bmw|audi|mercedes|ford|toyota|honda)\b/gi,  // Brand names
    /\b([a-z]+pro|[a-z]+max|[a-z]+plus)\b/gi,  // Product variants like "iPhone Pro"
  ];
  
  for (const pattern of productPatterns) {
    let match;
    while ((match = pattern.exec(textLower)) !== null) {
      const phrase = match[1].trim();
      if (phrase.length >= 3 && !stopWords.has(phrase)) {
        keywords.push(phrase);
      }
    }
  }
  
  // Extract single words 4+ chars, not stop words
  const words = textLower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stopWords.has(w));
  
  keywords.push(...words);
  
  // Get unique keywords, prioritize longer/more specific ones
  const unique = Array.from(new Set(keywords));
  const result = unique.sort((a, b) => b.length - a.length).slice(0, 20);
  
  console.log(`[ExternalEnrichment] Extracted ${result.length} relevance keywords: ${result.slice(0, 5).join(', ')}...`);
  return result;
}

// Filter citations to only include ones relevant to the current query
// STRICT: Only returns citations that have relevance score > 0 (excludes unrelated sources)
function filterRelevantCitations(citations: Citation[], keywords: string[], maxCount: number): Citation[] {
  if (keywords.length === 0) {
    // No keywords to filter by - return all up to max
    return citations.slice(0, maxCount);
  }
  
  // Score each citation by relevance - check URL, domain, title, and snippet
  const scored = citations.map(c => {
    const urlLower = c.url.toLowerCase();
    const domainLower = c.domain.toLowerCase();
    const titleLower = (c.title || "").toLowerCase();
    const snippetLower = (c.snippet || "").toLowerCase();
    let score = 0;
    
    for (const keyword of keywords) {
      // Higher scores for domain/title matches (more likely to be on-topic)
      if (domainLower.includes(keyword)) score += 4;
      if (titleLower.includes(keyword)) score += 3;
      if (urlLower.includes(keyword)) score += 2;
      if (snippetLower.includes(keyword)) score += 1;
    }
    
    // Boost trusted/authoritative domains (but still need relevance)
    const trustedDomains = ['wikipedia', 'gov', 'edu', 'reuters', 'bloomberg', 'bbc', 'nytimes', 'forbes', 'techcrunch'];
    for (const td of trustedDomains) {
      if (domainLower.includes(td)) {
        score += 2;
        break;
      }
    }
    
    return { citation: c, score };
  });
  
  // Sort by relevance score
  scored.sort((a, b) => b.score - a.score);
  
  // STRICT: Only include citations with relevance score > 0 (minimum threshold)
  // Do NOT backfill with unrelated sources
  const relevant = scored.filter(s => s.score > 0).map(s => s.citation);
  
  console.log(`[ExternalEnrichment] Citation filtering: ${relevant.length}/${citations.length} passed relevance threshold`);
  
  // Take up to maxCount relevant citations
  const result = relevant.slice(0, maxCount);
  
  // Re-assign IDs
  return result.map((c, idx) => ({ ...c, id: idx + 1 }));
}

export async function simplifyAnswer(
  originalAnswer: string,
  question: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a friendly, patient teacher who explains complex topics in simple terms.

Your task is to take an answer and rewrite it so anyone can understand it - like explaining to a curious friend who has no background in the topic.

Guidelines:
- Use everyday language, avoid jargon
- Write in short paragraphs (2-3 sentences each)
- Separate each paragraph with a blank line
- Add helpful analogies or examples where useful
- Keep the same information, just make it clearer
- Be warm and encouraging in tone
- Use "you" to address the reader directly
- If there are steps or multiple points, use bullet points (start lines with "- ")
- Break complex ideas into digestible pieces

Format:
- Always use multiple paragraphs separated by blank lines
- Use bullet points for lists
- Keep paragraphs short and focused

Do NOT add any new information - only simplify what's already there.`
      },
      {
        role: "user",
        content: `Original question: "${question}"

Original answer:
${originalAnswer}

Please rewrite this answer in simpler, friendlier terms that anyone can understand. Use multiple short paragraphs separated by blank lines.`
      }
    ],
    temperature: 0.7,
    max_tokens: 1500,
  });

  return response.choices[0]?.message?.content || originalAnswer;
}

export async function getExternalEnrichment(
  question: string,
  documentContext: string,
  style: "normal" | "eli5" | "detailed" = "normal",
  compareWith?: string,
  userId?: string | number,
  forceRefresh?: boolean // New option to bypass cache
): Promise<EnrichmentResult> {
  const cacheKey = getCacheKey(question + (compareWith || ""), style, userId, documentContext);
  
  // Check cache unless force refresh is requested
  if (!forceRefresh) {
    const cached = enrichmentCache.get(cacheKey);
    if (cached && isCacheValid(cached.timestamp)) {
      await logCacheOperation(userId || "anon", "hit", cacheKey, { question: question.substring(0, 50) });
      return cached.result;
    }
  } else {
    // Clear this specific cache entry on force refresh
    enrichmentCache.delete(cacheKey);
    console.log(`[ExternalEnrichment] Force refresh - cleared cache for user ${userId}`);
  }
  await logCacheOperation(userId || "anon", "miss", cacheKey, { question: question.substring(0, 50) });

  const styleInstructions = {
    normal: "Provide a clear, professional explanation with proper structure.",
    eli5: "Explain this like you're talking to a curious 10-year-old. Use simple words, fun analogies, and short sentences.",
    detailed: "Provide a comprehensive, detailed explanation with examples and context."
  };

  const isComparison = !!compareWith;
  
  // Try Perplexity first for real web citations
  const perplexityResult = await searchWithPerplexity(question, documentContext, style, isComparison, compareWith);
  
  let summary: string;
  let citations: Citation[];
  
  if (perplexityResult && perplexityResult.content && perplexityResult.citations && perplexityResult.citations.length > 0) {
    // Use Perplexity results with real URLs
    summary = perplexityResult.content;
    
    // Extract keywords from question and document context for relevance filtering
    const questionLower = question.toLowerCase();
    const contextLower = (documentContext || "").toLowerCase().slice(0, 500);
    const relevanceKeywords = extractRelevanceKeywords(questionLower + " " + contextLower);
    
    // Filter and map citations - only keep ones relevant to current query
    const allCitations = perplexityResult.citations.slice(0, 12).map((url, idx) => {
      let domain = "unknown";
      try {
        domain = new URL(url).hostname.replace('www.', '');
      } catch {}
      return {
        id: idx + 1,
        title: domain,
        url: url,
        publisher: domain,
        snippet: `Source from ${domain}`,
        domain: domain,
      };
    });
    
    // Filter to only show relevant citations (domain or URL contains relevant keywords)
    citations = filterRelevantCitations(allCitations, relevanceKeywords, 8);
    console.log(`[ExternalEnrichment] Using Perplexity with ${citations.length} relevant citations (filtered from ${allCitations.length})`);
  } else if (perplexityResult && perplexityResult.content) {
    // Perplexity returned content but no citations - use content as summary, no citations
    summary = perplexityResult.content;
    citations = [];
    console.log(`[ExternalEnrichment] Perplexity returned content but NO citations - using content as summary`);
  } else {
    // Fall back to OpenAI
    console.log(`[ExternalEnrichment] Falling back to OpenAI (no Perplexity key or error)`);
    
    const systemPrompt = isComparison
      ? `You are a knowledgeable research assistant helping users compare products, brands, or services.

Your role:
1. Compare the user's document content with the specified competitor/brand
2. Highlight key similarities and differences
3. Be objective and fair in your comparison
4. Always cite your sources using [1], [2], etc. format
5. Focus on factual, verifiable information

Format requirements:
- Start with a brief overview of both options
- Use a clear comparison structure (e.g., feature by feature)
- Write in short paragraphs (2-4 sentences each)
- Separate each paragraph with a blank line
- Use bullet points for lists of differences/similarities
- End with a "Sources:" section listing all references

Be balanced and objective - present facts, not opinions.`
      : `You are a knowledgeable research assistant providing external context to supplement document-based answers.

Your role:
1. Provide helpful context, definitions, or explanations that complement what was found in the user's documents
2. Always cite your sources using [1], [2], etc. format
3. ${styleInstructions[style]}
4. Be accurate and cite reputable sources (academic, government, established organizations)
5. Clearly distinguish between general knowledge and specific claims that need citations
6. If sources might conflict, note the different perspectives

Format requirements:
- Write in short paragraphs (2-4 sentences each)
- Separate each paragraph with a blank line
- Use bullet points (starting with "- ") for lists of items
- Use numbered lists (1., 2., 3.) for sequential steps
- Inline citations like [1], [2] where appropriate
- End with a "Sources:" section listing all references

Important: You are supplementing, not replacing, what the user found in their documents. Focus on providing helpful context in a conversational, readable way.`;

    const userPrompt = isComparison
      ? `The user has a document about a product/brand with this information:
${documentContext || "Details from the user's document."}

They want to compare it with: "${compareWith}"

Please provide a balanced comparison between what's in their document and ${compareWith}. Include key differences, similarities, and any important considerations. Use short paragraphs and cite your sources.`
      : `The user asked: "${question}"

From their documents, they found:
${documentContext || "The information was not fully found in their documents."}

Please provide helpful external context to supplement this information. Use short paragraphs separated by blank lines, and include citations to reputable sources.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.5,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || "";
    const parsed = parseExternalResponse(content);
    summary = parsed.summary;
    citations = parsed.citations;
  }

  const images = await searchPexelsImages(question, 3);

  const result: EnrichmentResult = {
    externalSummary: summary,
    citations,
    eli5Summary: style === "eli5" ? summary : undefined,
    images: images.length > 0 ? images : undefined,
  };

  enrichmentCache.set(cacheKey, { result, timestamp: Date.now() });
  await logCacheOperation(userId || "anon", "set", cacheKey, { 
    question: question.substring(0, 50),
    hasSummary: !!result.externalSummary,
    citationsCount: result.citations?.length || 0
  });

  return result;
}

function parseExternalResponse(content: string): { summary: string; citations: Citation[] } {
  const citations: Citation[] = [];
  
  const sourcesMatch = content.match(/(?:Sources?|References?):?\s*\n([\s\S]*?)$/i);
  let summary = content;
  
  if (sourcesMatch) {
    summary = content.slice(0, sourcesMatch.index).trim();
    const sourcesText = sourcesMatch[1];
    
    const sourceLines = sourcesText.split('\n').filter(l => l.trim());
    sourceLines.forEach((line, idx) => {
      const urlMatch = line.match(/https?:\/\/[^\s\)]+/);
      const cleanLine = line.replace(/^\[?\d+\]?\s*[-–—.]?\s*/, '').trim();
      
      let domain = "unknown";
      let url = "";
      if (urlMatch) {
        url = urlMatch[0];
        try {
          domain = new URL(url).hostname.replace('www.', '');
        } catch {}
      }
      
      const titleMatch = cleanLine.match(/^([^–—\-:]+)/);
      const title = titleMatch ? titleMatch[1].trim() : cleanLine.slice(0, 60);
      
      citations.push({
        id: idx + 1,
        title: title || `Source ${idx + 1}`,
        url: url,
        publisher: domain,
        snippet: cleanLine.slice(0, 150),
        domain: domain,
      });
    });
  }
  
  if (citations.length === 0) {
    const inlineCitations = content.match(/\[(\d+)\]/g);
    if (inlineCitations) {
      const uniqueNums = Array.from(new Set(inlineCitations.map(c => parseInt(c.replace(/[\[\]]/g, '')))));
      uniqueNums.forEach(num => {
        citations.push({
          id: num,
          title: `Reference ${num}`,
          url: "",
          publisher: "External source",
          snippet: "Citation from general knowledge base",
          domain: "general",
        });
      });
    }
  }

  return { summary, citations };
}

export function clearEnrichmentCache(): void {
  enrichmentCache.clear();
  imageCache.clear();
  console.log("[ExternalEnrichment] All caches cleared");
}

// Alias for admin API
export function clearAllCaches(): void {
  enrichmentCache.clear();
  imageCache.clear();
  searchTermCache.clear();
  console.log("[ExternalEnrichment] All caches cleared (admin)");
}

// Get cache statistics for monitoring
export function getCacheStats(): {
  enrichmentCacheSize: number;
  imageCacheSize: number;
  searchTermCacheSize: number;
  cacheEntries: Array<{ key: string; timestamp: number; age: string }>;
} {
  const now = Date.now();
  const entries: Array<{ key: string; timestamp: number; age: string }> = [];
  
  enrichmentCache.forEach((value, key) => {
    const ageMs = now - value.timestamp;
    const ageMinutes = Math.round(ageMs / 60000);
    entries.push({
      key: key.substring(0, 60) + (key.length > 60 ? "..." : ""),
      timestamp: value.timestamp,
      age: `${ageMinutes} min`
    });
  });
  
  return {
    enrichmentCacheSize: enrichmentCache.size,
    imageCacheSize: imageCache.size,
    searchTermCacheSize: searchTermCache.size,
    cacheEntries: entries.slice(0, 50) // Limit to 50 entries
  };
}

export { searchPexelsImages };
