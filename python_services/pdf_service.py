#!/usr/bin/env python3
"""
PDF Extraction Microservice using PyMuPDF
Provides text extraction, table detection, contract analysis, and Markdown output for RAG/LLM pipelines
"""

import os
import json
import tempfile
from flask import Flask, request, jsonify
import pymupdf
import pymupdf4llm
from openai import OpenAI

app = Flask(__name__)

def get_openai_client():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is required for contract analysis")
    return OpenAI(api_key=api_key)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "pdf-extraction"})

@app.route('/extract', methods=['POST'])
def extract_pdf():
    """
    Extract text and metadata from a PDF file.
    
    Request body (JSON):
        - file_path: Path to the PDF file on disk
        OR
        - file_data: Base64 encoded PDF data
        
    Query params:
        - format: 'text' | 'markdown' | 'blocks' (default: 'markdown')
        - extract_tables: 'true' | 'false' (default: 'true')
    
    Returns:
        - text: Extracted text content
        - markdown: Markdown-formatted text (if format=markdown)
        - tables: Array of extracted tables (if extract_tables=true)
        - page_count: Number of pages
        - metadata: PDF metadata
    """
    try:
        data = request.get_json() or {}
        file_path = data.get('file_path')
        file_data = data.get('file_data')
        
        output_format = request.args.get('format', 'markdown')
        extract_tables = request.args.get('extract_tables', 'true').lower() == 'true'
        
        doc = None
        temp_file = None
        
        if file_path:
            if not os.path.exists(file_path):
                return jsonify({"error": f"File not found: {file_path}"}), 404
            doc = pymupdf.open(file_path)
        elif file_data:
            import base64
            pdf_bytes = base64.b64decode(file_data)
            temp_file = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
            temp_file.write(pdf_bytes)
            temp_file.close()
            doc = pymupdf.open(temp_file.name)
            file_path = temp_file.name
        else:
            return jsonify({"error": "Either file_path or file_data is required"}), 400
        
        result = {
            "page_count": len(doc),
            "metadata": dict(doc.metadata) if doc.metadata else {},
            "tables": []
        }
        
        if output_format == 'markdown':
            md_text = pymupdf4llm.to_markdown(file_path)
            result["markdown"] = md_text
            result["text"] = md_text
        elif output_format == 'blocks':
            blocks = []
            for page_num, page in enumerate(doc):
                page_blocks = page.get_text("dict")["blocks"]
                for block in page_blocks:
                    if "lines" in block:
                        text = ""
                        for line in block["lines"]:
                            for span in line["spans"]:
                                text += span["text"]
                            text += "\n"
                        blocks.append({
                            "page": page_num + 1,
                            "text": text.strip(),
                            "bbox": block["bbox"],
                            "type": "text"
                        })
            result["blocks"] = blocks
            result["text"] = "\n\n".join([b["text"] for b in blocks])
        else:
            text_parts = []
            for page in doc:
                text_parts.append(page.get_text("text"))
            result["text"] = "\n\n".join(text_parts)
        
        if extract_tables:
            tables = []
            for page_num, page in enumerate(doc):
                page_tables = page.find_tables()
                for idx, table in enumerate(page_tables.tables):
                    try:
                        table_data = table.extract()
                        headers = table_data[0] if table_data else []
                        rows = table_data[1:] if len(table_data) > 1 else []
                        
                        tables.append({
                            "page": page_num + 1,
                            "table_index": idx,
                            "headers": headers,
                            "rows": rows,
                            "row_count": len(rows),
                            "col_count": len(headers) if headers else 0
                        })
                    except Exception as e:
                        tables.append({
                            "page": page_num + 1,
                            "table_index": idx,
                            "error": str(e)
                        })
            result["tables"] = tables
        
        doc.close()
        
        if temp_file and os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/extract-tables', methods=['POST'])
