/**
 * AliveTrust API — Cloudflare Worker entry point.
 *
 * Pure pattern-matching router with no external dependencies.
 * All routes return ApiResponse<T> JSON envelopes.
 */

import type {
  Env,
  SessionData,
  ApiResponse,
  RouteHandler,
  OptionalAuthRouteHandler,
} from './types/index.js';

import {
  authenticateRequest,
  requireAuth,
  createSession,
  destroySession,
  extractToken,
} from './middleware/auth.js';

import { requireTenantAccess } from './middleware/tenant.js';
import { logAudit, getAuditLog, getClientIp } from './middleware/audit.js';

// ─── Route Definition ───────────────────────────────────────────────────────

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler | OptionalAuthRouteHandler;
  requiresAuth: boolean;
}

/**
 * Convert an Express-style path pattern (e.g. "/trust/:trust_id/assets/:asset_id")
 * into a RegExp and extract the parameter names.
 */
function buildRoute(
  method: string,
  path: string,
  handler: RouteHandler | OptionalAuthRouteHandler,
  requiresAuth: boolean
): Route {
  const paramNames: string[] = [];
  const regexStr = path.replace(/:([a-zA-Z_]+)/g, (_match, paramName: string) => {
    paramNames.push(paramName);
    return '([^/]+)';
  });
  return {
    method,
    pattern: new RegExp(`^${regexStr}$`),
    paramNames,
    handler,
    requiresAuth,
  };
}

// ─── JSON Helpers ───────────────────────────────────────────────────────────

function jsonResponse<T>(data: ApiResponse<T>, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function successResponse<T>(data: T, status: number = 200): Response {
  return jsonResponse({ success: true, data }, status);
}

function errorResponse(error: string, status: number = 400): Response {
  return jsonResponse({ success: false, error }, status);
}

// ─── Auth Handlers ──────────────────────────────────────────────────────────

const authHandlers = {
  register: (async (request: Request, env: Env, _params: Record<string, string>) => {
    const body = await request.json() as {
      email?: string;
      password?: string;
      full_name?: string;
      phone?: string;
    };

    if (!body.email || !body.password || !body.full_name) {
      return errorResponse('Missing required fields: email, password, full_name');
    }

    // Check if user already exists
    const existing = await env.DB
      .prepare('SELECT id FROM user WHERE email = ?')
      .bind(body.email)
      .first();

    if (existing) {
      return errorResponse('An account with this email already exists', 409);
    }

    // Hash password using Web Crypto API (PBKDF2)
    const passwordHash = await hashPassword(body.password);

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB
      .prepare(
        `INSERT INTO user (id, email, password_hash, full_name, phone, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'owner', ?, ?)`
      )
      .bind(userId, body.email, passwordHash, body.full_name, body.phone ?? null, now, now)
      .run();

    const user = {
      id: userId,
      email: body.email,
      password_hash: passwordHash,
      full_name: body.full_name,
      phone: body.phone ?? null,
      role: 'owner' as const,
      created_at: now,
      updated_at: now,
    };

    const token = await createSession(env, user);

    return successResponse({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    }, 201);
  }) as OptionalAuthRouteHandler,

  login: (async (request: Request, env: Env, _params: Record<string, string>) => {
    const body = await request.json() as {
      email?: string;
      password?: string;
    };

    if (!body.email || !body.password) {
      return errorResponse('Missing required fields: email, password');
    }

    const user = await env.DB
      .prepare('SELECT id, email, password_hash, full_name, phone, role, created_at, updated_at FROM user WHERE email = ?')
      .bind(body.email)
      .first<{
        id: string;
        email: string;
        password_hash: string;
        full_name: string;
        phone: string | null;
        role: 'owner' | 'trustee' | 'advisor' | 'admin';
        created_at: string;
        updated_at: string;
      }>();

    if (!user) {
      return errorResponse('Invalid email or password', 401);
    }

    const passwordValid = await verifyPassword(body.password, user.password_hash);
    if (!passwordValid) {
      return errorResponse('Invalid email or password', 401);
    }

    const token = await createSession(env, user as any);

    return successResponse({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  }) as OptionalAuthRouteHandler,

  logout: (async (request: Request, env: Env, _params: Record<string, string>) => {
    const token = extractToken(request);
    if (token) {
      await destroySession(env, token);
    }
    return successResponse({ message: 'Logged out successfully' });
  }) as OptionalAuthRouteHandler,
};

// ─── Trust Handlers ─────────────────────────────────────────────────────────

const trustHandlers = {
  create: (async (request: Request, env: Env, _params: Record<string, string>, session: SessionData) => {
    const body = await request.json() as {
      trust_name?: string;
      trust_type?: string;
      jurisdiction?: string;
      date_established?: string;
      grantor_names?: string[];
      trustee_names?: string[];
      successor_trustee_names?: string[];
      beneficiary_names?: string[];
      estimated_estate_value?: number;
      has_pour_over_will?: boolean;
      has_power_of_attorney?: boolean;
      has_healthcare_directive?: boolean;
    };

    if (!body.trust_name || !body.trust_type || !body.jurisdiction) {
      return errorResponse('Missing required fields: trust_name, trust_type, jurisdiction');
    }

    const trustId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB
      .prepare(
        `INSERT INTO trust_profile (
          id, user_id, trust_name, trust_type, jurisdiction,
          date_established, grantor_names, trustee_names,
          successor_trustee_names, beneficiary_names,
          estimated_estate_value, has_pour_over_will,
          has_power_of_attorney, has_healthcare_directive,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
      )
      .bind(
        trustId,
        session.user_id,
        body.trust_name,
        body.trust_type,
        body.jurisdiction,
        body.date_established ?? null,
        JSON.stringify(body.grantor_names ?? []),
        JSON.stringify(body.trustee_names ?? []),
        JSON.stringify(body.successor_trustee_names ?? []),
        JSON.stringify(body.beneficiary_names ?? []),
        body.estimated_estate_value ?? null,
        body.has_pour_over_will ? 1 : 0,
        body.has_power_of_attorney ? 1 : 0,
        body.has_healthcare_directive ? 1 : 0,
        now,
        now
      )
      .run();

    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'CREATE',
      entity_type: 'trust_profile',
      entity_id: trustId,
      details: JSON.stringify({ trust_name: body.trust_name, trust_type: body.trust_type }),
      ip_address: getClientIp(request),
    });

    return successResponse({ id: trustId, trust_name: body.trust_name, status: 'draft' }, 201);
  }) as RouteHandler,

  get: (async (request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    const trustId = params['trust_id']!;
    await requireTenantAccess(env.DB, trustId, session.user_id);

    const trust = await env.DB
      .prepare('SELECT * FROM trust_profile WHERE id = ?')
      .bind(trustId)
      .first();

    if (!trust) {
      return errorResponse('Trust profile not found', 404);
    }

    // Parse JSON arrays from stored strings
    const parsed = {
      ...trust,
      grantor_names: safeParseJson(trust['grantor_names'] as string, []),
      trustee_names: safeParseJson(trust['trustee_names'] as string, []),
      successor_trustee_names: safeParseJson(trust['successor_trustee_names'] as string, []),
      beneficiary_names: safeParseJson(trust['beneficiary_names'] as string, []),
      has_pour_over_will: Boolean(trust['has_pour_over_will']),
      has_power_of_attorney: Boolean(trust['has_power_of_attorney']),
      has_healthcare_directive: Boolean(trust['has_healthcare_directive']),
    };

    return successResponse(parsed);
  }) as RouteHandler,
};

// ─── Asset Handlers ─────────────────────────────────────────────────────────

const assetHandlers = {
  create: (async (request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    const trustId = params['trust_id']!;
    await requireTenantAccess(env.DB, trustId, session.user_id);

    const body = await request.json() as {
      asset_type?: string;
      name?: string;
      description?: string;
      estimated_value?: number;
      ownership_status?: string;
      institution?: string;
      account_number_last4?: string;
      funding_date?: string;
      funding_method?: string;
      notes?: string;
    };

    if (!body.asset_type || !body.name) {
      return errorResponse('Missing required fields: asset_type, name');
    }

    const assetId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB
      .prepare(
        `INSERT INTO asset (
          id, trust_id, asset_type, name, description,
          estimated_value, ownership_status, institution,
          account_number_last4, funding_date, funding_method,
          notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        assetId,
        trustId,
        body.asset_type,
        body.name,
        body.description ?? null,
        body.estimated_value ?? null,
        body.ownership_status ?? 'unknown',
        body.institution ?? null,
        body.account_number_last4 ?? null,
        body.funding_date ?? null,
        body.funding_method ?? null,
        body.notes ?? null,
        now,
        now
      )
      .run();

    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'CREATE',
      entity_type: 'asset',
      entity_id: assetId,
      details: JSON.stringify({ asset_type: body.asset_type, name: body.name }),
      ip_address: getClientIp(request),
    });

    return successResponse({ id: assetId, name: body.name, asset_type: body.asset_type }, 201);
  }) as RouteHandler,

  list: (async (_request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    const trustId = params['trust_id']!;
    await requireTenantAccess(env.DB, trustId, session.user_id);

    const result = await env.DB
      .prepare('SELECT * FROM asset WHERE trust_id = ? ORDER BY created_at DESC')
      .bind(trustId)
      .all();

    return successResponse(result.results);
  }) as RouteHandler,

  update: (async (request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    const trustId = params['trust_id']!;
    const assetId = params['asset_id']!;
    await requireTenantAccess(env.DB, trustId, session.user_id);

    const body = await request.json() as Record<string, unknown>;

    // Build SET clause dynamically from provided fields
    const allowedFields = [
      'asset_type', 'name', 'description', 'estimated_value',
      'ownership_status', 'institution', 'account_number_last4',
      'funding_date', 'funding_method', 'notes',
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (field in body) {
        setClauses.push(`${field} = ?`);
        values.push(body[field] ?? null);
      }
    }

    if (setClauses.length === 0) {
      return errorResponse('No valid fields provided for update');
    }

    setClauses.push("updated_at = datetime('now')");
    values.push(assetId, trustId);

    await env.DB
      .prepare(`UPDATE asset SET ${setClauses.join(', ')} WHERE id = ? AND trust_id = ?`)
      .bind(...values)
      .run();

    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'UPDATE',
      entity_type: 'asset',
      entity_id: assetId,
      details: JSON.stringify({ updated_fields: Object.keys(body).filter(k => allowedFields.includes(k)) }),
      ip_address: getClientIp(request),
    });

    return successResponse({ id: assetId, updated: true });
  }) as RouteHandler,

  delete: (async (request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    const trustId = params['trust_id']!;
    const assetId = params['asset_id']!;
    await requireTenantAccess(env.DB, trustId, session.user_id);

    const result = await env.DB
      .prepare('DELETE FROM asset WHERE id = ? AND trust_id = ?')
      .bind(assetId, trustId)
      .run();

    if (!result.meta.changes) {
      return errorResponse('Asset not found', 404);
    }

    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'DELETE',
      entity_type: 'asset',
      entity_id: assetId,
      details: null,
      ip_address: getClientIp(request),
    });

    return successResponse({ id: assetId, deleted: true });
  }) as RouteHandler,
};

