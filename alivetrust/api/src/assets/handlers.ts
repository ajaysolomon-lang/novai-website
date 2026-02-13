import type { Env, SessionData, Asset } from '../types/index';
import { verifyTenantAccess } from '../middleware/tenant';
import { logAudit } from '../middleware/audit';
import { jsonResponse, errorResponse } from '../utils/response';

// ─── Handlers ───

export async function create(
  request: Request,
  env: Env,
  params: Record<string, string>,
  session: SessionData
): Promise<Response> {
  try {
    const trustId = params.trust_id;

    if (!trustId) {
      return errorResponse('trust_id is required');
    }

    // Verify tenant access
    const hasAccess = await verifyTenantAccess(env.DB, trustId, session.user_id);
    if (!hasAccess) {
      return errorResponse('Access denied', 403);
    }

    const body = await request.json<{
      asset_type: string;
      name: string;
      description?: string;
      estimated_value?: number;
      institution?: string;
      account_number?: string;
      address?: string;
      notes?: string;
    }>();

    const {
      asset_type,
      name,
      description,
      estimated_value,
      institution,
      account_number,
      address,
      notes,
    } = body;

    if (!asset_type || !name) {
      return errorResponse('asset_type and name are required');
    }

    const assetId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO asset (
        id, trust_id, asset_type, name, description, estimated_value,
        institution, account_number, address, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        assetId,
        trustId,
        asset_type,
        name,
        description ?? null,
        estimated_value ?? null,
        institution ?? null,
        account_number ?? null,
        address ?? null,
        notes ?? null,
        now,
        now
      )
      .run();

    const asset: Partial<Asset> = {
      id: assetId,
      trust_id: trustId,
      asset_type,
      name,
      description: description ?? undefined,
      estimated_value: estimated_value ?? undefined,
      institution: institution ?? undefined,
      account_number: account_number ?? undefined,
      address: address ?? undefined,
      notes: notes ?? undefined,
      created_at: now,
      updated_at: now,
    };

    // Log audit — logAudit(db, entry) expects D1Database as first arg
    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'create',
      entity_type: 'asset',
      entity_id: assetId,
      details: JSON.stringify({ asset_type, name, _note: 'Trust total value recompute may be needed' }),
      ip_address: request.headers.get('CF-Connecting-IP') ?? null,
    });

    return jsonResponse(asset, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create asset';
    return errorResponse(message, 500);
  }
}

export async function list(
  request: Request,
  env: Env,
  params: Record<string, string>,
  session: SessionData
): Promise<Response> {
  try {
    const trustId = params.trust_id;

    if (!trustId) {
      return errorResponse('trust_id is required');
    }

    // Verify tenant access
    const hasAccess = await verifyTenantAccess(env.DB, trustId, session.user_id);
    if (!hasAccess) {
      return errorResponse('Access denied', 403);
    }

    const { results } = await env.DB.prepare(
      `SELECT id, trust_id, asset_type, name, description, estimated_value,
              institution, account_number, address, notes, created_at, updated_at
       FROM asset
       WHERE trust_id = ?
       ORDER BY created_at DESC`
    )
      .bind(trustId)
      .all<Asset>();

    return jsonResponse(results ?? []);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list assets';
    return errorResponse(message, 500);
  }
}

export async function update(
  request: Request,
  env: Env,
  params: Record<string, string>,
  session: SessionData
): Promise<Response> {
  try {
    const trustId = params.trust_id;
    const assetId = params.asset_id;

    if (!trustId || !assetId) {
      return errorResponse('trust_id and asset_id are required');
    }

    // Verify tenant access
    const hasAccess = await verifyTenantAccess(env.DB, trustId, session.user_id);
    if (!hasAccess) {
      return errorResponse('Access denied', 403);
    }

    // Capture before state for audit
    const before = await env.DB.prepare(
      `SELECT id, trust_id, asset_type, name, description, estimated_value,
              institution, account_number, address, notes, created_at, updated_at
       FROM asset
       WHERE id = ? AND trust_id = ?`
    )
      .bind(assetId, trustId)
      .first<Asset>();

    if (!before) {
      return errorResponse('Asset not found', 404);
    }

    const body = await request.json<{
      asset_type?: string;
      name?: string;
      description?: string;
      estimated_value?: number;
      institution?: string;
      account_number?: string;
      address?: string;
      notes?: string;
    }>();

    const now = new Date().toISOString();

    await env.DB.prepare(
      `UPDATE asset SET
        asset_type = COALESCE(?, asset_type),
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        estimated_value = COALESCE(?, estimated_value),
        institution = COALESCE(?, institution),
        account_number = COALESCE(?, account_number),
        address = COALESCE(?, address),
        notes = COALESCE(?, notes),
        updated_at = ?
       WHERE id = ? AND trust_id = ?`
    )
      .bind(
        body.asset_type ?? null,
        body.name ?? null,
        body.description ?? null,
        body.estimated_value ?? null,
        body.institution ?? null,
        body.account_number ?? null,
        body.address ?? null,
        body.notes ?? null,
        now,
        assetId,
        trustId
      )
      .run();

    // Fetch updated record
    const after = await env.DB.prepare(
      `SELECT id, trust_id, asset_type, name, description, estimated_value,
              institution, account_number, address, notes, created_at, updated_at
       FROM asset
       WHERE id = ? AND trust_id = ?`
    )
      .bind(assetId, trustId)
      .first<Asset>();

    // Log audit with before/after — logAudit(db, entry) expects D1Database as first arg
    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'update',
      entity_type: 'asset',
      entity_id: assetId,
      details: JSON.stringify({ before, after }),
      ip_address: request.headers.get('CF-Connecting-IP') ?? null,
    });

    return jsonResponse(after);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update asset';
    return errorResponse(message, 500);
  }
}

export async function remove(
  request: Request,
  env: Env,
  params: Record<string, string>,
  session: SessionData
): Promise<Response> {
  try {
    const trustId = params.trust_id;
    const assetId = params.asset_id;

    if (!trustId || !assetId) {
      return errorResponse('trust_id and asset_id are required');
    }

    // Verify tenant access
    const hasAccess = await verifyTenantAccess(env.DB, trustId, session.user_id);
    if (!hasAccess) {
      return errorResponse('Access denied', 403);
    }

    // Capture before state for audit
    const before = await env.DB.prepare(
      `SELECT id, trust_id, asset_type, name, description, estimated_value,
              institution, account_number, address, notes, created_at, updated_at
       FROM asset
       WHERE id = ? AND trust_id = ?`
    )
      .bind(assetId, trustId)
      .first<Asset>();

    if (!before) {
      return errorResponse('Asset not found', 404);
    }

    // Clean up linked evidence
    await env.DB.prepare(
      'DELETE FROM evidence WHERE linked_asset_id = ? AND trust_id = ?'
    )
      .bind(assetId, trustId)
      .run();

    // Delete the asset
    await env.DB.prepare(
      'DELETE FROM asset WHERE id = ? AND trust_id = ?'
    )
      .bind(assetId, trustId)
      .run();

    // Log audit — logAudit(db, entry) expects D1Database as first arg
    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'delete',
      entity_type: 'asset',
      entity_id: assetId,
      details: JSON.stringify({ before }),
      ip_address: request.headers.get('CF-Connecting-IP') ?? null,
    });

    return jsonResponse({ message: 'Asset deleted successfully' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete asset';
    return errorResponse(message, 500);
  }
}