def extract_tables_only():
    """
    Extract only tables from a PDF file.
    
    Request body (JSON):
        - file_path: Path to the PDF file on disk
    
    Returns:
        - tables: Array of extracted tables with headers and rows
    """
    try:
        data = request.get_json() or {}
        file_path = data.get('file_path')
        
        if not file_path:
            return jsonify({"error": "file_path is required"}), 400
            
        if not os.path.exists(file_path):
            return jsonify({"error": f"File not found: {file_path}"}), 404
        
        doc = pymupdf.open(file_path)
        tables = []
        
        for page_num, page in enumerate(doc):
            page_tables = page.find_tables()
            for idx, table in enumerate(page_tables.tables):
                try:
                    table_data = table.extract()
                    headers = table_data[0] if table_data else []
                    rows = table_data[1:] if len(table_data) > 1 else []
                    
                    tables.append({
                        "page": page_num + 1,
                        "table_index": idx,
                        "headers": headers,
                        "rows": rows,
                        "row_count": len(rows),
                        "col_count": len(headers) if headers else 0
                    })
                except Exception as e:
                    tables.append({
                        "page": page_num + 1,
                        "table_index": idx,
                        "error": str(e)
                    })
        
        doc.close()
        return jsonify({"tables": tables, "table_count": len(tables)})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/page-count', methods=['POST'])
def get_page_count():
    """
    Get the page count of a PDF file.
    
    Request body (JSON):
        - file_path: Path to the PDF file on disk
    
    Returns:
        - page_count: Number of pages
    """
    try:
        data = request.get_json() or {}
        file_path = data.get('file_path')
        
        if not file_path:
            return jsonify({"error": "file_path is required"}), 400
            
        if not os.path.exists(file_path):
            return jsonify({"error": f"File not found: {file_path}"}), 404
        
        doc = pymupdf.open(file_path)
        page_count = len(doc)
        doc.close()
        
        return jsonify({"page_count": page_count})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/redact', methods=['POST'])