// ─── Document Handlers ──────────────────────────────────────────────────────

const documentHandlers = {
  create: (async (request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    const trustId = params['trust_id']!;
    await requireTenantAccess(env.DB, trustId, session.user_id);

    const body = await request.json() as {
      doc_type?: string;
      title?: string;
      file_url?: string;
      file_hash?: string;
      page_count?: number;
      date_signed?: string;
      date_notarized?: string;
      expiration_date?: string;
      status?: string;
      notes?: string;
    };

    if (!body.doc_type || !body.title) {
      return errorResponse('Missing required fields: doc_type, title');
    }

    const docId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB
      .prepare(
        `INSERT INTO document (
          id, trust_id, doc_type, title, file_url, file_hash,
          page_count, date_signed, date_notarized, expiration_date,
          status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        docId,
        trustId,
        body.doc_type,
        body.title,
        body.file_url ?? null,
        body.file_hash ?? null,
        body.page_count ?? null,
        body.date_signed ?? null,
        body.date_notarized ?? null,
        body.expiration_date ?? null,
        body.status ?? 'draft',
        body.notes ?? null,
        now,
        now
      )
      .run();

    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'CREATE',
      entity_type: 'document',
      entity_id: docId,
      details: JSON.stringify({ doc_type: body.doc_type, title: body.title }),
      ip_address: getClientIp(request),
    });

    return successResponse({ id: docId, title: body.title, doc_type: body.doc_type }, 201);
  }) as RouteHandler,

  list: (async (_request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    const trustId = params['trust_id']!;
    await requireTenantAccess(env.DB, trustId, session.user_id);

    const result = await env.DB
      .prepare('SELECT * FROM document WHERE trust_id = ? ORDER BY created_at DESC')
      .bind(trustId)
      .all();

    return successResponse(result.results);
  }) as RouteHandler,

  update: (async (request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    const trustId = params['trust_id']!;
    const docId = params['doc_id']!;
    await requireTenantAccess(env.DB, trustId, session.user_id);

    const body = await request.json() as Record<string, unknown>;

    const allowedFields = [
      'doc_type', 'title', 'file_url', 'file_hash', 'page_count',
      'date_signed', 'date_notarized', 'expiration_date', 'status', 'notes',
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (field in body) {
        setClauses.push(`${field} = ?`);
        values.push(body[field] ?? null);
      }
    }

    if (setClauses.length === 0) {
      return errorResponse('No valid fields provided for update');
    }

    setClauses.push("updated_at = datetime('now')");
    values.push(docId, trustId);

    await env.DB
      .prepare(`UPDATE document SET ${setClauses.join(', ')} WHERE id = ? AND trust_id = ?`)
      .bind(...values)
      .run();

    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'UPDATE',
      entity_type: 'document',
      entity_id: docId,
      details: JSON.stringify({ updated_fields: Object.keys(body).filter(k => allowedFields.includes(k)) }),
      ip_address: getClientIp(request),
    });

    return successResponse({ id: docId, updated: true });
  }) as RouteHandler,
};

// ─── Evidence Handlers ──────────────────────────────────────────────────────

const evidenceHandlers = {
  create: (async (request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    const trustId = params['trust_id']!;
    await requireTenantAccess(env.DB, trustId, session.user_id);

    const body = await request.json() as {
      evidence_type?: string;
      related_asset_id?: string;
      related_doc_id?: string;
      description?: string;
      file_url?: string;
      file_hash?: string;
    };

    if (!body.evidence_type || !body.description) {
      return errorResponse('Missing required fields: evidence_type, description');
    }

    const evidenceId = crypto.randomUUID();

    await env.DB
      .prepare(
        `INSERT INTO evidence (
          id, trust_id, evidence_type, related_asset_id, related_doc_id,
          description, file_url, file_hash, verified, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
      )
      .bind(
        evidenceId,
        trustId,
        body.evidence_type,
        body.related_asset_id ?? null,
        body.related_doc_id ?? null,
        body.description,
        body.file_url ?? null,
        body.file_hash ?? null
      )
      .run();

    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'CREATE',
      entity_type: 'evidence',
      entity_id: evidenceId,
      details: JSON.stringify({ evidence_type: body.evidence_type }),
      ip_address: getClientIp(request),
    });

    return successResponse({ id: evidenceId, evidence_type: body.evidence_type }, 201);
  }) as RouteHandler,

  list: (async (_request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    const trustId = params['trust_id']!;
    await requireTenantAccess(env.DB, trustId, session.user_id);

    const result = await env.DB
      .prepare('SELECT * FROM evidence WHERE trust_id = ? ORDER BY created_at DESC')
      .bind(trustId)
      .all();

    return successResponse(result.results);
  }) as RouteHandler,
};

