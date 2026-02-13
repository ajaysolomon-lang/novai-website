import type { Env, SessionData } from '../types/index';
import { logAudit } from '../middleware/audit';
import { jsonResponse, errorResponse, notFoundResponse } from '../utils/response';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface ProviderWithVerifications {
  id: string;
  name: string;
  specialty: string;
  state: string;
  county: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  verifications: ProviderVerificationRow[];
  why_shown: string;
}

interface ProviderVerificationRow {
  id: string;
  provider_id: string;
  verification_type: string;
  official_url: string;
  license_number: string | null;
  issuing_body: string | null;
  verified_at: string | null;
  expires_at: string | null;
  verified_by: string | null;
  notes: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Human-readable specialty labels for the `why_shown` explanation.
 */
const SPECIALTY_LABELS: Record<string, string> = {
  estate_attorney: 'estate attorney',
  trust_attorney: 'trust attorney',
  financial_advisor: 'financial advisor',
  cpa: 'CPA',
  insurance_agent: 'insurance agent',
  real_estate_attorney: 'real estate attorney',
  elder_law: 'elder law attorney',
  business_attorney: 'business attorney',
};

/**
 * Build the `why_shown` string explaining why a provider appeared in results.
 * Incorporates provider details and their verification records.
 */
function buildWhyShown(
  provider: { name: string; specialty: string; state: string; county: string | null },
  verifications: ProviderVerificationRow[]
): string {
  const specialtyLabel = SPECIALTY_LABELS[provider.specialty] ?? provider.specialty;
  const location = provider.county
    ? `${provider.county} County, ${provider.state}`
    : provider.state;

  let reason = `Verified ${specialtyLabel} in ${location}.`;

  // Append verification details.
  if (verifications.length > 0) {
    const verificationDetails = verifications
      .map((v) => {
        const type = v.verification_type.replace(/_/g, ' ');
        const issuer = v.issuing_body ? ` via ${v.issuing_body}` : '';
        return `${type} verified${issuer}`;
      })
      .join('; ');
    reason += ` ${verificationDetails}.`;
  }

  return reason;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * GET /providers?county=&state=&specialty=
 *
 * Search the provider directory. All filter parameters are optional.
 * Only returns providers that have at least one verification record,
 * ensuring we only surface vetted professionals.
 *
 * Query parameters:
 *   - county?: string — filter by county
 *   - state?: string — filter by state
 *   - specialty?: string — filter by specialty type
 */
export async function search(
  request: Request,
  env: Env,
  _params: Record<string, string>,
  _session: SessionData
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const county = url.searchParams.get('county');
    const state = url.searchParams.get('state');
    const specialty = url.searchParams.get('specialty');

    // Build the WHERE clause dynamically based on provided filters.
    const conditions: string[] = ['p.active = 1'];
    const bindings: string[] = [];

    if (state) {
      conditions.push('p.state = ?');
      bindings.push(state);
    }

    if (county) {
      conditions.push('p.county = ?');
      bindings.push(county);
    }

    if (specialty) {
      conditions.push('p.specialty = ?');
      bindings.push(specialty);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Fetch providers that have at least one verification record.
    // The INNER JOIN ensures only verified providers are returned.
    const providerRows = await env.DB
      .prepare(
        `SELECT DISTINCT
          p.id, p.name, p.specialty, p.state, p.county, p.city,
          p.phone, p.email, p.website, p.description, p.active,
          p.created_at, p.updated_at
        FROM providers p
        INNER JOIN provider_verification pv ON pv.provider_id = p.id
        ${whereClause}
        ORDER BY p.name ASC
        LIMIT 50`
      )
      .bind(...bindings)
      .all<{
        id: string;
        name: string;
        specialty: string;
        state: string;
        county: string | null;
        city: string | null;
        phone: string | null;
        email: string | null;
        website: string | null;
        description: string | null;
        active: number;
        created_at: string;
        updated_at: string;
      }>();

    const providers = providerRows.results ?? [];

    // For each provider, fetch their verification records.
    const results: ProviderWithVerifications[] = [];

    for (const provider of providers) {
      const verificationRows = await env.DB
        .prepare(
          `SELECT id, provider_id, verification_type, official_url,
                  license_number, issuing_body, verified_at, expires_at,
                  verified_by, notes
           FROM provider_verification
           WHERE provider_id = ?
           ORDER BY verified_at DESC`
        )
        .bind(provider.id)
        .all<ProviderVerificationRow>();

      const verifications = verificationRows.results ?? [];

      results.push({
        id: provider.id,
        name: provider.name,
        specialty: provider.specialty,
        state: provider.state,
        county: provider.county,
        city: provider.city,
        phone: provider.phone,
        email: provider.email,
        website: provider.website,
        description: provider.description,
        active: provider.active === 1,
        created_at: provider.created_at,
        updated_at: provider.updated_at,
        verifications,
        why_shown: buildWhyShown(provider, verifications),
      });
    }

    return jsonResponse(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to search providers';
    return errorResponse(message, 500);
  }
}

/**
 * POST /providers
 *
 * Create a new provider with an initial verification record.
 * MVP: any authenticated user can add providers.
 *
 * Body:
 *   - name: string (required)
 *   - specialty: string (required)
 *   - state: string (required)
 *   - county?: string
 *   - city?: string
 *   - phone?: string
 *   - email?: string
 *   - website?: string
 *   - description?: string
 *   - verification: object (required)
 *     - verification_type: string (required)
 *     - official_url: string (required)
 *     - license_number?: string
 *     - issuing_body?: string
 *     - notes?: string
 */
export async function create(
  request: Request,
  env: Env,
  _params: Record<string, string>,
  session: SessionData
): Promise<Response> {
  try {
    const body = await request.json<{
      name: string;
      specialty: string;
      state: string;
      county?: string;
      city?: string;
      phone?: string;
      email?: string;
      website?: string;
      description?: string;
      verification: {
        verification_type: string;
        official_url: string;
        license_number?: string;
        issuing_body?: string;
        notes?: string;
      };
    }>();

    // Validate required provider fields.
    if (!body.name || !body.specialty || !body.state) {
      return errorResponse('name, specialty, and state are required');
    }

    // Validate specialty value.
    const validSpecialties = [
      'estate_attorney', 'trust_attorney', 'financial_advisor', 'cpa',
      'insurance_agent', 'real_estate_attorney', 'elder_law', 'business_attorney',
    ];
    if (!validSpecialties.includes(body.specialty)) {
      return errorResponse(
        `specialty must be one of: ${validSpecialties.join(', ')}`
      );
    }

    // Validate required verification fields.
    if (!body.verification || !body.verification.verification_type || !body.verification.official_url) {
      return errorResponse(
        'verification.verification_type and verification.official_url are required'
      );
    }

    const validVerificationTypes = [
      'bar_membership', 'license', 'certification',
      'referral_service', 'professional_association',
    ];
    if (!validVerificationTypes.includes(body.verification.verification_type)) {
      return errorResponse(
        `verification_type must be one of: ${validVerificationTypes.join(', ')}`
      );
    }

    const now = new Date().toISOString();
    const providerId = crypto.randomUUID();
    const verificationId = crypto.randomUUID();

    // Insert the provider.
    await env.DB
      .prepare(
        `INSERT INTO providers (
          id, name, specialty, state, county, city,
          phone, email, website, description, active,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .bind(
        providerId,
        body.name,
        body.specialty,
        body.state,
        body.county ?? null,
        body.city ?? null,
        body.phone ?? null,
        body.email ?? null,
        body.website ?? null,
        body.description ?? null,
        now,
        now
      )
      .run();

    // Insert the verification record.
    await env.DB
      .prepare(
        `INSERT INTO provider_verification (
          id, provider_id, verification_type, official_url,
          license_number, issuing_body, verified_at, verified_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        verificationId,
        providerId,
        body.verification.verification_type,
        body.verification.official_url,
        body.verification.license_number ?? null,
        body.verification.issuing_body ?? null,
        now,
        session.user_id,
        body.verification.notes ?? null
      )
      .run();

    // Log audit — logAudit expects Omit<AuditLogEntry, 'id' | 'created_at'>
    await logAudit(env.DB, {
      trust_id: '__global__',
      user_id: session.user_id,
      action: 'create',
      entity_type: 'provider',
      entity_id: providerId,
      details: JSON.stringify({
        name: body.name,
        specialty: body.specialty,
        state: body.state,
        county: body.county ?? null,
      }),
      ip_address: request.headers.get('CF-Connecting-IP') ?? null,
    });

    return jsonResponse(
      {
        id: providerId,
        name: body.name,
        specialty: body.specialty,
        state: body.state,
        county: body.county ?? null,
        city: body.city ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        website: body.website ?? null,
        description: body.description ?? null,
        active: true,
        created_at: now,
        updated_at: now,
        verification: {
          id: verificationId,
          provider_id: providerId,
          verification_type: body.verification.verification_type,
          official_url: body.verification.official_url,
          license_number: body.verification.license_number ?? null,
          issuing_body: body.verification.issuing_body ?? null,
          verified_at: now,
          verified_by: session.user_id,
          notes: body.verification.notes ?? null,
        },
      },
      201
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create provider';
    return errorResponse(message, 500);
  }
}

/**
 * PUT /providers/:provider_id
 *
 * Update an existing provider's fields.
 * MVP: any authenticated user can update providers.
 * Logs before/after state for audit compliance.
 *
 * Body (all optional — only provided fields are updated):
 *   - name?: string
 *   - specialty?: string
 *   - state?: string
 *   - county?: string
 *   - city?: string
 *   - phone?: string
 *   - email?: string
 *   - website?: string
 *   - description?: string
 *   - active?: boolean
 */
export async function update(
  request: Request,
  env: Env,
  params: Record<string, string>,
  session: SessionData
): Promise<Response> {
  try {
    const providerId = params.provider_id;

    if (!providerId) {
      return errorResponse('provider_id is required');
    }

    // Fetch the current provider state for before/after audit logging.
    const existing = await env.DB
      .prepare(
        `SELECT id, name, specialty, state, county, city, phone, email,
                website, description, active, created_at, updated_at
         FROM providers
         WHERE id = ?`
      )
      .bind(providerId)
      .first<{
        id: string;
        name: string;
        specialty: string;
        state: string;
        county: string | null;
        city: string | null;
        phone: string | null;
        email: string | null;
        website: string | null;
        description: string | null;
        active: number;
        created_at: string;
        updated_at: string;
      }>();

    if (!existing) {
      return notFoundResponse('Provider');
    }

    const body = await request.json<{
      name?: string;
      specialty?: string;
      state?: string;
      county?: string;
      city?: string;
      phone?: string;
      email?: string;
      website?: string;
      description?: string;
      active?: boolean;
    }>();

    // Validate specialty if provided.
    if (body.specialty) {
      const validSpecialties = [
        'estate_attorney', 'trust_attorney', 'financial_advisor', 'cpa',
        'insurance_agent', 'real_estate_attorney', 'elder_law', 'business_attorney',
      ];
      if (!validSpecialties.includes(body.specialty)) {
        return errorResponse(
          `specialty must be one of: ${validSpecialties.join(', ')}`
        );
      }
    }

    // Build the SET clause dynamically from provided fields.
    const updates: string[] = [];
    const bindings: (string | number | null)[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      bindings.push(body.name);
    }
    if (body.specialty !== undefined) {
      updates.push('specialty = ?');
      bindings.push(body.specialty);
    }
    if (body.state !== undefined) {
      updates.push('state = ?');
      bindings.push(body.state);
    }
    if (body.county !== undefined) {
      updates.push('county = ?');
      bindings.push(body.county);
    }
    if (body.city !== undefined) {
      updates.push('city = ?');
      bindings.push(body.city);
    }
    if (body.phone !== undefined) {
      updates.push('phone = ?');
      bindings.push(body.phone);
    }
    if (body.email !== undefined) {
      updates.push('email = ?');
      bindings.push(body.email);
    }
    if (body.website !== undefined) {
      updates.push('website = ?');
      bindings.push(body.website);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      bindings.push(body.description);
    }
    if (body.active !== undefined) {
      updates.push('active = ?');
      bindings.push(body.active ? 1 : 0);
    }

    if (updates.length === 0) {
      return errorResponse('No fields provided to update');
    }

    const now = new Date().toISOString();
    updates.push('updated_at = ?');
    bindings.push(now);

    // Add the WHERE clause binding.
    bindings.push(providerId);

    await env.DB
      .prepare(`UPDATE providers SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...bindings)
      .run();

    // Fetch the updated provider.
    const updated = await env.DB
      .prepare(
        `SELECT id, name, specialty, state, county, city, phone, email,
                website, description, active, created_at, updated_at
         FROM providers
         WHERE id = ?`
      )
      .bind(providerId)
      .first<{
        id: string;
        name: string;
        specialty: string;
        state: string;
        county: string | null;
        city: string | null;
        phone: string | null;
        email: string | null;
        website: string | null;
        description: string | null;
        active: number;
        created_at: string;
        updated_at: string;
      }>();

    // Log audit with before/after snapshots — logAudit expects Omit<AuditLogEntry, 'id' | 'created_at'>
    await logAudit(env.DB, {
      trust_id: '__global__',
      user_id: session.user_id,
      action: 'update',
      entity_type: 'provider',
      entity_id: providerId,
      details: JSON.stringify({ before: existing, after: updated }),
      ip_address: request.headers.get('CF-Connecting-IP') ?? null,
    });

    return jsonResponse({
      ...updated,
      active: updated ? updated.active === 1 : existing.active === 1,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update provider';
    return errorResponse(message, 500);
  }
}
