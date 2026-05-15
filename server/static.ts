import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static assets with proper cache headers
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);
      
      // Vite hashed assets in /assets/ folder with pattern like index-AbC12dE3.js
      // These are content-addressed and can be cached forever
      const isViteHashedAsset = filePath.includes('/assets/') && 
        /\-[a-zA-Z0-9]{7,8}\.(js|css|woff2?|ttf|eot)$/.test(fileName);
      
      if (isViteHashedAsset) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      // HTML files should always revalidate
      else if (ext === '.html') {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      }
      // Other static assets get moderate caching with revalidation
      else {
        res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
      }
    }
  }));

  // SPA fallback - serve index.html for navigation requests only
  // Return 404 for missing asset files (prevents MIME type errors)
  app.use("*", (req, res) => {
    // Only handle GET requests for navigation
    if (req.method !== 'GET') {
      res.status(404).send('Not found');
      return;
    }
    
    const requestPath = req.originalUrl.split('?')[0]; // Remove query string
    const ext = path.extname(requestPath).toLowerCase();
    const acceptHeader = req.headers.accept || '';
    
    // If request has a file extension (not .html), it's a missing asset - return 404
    // express.static already handled existing files, so reaching here means file doesn't exist
    // This prevents serving HTML when browser expects JS/CSS (MIME type error)
    if (ext && ext !== '.html') {
      res.status(404).send('Not found');
      return;
    }
    
    // Only serve index.html for browser navigation requests
    // Check for Accept: text/html (browsers send this for page navigation)
    // Do NOT treat */* as navigation to avoid MIME errors from XHR/fetch requests
    const isNavigation = acceptHeader.includes('text/html');
    
    if (!isNavigation) {
      res.status(404).send('Not found');
      return;
    }
    
    // For navigation requests, serve index.html with no-cache
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
