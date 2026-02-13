import type { Citation } from '../types/index';

// ─── Legal Disclaimer ────────────────────────────────────────────────────────

const LEGAL_DISCLAIMER =
  'This information is for educational purposes only and does not constitute ' +
  'legal advice. Consult a qualified attorney for guidance specific to your situation.';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ChunkResult {
  chunk_id: string;
  source_type: 'user_document' | 'verified_source';
  source_id: string | null;
  source_doc_id: string | null;
  content: string;
  relevance_score: number;
  metadata: Record<string, unknown>;
}

export interface RAGQueryResult {
  chunks: ChunkResult[];
  citations: Citation[];
  has_data_gap: boolean;
  data_gap_message: string | null;
  disclaimer: string;
}

export interface VerifiedSource {
  source_id: string;
  title: string;
  content: string;
  category: string;
  jurisdiction?: string;
  effective_date?: string;
  url?: string;
}

// ─── Stop Words ──────────────────────────────────────────────────────────────
// Common English stop words that add no search value.

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'as', 'be', 'was', 'were',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'this',
  'that', 'these', 'those', 'am', 'are', 'not', 'no', 'if', 'so',
  'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'than', 'too', 'very', 'just', 'about', 'above',
  'after', 'before', 'between', 'into', 'through', 'during', 'out',
  'up', 'down', 'then', 'once', 'here', 'there', 'any', 'its', 'my',
  'your', 'our', 'their', 'his', 'her', 'i', 'me', 'we', 'you', 'he',
  'she', 'they', 'them', 'us',
]);

// ─── Text Chunking ───────────────────────────────────────────────────────────

/**
 * Split text into chunks of approximately `chunkSize` characters with
 * `overlap` characters of overlap between consecutive chunks.
 *
 * The algorithm prefers to split on paragraph boundaries (\n\n), then
 * sentence boundaries (. ! ?), then falls back to the raw character limit.
 * This keeps semantic units together when possible.
 */
export function chunkText(
  text: string,
  chunkSize: number = 500,
  overlap: number = 50
): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const trimmed = text.trim();

  // If the entire text fits in one chunk, return it as-is.
  if (trimmed.length <= chunkSize) {
    return [trimmed];
  }

  const chunks: string[] = [];
  let position = 0;

  while (position < trimmed.length) {
    // Determine the end boundary for this chunk.
    let end = Math.min(position + chunkSize, trimmed.length);

    // If we haven't reached the end of the text, try to split at a
    // natural boundary rather than mid-word.
    if (end < trimmed.length) {
      const window = trimmed.substring(position, end);

      // 1. Try paragraph boundary (double newline).
      const paragraphBreak = window.lastIndexOf('\n\n');
      if (paragraphBreak > chunkSize * 0.3) {
        end = position + paragraphBreak + 2; // include the newlines
      } else {
        // 2. Try sentence boundary.
        const sentenceMatch = window.match(/.*[.!?]\s/s);
        if (sentenceMatch && sentenceMatch[0].length > chunkSize * 0.3) {
          end = position + sentenceMatch[0].length;
        } else {
          // 3. Try word boundary (last space).
          const lastSpace = window.lastIndexOf(' ');
          if (lastSpace > chunkSize * 0.3) {
            end = position + lastSpace + 1;
          }
          // Otherwise, hard break at chunkSize.
        }
      }
    }

    const chunk = trimmed.substring(position, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Advance position, stepping back by the overlap amount so adjacent
    // chunks share context at their boundary.
    const step = end - position;
    position += Math.max(step - overlap, 1);
  }

  return chunks;
}

// ─── Keyword Extraction ──────────────────────────────────────────────────────

/**
 * Extract meaningful keywords from a query string.
 *
 * Removes stop words, lowercases, strips non-alphanumeric characters, and
 * deduplicates. Returns only words with 2+ characters.
 */
function extractKeywords(query: string): string[] {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));

  // Deduplicate while preserving order.
  return [...new Set(words)];
}

// ─── Document Ingestion ──────────────────────────────────────────────────────

/**
 * Chunk content and store each chunk in the `doc_chunks` table.
 *
 * Returns an array of the generated chunk IDs so callers can reference them
 * (e.g., for citation linking).
 */
