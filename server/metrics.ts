/**
 * Server-side metrics collection for monitoring application health
 * Tracks API response times, document processing, errors, and resource usage
 */

interface RequestMetric {
  path: string;
  method: string;
  duration: number;
  timestamp: number;
  statusCode: number;
}

interface ProcessingMetric {
  type: 'document' | 'embedding' | 'chat' | 'vision' | 'transcription';
  duration: number;
  timestamp: number;
  success: boolean;
  fileSize?: number;
  error?: string;
}

interface PythonServiceMetric {
  endpoint: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
  statusCode?: number;
}

interface MetricsState {
  requests: RequestMetric[];
  processing: ProcessingMetric[];
  errors: { message: string; timestamp: number; type: string }[];
  pythonService: PythonServiceMetric[];
  startTime: number;
  openaiRateLimitErrors: number;
  lastRateLimitError: number | null;
  // Peak tracking for capacity planning
  peakMemoryMB: number;
  peakRequestsPerMinute: number;
  peakResponseTime: number;
  peakConcurrentProcessing: number;
  lastPeakUpdate: number;
  // API cost tracking (cumulative since server start)
  apiCosts: {
    embeddings: number;
    chat: number;
    vision: number;
    transcriptionMinutes: number;
    perplexityRequests: number;
  };
}

// API cost rates (as of 2024)
const API_COSTS = {
  EMBEDDING_PER_1K_TOKENS: 0.00002,
  CHAT_INPUT_PER_1K_TOKENS: 0.00015,
  CHAT_OUTPUT_PER_1K_TOKENS: 0.0006,
  VISION_PER_1K_TOKENS: 0.0025,
  TRANSCRIPTION_PER_MINUTE: 0.006,
  PERPLEXITY_PER_REQUEST: 0.005,
  // Estimates per operation type
  AVG_EMBEDDING_TOKENS: 500,
  AVG_CHAT_INPUT_TOKENS: 1000,
  AVG_CHAT_OUTPUT_TOKENS: 500,
  AVG_VISION_TOKENS: 1500,
};

// Thresholds for warnings
const THRESHOLDS = {
  API_RESPONSE_WARNING: 3000,      // 3 seconds
  API_RESPONSE_CRITICAL: 10000,    // 10 seconds
  PROCESSING_WARNING: 30000,       // 30 seconds
  PROCESSING_CRITICAL: 120000,     // 2 minutes
  ERROR_RATE_WARNING: 0.05,        // 5%
  ERROR_RATE_CRITICAL: 0.15,       // 15%
  RATE_LIMIT_WARNING: 1,           // Any occurrence
  RATE_LIMIT_CRITICAL: 3,          // 3+ per minute
};

// Keep last N items for rolling metrics
const MAX_REQUESTS = 1000;
const MAX_PROCESSING = 500;
const MAX_ERRORS = 200;
const MAX_PYTHON_SERVICE = 500;

class MetricsCollector {
  private state: MetricsState = {
    requests: [],
    processing: [],
    errors: [],
    pythonService: [],
    startTime: Date.now(),
    openaiRateLimitErrors: 0,
    lastRateLimitError: null,
    peakMemoryMB: 0,
    peakRequestsPerMinute: 0,
    peakResponseTime: 0,
    peakConcurrentProcessing: 0,
    lastPeakUpdate: Date.now(),
    apiCosts: {
      embeddings: 0,
      chat: 0,
      vision: 0,
      transcriptionMinutes: 0,
      perplexityRequests: 0,
    },
  };

  // Track API costs
  recordApiCost(type: 'embedding' | 'chat' | 'vision' | 'transcription' | 'perplexity', amount?: number) {
    switch (type) {
      case 'embedding':
        this.state.apiCosts.embeddings += amount || 1;
        break;
      case 'chat':
        this.state.apiCosts.chat++;
        break;
      case 'vision':
        this.state.apiCosts.vision++;
        break;
      case 'transcription':
        this.state.apiCosts.transcriptionMinutes += amount || 1;
        break;
      case 'perplexity':
        this.state.apiCosts.perplexityRequests++;
        break;
    }
  }

