import { useEffect } from "react";

const BASE_TITLE = "Evident";

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} | ${BASE_TITLE}` : `${BASE_TITLE} - AI-Powered Document Intelligence Platform`;
    
    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
