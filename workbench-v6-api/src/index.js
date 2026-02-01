import { handleAuth } from './routes/auth.js';
import { handleVerify } from './routes/verify.js';
import { handleIntake } from './agents/intake.js';
import { handleMatch } from './agents/match.js';
import { handleSchedule } from './agents/schedule.js';
import { handleSearch } from './agents/search.js';
import { handleOptions, withCors } from './middleware/cors.js';
import { json } from './utils/response.js';

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(env);
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    let response;

    try {
      // Route mapping
      if (path === '/' || path === '/api') {
        response = json({
          name: 'Novai Workbench V6.3 API',
          version: '6.3.0',
          status: 'operational',
          endpoints: {
            auth: '/api/auth/*',
            verify: '/api/verify/*',
            intake: '/api/intake/*',
            match: '/api/match/*',
            schedule: '/api/schedule/*',
            search: '/api/search/*'
          }
        });
      }
      // Auth routes
      else if (path.startsWith('/api/auth/')) {
        const subPath = path.replace('/api/auth', '');
        response = await handleAuth(subPath, method, request, env);
      }
      // Verification routes
      else if (path.startsWith('/api/verify/')) {
        const subPath = path.replace('/api/verify', '');
        response = await handleVerify(subPath, method, request, env);
      }
      // Intake Agent
      else if (path.startsWith('/api/intake/')) {
        const subPath = path.replace('/api/intake', '');
        response = await handleIntake(subPath, method, request, env);
      }
      // Match Agent
      else if (path.startsWith('/api/match/')) {
        const subPath = path.replace('/api/match', '');
        response = await handleMatch(subPath, method, request, env);
      }
      // Schedule Agent
      else if (path.startsWith('/api/schedule/')) {
        const subPath = path.replace('/api/schedule', '');
        response = await handleSchedule(subPath, method, request, env);
      }
      // Search Agent
      else if (path.startsWith('/api/search/')) {
        const subPath = path.replace('/api/search', '');
        response = await handleSearch(subPath, method, request, env);
      }
      // Health check
      else if (path === '/health') {
        response = json({ status: 'healthy', timestamp: new Date().toISOString() });
      }
      else {
        response = json({ error: 'Not found' }, 404);
      }
    } catch (e) {
      console.error('Unhandled error:', e.message, e.stack);
      response = json({ error: 'Internal server error' }, 500);
    }

    return withCors(response, env);
  }
};