// ─── Compute Handlers ───────────────────────────────────────────────────────

const computeHandlers = {
  compute: (async (request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    const trustId = params['trust_id']!;
    await requireTenantAccess(env.DB, trustId, session.user_id);

    // Fetch trust profile
    const trust = await env.DB
      .prepare('SELECT * FROM trust_profile WHERE id = ?')
      .bind(trustId)
      .first();

    if (!trust) {
      return errorResponse('Trust profile not found', 404);
    }

    // Fetch all assets for the trust
    const assetsResult = await env.DB
      .prepare('SELECT * FROM asset WHERE trust_id = ?')
      .bind(trustId)
      .all();
    const assets = assetsResult.results;

    // Fetch all documents for the trust
    const docsResult = await env.DB
      .prepare('SELECT * FROM document WHERE trust_id = ?')
      .bind(trustId)
      .all();
    const docs = docsResult.results;

    // Fetch all evidence for the trust
    const evidenceResult = await env.DB
      .prepare('SELECT * FROM evidence WHERE trust_id = ?')
      .bind(trustId)
      .all();
    const evidence = evidenceResult.results;

    // ─── Compute funding coverage ───────────────────────────────────
    const totalAssets = assets.length;
    const fundedAssets = assets.filter(
      (a) => a['ownership_status'] === 'funded' || a['ownership_status'] === 'beneficiary_designated'
    );
    const fundingCoverageCountPct = totalAssets > 0
      ? Math.round((fundedAssets.length / totalAssets) * 100)
      : 0;

    const totalValue = assets.reduce((sum, a) => sum + (Number(a['estimated_value']) || 0), 0);
    const fundedValue = fundedAssets.reduce((sum, a) => sum + (Number(a['estimated_value']) || 0), 0);
    const fundingCoverageValuePct = totalValue > 0
      ? Math.round((fundedValue / totalValue) * 100)
      : 0;

    // ─── Compute probate exposure ───────────────────────────────────
    const unfundedAssets = assets.filter(
      (a) => a['ownership_status'] === 'unfunded' || a['ownership_status'] === 'unknown'
    );
    const probateExposureAmount = unfundedAssets.reduce(
      (sum, a) => sum + (Number(a['estimated_value']) || 0), 0
    );
    const probateExposureAssetIds = unfundedAssets.map((a) => a['id'] as string);

    // ─── Compute document completeness ──────────────────────────────
    const requiredDocTypes = [
      'trust_agreement',
      'pour_over_will',
      'power_of_attorney',
      'healthcare_directive',
      'certificate_of_trust',
    ];
    const currentDocs = docs.filter((d) => d['status'] === 'current');
    const presentDocTypes = new Set(currentDocs.map((d) => d['doc_type'] as string));
    const docCompletenessScore = Math.round(
      (requiredDocTypes.filter((t) => presentDocTypes.has(t)).length / requiredDocTypes.length) * 100
    );

    // ─── Compute incapacity readiness ───────────────────────────────
    const incapacityDocs = ['power_of_attorney', 'healthcare_directive'];
    const hasPoA = presentDocTypes.has('power_of_attorney');
    const hasHCD = presentDocTypes.has('healthcare_directive');
    const hasSuccessorTrustee = safeParseJson(trust['successor_trustee_names'] as string, []).length > 0;
    const incapacityFactors = [hasPoA, hasHCD, hasSuccessorTrustee];
    const incapacityReadinessScore = Math.round(
      (incapacityFactors.filter(Boolean).length / incapacityFactors.length) * 100
    );

    // ─── Compute evidence completeness ──────────────────────────────
    const assetsNeedingEvidence = assets.filter(
      (a) => a['ownership_status'] === 'funded' || a['ownership_status'] === 'partially_funded'
    );
    const assetsWithEvidence = new Set(
      evidence
        .filter((e) => e['related_asset_id'])
        .map((e) => e['related_asset_id'] as string)
    );
    const evidenceCompletenessPct = assetsNeedingEvidence.length > 0
      ? Math.round(
          (assetsNeedingEvidence.filter((a) => assetsWithEvidence.has(a['id'] as string)).length /
            assetsNeedingEvidence.length) *
            100
        )
      : 100;

    // ─── Identify red flags ─────────────────────────────────────────
    const redFlags: Array<{
      flag_id: string;
      type: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      message: string;
      related_asset_ids: string[];
      related_doc_ids: string[];
    }> = [];

    // High-value unfunded assets
    for (const asset of unfundedAssets) {
      const value = Number(asset['estimated_value']) || 0;
      if (value > 100000) {
        redFlags.push({
          flag_id: crypto.randomUUID(),
          type: 'high_value_unfunded',
          severity: 'critical',
          message: `High-value asset "${asset['name']}" ($${value.toLocaleString()}) is not funded into the trust`,
          related_asset_ids: [asset['id'] as string],
          related_doc_ids: [],
        });
      }
    }

    // Missing core documents
    if (!presentDocTypes.has('trust_agreement')) {
      redFlags.push({
        flag_id: crypto.randomUUID(),
        type: 'missing_trust_agreement',
        severity: 'critical',
        message: 'No current trust agreement document on file',
        related_asset_ids: [],
        related_doc_ids: [],
      });
    }

    if (!hasPoA) {
      redFlags.push({
        flag_id: crypto.randomUUID(),
        type: 'missing_poa',
        severity: 'high',
        message: 'No current durable power of attorney document on file',
        related_asset_ids: [],
        related_doc_ids: [],
      });
    }

    if (!hasHCD) {
      redFlags.push({
        flag_id: crypto.randomUUID(),
        type: 'missing_healthcare_directive',
        severity: 'high',
        message: 'No current advance healthcare directive on file',
        related_asset_ids: [],
        related_doc_ids: [],
      });
    }

    // Real estate without deeds
    const realEstateAssets = assets.filter((a) => a['asset_type'] === 'real_estate' && a['ownership_status'] === 'funded');
    const deedDocs = docs.filter((d) => d['doc_type'] === 'deed' && d['status'] === 'current');
    if (realEstateAssets.length > 0 && deedDocs.length === 0) {
      redFlags.push({
        flag_id: crypto.randomUUID(),
        type: 'real_estate_no_deed',
        severity: 'high',
        message: 'Real estate assets are marked as funded but no deed documents are on file',
        related_asset_ids: realEstateAssets.map((a) => a['id'] as string),
        related_doc_ids: [],
      });
    }

    // Expired documents
    const now = new Date().toISOString();
    const expiredDocs = docs.filter(
      (d) => d['expiration_date'] && (d['expiration_date'] as string) < now && d['status'] === 'current'
    );
    for (const doc of expiredDocs) {
      redFlags.push({
        flag_id: crypto.randomUUID(),
        type: 'expired_document',
        severity: 'medium',
        message: `Document "${doc['title']}" has expired (${doc['expiration_date']})`,
        related_asset_ids: [],
        related_doc_ids: [doc['id'] as string],
      });
    }

    // ─── Identify data gaps ─────────────────────────────────────────
    const dataGaps: Array<{
      gap_id: string;
      field: string;
      message: string;
      resolution_hint: string;
    }> = [];

    // Assets without estimated values
    const noValueAssets = assets.filter((a) => !a['estimated_value']);
    if (noValueAssets.length > 0) {
      dataGaps.push({
        gap_id: crypto.randomUUID(),
        field: 'asset.estimated_value',
        message: `${noValueAssets.length} asset(s) have no estimated value`,
        resolution_hint: 'Add current estimated values to improve funding coverage calculations',
      });
    }

    // Missing grantor/trustee names
    if (safeParseJson(trust['grantor_names'] as string, []).length === 0) {
      dataGaps.push({
        gap_id: crypto.randomUUID(),
        field: 'trust_profile.grantor_names',
        message: 'No grantor names specified in the trust profile',
        resolution_hint: 'Add the grantor name(s) to the trust profile',
      });
    }

    if (safeParseJson(trust['trustee_names'] as string, []).length === 0) {
      dataGaps.push({
        gap_id: crypto.randomUUID(),
        field: 'trust_profile.trustee_names',
        message: 'No trustee names specified in the trust profile',
        resolution_hint: 'Add the trustee name(s) to the trust profile',
      });
    }

    // ─── Compute overall health score ───────────────────────────────
    const criticalFlags = redFlags.filter((f) => f.severity === 'critical').length;
    const highFlags = redFlags.filter((f) => f.severity === 'high').length;
    const flagPenalty = (criticalFlags * 15) + (highFlags * 8);

    const trustHealthScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (fundingCoverageValuePct * 0.30) +
          (docCompletenessScore * 0.25) +
          (incapacityReadinessScore * 0.20) +
          (evidenceCompletenessPct * 0.15) +
          (fundingCoverageCountPct * 0.10) -
          flagPenalty
        )
      )
    );

    // ─── Build results object ───────────────────────────────────────
    const results = {
      funding_coverage_value_pct: fundingCoverageValuePct,
      funding_coverage_count_pct: fundingCoverageCountPct,
      probate_exposure_amount: probateExposureAmount,
      probate_exposure_assets: probateExposureAssetIds,
      document_completeness_score: docCompletenessScore,
      incapacity_readiness_score: incapacityReadinessScore,
      evidence_completeness_pct: evidenceCompletenessPct,
      red_flags: redFlags,
      formulas: {
        trust_health_score: '(funding_value * 0.30) + (doc_completeness * 0.25) + (incapacity_readiness * 0.20) + (evidence_completeness * 0.15) + (funding_count * 0.10) - flag_penalty',
        funding_coverage_value: 'sum(funded_asset_values) / sum(all_asset_values) * 100',
        funding_coverage_count: 'count(funded_assets) / count(all_assets) * 100',
        probate_exposure: 'sum(unfunded_asset_values)',
        document_completeness: 'count(present_required_doc_types) / count(all_required_doc_types) * 100',
        incapacity_readiness: 'count([has_poa, has_hcd, has_successor_trustee].filter(true)) / 3 * 100',
        evidence_completeness: 'count(funded_assets_with_evidence) / count(funded_assets) * 100',
        flag_penalty: '(critical_flags * 15) + (high_flags * 8)',
      },
      contributing_asset_ids: {
        funded: fundedAssets.map((a) => a['id'] as string),
        unfunded: probateExposureAssetIds,
        no_value: noValueAssets.map((a) => a['id'] as string),
      },
      contributing_evidence_ids: {
        verified: evidence.filter((e) => e['verified']).map((e) => e['id'] as string),
        unverified: evidence.filter((e) => !e['verified']).map((e) => e['id'] as string),
      },
      data_gaps: dataGaps,
    };

    // ─── Store computation ──────────────────────────────────────────
    const computationId = crypto.randomUUID();

    // Get latest version number
    const latestComputation = await env.DB
      .prepare('SELECT MAX(version) as max_version FROM computation WHERE trust_id = ?')
      .bind(trustId)
      .first<{ max_version: number | null }>();

    const nextVersion = (latestComputation?.max_version ?? 0) + 1;

    await env.DB
      .prepare(
        `INSERT INTO computation (
          id, trust_id, computed_at, trust_health_score,
          funding_coverage_pct, probate_exposure,
          document_completeness_pct, incapacity_readiness_pct,
          results, version
        ) VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        computationId,
        trustId,
        trustHealthScore,
        fundingCoverageValuePct,
        probateExposureAmount,
        docCompletenessScore,
        incapacityReadinessScore,
        JSON.stringify(results),
        nextVersion
      )
      .run();

    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'COMPUTE',
      entity_type: 'computation',
      entity_id: computationId,
      details: JSON.stringify({
        trust_health_score: trustHealthScore,
        version: nextVersion,
        red_flag_count: redFlags.length,
        data_gap_count: dataGaps.length,
      }),
      ip_address: getClientIp(request),
    });

    return successResponse({
      id: computationId,
      trust_id: trustId,
      trust_health_score: trustHealthScore,
      funding_coverage_pct: fundingCoverageValuePct,
      probate_exposure: probateExposureAmount,
      document_completeness_pct: docCompletenessScore,
      incapacity_readiness_pct: incapacityReadinessScore,
      version: nextVersion,
      results,
    });
  }) as RouteHandler,
};

// ─── NBA (Next Best Action) Handlers ────────────────────────────────────────

const nbaHandlers = {
  getActions: (async (request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    const trustId = params['trust_id']!;
    await requireTenantAccess(env.DB, trustId, session.user_id);

    // Fetch the latest computation
    const latestComputation = await env.DB
      .prepare(
        'SELECT * FROM computation WHERE trust_id = ? ORDER BY version DESC LIMIT 1'
      )
      .bind(trustId)
      .first();

    if (!latestComputation) {
      return errorResponse(
        'No computation found. Run POST /trust/:trust_id/compute first.',
        404
      );
    }

    const results = safeParseJson(latestComputation['results'] as string, null);
    if (!results) {
      return errorResponse('Computation results are corrupted', 500);
    }

    // Fetch NBA rules
    const rulesResult = await env.DB
      .prepare('SELECT * FROM nba_rule WHERE enabled = 1 ORDER BY priority_base DESC')
      .all();

    const rules = rulesResult.results;

    // Fetch assets and documents for context
    const assetsResult = await env.DB
      .prepare('SELECT * FROM asset WHERE trust_id = ?')
      .bind(trustId)
      .all();

    const docsResult = await env.DB
      .prepare('SELECT * FROM document WHERE trust_id = ?')
      .bind(trustId)
      .all();

    // Evaluate each rule against the computation results
    const actions: Array<{
      action_id: string;
      rule_id: string;
      action_type: string;
      title: string;
      description: string;
      priority_score: number;
      category: string;
      steps: string[];
      evidence_required: string[];
      related_asset_ids: string[];
      related_doc_ids: string[];
      estimated_time_minutes: number | null;
      provider_type: string | null;
    }> = [];

    for (const rule of rules) {
      const conditionMet = evaluateNBACondition(
        rule['condition_type'] as string,
        rule['condition_field'] as string,
        rule['condition_operator'] as string,
        rule['condition_value'] as string,
        results,
        assetsResult.results,
        docsResult.results
      );

      if (conditionMet) {
        // Calculate priority score: base priority + severity boost
        const basePriority = Number(rule['priority_base']) || 50;
        const severityBoost = calculateSeverityBoost(
          rule['condition_field'] as string,
          results
        );

        actions.push({
          action_id: crypto.randomUUID(),
          rule_id: rule['rule_id'] as string,
          action_type: rule['action_type'] as string,
          title: rule['action_title'] as string,
          description: rule['action_description'] as string,
          priority_score: Math.min(100, basePriority + severityBoost),
          category: rule['category'] as string,
          steps: safeParseJson(rule['steps'] as string, []),
          evidence_required: safeParseJson(rule['evidence_required'] as string, []),
          related_asset_ids: findRelatedAssetIds(rule['condition_field'] as string, results),
          related_doc_ids: findRelatedDocIds(rule['condition_field'] as string, results),
          estimated_time_minutes: estimateTime(rule['action_type'] as string),
          provider_type: suggestProvider(rule['action_type'] as string),
        });
      }
    }

    // Sort by priority descending
    actions.sort((a, b) => b.priority_score - a.priority_score);

    return successResponse({
      trust_id: trustId,
      computation_id: latestComputation['id'],
      computation_version: latestComputation['version'],
      actions,
      total_actions: actions.length,
    });
  }) as RouteHandler,
};

// ─── RAG Handlers ───────────────────────────────────────────────────────────

const ragHandlers = {
  ingest: (async (request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    const trustId = params['trust_id']!;
    await requireTenantAccess(env.DB, trustId, session.user_id);

    const body = await request.json() as {
      doc_id?: string;
      content?: string;
      chunk_size?: number;
    };

    if (!body.doc_id || !body.content) {
      return errorResponse('Missing required fields: doc_id, content');
    }

    // Verify document belongs to this trust
    const doc = await env.DB
      .prepare('SELECT id FROM document WHERE id = ? AND trust_id = ?')
      .bind(body.doc_id, trustId)
      .first();

    if (!doc) {
      return errorResponse('Document not found in this trust profile', 404);
    }

    const chunkSize = body.chunk_size ?? 1000;
    const chunks = splitIntoChunks(body.content, chunkSize);

    // Delete existing chunks for this document
    await env.DB
      .prepare('DELETE FROM doc_chunk WHERE doc_id = ? AND trust_id = ?')
      .bind(body.doc_id, trustId)
      .run();

    // Insert new chunks
    const chunkIds: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const chunkId = crypto.randomUUID();
      chunkIds.push(chunkId);

      await env.DB
        .prepare(
          `INSERT INTO doc_chunk (
            id, doc_id, trust_id, chunk_index, content,
            token_count, source_page, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(
          chunkId,
          body.doc_id,
          trustId,
          i,
          chunk.text,
          chunk.tokenEstimate,
          chunk.sourcePage
        )
        .run();
    }

    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'INGEST',
      entity_type: 'doc_chunk',
      entity_id: body.doc_id,
      details: JSON.stringify({ chunk_count: chunks.length, chunk_size: chunkSize }),
      ip_address: getClientIp(request),
    });

    return successResponse({
      doc_id: body.doc_id,
      chunks_created: chunks.length,
      chunk_ids: chunkIds,
    });
  }) as RouteHandler,

  query: (async (request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    const trustId = params['trust_id']!;
    await requireTenantAccess(env.DB, trustId, session.user_id);

    const body = await request.json() as {
      query?: string;
      top_k?: number;
      doc_id?: string;
    };

    if (!body.query) {
      return errorResponse('Missing required field: query');
    }

    const topK = body.top_k ?? 5;

    // Simple keyword-based retrieval (full vector search would require an embedding model)
    // For now, use SQLite FTS-style LIKE matching on chunk content
    const queryTerms = body.query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 2);

    if (queryTerms.length === 0) {
      return errorResponse('Query must contain at least one meaningful term');
    }

    // Build WHERE clause with LIKE conditions for each term
    let sql = `SELECT id, doc_id, trust_id, chunk_index, content, token_count, source_page, created_at
               FROM doc_chunk
               WHERE trust_id = ?`;
    const bindValues: unknown[] = [trustId];

    if (body.doc_id) {
      sql += ' AND doc_id = ?';
      bindValues.push(body.doc_id);
    }

    // Score chunks by number of matching terms (simple relevance)
    // Use CASE expressions to count matches
    const scoreCases = queryTerms.map(() => `CASE WHEN LOWER(content) LIKE ? THEN 1 ELSE 0 END`);
    const scoreExpr = scoreCases.join(' + ');

    sql = `SELECT id, doc_id, trust_id, chunk_index, content, token_count, source_page, created_at,
                  (${scoreExpr}) as relevance_score
           FROM doc_chunk
           WHERE trust_id = ?`;

    const scoreBindValues: unknown[] = [];
    for (const term of queryTerms) {
      scoreBindValues.push(`%${term}%`);
    }
    scoreBindValues.push(trustId);

    if (body.doc_id) {
      sql += ' AND doc_id = ?';
      scoreBindValues.push(body.doc_id);
    }

    // Only return chunks that match at least one term
    sql += ' HAVING relevance_score > 0 ORDER BY relevance_score DESC LIMIT ?';
    scoreBindValues.push(topK);

    const result = await env.DB
      .prepare(sql)
      .bind(...scoreBindValues)
      .all();

    const citations = result.results.map((chunk) => ({
      chunk_id: chunk['id'] as string,
      source_id: chunk['doc_id'] as string,
      text_snippet: truncateText(chunk['content'] as string, 200),
    }));

    return successResponse({
      query: body.query,
      results: result.results,
      citations,
      total_results: result.results.length,
    });
  }) as RouteHandler,
};

