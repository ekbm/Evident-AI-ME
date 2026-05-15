"""
Evident Python Document Processing Microservice
Flask API for OCR, PDF extraction, and table detection
"""
import os
import sys
import json
import tempfile
import requests
import time
from datetime import datetime
from flask import Flask, request, jsonify
from functools import wraps

app = Flask(__name__)

API_KEY = os.environ.get('EVIDENT_PYTHON_API_KEY', '')

# Usage tracking - stores stats in memory (resets on restart)
usage_stats = {
    'total_requests': 0,
    'endpoints': {
        'paddle_ocr': {'count': 0, 'success': 0, 'errors': 0, 'total_time_ms': 0},
        'tesseract_ocr': {'count': 0, 'success': 0, 'errors': 0, 'total_time_ms': 0},
        'extract_pdf': {'count': 0, 'success': 0, 'errors': 0, 'total_time_ms': 0},
        'extract_tables': {'count': 0, 'success': 0, 'errors': 0, 'total_time_ms': 0},
        'analyze_document': {'count': 0, 'success': 0, 'errors': 0, 'total_time_ms': 0},
    },
    'started_at': datetime.utcnow().isoformat(),
    'last_request_at': None
}

def track_usage(endpoint_name, success, time_ms):
    """Track usage statistics for an endpoint"""
    usage_stats['total_requests'] += 1
    usage_stats['last_request_at'] = datetime.utcnow().isoformat()
    if endpoint_name in usage_stats['endpoints']:
        usage_stats['endpoints'][endpoint_name]['count'] += 1
        usage_stats['endpoints'][endpoint_name]['total_time_ms'] += time_ms
        if success:
            usage_stats['endpoints'][endpoint_name]['success'] += 1
        else:
            usage_stats['endpoints'][endpoint_name]['errors'] += 1

def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key or api_key != API_KEY:
            return jsonify({'error': 'Unauthorized', 'message': 'Invalid or missing API key'}), 401
        return f(*args, **kwargs)
    return decorated

def download_file(url: str, suffix: str = '') -> str:
    """Download file from URL to temp file and return path"""
    response = requests.get(url, timeout=300)
    response.raise_for_status()
    
    fd, path = tempfile.mkstemp(suffix=suffix)
    try:
        os.write(fd, response.content)
    finally:
        os.close(fd)
    return path

def cleanup_file(path: str):
    """Remove temporary file"""
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except Exception:
        pass

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'evident-python-service',
        'version': '1.0.0'
    })

@app.route('/stats', methods=['GET'])
@require_api_key
def get_stats():
    """Get usage statistics - helps monitor service usage"""
    # Calculate averages
    stats_with_averages = {
        'total_requests': usage_stats['total_requests'],
        'started_at': usage_stats['started_at'],
        'last_request_at': usage_stats['last_request_at'],
        'endpoints': {}
    }
    
    for name, data in usage_stats['endpoints'].items():
        avg_time = data['total_time_ms'] / data['count'] if data['count'] > 0 else 0
        success_rate = (data['success'] / data['count'] * 100) if data['count'] > 0 else 0
        stats_with_averages['endpoints'][name] = {
            'total_calls': data['count'],
            'successful': data['success'],
            'errors': data['errors'],
            'success_rate_percent': round(success_rate, 1),
            'avg_time_ms': round(avg_time, 0)
        }
    
    return jsonify(stats_with_averages)

@app.route('/api/ocr/paddle', methods=['POST'])
@require_api_key
def paddle_ocr():
    """Run PaddleOCR on an image"""
    temp_path = None
    try:
        data = request.get_json()
        image_url = data.get('image_url')
        image_base64 = data.get('image_base64')
        language = data.get('language', 'en')
        
        if image_url:
            suffix = '.png' if 'png' in image_url.lower() else '.jpg'
            temp_path = download_file(image_url, suffix)
        elif image_base64:
            import base64
            fd, temp_path = tempfile.mkstemp(suffix='.png')
            try:
                os.write(fd, base64.b64decode(image_base64))
            finally:
                os.close(fd)
        else:
            return jsonify({'error': 'No image provided. Use image_url or image_base64'}), 400
        
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(use_angle_cls=True, lang=language, use_gpu=False, show_log=False)
        result = ocr.ocr(temp_path, cls=True)
        
        texts = []
        confidences = []
        if result and result[0]:
            for line in result[0]:
                if line and len(line) >= 2:
                    text_info = line[1]
                    if isinstance(text_info, tuple) and len(text_info) >= 1:
                        texts.append(text_info[0])
                        if len(text_info) >= 2:
                            confidences.append(text_info[1])
        
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.85
        
        return jsonify({
            'success': True,
            'text': '\n'.join(texts),
            'lines': len(texts),
            'confidence': avg_confidence,
            'engine': 'paddleocr'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'engine': 'paddleocr'
        }), 500
    finally:
        cleanup_file(temp_path)

@app.route('/api/ocr/tesseract', methods=['POST'])
@require_api_key
def tesseract_ocr():
    """Run Tesseract OCR on an image"""
    temp_path = None
    try:
        data = request.get_json()
        image_url = data.get('image_url')
        image_base64 = data.get('image_base64')
        language = data.get('language', 'eng')
        
        if image_url:
            suffix = '.png' if 'png' in image_url.lower() else '.jpg'
            temp_path = download_file(image_url, suffix)
        elif image_base64:
            import base64
            fd, temp_path = tempfile.mkstemp(suffix='.png')
            try:
                os.write(fd, base64.b64decode(image_base64))
            finally:
                os.close(fd)
        else:
            return jsonify({'error': 'No image provided. Use image_url or image_base64'}), 400
        
        import pytesseract
        text = pytesseract.image_to_string(temp_path, lang=language)
        
        return jsonify({
            'success': True,
            'text': text.strip(),
            'confidence': 0.8,
            'engine': 'tesseract'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'engine': 'tesseract'
        }), 500
    finally:
        cleanup_file(temp_path)