  // Calculate estimated costs
  getEstimatedCosts() {
    const costs = this.state.apiCosts;
    
    const embeddingCost = costs.embeddings * (API_COSTS.AVG_EMBEDDING_TOKENS / 1000) * API_COSTS.EMBEDDING_PER_1K_TOKENS;
    const chatCost = costs.chat * (
      (API_COSTS.AVG_CHAT_INPUT_TOKENS / 1000) * API_COSTS.CHAT_INPUT_PER_1K_TOKENS +
      (API_COSTS.AVG_CHAT_OUTPUT_TOKENS / 1000) * API_COSTS.CHAT_OUTPUT_PER_1K_TOKENS
    );
    const visionCost = costs.vision * (API_COSTS.AVG_VISION_TOKENS / 1000) * API_COSTS.VISION_PER_1K_TOKENS;
    const transcriptionCost = costs.transcriptionMinutes * API_COSTS.TRANSCRIPTION_PER_MINUTE;
    const perplexityCost = costs.perplexityRequests * API_COSTS.PERPLEXITY_PER_REQUEST;
    
    const totalCost = embeddingCost + chatCost + visionCost + transcriptionCost + perplexityCost;
    
    // Calculate uptime in days for monthly projection
    const uptimeDays = (Date.now() - this.state.startTime) / (1000 * 60 * 60 * 24);
    const projectedMonthlyCost = uptimeDays > 0 ? (totalCost / uptimeDays) * 30 : 0;
    
    return {
      breakdown: {
        embeddings: { count: costs.embeddings, cost: embeddingCost },
        chat: { count: costs.chat, cost: chatCost },
        vision: { count: costs.vision, cost: visionCost },
        transcription: { minutes: costs.transcriptionMinutes, cost: transcriptionCost },
        perplexity: { requests: costs.perplexityRequests, cost: perplexityCost },
      },
      totalSinceStart: totalCost,
      projectedMonthly: projectedMonthlyCost,
      uptimeDays: Math.round(uptimeDays * 100) / 100,
      rates: API_COSTS,
    };
  }

  // Record an API request
  recordRequest(path: string, method: string, duration: number, statusCode: number) {
    this.state.requests.push({
      path,
      method,
      duration,
      timestamp: Date.now(),
      statusCode,
    });

    // Keep only recent requests
    if (this.state.requests.length > MAX_REQUESTS) {
      this.state.requests = this.state.requests.slice(-MAX_REQUESTS);
    }

    // Check thresholds
    if (duration >= THRESHOLDS.API_RESPONSE_CRITICAL) {
      console.warn(`[METRICS CRITICAL] Slow API response: ${path} took ${duration}ms`);
    } else if (duration >= THRESHOLDS.API_RESPONSE_WARNING) {
      console.warn(`[METRICS WARNING] Slow API response: ${path} took ${duration}ms`);
    }
  }

  // Record document/AI processing
  recordProcessing(
    type: ProcessingMetric['type'],
    duration: number,
    success: boolean,
    fileSize?: number,
    error?: string
  ) {
    this.state.processing.push({
      type,
      duration,
      timestamp: Date.now(),
      success,
      fileSize,
      error,
    });

    if (this.state.processing.length > MAX_PROCESSING) {
      this.state.processing = this.state.processing.slice(-MAX_PROCESSING);
    }

    // Check thresholds
    if (duration >= THRESHOLDS.PROCESSING_CRITICAL) {
      console.warn(`[METRICS CRITICAL] Slow ${type} processing: ${duration}ms`);
    } else if (duration >= THRESHOLDS.PROCESSING_WARNING) {
      console.warn(`[METRICS WARNING] Slow ${type} processing: ${duration}ms`);
    }

    if (!success) {
      this.recordError(error || 'Processing failed', type);
    }
  }

  // Record an error
  recordError(message: string, type: string) {
    this.state.errors.push({
      message,
      timestamp: Date.now(),
      type,
    });

    if (this.state.errors.length > MAX_ERRORS) {
      this.state.errors = this.state.errors.slice(-MAX_ERRORS);
    }

    // Check for OpenAI rate limit errors
    if (message.includes('rate limit') || message.includes('429')) {
      this.state.openaiRateLimitErrors++;
      this.state.lastRateLimitError = Date.now();
      
      const recentRateLimits = this.getRecentRateLimitErrors();
      if (recentRateLimits >= THRESHOLDS.RATE_LIMIT_CRITICAL) {
        console.error(`[METRICS CRITICAL] OpenAI rate limit hit ${recentRateLimits} times in last minute!`);
      } else if (recentRateLimits >= THRESHOLDS.RATE_LIMIT_WARNING) {
        console.warn(`[METRICS WARNING] OpenAI rate limit encountered`);
      }
    }
  }

