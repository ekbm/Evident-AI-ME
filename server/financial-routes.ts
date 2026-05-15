import { Router, type Request, type Response } from "express";
import { isAuthenticated } from "./replit_integrations/auth";
import { getFinancials, getPriceSnapshot, calculateMetrics } from "./financial-data";
import { detectFinancialIntent, generateFinancialAnalysis } from "./financial-analysis";

const router = Router();

router.get("/api/financial/analyze", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const question = req.query.question as string;
    const tickerOverride = req.query.ticker as string | undefined;

    if (!question) {
      return res.status(400).json({ error: "question query parameter is required" });
    }

    const intent = detectFinancialIntent(question);

    if (tickerOverride) {
      intent.ticker = tickerOverride.toUpperCase();
      intent.isFinancial = true;
      if (!intent.companyName) {
        intent.companyName = intent.ticker;
      }
    }

    if (!intent.isFinancial || !intent.ticker) {
      return res.json({ isFinancial: false });
    }

    const [financials, priceSnapshot] = await Promise.all([
      getFinancials(intent.ticker, "annual", 4),
      getPriceSnapshot(intent.ticker),
    ]);

    const metrics = calculateMetrics(financials);

    const { answer, dataUsed } = await generateFinancialAnalysis(
      intent,
      financials,
      metrics,
      priceSnapshot,
      question
    );

    res.json({
      isFinancial: true,
      ticker: intent.ticker,
      companyName: intent.companyName,
      analysis: answer,
      metrics,
      priceSnapshot,
      dataUsed,
    });
  } catch (error: any) {
    console.error("[FinancialAnalysis] Error:", error);
    res.status(500).json({ error: "Failed to generate financial analysis" });
  }
});

router.get("/api/financial/snapshot", async (req: Request, res: Response) => {
  try {
    const ticker = req.query.ticker as string;
    if (!ticker) {
      return res.status(400).json({ error: "ticker query parameter is required" });
    }

    const snapshot = await getPriceSnapshot(ticker.toUpperCase());
    if (!snapshot) {
      return res.status(404).json({ error: "Price snapshot not found for ticker" });
    }

    res.json(snapshot);
  } catch (error: any) {
    console.error("[FinancialSnapshot] Error:", error);
    res.status(500).json({ error: "Failed to fetch price snapshot" });
  }
});

router.get("/api/financial/metrics", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const ticker = req.query.ticker as string;
    const period = (req.query.period as "annual" | "quarterly") || "annual";
    const limit = parseInt(req.query.limit as string) || 4;

    if (!ticker) {
      return res.status(400).json({ error: "ticker query parameter is required" });
    }

    const financials = await getFinancials(ticker.toUpperCase(), period, limit);
    const metrics = calculateMetrics(financials);

    res.json({ ticker: ticker.toUpperCase(), period, metrics });
  } catch (error: any) {
    console.error("[FinancialMetrics] Error:", error);
    res.status(500).json({ error: "Failed to fetch financial metrics" });
  }
});

export default router;
