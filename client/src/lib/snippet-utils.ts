export function trimSnippet(text: string): string {
  if (!text) return '';
  let result = text;

  const firstSentenceEnd = result.search(/[.!?]\s/);
  if (firstSentenceEnd > 0 && firstSentenceEnd < result.length * 0.3) {
    result = result.slice(firstSentenceEnd + 2);
  } else {
    const firstSpace = result.indexOf(' ');
    if (firstSpace > 0 && firstSpace < 30 && /^[a-z]/.test(result)) {
      result = result.slice(firstSpace + 1);
    }
  }

  const lastSentenceEnd = result.search(/[.!?]\s*$/);
  if (lastSentenceEnd > 0) {
    result = result.slice(0, lastSentenceEnd + 1);
  } else {
    const lastPeriod = result.lastIndexOf('.');
    const lastQuestion = result.lastIndexOf('?');
    const lastExclaim = result.lastIndexOf('!');
    const lastEnd = Math.max(lastPeriod, lastQuestion, lastExclaim);
    if (lastEnd > result.length * 0.5) {
      result = result.slice(0, lastEnd + 1);
    }
  }

  return result.trim();
}