  // Record a Python service call
  recordPythonServiceCall(
    endpoint: string,
    duration: number,
    success: boolean,
    statusCode?: number,
    error?: string
  ) {
    this.state.pythonService.push({
      endpoint,
      duration,
      timestamp: Date.now(),
      success,
      statusCode,
      error,
    });

    if (this.state.pythonService.length > MAX_PYTHON_SERVICE) {
      this.state.pythonService = this.state.pythonService.slice(-MAX_PYTHON_SERVICE);
    }

    // Log warnings for failures
    if (!success) {
      console.warn(`[PythonService] Call to ${endpoint} failed: ${error}`);
      this.recordError(`Python service: ${error || 'Unknown error'}`, 'python-service');
    }

    // Log slow requests
    if (duration > 60000) {
      console.warn(`[PythonService] Slow request to ${endpoint}: ${duration}ms`);
    }
  }

  // Get rate limit errors in last minute
  private getRecentRateLimitErrors(): number {
    const oneMinuteAgo = Date.now() - 60000;
    return this.state.errors.filter(
      e => e.timestamp > oneMinuteAgo && (e.message.includes('rate limit') || e.message.includes('429'))
    ).length;
  }

  // Calculate metrics summary
  getMetrics() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const fiveMinutesAgo = now - 300000;
    const oneHourAgo = now - 3600000;

    // Recent requests (last minute)
    const recentRequests = this.state.requests.filter(r => r.timestamp > oneMinuteAgo);
    const recentProcessing = this.state.processing.filter(p => p.timestamp > fiveMinutesAgo);
    const recentErrors = this.state.errors.filter(e => e.timestamp > fiveMinutesAgo);

    // Calculate averages
    const avgResponseTime = recentRequests.length > 0
      ? recentRequests.reduce((sum, r) => sum + r.duration, 0) / recentRequests.length
      : 0;

    const avgProcessingTime = recentProcessing.length > 0
      ? recentProcessing.reduce((sum, p) => sum + p.duration, 0) / recentProcessing.length
      : 0;

    // Error rates
    const processingErrorRate = recentProcessing.length > 0
      ? recentProcessing.filter(p => !p.success).length / recentProcessing.length
      : 0;

    const requestErrorRate = recentRequests.length > 0
      ? recentRequests.filter(r => r.statusCode >= 500).length / recentRequests.length
      : 0;

    // Slow requests
    const slowRequests = recentRequests.filter(r => r.duration > THRESHOLDS.API_RESPONSE_WARNING).length;
    const criticalSlowRequests = recentRequests.filter(r => r.duration > THRESHOLDS.API_RESPONSE_CRITICAL).length;

    // Processing by type
    const processingByType = {
      document: recentProcessing.filter(p => p.type === 'document'),
      embedding: recentProcessing.filter(p => p.type === 'embedding'),
      chat: recentProcessing.filter(p => p.type === 'chat'),
      vision: recentProcessing.filter(p => p.type === 'vision'),
      transcription: recentProcessing.filter(p => p.type === 'transcription'),
    };

    // Determine overall health
    let health: 'healthy' | 'warning' | 'critical' = 'healthy';
    const warnings: string[] = [];

    if (avgResponseTime > THRESHOLDS.API_RESPONSE_CRITICAL) {
      health = 'critical';
      warnings.push(`Average response time critical: ${Math.round(avgResponseTime)}ms`);
    } else if (avgResponseTime > THRESHOLDS.API_RESPONSE_WARNING) {
      health = 'warning';
      warnings.push(`Average response time elevated: ${Math.round(avgResponseTime)}ms`);
    }

    if (processingErrorRate > THRESHOLDS.ERROR_RATE_CRITICAL) {
      health = 'critical';
      warnings.push(`Processing error rate critical: ${(processingErrorRate * 100).toFixed(1)}%`);
    } else if (processingErrorRate > THRESHOLDS.ERROR_RATE_WARNING) {
      if (health !== 'critical') health = 'warning';
      warnings.push(`Processing error rate elevated: ${(processingErrorRate * 100).toFixed(1)}%`);
    }

    const recentRateLimits = this.getRecentRateLimitErrors();
    if (recentRateLimits >= THRESHOLDS.RATE_LIMIT_CRITICAL) {
      health = 'critical';
      warnings.push(`OpenAI rate limits: ${recentRateLimits} in last minute`);
    } else if (recentRateLimits >= THRESHOLDS.RATE_LIMIT_WARNING) {
      if (health !== 'critical') health = 'warning';
      warnings.push(`OpenAI rate limit encountered`);
    }

    // Memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);

