# Evident Python Document Processing Service

This is a separate microservice for heavy document processing (OCR, PDF extraction, table detection).

## Setup on Replit

1. Create a new Python Replit project
2. Copy all files from this `python-service/` folder
3. Add secrets:
   - `EVIDENT_PYTHON_API_KEY`: Shared API key (same as main app)
   - `OPENAI_API_KEY`: For AI-assisted processing (optional)
4. Deploy the app

## API Endpoints

All endpoints (except `/health`) require `X-API-Key` header.

### Health Check
```
GET /health
```

### PaddleOCR (Advanced OCR)
```
POST /api/ocr/paddle
{
  "image_url": "https://...",
  "language": "en"
}
```

### Tesseract OCR (Fast OCR)
```
POST /api/ocr/tesseract
{
  "image_url": "https://...",
  "language": "eng"
}
```

### PDF Text Extraction
```
POST /api/extract-pdf
{
  "pdf_url": "https://..."
}
```

### Table Extraction
```
POST /api/extract-tables
{
  "pdf_url": "https://...",
  "pages": "all",
  "method": "lattice"
}
```

### Full Document Analysis
```
POST /api/analyze-document
{
  "file_url": "https://...",
  "file_type": "pdf",
  "extract_tables": true,
  "run_ocr": false,
  "ocr_engine": "paddle"
}
```

## Environment Variables

- `EVIDENT_PYTHON_API_KEY`: Required for API authentication
- `PORT`: Server port (default: 5000)

## Dependencies

- PaddleOCR: Advanced OCR with table/form recognition
- PyMuPDF: PDF text extraction
- Camelot/Tabula: Table extraction from PDFs
- Tesseract: Fast text OCR
