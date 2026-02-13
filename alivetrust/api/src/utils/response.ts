import type { ApiResponse } from '../types/index';

export function jsonResponse<T>(data: T, status = 200): Response {
  const body: ApiResponse<T> = { success: true, data };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(error: string, status = 400): Response {
  const body: ApiResponse<never> = { success: false, error };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function notFoundResponse(entity = 'Resource'): Response {
  return errorResponse(`${entity} not found`, 404);
}

export function unauthorizedResponse(): Response {
  return errorResponse('Authentication required', 401);
}

export function forbiddenResponse(): Response {
  return errorResponse('Access denied', 403);
}
