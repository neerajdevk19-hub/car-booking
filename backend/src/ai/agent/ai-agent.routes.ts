import { Router, Response } from 'express';
import { processAgentMessage } from './ai-agent.service';
import { authenticateJWT, AuthenticatedRequest } from '../../middleware/auth.middleware';
import { prisma } from '../../prisma/client';

export const aiAgentRouter = Router();

// POST /api/v1/agent/chat
aiAgentRouter.post('/chat', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message, conversationId, language } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const result = await processAgentMessage({
      userId: req.user!.id,
      conversationId,
      message,
      language: language as 'en' | 'te'
    });

    // Record AI Action Log in DB for admin/audit inspection
    await prisma.aIActionLog.create({
      data: {
        conversationId: result.conversationId,
        userId: req.user!.id,
        actionName: result.toolExecuted || result.intent || 'CHAT_RESPONSE',
        input: JSON.stringify({ message, language }),
        output: JSON.stringify({ response: result.response, intent: result.intent }),
        status: 'SUCCESS'
      }
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/agent/conversations
aiAgentRouter.get('/conversations', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.user?.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });

    res.json({ success: true, count: conversations.length, conversations });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/agent/conversations/:id
aiAgentRouter.get('/conversations/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    res.json({ success: true, conversation });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/agent/conversations/:id/language
aiAgentRouter.post('/conversations/:id/language', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { language } = req.body;
    if (!['en', 'te'].includes(language)) {
      return res.status(400).json({ success: false, message: 'Language must be en or te' });
    }

    const updated = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { preferredLanguage: language }
    });

    res.json({ success: true, conversation: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/v1/agent/conversations/:id
aiAgentRouter.delete('/conversations/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Note: Prisma will cascade delete messages if configured in schema, 
    // otherwise we must delete messages first.
    await prisma.message.deleteMany({
      where: { conversationId: req.params.id }
    });
    
    await prisma.conversation.delete({
      where: { id: req.params.id, userId: req.user?.id }
    });

    res.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});