def redact_text():
    """
    Redact sensitive text from a PDF file.
    
    Request body (JSON):
        - file_path: Path to the PDF file on disk
        - patterns: Array of text patterns to redact
        - output_path: Path to save the redacted PDF (optional)
    
    Returns:
        - redacted_count: Number of redactions made
        - output_path: Path to the redacted file
    """
    try:
        data = request.get_json() or {}
        file_path = data.get('file_path')
        patterns = data.get('patterns', [])
        output_path = data.get('output_path')
        
        if not file_path:
            return jsonify({"error": "file_path is required"}), 400
            
        if not os.path.exists(file_path):
            return jsonify({"error": f"File not found: {file_path}"}), 404
        
        if not patterns:
            return jsonify({"error": "patterns array is required"}), 400
        
        if not output_path:
            base, ext = os.path.splitext(file_path)
            output_path = f"{base}_redacted{ext}"
        
        doc = pymupdf.open(file_path)
        redacted_count = 0
        
        for page in doc:
            for pattern in patterns:
                areas = page.search_for(pattern)
                for area in areas:
                    page.add_redact_annot(area, fill=(0, 0, 0))
                    redacted_count += 1
            page.apply_redactions()
        
        doc.save(output_path)
        doc.close()
        
        return jsonify({
            "redacted_count": redacted_count,
            "output_path": output_path
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/analyze-contract', methods=['POST'])
def analyze_contract():
    """
    Analyze a contract PDF for clauses, implications, negotiation points, and generate a summary.
    
    Request body (JSON):
        - file_path: Path to the PDF file on disk
        - focus_areas: Optional list of specific areas to focus on (e.g., ["termination", "liability", "payment"])
    
    Returns:
        - summary: Executive summary of the contract
        - clauses: Array of identified clauses with their implications
        - negotiation_points: Suggested negotiation points
        - risks: Identified risks and red flags
        - key_terms: Important terms and definitions
        - obligations: List of obligations for each party
    """
    try:
        data = request.get_json() or {}
        file_path = data.get('file_path')
        focus_areas = data.get('focus_areas', [])
        
        if not file_path:
            return jsonify({"error": "file_path is required"}), 400
            
        if not os.path.exists(file_path):
            return jsonify({"error": f"File not found: {file_path}"}), 404
        
        md_text = pymupdf4llm.to_markdown(file_path)
        
        doc = pymupdf.open(file_path)
        page_count = len(doc)
        doc.close()
        
        if len(md_text) > 100000:
            md_text = md_text[:100000] + "\n\n[Document truncated for analysis...]"
        
        focus_instruction = ""
        if focus_areas:
            focus_instruction = f"\n\nPay special attention to these areas: {', '.join(focus_areas)}"
        
        client = get_openai_client()
        
        analysis_prompt = f"""You are an expert legal analyst specializing in contract review. Analyze the following contract document and provide a comprehensive analysis.

CONTRACT TEXT:
{md_text}
{focus_instruction}

Provide your analysis in the following JSON structure:
{{
    "summary": "A 2-3 paragraph executive summary of the contract, including parties involved, purpose, and key dates",
    "document_type": "Type of contract (e.g., Service Agreement, NDA, Employment Contract, etc.)",
    "parties": [
        {{"name": "Party name", "role": "Their role in the contract"}}
    ],
    "key_terms": [
        {{"term": "Term name", "definition": "What it means", "location": "Where found in document"}}
    ],
    "clauses": [
        {{
            "title": "Clause name/type",
            "summary": "Brief description of what this clause covers",
            "full_text": "Key excerpt from the clause",
            "implications": "What this means in practical terms",
            "risk_level": "low/medium/high",
            "party_favored": "Which party this clause favors, if any"
        }}
    ],
    "obligations": [
        {{
            "party": "Party name",
            "obligation": "What they must do",
            "deadline": "Any associated deadline or timeframe",
            "consequence": "What happens if not fulfilled"
        }}
    ],
    "negotiation_points": [
        {{
            "clause": "Which clause this relates to",
            "concern": "Why this might be problematic",
            "suggestion": "Recommended modification or alternative language",
            "priority": "high/medium/low"
        }}
    ],
    "risks": [
        {{
            "description": "Description of the risk",
            "severity": "low/medium/high/critical",
            "mitigation": "How to address this risk"
        }}
    ],
    "important_dates": [
        {{
            "date": "The date or timeframe",
            "event": "What happens on this date"
        }}
    ],
    "missing_clauses": ["List of standard clauses that appear to be missing"],
    "overall_assessment": {{
        "fairness_score": 1-10,
        "complexity_level": "simple/moderate/complex",
        "recommendation": "Overall recommendation for the reviewing party"
    }}
}}

Respond ONLY with valid JSON. Be thorough but concise in your analysis."""

        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": "You are an expert legal contract analyst. Always respond with valid JSON only."},
                {"role": "user", "content": analysis_prompt}
            ],
            temperature=0.3,
            max_tokens=8000
        )
        
        analysis_text = response.choices[0].message.content.strip()
        
        if analysis_text.startswith("```json"):
            analysis_text = analysis_text[7:]
        if analysis_text.startswith("```"):
            analysis_text = analysis_text[3:]
        if analysis_text.endswith("```"):
            analysis_text = analysis_text[:-3]
        
        try:
            analysis = json.loads(analysis_text)
        except json.JSONDecodeError:
            analysis = {
                "summary": analysis_text,
                "error": "Failed to parse structured response",
                "raw_response": analysis_text
            }
        
        result = {
            "page_count": page_count,
            "analysis": analysis,
            "text_length": len(md_text),
            "focus_areas": focus_areas
        }
        
        return jsonify(result)
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


import re
from typing import Dict, List, Optional, Any, Tuple

def detect_scanned_pdf(raw_text: str, page_count: int) -> bool:
    """Detect if PDF is likely scanned (image-based) rather than text-based."""
    total_chars = len(raw_text.strip())
    if total_chars < 200:
        return True
    if page_count > 0 and (total_chars / page_count) < 100:
        return True
    return False

def find_field_anchor(text: str, blocks: List[Dict], search_value: str) -> Optional[Dict]:
    """Find the bbox anchor for a field value in the PDF blocks."""
    if not search_value or not blocks:
        return None
    search_lower = search_value.lower().strip()
    for block in blocks:
        block_text = block.get("text", "").lower()
        if search_lower in block_text:
            return {
                "page": block.get("page", 0),
                "bbox": block.get("bbox", [])
            }
    return None

