import { Router, Request, Response } from "express";
import { HELP_TOPICS, HelpTopic, HelpTopicsResponse, HelpAskResult } from "../shared/help";

const router = Router();

// Uses PostgreSQL entitlements table (same as /api/entitlements and /api/packs)
async function getEnabledPacks(userId: string | undefined): Promise<Set<string>> {
  const enabled = new Set<string>();
  
  // No packs enabled for unauthenticated users
  if (!userId) {
    return enabled;
  }
  
  try {
    const { getUserPackEntitlements } = await import("./usage");
    const userPacks = await getUserPackEntitlements(userId);
    
    if (userPacks.hasFinancePack) enabled.add("finance");
    if (userPacks.hasLegalPack) enabled.add("legal");
    if (userPacks.hasHrPack) enabled.add("hr");
    if (userPacks.hasProcurementPack) enabled.add("procurement");
    if (userPacks.hasConstructionPack) enabled.add("construction");
    if (userPacks.hasCompliancePack) enabled.add("compliance");
  } catch (error) {
    console.warn("Could not fetch user entitlements:", error);
  }
  
  return enabled;
}

function filterTopicsByEntitlements(enabledPacks: Set<string>): HelpTopic[] {
  return HELP_TOPICS.filter(topic => {
    if (!topic.packRequired) return true;
    return enabledPacks.has(topic.packRequired);
  });
}

function groupTopicsByArea(topics: HelpTopic[]): HelpTopicsResponse["areas"] {
  const areas: HelpTopicsResponse["areas"] = {
    core: [],
    finance: [],
    legal: [],
    packs: [],
    account: []
  };
  
  for (const topic of topics) {
    areas[topic.area].push(topic);
  }
  
  for (const area of Object.keys(areas) as Array<keyof typeof areas>) {
    areas[area].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
  
  return areas;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(t => t.length > 1);
}

function computeRelevanceScore(query: string, topic: HelpTopic): number {
  const queryTokens = tokenize(query);
  const queryLower = query.toLowerCase();
  
  let score = 0;
  
  const titleLower = topic.title.toLowerCase();
  if (titleLower.includes(queryLower)) {
    score += 50;
  }
  
  for (const token of queryTokens) {
    if (titleLower.includes(token)) {
      score += 10;
    }
  }
  
  for (const tag of topic.tags) {
    const tagLower = tag.toLowerCase();
    if (queryLower.includes(tagLower)) {
      score += 20;
    }
    for (const token of queryTokens) {
      if (tagLower.includes(token) || token.includes(tagLower)) {
        score += 8;
      }
    }
  }
  
  const descTokens = tokenize(topic.description);
  for (const token of queryTokens) {
    if (descTokens.includes(token)) {
      score += 3;
    }
  }
  
  if (queryTokens.includes(topic.area)) {
    score += 5;
  }
  
  score += (topic.priority || 0) * 0.5;
  
  return score;
}

router.get("/topics", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const enabledPacks = await getEnabledPacks(userId);
    const filteredTopics = filterTopicsByEntitlements(enabledPacks);
    const areas = groupTopicsByArea(filteredTopics);
    
    res.json({ areas });
  } catch (error) {
    console.error("Error fetching help topics:", error);
    res.status(500).json({ error: "Failed to fetch help topics" });
  }
});

router.post("/ask", async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return res.status(400).json({ error: "Query is required" });
    }
    
    const userId = (req as any).user?.id;
    const enabledPacks = await getEnabledPacks(userId);
    const filteredTopics = filterTopicsByEntitlements(enabledPacks);
    
    const scoredTopics = filteredTopics
      .map(topic => ({
        topic,
        score: computeRelevanceScore(query.trim(), topic)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
    
    if (scoredTopics.length === 0) {
      const defaultTopic = filteredTopics.find(t => t.id === "ask-questions") || filteredTopics[0];
      
      const result: HelpAskResult = {
        query: query.trim(),
        matches: [{ topicId: defaultTopic.id, score: 1 }],
        answer: {
          title: "No exact match found",
          body: "We couldn't find a specific help topic for your question. Here's a suggestion that might help, or try browsing the topics below.",
          routes: defaultTopic.routes,
          steps: defaultTopic.steps
        }
      };
      
      return res.json(result);
    }
    
    const topMatches = scoredTopics.slice(0, 3);
    const bestMatch = topMatches[0].topic;
    
    const result: HelpAskResult = {
      query: query.trim(),
      matches: topMatches.map(m => ({ topicId: m.topic.id, score: m.score })),
      answer: {
        title: bestMatch.title,
        body: bestMatch.description,
        routes: bestMatch.routes,
        steps: bestMatch.steps
      }
    };
    
    res.json(result);
  } catch (error) {
    console.error("Error processing help query:", error);
    res.status(500).json({ error: "Failed to process help query" });
  }
});

router.get("/topic/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const enabledPacks = await getEnabledPacks(userId);
    const filteredTopics = filterTopicsByEntitlements(enabledPacks);
    
    const topic = filteredTopics.find(t => t.id === id);
    
    if (!topic) {
      return res.status(404).json({ error: "Topic not found" });
    }
    
    res.json({ topic });
  } catch (error) {
    console.error("Error fetching help topic:", error);
    res.status(500).json({ error: "Failed to fetch help topic" });
  }
});

export default router;
