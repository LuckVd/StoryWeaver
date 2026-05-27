import type { ErrorHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ErrorCode } from '@storyweaver/core';

/**
 * 自定义 API 错误
 *
 * 路由层可抛出此错误，全局错误处理器自动转换为标准错误响应。
 */
export class APIError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/** 全局错误处理器（用于 app.onError） */
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof APIError) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      statusForCode(err.code) as ContentfulStatusCode,
    );
  }

  const message =
    err instanceof Error ? err.message : 'Internal Server Error';
  return c.json(
    { error: { code: ErrorCode.INTERNAL_ERROR, message } },
    500 as ContentfulStatusCode,
  );
};

/** 根据 ErrorCode 映射 HTTP 状态码 */
function statusForCode(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.VALIDATION_ERROR:
      return 400;
    case ErrorCode.NOT_FOUND:
    case ErrorCode.CHAPTER_NOT_FOUND:
    case ErrorCode.KNOWLEDGE_CATEGORY_NOT_FOUND:
      return 404;
    case ErrorCode.CHAPTER_LOCKED:
      return 423;
    case ErrorCode.CHAPTER_NOT_APPROVED:
      return 409;
    case ErrorCode.LLM_RATE_LIMITED:
      return 429;
    case ErrorCode.LLM_CONNECTION_FAILED:
    case ErrorCode.LLM_CONTEXT_OVERFLOW:
    case ErrorCode.LLM_INVALID_RESPONSE:
      return 502;
    default:
      return 500;
  }
}