def extract_invoice_fields(raw_text: str) -> Dict[str, Any]:
    """Extract invoice fields using regex patterns."""
    fields = {}
    
    # Invoice number patterns
    inv_patterns = [
        r'(?:invoice|inv)[\s\.\-#:]*(?:no|number|#)?[\s\.\-#:]*([A-Z0-9\-\/]+)',
        r'(?:bill|receipt)[\s\.\-#:]*(?:no|number|#)?[\s\.\-#:]*([A-Z0-9\-\/]+)',
    ]
    for pattern in inv_patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            fields["invoiceNumber"] = match.group(1).strip()
            break
    
    # PO reference
    po_patterns = [
        r'(?:po|purchase\s*order)[\s\.\-#:]*(?:no|number|#)?[\s\.\-#:]*([A-Z0-9\-\/]+)',
    ]
    for pattern in po_patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            fields["poReference"] = match.group(1).strip()
            break
    
    # Dates
    date_patterns = [
        (r'(?:invoice\s*date|date\s*of\s*invoice)[\s\.\-:]*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})', "invoiceDate"),
        (r'(?:due\s*date|payment\s*due)[\s\.\-:]*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})', "dueDate"),
        (r'(?:date)[\s\.\-:]*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})', "invoiceDate"),
    ]
    for pattern, field_name in date_patterns:
        if field_name not in fields:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                fields[field_name] = match.group(1).strip()
    
    # Currency detection
    currency_patterns = [
        (r'\$|USD|US\s*Dollar', "USD"),
        (r'AUD|A\$|Australian', "AUD"),
        (r'€|EUR|Euro', "EUR"),
        (r'£|GBP|Pound', "GBP"),
    ]
    for pattern, currency in currency_patterns:
        if re.search(pattern, raw_text, re.IGNORECASE):
            fields["currency"] = currency
            break
    if "currency" not in fields:
        fields["currency"] = "USD"
    
    # Total amount - find last occurrence
    total_patterns = [
        r'(?:total|amount\s*due|grand\s*total|balance\s*due)[\s\.\-:]*[\$€£]?\s*([\d,]+\.?\d*)',
        r'[\$€£]\s*([\d,]+\.?\d*)\s*(?:total|due)',
    ]
    all_totals = []
    for pattern in total_patterns:
        matches = re.findall(pattern, raw_text, re.IGNORECASE)
        all_totals.extend(matches)
    if all_totals:
        try:
            fields["totalAmount"] = float(all_totals[-1].replace(",", ""))
        except ValueError:
            pass
    
    # Tax/GST/VAT
    tax_patterns = [
        r'(?:gst|vat|tax|sales\s*tax)[\s\.\-:]*[\$€£]?\s*([\d,]+\.?\d*)',
    ]
    for pattern in tax_patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            try:
                fields["taxAmount"] = float(match.group(1).replace(",", ""))
            except ValueError:
                pass
            break
    
    # Vendor name - usually at top of document
    lines = raw_text.strip().split('\n')
    for line in lines[:10]:
        line = line.strip()
        if len(line) > 3 and len(line) < 100 and not re.match(r'^[\d\s\-\/\.\$]+$', line):
            if not any(kw in line.lower() for kw in ['invoice', 'bill', 'date', 'to:', 'from:', 'page']):
                fields["vendorName"] = line
                break
    
    return fields

def extract_line_items_from_tables(tables: List[Dict]) -> List[Dict]:
    """Extract line items from detected tables."""
    line_items = []
    
    for table in tables:
        if "error" in table:
            continue
        headers = [str(h).lower() if h else "" for h in table.get("headers", [])]
        rows = table.get("rows", [])
        
        # Look for quantity/price columns
        qty_idx = None
        price_idx = None
        desc_idx = None
        amount_idx = None
        
        for i, h in enumerate(headers):
            if any(kw in h for kw in ['qty', 'quantity', 'hours', 'units']):
                qty_idx = i
            elif any(kw in h for kw in ['rate', 'price', 'unit price', 'cost']):
                price_idx = i
            elif any(kw in h for kw in ['description', 'item', 'service', 'product']):
                desc_idx = i
            elif any(kw in h for kw in ['amount', 'total', 'line total', 'subtotal']):
                amount_idx = i
        
        if desc_idx is not None or qty_idx is not None:
            for row in rows:
                if len(row) == 0:
                    continue
                item = {}
                if desc_idx is not None and desc_idx < len(row):
                    item["description"] = str(row[desc_idx] or "")
                if qty_idx is not None and qty_idx < len(row):
                    try:
                        item["quantity"] = float(str(row[qty_idx]).replace(",", ""))
                    except:
                        item["quantity"] = 0
                if price_idx is not None and price_idx < len(row):
                    try:
                        item["unitPrice"] = float(re.sub(r'[^\d.]', '', str(row[price_idx] or "0")))
                    except:
                        item["unitPrice"] = 0
                if amount_idx is not None and amount_idx < len(row):
                    try:
                        item["amount"] = float(re.sub(r'[^\d.]', '', str(row[amount_idx] or "0")))
                    except:
                        item["amount"] = 0
                
                if item.get("description") or item.get("quantity"):
                    line_items.append(item)
    
    return line_items