    // Update peak tracking
    if (memoryUsedMB > this.state.peakMemoryMB) {
      this.state.peakMemoryMB = memoryUsedMB;
    }
    if (recentRequests.length > this.state.peakRequestsPerMinute) {
      this.state.peakRequestsPerMinute = recentRequests.length;
    }
    const maxResponseTime = recentRequests.length > 0 
      ? Math.max(...recentRequests.map(r => r.duration)) 
      : 0;
    if (maxResponseTime > this.state.peakResponseTime) {
      this.state.peakResponseTime = maxResponseTime;
    }

    // Get recent request log with timestamps (last 50)
    const recentRequestLog = this.state.requests.slice(-50).map(r => ({
      path: r.path,
      method: r.method,
      duration: r.duration,
      statusCode: r.statusCode,
      timestamp: r.timestamp,
      datetime: new Date(r.timestamp).toISOString(),
    })).reverse();

    // Get recent processing log with timestamps (last 30)
    const recentProcessingLog = this.state.processing.slice(-30).map(p => ({
      type: p.type,
      duration: p.duration,
      success: p.success,
      fileSize: p.fileSize,
      error: p.error,
      timestamp: p.timestamp,
      datetime: new Date(p.timestamp).toISOString(),
    })).reverse();

    return {
      health,
      warnings,
      uptime: Math.round((now - this.state.startTime) / 1000),
      serverStartTime: new Date(this.state.startTime).toISOString(),
      
      requests: {
        lastMinute: recentRequests.length,
        avgResponseTime: Math.round(avgResponseTime),
        slowRequests,
        criticalSlowRequests,
        errorRate: (requestErrorRate * 100).toFixed(2) + '%',
        recentLog: recentRequestLog,
      },
      
      processing: {
        lastFiveMinutes: recentProcessing.length,
        avgProcessingTime: Math.round(avgProcessingTime),
        errorRate: (processingErrorRate * 100).toFixed(2) + '%',
        byType: {
          document: processingByType.document.length,
          embedding: processingByType.embedding.length,
          chat: processingByType.chat.length,
          vision: processingByType.vision.length,
          transcription: processingByType.transcription.length,
        },
        recentLog: recentProcessingLog,
      },
      
      errors: {
        lastFiveMinutes: recentErrors.length,
        rateLimitErrors: recentRateLimits,
        recent: recentErrors.slice(-10).map(e => ({
          message: e.message.substring(0, 100),
          type: e.type,
          ago: Math.round((now - e.timestamp) / 1000) + 's ago',
          timestamp: e.timestamp,
          datetime: new Date(e.timestamp).toISOString(),
        })),
      },
      
      memory: {
        usedMB: memoryUsedMB,
        totalMB: memoryTotalMB,
        rssMB, // Total process memory including native code
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
        explanation: 'Heap memory is used by JavaScript. RSS (Resident Set Size) is total process memory. These are normal for a Node.js app.',
      },
      
      capacity: {
        peakMemoryMB: this.state.peakMemoryMB,
        peakRequestsPerMinute: this.state.peakRequestsPerMinute,
        peakResponseTimeMs: this.state.peakResponseTime,
        estimatedMaxConcurrent: 100, // Typical for Replit instances
        containerLimitMB: 512, // Replit default container memory
        utilizationPercent: Math.round((rssMB / 512) * 100),
      },
      
      pythonService: this.getPythonServiceMetrics(fiveMinutesAgo, oneHourAgo),
      
      apiCosts: this.getEstimatedCosts(),
      
      thresholds: THRESHOLDS,
    };
  }

  // Get Python service metrics including force toggle status
  private getPythonServiceMetrics(fiveMinutesAgo: number, oneHourAgo: number) {
    // Import processing settings dynamically to avoid circular deps
    // Use sync version to avoid async issues in metrics collection
    let forcePythonService = false;
    let forcePythonServiceEnabledAt: string | null = null;
    let forcePythonServiceEnabledBy: string | null = null;
    
    try {
      const { getProcessingSettingsSync } = require('./processing-settings');
      const settings = getProcessingSettingsSync();
      forcePythonService = settings.forcePythonService;
      forcePythonServiceEnabledAt = settings.forcePythonServiceEnabledAt;
      forcePythonServiceEnabledBy = settings.forcePythonServiceEnabledBy;
    } catch (e) {
      // Module not available
    }

    const recentPython = this.state.pythonService.filter(p => p.timestamp > fiveMinutesAgo);
    const hourPython = this.state.pythonService.filter(p => p.timestamp > oneHourAgo);
    
    const successCount = hourPython.filter(p => p.success).length;
    const failedCount = hourPython.filter(p => !p.success).length;
    
    // Group by endpoint
    const byEndpoint: Record<string, { total: number; success: number; failed: number; avgTime: number }> = {};
    for (const p of recentPython) {
      if (!byEndpoint[p.endpoint]) {
        byEndpoint[p.endpoint] = { total: 0, success: 0, failed: 0, avgTime: 0 };
      }
      byEndpoint[p.endpoint].total++;
      if (p.success) byEndpoint[p.endpoint].success++;
      else byEndpoint[p.endpoint].failed++;
    }
    // Calculate averages per endpoint
    for (const endpoint of Object.keys(byEndpoint)) {
      const endpointCalls = recentPython.filter(p => p.endpoint === endpoint);
      byEndpoint[endpoint].avgTime = endpointCalls.length > 0
        ? Math.round(endpointCalls.reduce((sum, p) => sum + p.duration, 0) / endpointCalls.length)
        : 0;
    }

    // Group by document type (extract from endpoint path like /analyze/pdf, /extract/docx)
    const byDocumentType: Record<string, { count: number; avgTime: number; errors: number }> = {};
    for (const p of hourPython) {
      const docType = this.extractDocTypeFromEndpoint(p.endpoint);
      if (!byDocumentType[docType]) {
        byDocumentType[docType] = { count: 0, avgTime: 0, errors: 0 };
      }
      byDocumentType[docType].count++;
      if (!p.success) byDocumentType[docType].errors++;
    }
    // Calculate averages per doc type
    for (const docType of Object.keys(byDocumentType)) {
      const typeCalls = hourPython.filter(p => this.extractDocTypeFromEndpoint(p.endpoint) === docType);
      byDocumentType[docType].avgTime = typeCalls.length > 0
        ? Math.round(typeCalls.reduce((sum, p) => sum + p.duration, 0) / typeCalls.length)
        : 0;
    }

    // Recent errors
    const recentErrors = this.state.pythonService
      .filter(p => !p.success && p.timestamp > fiveMinutesAgo)
      .slice(-5)
      .map(p => ({
        endpoint: p.endpoint,
        error: p.error || 'Unknown error',
        ago: Math.round((Date.now() - p.timestamp) / 1000) + 's ago',
        statusCode: p.statusCode,
      }));

    return {
      isConfigured: !!(process.env.PYTHON_SERVICE_URL && process.env.EVIDENT_PYTHON_API_KEY),
      isHealthy: recentPython.length > 0 ? recentPython.some(p => p.success) : false,
      serviceUrl: process.env.PYTHON_SERVICE_URL ? 'configured' : 'not set',
      totalCalls: hourPython.length,
      recentCalls: recentPython.length,
      successCount,
      failedCount,
      successRate: hourPython.length > 0 ? ((successCount / hourPython.length) * 100).toFixed(1) + '%' : 'N/A',
      avgResponseTime: hourPython.length > 0
        ? Math.round(hourPython.reduce((sum, p) => sum + p.duration, 0) / hourPython.length)
        : 0,
      forcePythonService,
      forcePythonServiceEnabledAt,
      forcePythonServiceEnabledBy,
      byEndpoint,
      byDocumentType,
      recentErrors,
    };
  }

  // Extract document type from endpoint path
  private extractDocTypeFromEndpoint(endpoint: string): string {
    const match = endpoint.match(/\/(pdf|docx|xlsx|image|media|pptx|txt)/i);
    return match ? match[1].toLowerCase() : 'other';
  }

  // Reset metrics (useful for testing)
  reset() {
    this.state = {
      requests: [],
      processing: [],
      pythonService: [],
      errors: [],
      startTime: Date.now(),
      openaiRateLimitErrors: 0,
      lastRateLimitError: null,
      peakMemoryMB: 0,
      peakRequestsPerMinute: 0,
      peakResponseTime: 0,
      peakConcurrentProcessing: 0,
      lastPeakUpdate: Date.now(),
      apiCosts: {
        embeddings: 0,
        chat: 0,
        vision: 0,
        transcriptionMinutes: 0,
        perplexityRequests: 0,
      },
    };
  }
}

// Singleton instance
export const metrics = new MetricsCollector();

// Express middleware for timing requests
export function metricsMiddleware(req: any, res: any, next: any) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.recordRequest(req.path, req.method, duration, res.statusCode);
  });
  
  next();
}
