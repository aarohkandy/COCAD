import { Router, Request, Response } from 'express';
import { generateClarifyingQuestions } from '../services/ai-service.js';
import type { ChatMessage } from '../services/types.js';

export const clarifyRouter = Router();

interface ClarifyRequest {
  description: string;
  conversation?: ChatMessage[];
}

/**
 * POST /api/clarify
 * Generate clarifying questions for a natural language description
 */
clarifyRouter.post('/', async (req: Request<{}, {}, ClarifyRequest>, res: Response) => {
  try {
    const { description, conversation = [] } = req.body;

    if (!description || typeof description !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid description',
        message: 'Please provide a description of the part you want to create',
      });
    }

    if (!Array.isArray(conversation)) {
      return res.status(400).json({
        error: 'Invalid conversation',
        message: 'Conversation must be an array of messages',
      });
    }

    console.log(`[Clarify] Generating questions for: "${description.slice(0, 50)}..."`);

    const result = await generateClarifyingQuestions(description, conversation);

    res.json({
      success: true,
      readyToGenerate: result.readyToGenerate,
      questions: result.questions,
    });
  } catch (error) {
    console.error('[Clarify] Error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    res.status(500).json({
      error: 'Failed to generate clarifying questions',
      message,
    });
  }
});
