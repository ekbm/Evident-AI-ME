const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;

export interface TextChunk {
  text: string;
  index: number;
}

export function chunkText(text: string): TextChunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }
  
  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 1;
  
  while (start < text.length) {
    let end = start + CHUNK_SIZE;
    
    // Try to break at sentence or paragraph boundary
    if (end < text.length) {
      const searchStart = Math.max(start + CHUNK_SIZE - 200, start);
      const searchEnd = Math.min(start + CHUNK_SIZE + 100, text.length);
      const searchText = text.slice(searchStart, searchEnd);
      
      // Look for paragraph break first
      const paragraphBreak = searchText.lastIndexOf("\n\n");
      if (paragraphBreak !== -1 && paragraphBreak > 50) {
        end = searchStart + paragraphBreak + 2;
      } else {
        // Look for sentence break
        const sentenceBreak = searchText.search(/[.!?]\s+/);
        if (sentenceBreak !== -1 && sentenceBreak > 50) {
          end = searchStart + sentenceBreak + 2;
        }
      }
    }
    
    const chunkText = text.slice(start, end).trim();
    if (chunkText.length > 0) {
      chunks.push({ text: chunkText, index });
      index++;
    }
    
    // Move start with overlap
    start = end - CHUNK_OVERLAP;
    if (start >= text.length - CHUNK_OVERLAP) {
      break;
    }
  }
  
  return chunks;
}

export function chunkTextWithPageRefs(pages: { pageNum: number; text: string }[]): { text: string; sourceRef: string }[] {
  const result: { text: string; sourceRef: string }[] = [];
  
  for (const page of pages) {
    const chunks = chunkText(page.text);
    for (const chunk of chunks) {
      result.push({
        text: chunk.text,
        sourceRef: chunks.length > 1 ? `page=${page.pageNum}:chunk=${chunk.index}` : `page=${page.pageNum}`,
      });
    }
  }
  
  return result;
}