@app.route('/extract-invoice', methods=['POST'])
def extract_invoice():
    """
    Extract structured invoice data with field anchors for evidence-based verification.
    
    Request body (JSON):
        - file_path: Path to the PDF file on disk
        - file_data: Base64 encoded PDF data (alternative to file_path)
        - docType: 'invoice' | 'po' | 'grn' (default: 'invoice')
        - vendorHint: Optional vendor name hint
        - currencyHint: Optional currency hint
    
    Returns:
        - docType: Document type
        - fields: Extracted field values
        - lineItems: Array of line items
        - rawText: Full extracted text
        - anchors: Field locations with page + bbox
        - meta: Metadata including scanned detection
    """
    try:
        data = request.get_json() or {}
        file_path = data.get('file_path')
        file_data = data.get('file_data')
        doc_type = data.get('docType', 'invoice')
        vendor_hint = data.get('vendorHint')
        currency_hint = data.get('currencyHint')
        
        doc = None
        temp_file = None
        
        if file_path:
            if not os.path.exists(file_path):
                return jsonify({"error": f"File not found: {file_path}"}), 404
            doc = pymupdf.open(file_path)
        elif file_data:
            import base64
            pdf_bytes = base64.b64decode(file_data)
            temp_file = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
            temp_file.write(pdf_bytes)
            temp_file.close()
            doc = pymupdf.open(temp_file.name)
            file_path = temp_file.name
        else:
            return jsonify({"error": "Either file_path or file_data is required"}), 400
        
        page_count = len(doc)
        
        # Extract text blocks with coordinates
        blocks = []
        raw_text_parts = []
        for page_num, page in enumerate(doc):
            page_dict = page.get_text("dict")
            for block in page_dict.get("blocks", []):
                if "lines" in block:
                    text = ""
                    for line in block["lines"]:
                        for span in line["spans"]:
                            text += span["text"]
                        text += "\n"
                    blocks.append({
                        "page": page_num,
                        "text": text.strip(),
                        "bbox": list(block["bbox"]),
                        "type": "text"
                    })
                    raw_text_parts.append(text)
        
        raw_text = "\n".join(raw_text_parts)
        
        # Detect scanned PDF
        is_scanned = detect_scanned_pdf(raw_text, page_count)
        
        # Extract tables for line items
        tables = []
        for page_num, page in enumerate(doc):
            try:
                page_tables = page.find_tables()
                for idx, table in enumerate(page_tables.tables):
                    table_data = table.extract()
                    headers = table_data[0] if table_data else []
                    rows = table_data[1:] if len(table_data) > 1 else []
                    tables.append({
                        "page": page_num,
                        "headers": headers,
                        "rows": rows
                    })
            except Exception as e:
                pass
        
        doc.close()
        
        if temp_file and os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
        
        # Extract fields
        fields = extract_invoice_fields(raw_text)
        
        # Apply hints
        if vendor_hint and not fields.get("vendorName"):
            fields["vendorName"] = vendor_hint
        if currency_hint:
            fields["currency"] = currency_hint
        
        # Extract line items from tables
        line_items = extract_line_items_from_tables(tables)
        
        # Build anchors for extracted fields
        anchors = {}
        for field_name, field_value in fields.items():
            if isinstance(field_value, str):
                anchor = find_field_anchor(raw_text, blocks, field_value)
                if anchor:
                    anchors[field_name] = anchor
        
        # Build response
        result = {
            "docType": doc_type,
            "fields": fields,
            "lineItems": line_items,
            "rawText": raw_text,
            "anchors": anchors,
            "meta": {
                "isScannedLikely": is_scanned,
                "pages": page_count,
                "tableCount": len(tables),
                "blockCount": len(blocks)
            }
        }
        
        # Add OCR warning if scanned
        if is_scanned:
            result["meta"]["code"] = "OCR_REQUIRED"
            result["meta"]["message"] = "This PDF appears to be scanned. Extraction may be incomplete. Consider using OCR processing."
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PDF_SERVICE_PORT', 5001))
    print(f"Starting PDF extraction service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
