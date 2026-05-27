import { Hono } from 'hono';
import type { ChatService } from '../services/chat-service.js';
import { APIError } from '../error-handler.js';
import { ErrorCode } from '@storyweaver/core';
import { validate } from '../validate.js';
import { createSessionSchema, sendMessageSchema, applySchema } from '../schemas.js';

/**
 * 对话路由
 *
 * GET    /chat/sessions                  — 列出会话
 * POST   /chat/sessions                  — 创建会话
 * GET    /chat/sessions/:id              — 获取会话详情
 * DELETE /chat/sessions/:id              — 删除会话
 * POST   /chat/sessions/:id/messages     — 发送消息（触发 AI 流式回复）
 * POST   /chat/sessions/:id/apply        — 应用 AI 回复到章节
 */
export function chatRoute(service: ChatService): Hono {
  const app = new Hono();

  // GET /chat/sessions
  app.get('/sessions', async (c) => {
    const sessions = service.listSessions();
    return c.json(sessions);
  });

  // POST /chat/sessions
  app.post('/sessions', validate(createSessionSchema), async (c) => {
    const data = c.get('validated');
    const session = service.createSession(data);
    return c.json(session, 201);
  });

  // GET /chat/sessions/:id
  app.get('/sessions/:id', async (c) => {
    const id = c.req.param('id');
    const session = service.getSession(id);
    if (!session) {
      throw new APIError(ErrorCode.NOT_FOUND, `会话 ${id} 不存在`);
    }
    return c.json(session);
  });

  // DELETE /chat/sessions/:id
  app.delete('/sessions/:id', async (c) => {
    const id = c.req.param('id');
    const deleted = service.deleteSession(id);
    if (!deleted) {
      throw new APIError(ErrorCode.NOT_FOUND, `会话 ${id} 不存在`);
    }
    return c.json({ ok: true });
  });

  // POST /chat/sessions/:id/messages
  app.post('/sessions/:id/messages', validate(sendMessageSchema), async (c) => {
    const id = c.req.param('id');
    const { message, context } = c.get('validated');
    try {
      await service.handleMessage(id, message, context);
      return c.json({ ok: true });
    } catch (err) {
      if (err instanceof Error && err.message === 'SESSION_NOT_FOUND') {
        throw new APIError(ErrorCode.NOT_FOUND, `会话 ${id} 不存在`);
      }
      throw err;
    }
  });

  // POST /chat/sessions/:id/apply
  app.post('/sessions/:id/apply', validate(applySchema), async (c) => {
    const id = c.req.param('id');
    const { messageId, chapterId, mode, content } = c.get('validated');
    try {
      await service.applyMessage(id, messageId, { chapterId, mode, content });
      return c.json({ ok: true });
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'SESSION_NOT_FOUND') {
          throw new APIError(ErrorCode.NOT_FOUND, `会话 ${id} 不存在`);
        }
        if (err.message === 'MESSAGE_NOT_FOUND') {
          throw new APIError(ErrorCode.NOT_FOUND, `消息 ${messageId} 不存在`);
        }
        if (err.message === 'CHAPTER_NOT_FOUND') {
          throw new APIError(ErrorCode.CHAPTER_NOT_FOUND, `章节 ${chapterId} 不存在`);
        }
        if (err.message === 'CHAPTER_LOCKED') {
          throw new APIError(ErrorCode.CHAPTER_LOCKED, '已发布章节不可修改');
        }
      }
      throw err;
    }
  });

  return app;
}