export async function ingestDocument(
  db: D1Database,
  params: {
    trust_id: string;
    user_id: string;
    source_doc_id?: string;
    source_evidence_id?: string;
    source_type: 'user_document' | 'verified_source';
    source_id?: string;
    content: string;
  }
): Promise<string[]> {
  const chunks = chunkText(params.content);
  const chunkIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkId = crypto.randomUUID();
    chunkIds.push(chunkId);

    const metadata = JSON.stringify({
      chunk_index: i,
      total_chunks: chunks.length,
      char_length: chunks[i].length,
    });

    await db
      .prepare(
        `INSERT INTO doc_chunk (
          id, trust_id, user_id, source_doc_id, source_evidence_id,
          source_type, source_id, chunk_index, content, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        chunkId,
        params.trust_id,
        params.user_id,
        params.source_doc_id ?? null,
        params.source_evidence_id ?? null,
        params.source_type,
        params.source_id ?? null,
        i,
        chunks[i],
        metadata
      )
      .run();
  }

  return chunkIds;
}

// ─── Chunk Query (Keyword-based MVP) ─────────────────────────────────────────

/**
 * Search `doc_chunks` for chunks relevant to the given query.
 *
 * MVP implementation: keyword-based SQL LIKE matching. Each chunk is scored
 * by the number of distinct query keywords it contains. This can be upgraded
 * to vector similarity search (e.g., Vectorize) in a future release without
 * changing the interface.
 *
 * Always includes the legal disclaimer in the result.
 */
export async function queryChunks(
  db: D1Database,
  params: {
    trust_id: string;
    query: string;
    source_type?: string;
    limit?: number;
  }
): Promise<RAGQueryResult> {
  const limit = params.limit ?? 10;
  const keywords = extractKeywords(params.query);

  // If no meaningful keywords remain after filtering, return a data gap.
  if (keywords.length === 0) {
    return {
      chunks: [],
      citations: [],
      has_data_gap: true,
      data_gap_message:
        'No meaningful search terms could be extracted from the query. ' +
        'Please try rephrasing with more specific terms.',
      disclaimer: LEGAL_DISCLAIMER,
    };
  }

  // Build a query that matches any keyword, then score by match count.
  // We use a UNION approach: for each keyword, find matching chunks, then
  // aggregate to count how many keywords each chunk matched.
  //
  // SQL structure:
  //   SELECT id, ..., COUNT(*) as match_count
  //   FROM (
  //     SELECT * FROM doc_chunk WHERE trust_id = ? AND content LIKE ?
  //     UNION ALL
  //     SELECT * FROM doc_chunk WHERE trust_id = ? AND content LIKE ?
  //     ...
  //   )
  //   GROUP BY id
  //   ORDER BY match_count DESC
  //   LIMIT ?

  const unionParts: string[] = [];
  const bindValues: (string | number)[] = [];

  const sourceFilter = params.source_type
    ? ' AND source_type = ?'
    : '';

  for (const keyword of keywords) {
    unionParts.push(
      `SELECT id, trust_id, source_type, source_id, source_doc_id, content, metadata
       FROM doc_chunk
       WHERE trust_id = ?${sourceFilter}
         AND LOWER(content) LIKE ?`
    );
    bindValues.push(params.trust_id);
    if (params.source_type) {
      bindValues.push(params.source_type);
    }
    bindValues.push(`%${keyword}%`);
  }

  const sql = `
    SELECT
      id,
      source_type,
      source_id,
      source_doc_id,
      content,
      metadata,
      COUNT(*) as match_count
    FROM (
      ${unionParts.join(' UNION ALL ')}
    )
    GROUP BY id
    ORDER BY match_count DESC, id ASC
    LIMIT ?
  `;
  bindValues.push(limit);

  const result = await db
    .prepare(sql)
    .bind(...bindValues)
    .all<{
      id: string;
      source_type: 'user_document' | 'verified_source';
      source_id: string | null;
      source_doc_id: string | null;
      content: string;
      metadata: string | null;
      match_count: number;
    }>();

  const rows = result.results ?? [];

  // Normalize scores: highest match count = 1.0, scale others proportionally.
  const maxMatches = rows.length > 0 ? rows[0].match_count : 1;

  const chunks: ChunkResult[] = rows.map((row) => ({
    chunk_id: row.id,
    source_type: row.source_type,
    source_id: row.source_id,
    source_doc_id: row.source_doc_id,
    content: row.content,
    relevance_score: parseFloat((row.match_count / maxMatches).toFixed(3)),
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {},
  }));

  // Build citations from matching chunks.
  const citations: Citation[] = chunks.map((chunk) => ({
    chunk_id: chunk.chunk_id,
    source_id: chunk.source_id ?? undefined,
    text_snippet: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
  }));

  // Determine data gap status.
  const hasDataGap = chunks.length < 2;
  const dataGapMessage = hasDataGap
    ? 'Limited information found for this query. Results may be incomplete. ' +
      'Consider uploading additional documents or refining your search terms.'
    : null;

  return {
    chunks,
    citations,
    has_data_gap: hasDataGap,
    data_gap_message: dataGapMessage,
    disclaimer: LEGAL_DISCLAIMER,
  };
}

// ─── Verified Source Ingestion ────────────────────────────────────────────────

/**
 * Ingest an array of verified (curated) sources into `doc_chunks`.
 *
 * Each source is chunked and stored with `source_type = 'verified_source'`
 * and the source's `source_id` set for traceability.
 *
 * This is intended to be called during database seeding to pre-populate
 * the RAG index with authoritative reference material (e.g., state-specific
 * trust funding rules, probate thresholds, legal checklists).
 *
 * Uses a sentinel `trust_id` of '__global__' and `user_id` of '__system__'
 * for verified sources that are not tenant-specific.
 */
export async function ingestVerifiedSources(
  db: D1Database,
  sources: VerifiedSource[]
): Promise<void> {
  for (const source of sources) {
    const chunks = chunkText(source.content);

    for (let i = 0; i < chunks.length; i++) {
      const chunkId = crypto.randomUUID();

      const metadata = JSON.stringify({
        chunk_index: i,
        total_chunks: chunks.length,
        char_length: chunks[i].length,
        title: source.title,
        category: source.category,
        jurisdiction: source.jurisdiction ?? null,
        effective_date: source.effective_date ?? null,
        url: source.url ?? null,
      });

      await db
        .prepare(
          `INSERT INTO doc_chunk (
            id, trust_id, user_id, source_doc_id, source_evidence_id,
            source_type, source_id, chunk_index, content, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          chunkId,
          '__global__',       // verified sources are not tenant-specific
          '__system__',       // system-ingested, no real user
          null,               // no source_doc_id
          null,               // no source_evidence_id
          'verified_source',
          source.source_id,
          i,
          chunks[i],
          metadata
        )
        .run();
    }
  }
}