@app.route('/api/extract-pdf', methods=['POST'])
@require_api_key
def extract_pdf():
    """Extract text from PDF using PyMuPDF"""
    temp_path = None
    try:
        data = request.get_json()
        pdf_url = data.get('pdf_url')
        
        if not pdf_url:
            return jsonify({'error': 'No pdf_url provided'}), 400
        
        temp_path = download_file(pdf_url, '.pdf')
        
        import fitz  # PyMuPDF
        doc = fitz.open(temp_path)
        
        pages = []
        full_text = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            pages.append({
                'page': page_num + 1,
                'text': text,
                'char_count': len(text)
            })
            full_text.append(text)
        
        doc.close()
        
        return jsonify({
            'success': True,
            'text': '\n\n'.join(full_text),
            'pages': pages,
            'page_count': len(pages),
            'total_chars': sum(p['char_count'] for p in pages)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    finally:
        cleanup_file(temp_path)

@app.route('/api/extract-tables', methods=['POST'])
@require_api_key
def extract_tables():
    """Extract tables from PDF using Camelot (with Tabula fallback)"""
    temp_path = None
    try:
        data = request.get_json()
        pdf_url = data.get('pdf_url')
        pages = data.get('pages', 'all')
        method = data.get('method', 'lattice')
        
        if not pdf_url:
            return jsonify({'error': 'No pdf_url provided'}), 400
        
        temp_path = download_file(pdf_url, '.pdf')
        
        result_tables = []
        fallback_used = False
        
        try:
            import camelot
            tables = camelot.read_pdf(temp_path, pages=str(pages), flavor=method)
            
            for i, table in enumerate(tables):
                df = table.df
                headers = df.iloc[0].tolist() if len(df) > 0 else []
                rows = df.iloc[1:].values.tolist() if len(df) > 1 else []
                result_tables.append({
                    'id': f'table_{i+1}',
                    'headers': headers,
                    'rows': rows,
                    'page': table.page,
                    'accuracy': table.accuracy
                })
        except Exception as camelot_error:
            try:
                import tabula
                dfs = tabula.read_pdf(temp_path, pages='all')
                fallback_used = True
                
                for i, df in enumerate(dfs):
                    headers = df.columns.tolist()
                    rows = df.values.tolist()
                    result_tables.append({
                        'id': f'table_{i+1}',
                        'headers': headers,
                        'rows': rows,
                        'page': i + 1,
                        'accuracy': 80
                    })
            except Exception as tabula_error:
                return jsonify({
                    'success': False,
                    'error': f'Camelot: {str(camelot_error)}, Tabula: {str(tabula_error)}'
                }), 500
        
        return jsonify({
            'success': True,
            'tables': result_tables,
            'count': len(result_tables),
            'fallback_used': fallback_used
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    finally:
        cleanup_file(temp_path)

@app.route('/api/analyze-document', methods=['POST'])
@require_api_key
def analyze_document():
    """Full document analysis - combines PDF extraction, OCR, and table detection"""
    temp_path = None
    try:
        data = request.get_json()
        file_url = data.get('file_url')
        file_type = data.get('file_type', 'pdf')
        extract_tables = data.get('extract_tables', True)
        run_ocr = data.get('run_ocr', False)
        ocr_engine = data.get('ocr_engine', 'paddle')
        
        if not file_url:
            return jsonify({'error': 'No file_url provided'}), 400
        
        suffix = '.pdf' if file_type == 'pdf' else '.png'
        temp_path = download_file(file_url, suffix)
        
        result = {
            'success': True,
            'text': '',
            'tables': [],
            'ocr_result': None,
            'page_count': 0
        }
        
        if file_type == 'pdf':
            import fitz
            doc = fitz.open(temp_path)
            
            pages_text = []
            for page_num in range(len(doc)):
                page = doc[page_num]
                pages_text.append(page.get_text())
            
            result['text'] = '\n\n'.join(pages_text)
            result['page_count'] = len(doc)
            doc.close()
            
            if extract_tables:
                try:
                    import camelot
                    tables = camelot.read_pdf(temp_path, pages='all', flavor='lattice')
                    for i, table in enumerate(tables):
                        df = table.df
                        result['tables'].append({
                            'id': f'table_{i+1}',
                            'headers': df.iloc[0].tolist() if len(df) > 0 else [],
                            'rows': df.iloc[1:].values.tolist() if len(df) > 1 else [],
                            'page': table.page,
                            'accuracy': table.accuracy
                        })
                except Exception as e:
                    result['table_error'] = str(e)
        
        if run_ocr or (file_type in ['image', 'png', 'jpg', 'jpeg']):
            if ocr_engine == 'paddle':
                from paddleocr import PaddleOCR
                ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False, show_log=False)
                ocr_result = ocr.ocr(temp_path, cls=True)
                
                texts = []
                if ocr_result and ocr_result[0]:
                    for line in ocr_result[0]:
                        if line and len(line) >= 2:
                            text_info = line[1]
                            if isinstance(text_info, tuple) and len(text_info) >= 1:
                                texts.append(text_info[0])
                
                result['ocr_result'] = {
                    'text': '\n'.join(texts),
                    'lines': len(texts),
                    'engine': 'paddleocr'
                }
            else:
                import pytesseract
                text = pytesseract.image_to_string(temp_path)
                result['ocr_result'] = {
                    'text': text.strip(),
                    'engine': 'tesseract'
                }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    finally:
        cleanup_file(temp_path)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