// ─── Provider Handlers ──────────────────────────────────────────────────────

const providerHandlers = {
  search: (async (request: Request, env: Env, _params: Record<string, string>) => {
    const url = new URL(request.url);
    const providerType = url.searchParams.get('type');
    const jurisdiction = url.searchParams.get('jurisdiction');
    const keyword = url.searchParams.get('q');

    let sql = 'SELECT * FROM provider WHERE verified = 1';
    const bindValues: unknown[] = [];

    if (providerType) {
      sql += ' AND provider_type = ?';
      bindValues.push(providerType);
    }

    if (jurisdiction) {
      sql += ' AND jurisdiction = ?';
      bindValues.push(jurisdiction);
    }

    if (keyword) {
      sql += ' AND (LOWER(name) LIKE ? OR LOWER(specialty) LIKE ?)';
      const term = `%${keyword.toLowerCase()}%`;
      bindValues.push(term, term);
    }

    sql += ' ORDER BY rating DESC NULLS LAST LIMIT 50';

    const result = await env.DB
      .prepare(sql)
      .bind(...bindValues)
      .all();

    return successResponse(result.results);
  }) as OptionalAuthRouteHandler,

  create: (async (request: Request, env: Env, _params: Record<string, string>, session: SessionData) => {
    // Admin-only endpoint
    const user = await env.DB
      .prepare('SELECT role FROM user WHERE id = ?')
      .bind(session.user_id)
      .first<{ role: string }>();

    if (!user || user.role !== 'admin') {
      return errorResponse('Admin access required', 403);
    }

    const body = await request.json() as {
      name?: string;
      provider_type?: string;
      specialty?: string;
      jurisdiction?: string;
      email?: string;
      phone?: string;
      website?: string;
      address?: string;
    };

    if (!body.name || !body.provider_type) {
      return errorResponse('Missing required fields: name, provider_type');
    }

    const providerId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB
      .prepare(
        `INSERT INTO provider (
          id, name, provider_type, specialty, jurisdiction,
          email, phone, website, address, verified, rating,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`
      )
      .bind(
        providerId,
        body.name,
        body.provider_type,
        body.specialty ?? null,
        body.jurisdiction ?? null,
        body.email ?? null,
        body.phone ?? null,
        body.website ?? null,
        body.address ?? null,
        now,
        now
      )
      .run();

    return successResponse({ id: providerId, name: body.name }, 201);
  }) as RouteHandler,

  update: (async (request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    // Admin-only endpoint
    const user = await env.DB
      .prepare('SELECT role FROM user WHERE id = ?')
      .bind(session.user_id)
      .first<{ role: string }>();

    if (!user || user.role !== 'admin') {
      return errorResponse('Admin access required', 403);
    }

    const providerId = params['id']!;
    const body = await request.json() as Record<string, unknown>;

    const allowedFields = [
      'name', 'provider_type', 'specialty', 'jurisdiction',
      'email', 'phone', 'website', 'address', 'verified', 'rating',
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (field in body) {
        setClauses.push(`${field} = ?`);
        values.push(body[field] ?? null);
      }
    }

    if (setClauses.length === 0) {
      return errorResponse('No valid fields provided for update');
    }

    setClauses.push("updated_at = datetime('now')");
    values.push(providerId);

    await env.DB
      .prepare(`UPDATE provider SET ${setClauses.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return successResponse({ id: providerId, updated: true });
  }) as RouteHandler,
};

// ─── Export Handlers ────────────────────────────────────────────────────────

const exportHandlers = {
  healthReport: (async (request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    const trustId = params['trust_id']!;
    await requireTenantAccess(env.DB, trustId, session.user_id);

    // Fetch latest computation
    const computation = await env.DB
      .prepare('SELECT * FROM computation WHERE trust_id = ? ORDER BY version DESC LIMIT 1')
      .bind(trustId)
      .first();

    if (!computation) {
      return errorResponse('No computation found. Run POST /trust/:trust_id/compute first.', 404);
    }

    // Fetch trust profile
    const trust = await env.DB
      .prepare('SELECT * FROM trust_profile WHERE id = ?')
      .bind(trustId)
      .first();

    // Fetch assets
    const assetsResult = await env.DB
      .prepare('SELECT * FROM asset WHERE trust_id = ? ORDER BY estimated_value DESC')
      .bind(trustId)
      .all();

    // Fetch documents
    const docsResult = await env.DB
      .prepare('SELECT * FROM document WHERE trust_id = ? ORDER BY created_at DESC')
      .bind(trustId)
      .all();

    const results = safeParseJson(computation['results'] as string, {});

    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'EXPORT',
      entity_type: 'health_report',
      entity_id: computation['id'] as string,
      details: JSON.stringify({ format: 'pdf', computation_version: computation['version'] }),
      ip_address: getClientIp(request),
    });

    // Return structured JSON for client-side PDF generation
    // (actual PDF rendering happens on the frontend or a dedicated service)
    return successResponse({
      report_type: 'health_report',
      generated_at: new Date().toISOString(),
      trust: {
        id: trust?.['id'],
        name: trust?.['trust_name'],
        type: trust?.['trust_type'],
        jurisdiction: trust?.['jurisdiction'],
        status: trust?.['status'],
      },
      scores: {
        trust_health_score: computation['trust_health_score'],
        funding_coverage_pct: computation['funding_coverage_pct'],
        probate_exposure: computation['probate_exposure'],
        document_completeness_pct: computation['document_completeness_pct'],
        incapacity_readiness_pct: computation['incapacity_readiness_pct'],
      },
      computation_version: computation['version'],
      results,
      assets: assetsResult.results,
      documents: docsResult.results,
    });
  }) as RouteHandler,

  trusteePacket: (async (request: Request, env: Env, params: Record<string, string>, session: SessionData) => {
    const trustId = params['trust_id']!;
    await requireTenantAccess(env.DB, trustId, session.user_id);

    // Fetch trust profile
    const trust = await env.DB
      .prepare('SELECT * FROM trust_profile WHERE id = ?')
      .bind(trustId)
      .first();

    if (!trust) {
      return errorResponse('Trust profile not found', 404);
    }

    // Fetch all related data
    const [assetsResult, docsResult, evidenceResult] = await Promise.all([
      env.DB.prepare('SELECT * FROM asset WHERE trust_id = ? ORDER BY asset_type, name').bind(trustId).all(),
      env.DB.prepare('SELECT * FROM document WHERE trust_id = ? ORDER BY doc_type, created_at DESC').bind(trustId).all(),
      env.DB.prepare('SELECT * FROM evidence WHERE trust_id = ? ORDER BY created_at DESC').bind(trustId).all(),
    ]);

    // Fetch latest computation if available
    const computation = await env.DB
      .prepare('SELECT * FROM computation WHERE trust_id = ? ORDER BY version DESC LIMIT 1')
      .bind(trustId)
      .first();

    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'EXPORT',
      entity_type: 'trustee_packet',
      entity_id: trustId,
      details: JSON.stringify({ format: 'pdf' }),
      ip_address: getClientIp(request),
    });

    // Return structured JSON for client-side PDF generation
    return successResponse({
      report_type: 'trustee_packet',
      generated_at: new Date().toISOString(),
      trust: {
        ...trust,
        grantor_names: safeParseJson(trust['grantor_names'] as string, []),
        trustee_names: safeParseJson(trust['trustee_names'] as string, []),
        successor_trustee_names: safeParseJson(trust['successor_trustee_names'] as string, []),
        beneficiary_names: safeParseJson(trust['beneficiary_names'] as string, []),
        has_pour_over_will: Boolean(trust['has_pour_over_will']),
        has_power_of_attorney: Boolean(trust['has_power_of_attorney']),
        has_healthcare_directive: Boolean(trust['has_healthcare_directive']),
      },
      assets: assetsResult.results,
      documents: docsResult.results,
      evidence: evidenceResult.results,
      latest_computation: computation
        ? {
            trust_health_score: computation['trust_health_score'],
            funding_coverage_pct: computation['funding_coverage_pct'],
            probate_exposure: computation['probate_exposure'],
            document_completeness_pct: computation['document_completeness_pct'],
            incapacity_readiness_pct: computation['incapacity_readiness_pct'],
            computed_at: computation['computed_at'],
            version: computation['version'],
          }
        : null,
    });
  }) as RouteHandler,
};

// ─── Route Table ────────────────────────────────────────────────────────────

const routes: Route[] = [
  // Auth (no auth required)
  buildRoute('POST', '/auth/register', authHandlers.register, false),
  buildRoute('POST', '/auth/login', authHandlers.login, false),
  buildRoute('POST', '/auth/logout', authHandlers.logout, false),

  // Trust profiles
  buildRoute('POST', '/trust', trustHandlers.create, true),
  buildRoute('GET', '/trust/:trust_id', trustHandlers.get, true),

  // Assets
  buildRoute('POST', '/trust/:trust_id/assets', assetHandlers.create, true),
  buildRoute('GET', '/trust/:trust_id/assets', assetHandlers.list, true),
  buildRoute('PUT', '/trust/:trust_id/assets/:asset_id', assetHandlers.update, true),
  buildRoute('DELETE', '/trust/:trust_id/assets/:asset_id', assetHandlers.delete, true),

  // Documents
  buildRoute('POST', '/trust/:trust_id/documents', documentHandlers.create, true),
  buildRoute('GET', '/trust/:trust_id/documents', documentHandlers.list, true),
  buildRoute('PUT', '/trust/:trust_id/documents/:doc_id', documentHandlers.update, true),

  // Evidence
  buildRoute('POST', '/trust/:trust_id/evidence', evidenceHandlers.create, true),
  buildRoute('GET', '/trust/:trust_id/evidence', evidenceHandlers.list, true),

  // Computation
  buildRoute('POST', '/trust/:trust_id/compute', computeHandlers.compute, true),

  // Next Best Actions
  buildRoute('GET', '/trust/:trust_id/nba', nbaHandlers.getActions, true),

  // RAG
  buildRoute('POST', '/trust/:trust_id/rag/ingest', ragHandlers.ingest, true),
  buildRoute('POST', '/trust/:trust_id/rag/query', ragHandlers.query, true),

  // Providers (search is public, create/update are admin-only)
  buildRoute('GET', '/providers', providerHandlers.search, false),
  buildRoute('POST', '/providers', providerHandlers.create, true),
  buildRoute('PUT', '/providers/:id', providerHandlers.update, true),

  // Export
  buildRoute('POST', '/trust/:trust_id/export/health-report.pdf', exportHandlers.healthReport, true),
  buildRoute('POST', '/trust/:trust_id/export/trustee-packet.pdf', exportHandlers.trusteePacket, true),
];

// ─── CORS ───────────────────────────────────────────────────────────────────

function getCorsHeaders(env: Env): Record<string, string> {
  const origin = env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function addCorsHeaders(response: Response, env: Env): Response {
  const corsHeaders = getCorsHeaders(env);
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// ─── Password Hashing ──────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  const hashArray = new Uint8Array(derivedBits);
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(hashArray).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:100000:${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    return false;
  }

  const iterations = parseInt(parts[1]!, 10);
  const saltHex = parts[2]!;
  const expectedHashHex = parts[3]!;

  const salt = new Uint8Array(
    saltHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
  );

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const hashArray = new Uint8Array(derivedBits);
  const hashHex = Array.from(hashArray).map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex === expectedHashHex;
}

// ─── Utility Functions ──────────────────────────────────────────────────────

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function splitIntoChunks(
  content: string,
  chunkSize: number
): Array<{ text: string; tokenEstimate: number; sourcePage: number | null }> {
  const chunks: Array<{ text: string; tokenEstimate: number; sourcePage: number | null }> = [];
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = '';
  let currentPage: number | null = null;

  for (const paragraph of paragraphs) {
    // Detect page markers like "[Page 3]" or "--- Page 3 ---"
    const pageMatch = paragraph.match(/(?:\[Page\s+(\d+)\]|---\s*Page\s+(\d+)\s*---)/i);
    if (pageMatch) {
      currentPage = parseInt(pageMatch[1] ?? pageMatch[2]!, 10);
    }

    if (currentChunk.length + paragraph.length + 2 > chunkSize && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        tokenEstimate: Math.ceil(currentChunk.trim().length / 4), // rough estimate: ~4 chars per token
        sourcePage: currentPage,
      });
      currentChunk = '';
    }

    currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      tokenEstimate: Math.ceil(currentChunk.trim().length / 4),
      sourcePage: currentPage,
    });
  }

  return chunks;
}

// ─── NBA Helper Functions ───────────────────────────────────────────────────

function evaluateNBACondition(
  conditionType: string,
  conditionField: string,
  conditionOperator: string,
  conditionValue: string,
  results: Record<string, unknown>,
  assets: Record<string, unknown>[],
  docs: Record<string, unknown>[]
): boolean {
  let actualValue: unknown;

  switch (conditionType) {
    case 'score':
      actualValue = results[conditionField];
      break;
    case 'count':
      if (conditionField === 'red_flags') {
        actualValue = (results['red_flags'] as unknown[] | undefined)?.length ?? 0;
      } else if (conditionField === 'data_gaps') {
        actualValue = (results['data_gaps'] as unknown[] | undefined)?.length ?? 0;
      } else if (conditionField === 'unfunded_assets') {
        actualValue = assets.filter(
          (a) => a['ownership_status'] === 'unfunded' || a['ownership_status'] === 'unknown'
        ).length;
      } else if (conditionField === 'missing_docs') {
        const requiredTypes = ['trust_agreement', 'pour_over_will', 'power_of_attorney', 'healthcare_directive'];
        const presentTypes = new Set(
          docs.filter((d) => d['status'] === 'current').map((d) => d['doc_type'] as string)
        );
        actualValue = requiredTypes.filter((t) => !presentTypes.has(t)).length;
      } else {
        actualValue = 0;
      }
      break;
    case 'array_contains':
      actualValue = results[conditionField];
      if (Array.isArray(actualValue)) {
        return actualValue.some(
          (item: unknown) =>
            typeof item === 'object' &&
            item !== null &&
            'type' in item &&
            (item as Record<string, unknown>)['type'] === conditionValue
        );
      }
      return false;
    case 'exists':
      actualValue = results[conditionField];
      return conditionOperator === 'empty'
        ? !actualValue || (Array.isArray(actualValue) && actualValue.length === 0)
        : Boolean(actualValue) && (!Array.isArray(actualValue) || actualValue.length > 0);
    default:
      return false;
  }

  const numActual = Number(actualValue);
  const numExpected = Number(conditionValue);

  switch (conditionOperator) {
    case 'lt':
      return numActual < numExpected;
    case 'lte':
      return numActual <= numExpected;
    case 'gt':
      return numActual > numExpected;
    case 'gte':
      return numActual >= numExpected;
    case 'eq':
      return numActual === numExpected;
    case 'neq':
      return numActual !== numExpected;
    default:
      return false;
  }
}

function calculateSeverityBoost(conditionField: string, results: Record<string, unknown>): number {
  if (conditionField === 'funding_coverage_value_pct') {
    const pct = Number(results['funding_coverage_value_pct']) || 0;
    if (pct < 25) return 30;
    if (pct < 50) return 20;
    if (pct < 75) return 10;
    return 0;
  }
  if (conditionField === 'probate_exposure_amount') {
    const amount = Number(results['probate_exposure_amount']) || 0;
    if (amount > 500000) return 30;
    if (amount > 100000) return 20;
    if (amount > 50000) return 10;
    return 0;
  }
  if (conditionField === 'document_completeness_score') {
    const score = Number(results['document_completeness_score']) || 0;
    if (score < 40) return 25;
    if (score < 60) return 15;
    return 0;
  }
  return 0;
}

function findRelatedAssetIds(conditionField: string, results: Record<string, unknown>): string[] {
  if (conditionField.includes('funding') || conditionField.includes('probate')) {
    return (results['probate_exposure_assets'] as string[] | undefined) ?? [];
  }
  return [];
}

function findRelatedDocIds(conditionField: string, results: Record<string, unknown>): string[] {
  const redFlags = (results['red_flags'] as Array<{ related_doc_ids?: string[] }>) ?? [];
  if (conditionField.includes('document')) {
    return redFlags.flatMap((f) => f.related_doc_ids ?? []);
  }
  return [];
}

function estimateTime(actionType: string): number | null {
  const estimates: Record<string, number> = {
    fund_asset: 30,
    upload_document: 15,
    add_evidence: 20,
    review_beneficiary: 45,
    contact_attorney: 60,
    update_deed: 90,
    notarize_document: 60,
    review_trust: 120,
  };
  return estimates[actionType] ?? null;
}

function suggestProvider(actionType: string): string | null {
  const providers: Record<string, string> = {
    update_deed: 'attorney',
    contact_attorney: 'attorney',
    review_trust: 'attorney',
    notarize_document: 'notary',
    review_beneficiary: 'financial_advisor',
    tax_review: 'cpa',
  };
  return providers[actionType] ?? null;
}

// ─── Worker Entry Point ─────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(env),
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Match route
    for (const route of routes) {
      if (request.method !== route.method) continue;

      const match = path.match(route.pattern);
      if (!match) continue;

      // Extract path parameters
      const params: Record<string, string> = {};
      for (let i = 0; i < route.paramNames.length; i++) {
        const paramName = route.paramNames[i]!;
        const paramValue = match[i + 1];
        if (paramValue) {
          params[paramName] = decodeURIComponent(paramValue);
        }
      }

      try {
        // Authenticate if required
        let session: SessionData | null = null;
        if (route.requiresAuth) {
          session = await requireAuth(request, env);
        } else {
          session = await authenticateRequest(request, env);
        }

        const response = await (route.handler as Function)(request, env, params, session);
        return addCorsHeaders(response, env);
      } catch (thrown: unknown) {
        // If a handler threw a Response (e.g., from requireAuth or requireTenantAccess),
        // return it directly with CORS headers
        if (thrown instanceof Response) {
          return addCorsHeaders(thrown, env);
        }

        // Unexpected error
        console.error('Unhandled error:', thrown);
        const errResponse = errorResponse('Internal server error', 500);
        return addCorsHeaders(errResponse, env);
      }
    }

    // No route matched
    const notFound = errorResponse(`Not found: ${request.method} ${path}`, 404);
    return addCorsHeaders(notFound, env);
  },
} satisfies ExportedHandler<Env>;
