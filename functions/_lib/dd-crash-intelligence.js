import { readSession } from './auth.js';
import { isCmsOwner } from './content.js';

export const DD_FORMAT = 'daw-detectives-crash-intelligence';
export const DD_SCHEMA_VERSION = 1;
export const DD_PLATFORMS = Object.freeze(['windows', 'macos']);
export const DD_EVIDENCE = Object.freeze(['verified', 'supported', 'provisional', 'research', 'retired']);
export const DD_CONFIDENCE = Object.freeze(['low', 'medium', 'high']);
export const DD_SOURCE_CATEGORIES = Object.freeze(['primary-official', 'vendor-support', 'verified-technical', 'community-evidence', 'internal-dd-research']);
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,95}$/;

export const ddJson = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
export const ddError = (message, status = 400) => ddJson({ error: message }, status);

export const requireDdOwner = async (request, env) => {
  if (!env.DD_INTELLIGENCE_DB) throw Object.assign(new Error('Crash Intelligence store is unavailable.'), { status: 503 });
  const session = await readSession(request, env);
  if (!session?.subject) throw Object.assign(new Error('Owner sign-in is required.'), { status: 401 });
  if (!isCmsOwner(env, session.subject)) throw Object.assign(new Error('This account is not authorised to manage Crash Intelligence.'), { status: 403 });
  return session.subject;
};

const text = (value, maximum = 4000, required = false) => {
  if (typeof value !== 'string') { if (required) throw new Error('A required text value is missing.'); return ''; }
  const clean = value.trim().replace(/\r\n?/g, '\n');
  if ((required && !clean) || clean.length > maximum) throw new Error('A text value is invalid.');
  return clean;
};
const id = (value) => { const clean = text(value, 96, true); if (!ID_PATTERN.test(clean)) throw new Error('Stable IDs must use lowercase letters, numbers and hyphens.'); return clean; };
const array = (value, allowed, maximum = 50) => {
  if (!Array.isArray(value) || value.length > maximum || value.some((entry) => typeof entry !== 'string')) throw new Error('A list value is invalid.');
  const result = [...new Set(value.map((entry) => entry.trim()).filter(Boolean))];
  if (allowed && result.some((entry) => !allowed.includes(entry))) throw new Error('A list contains an unsupported value.');
  return result;
};
const strings = (value, maximum = 50) => array(value, null, maximum).map((entry) => text(entry, 300, true));
const json = (value) => JSON.stringify(value);
const parse = (value, fallback = []) => { try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; } };

export const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
export const sha256 = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, '0')).join('');

export const validateSource = (input) => ({
  id: id(input.id), title: text(input.title, 240, true), organisation: text(input.organisation, 240), url: text(input.url, 2000),
  category: (() => { const value = text(input.category, 80, true); if (!DD_SOURCE_CATEGORIES.includes(value)) throw new Error('Source category is invalid.'); return value; })(),
  platforms: array(input.platforms || [], DD_PLATFORMS), daws: strings(input.daws || []), notes: text(input.notes, 4000), lastCheckedAt: text(input.lastCheckedAt, 40), active: input.active !== false,
});

export const validateKnowledge = (input) => {
  const evidenceStatus = text(input.evidenceStatus, 40, true); const confidence = text(input.confidence, 20, true);
  if (!DD_EVIDENCE.includes(evidenceStatus) || !DD_CONFIDENCE.includes(confidence)) throw new Error('Evidence status or confidence is invalid.');
  const publicationState = text(input.publicationState || 'draft', 20, true);
  if (!['draft', 'approved', 'retired'].includes(publicationState)) throw new Error('Publication state is invalid.');
  const platforms = array(input.platforms, DD_PLATFORMS);
  if (!platforms.length) throw new Error('At least one platform is required.');
  const dawApplicability = (input.dawApplicability || []).map((entry) => ({ dawId: id(entry.dawId), versionMin: text(entry.versionMin, 80), versionMax: text(entry.versionMax, 80) }));
  if (new Set(dawApplicability.map((entry) => entry.dawId)).size !== dawApplicability.length) throw new Error('DAW applicability contains a duplicate DAW.');
  const record = {
    id: id(input.id), title: text(input.title, 240, true), platforms, dawApplicability,
    osVersionMin: text(input.osVersionMin, 80), osVersionMax: text(input.osVersionMax, 80), exceptionCode: text(input.exceptionCode, 160), canonicalName: text(input.canonicalName, 240), plainEnglishMeaning: text(input.plainEnglishMeaning, 1600, true), eventType: text(input.eventType, 160), faultModules: strings(input.faultModules || []), pluginVendorEvidence: strings(input.pluginVendorEvidence || []), causeCategories: strings(input.causeCategories || []), safeGuidance: text(input.safeGuidance, 4000, true), dawSpecificNotes: text(input.dawSpecificNotes, 4000), limitations: text(input.limitations, 4000), confidence, evidenceStatus, sourceIds: strings(input.sourceIds || []), internalResearchNotes: text(input.internalResearchNotes, 6000), futureRule: input.futureRule && typeof input.futureRule === 'object' && !Array.isArray(input.futureRule) ? input.futureRule : {}, publicationState, retired: Boolean(input.retired), lastReviewedAt: text(input.lastReviewedAt, 40),
  };
  if (record.publicationState === 'approved' && !record.sourceIds.length) throw new Error('Approved knowledge requires at least one source.');
  return record;
};

const sourceProjection = (row, daws) => ({ id: row.id, title: row.title, organisation: row.organisation, url: row.url, category: row.category, platforms: parse(row.platforms_json), daws, notes: row.notes, lastCheckedAt: row.last_checked_at, active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at });
export const knowledgeProjection = (row, daws, sourceIds, includeInternal = true) => ({ id: row.id, title: row.title, platforms: parse(row.platforms_json), dawApplicability: daws, osVersionMin: row.os_version_min, osVersionMax: row.os_version_max, exceptionCode: row.exception_code, canonicalName: row.canonical_name, plainEnglishMeaning: row.plain_english_meaning, eventType: row.event_type, faultModules: parse(row.fault_modules_json), pluginVendorEvidence: parse(row.plugin_vendor_evidence_json), causeCategories: parse(row.cause_categories_json), safeGuidance: row.safe_guidance, dawSpecificNotes: row.daw_specific_notes, limitations: row.limitations, confidence: row.confidence, evidenceStatus: row.evidence_status, sourceIds, publicationState: row.publication_state, retired: Boolean(row.retired), createdAt: row.created_at, updatedAt: row.updated_at, lastReviewedAt: row.last_reviewed_at, ...(includeInternal ? { internalResearchNotes: row.internal_research_notes, futureRule: parse(row.future_rule_json, {}) } : {}) });

const getDawLinks = async (database, table, parentField) => {
  const rows = await database.prepare(`SELECT ${parentField} AS parent_id, daw_id, daw_version_min, daw_version_max FROM ${table}`).all();
  return (rows.results || []).reduce((result, row) => { (result[row.parent_id] ||= []).push({ dawId: row.daw_id, versionMin: row.daw_version_min || '', versionMax: row.daw_version_max || '' }); return result; }, {});
};
const getSourceLinks = async (database) => {
  const rows = await database.prepare('SELECT knowledge_id, source_id FROM dd_knowledge_sources').all();
  return (rows.results || []).reduce((result, row) => { (result[row.knowledge_id] ||= []).push(row.source_id); return result; }, {});
};

export const listAdminState = async (database, query = {}) => {
  const page = Math.max(1, Number(query.page) || 1); const limit = Math.min(100, Math.max(1, Number(query.limit) || 25)); const offset = (page - 1) * limit;
  const filters = []; const bindings = [];
  if (query.search) { filters.push('(title LIKE ? OR exception_code LIKE ? OR canonical_name LIKE ? OR fault_modules_json LIKE ?)'); const term = `%${String(query.search).slice(0, 120)}%`; bindings.push(term, term, term, term); }
  if (query.platform && DD_PLATFORMS.includes(query.platform)) { filters.push('platforms_json LIKE ?'); bindings.push(`%${query.platform}%`); }
  if (query.daw) { filters.push('id IN (SELECT knowledge_id FROM dd_knowledge_daws WHERE daw_id = ?)'); bindings.push(String(query.daw).slice(0, 96)); }
  if (query.dawVersion) { filters.push("id IN (SELECT knowledge_id FROM dd_knowledge_daws WHERE (daw_version_min = '' OR daw_version_min <= ?) AND (daw_version_max = '' OR daw_version_max >= ?))"); const version = String(query.dawVersion).slice(0, 80); bindings.push(version, version); }
  if (query.code) { filters.push('exception_code LIKE ?'); bindings.push(`%${String(query.code).slice(0, 120)}%`); }
  if (query.module) { filters.push('fault_modules_json LIKE ?'); bindings.push(`%${String(query.module).slice(0, 120)}%`); }
  if (query.confidence && DD_CONFIDENCE.includes(query.confidence)) { filters.push('confidence = ?'); bindings.push(query.confidence); }
  if (query.evidence && DD_EVIDENCE.includes(query.evidence)) { filters.push('evidence_status = ?'); bindings.push(query.evidence); }
  if (query.reviewNeeded === 'yes') filters.push("(last_reviewed_at IS NULL OR last_reviewed_at = '' OR evidence_status = 'provisional')");
  if (query.published === 'yes') filters.push("publication_state = 'approved' AND retired = 0");
  if (query.published === 'no') filters.push("publication_state <> 'approved' OR retired = 1");
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [countRow, knowledgeRows, sourceRows, researchRows, daws, manifest, versions, knowledgeStateRows] = await Promise.all([
    database.prepare(`SELECT COUNT(*) AS count FROM dd_knowledge_records ${where}`).bind(...bindings).first(),
    database.prepare(`SELECT * FROM dd_knowledge_records ${where} ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?`).bind(...bindings, limit, offset).all(),
    database.prepare('SELECT * FROM dd_sources ORDER BY active DESC, title COLLATE NOCASE ASC').all(),
    database.prepare('SELECT * FROM dd_research_records ORDER BY updated_at DESC, id ASC LIMIT 100').all(),
    database.prepare('SELECT id, name, active FROM dd_daws ORDER BY name').all(),
    database.prepare('SELECT m.current_version,m.updated_at_utc,v.dataset_json FROM dd_current_manifest m LEFT JOIN dd_database_versions v ON v.version=m.current_version WHERE m.singleton = 1').first(),
    database.prepare('SELECT version,schema_version,content_sha256,content_size_bytes,published_at_utc,record_count,source_count FROM dd_database_versions ORDER BY version DESC LIMIT 25').all(),
    database.prepare('SELECT id,updated_at,publication_state,retired FROM dd_knowledge_records').all(),
  ]);
  const [knowledgeDaws, sourceLinks] = await Promise.all([getDawLinks(database, 'dd_knowledge_daws', 'knowledge_id'), getSourceLinks(database)]);
  const sourceDawRows = await database.prepare('SELECT source_id, daw_id FROM dd_source_daws').all();
  const sourceDaws = (sourceDawRows.results || []).reduce((result, row) => { (result[row.source_id] ||= []).push(row.daw_id); return result; }, {});
  const knowledge = (knowledgeRows.results || []).map((row) => knowledgeProjection(row, knowledgeDaws[row.id] || [], sourceLinks[row.id] || []));
  const sources = (sourceRows.results || []).map((row) => sourceProjection(row, sourceDaws[row.id] || []));
  const publishedUpdatedAt = new Map((parse(manifest?.dataset_json, {}).records || []).map((record) => [record.id, record.updatedAt]));
  const unpublishedChanges = (knowledgeStateRows.results || []).some((record) => record.publication_state !== 'approved' || Boolean(record.retired) || publishedUpdatedAt.get(record.id) !== record.updated_at);
  return { overview: { currentVersion: manifest?.current_version || null, lastPublishAt: manifest?.updated_at_utc || null, knowledgeRecords: Number(countRow?.count || 0), daws: (daws.results || []).length, sources: sources.length, needingReview: knowledge.filter((record) => !record.lastReviewedAt || record.evidenceStatus === 'provisional').length, unpublishedChanges }, page, limit, total: Number(countRow?.count || 0), knowledge, sources, research: (researchRows.results || []).map((row) => ({ id: row.id, title: row.title, candidateFindings: row.candidate_findings, links: parse(row.links_json), internalNotes: row.internal_notes, aiSuggestions: row.ai_suggestions, reviewStatus: row.review_status, createdAt: row.created_at, updatedAt: row.updated_at })), daws: daws.results || [], versions: versions.results || [] };
};

const ensureIdsExist = async (database, table, ids) => { if (!ids.length) return; const placeholders = ids.map(() => '?').join(','); const rows = await database.prepare(`SELECT id FROM ${table} WHERE id IN (${placeholders})`).bind(...ids).all(); if ((rows.results || []).length !== ids.length) throw new Error(`One or more referenced ${table} records do not exist.`); };
export const saveSource = async (database, input, subject) => { const source = validateSource(input); await ensureIdsExist(database, 'dd_daws', source.daws); const now = new Date().toISOString(); await database.batch([database.prepare(`INSERT INTO dd_sources (id,title,organisation,url,category,platforms_json,notes,last_checked_at,active,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,organisation=excluded.organisation,url=excluded.url,category=excluded.category,platforms_json=excluded.platforms_json,notes=excluded.notes,last_checked_at=excluded.last_checked_at,active=excluded.active,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(source.id, source.title, source.organisation, source.url, source.category, json(source.platforms), source.notes, source.lastCheckedAt || null, source.active ? 1 : 0, now, now, subject, subject), database.prepare('DELETE FROM dd_source_daws WHERE source_id = ?').bind(source.id), ...source.daws.map((dawId) => database.prepare('INSERT INTO dd_source_daws (source_id,daw_id) VALUES (?,?)').bind(source.id, dawId))]); return source; };
export const saveKnowledge = async (database, input, subject) => { const record = validateKnowledge(input); await ensureIdsExist(database, 'dd_daws', record.dawApplicability.map((entry) => entry.dawId)); await ensureIdsExist(database, 'dd_sources', record.sourceIds); const now = new Date().toISOString(); await database.batch([database.prepare(`INSERT INTO dd_knowledge_records (id,title,platforms_json,os_version_min,os_version_max,exception_code,canonical_name,plain_english_meaning,event_type,fault_modules_json,plugin_vendor_evidence_json,cause_categories_json,safe_guidance,daw_specific_notes,limitations,confidence,evidence_status,publication_state,internal_research_notes,future_rule_json,retired,created_at,updated_at,last_reviewed_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,platforms_json=excluded.platforms_json,os_version_min=excluded.os_version_min,os_version_max=excluded.os_version_max,exception_code=excluded.exception_code,canonical_name=excluded.canonical_name,plain_english_meaning=excluded.plain_english_meaning,event_type=excluded.event_type,fault_modules_json=excluded.fault_modules_json,plugin_vendor_evidence_json=excluded.plugin_vendor_evidence_json,cause_categories_json=excluded.cause_categories_json,safe_guidance=excluded.safe_guidance,daw_specific_notes=excluded.daw_specific_notes,limitations=excluded.limitations,confidence=excluded.confidence,evidence_status=excluded.evidence_status,publication_state=excluded.publication_state,internal_research_notes=excluded.internal_research_notes,future_rule_json=excluded.future_rule_json,retired=excluded.retired,updated_at=excluded.updated_at,last_reviewed_at=excluded.last_reviewed_at,updated_by=excluded.updated_by`).bind(record.id, record.title, json(record.platforms), record.osVersionMin, record.osVersionMax, record.exceptionCode, record.canonicalName, record.plainEnglishMeaning, record.eventType, json(record.faultModules), json(record.pluginVendorEvidence), json(record.causeCategories), record.safeGuidance, record.dawSpecificNotes, record.limitations, record.confidence, record.evidenceStatus, record.publicationState, record.internalResearchNotes, json(record.futureRule), record.retired ? 1 : 0, now, now, record.lastReviewedAt || null, subject, subject), database.prepare('DELETE FROM dd_knowledge_daws WHERE knowledge_id = ?').bind(record.id), database.prepare('DELETE FROM dd_knowledge_sources WHERE knowledge_id = ?').bind(record.id), ...record.dawApplicability.map((entry) => database.prepare('INSERT INTO dd_knowledge_daws (knowledge_id,daw_id,daw_version_min,daw_version_max) VALUES (?,?,?,?)').bind(record.id, entry.dawId, entry.versionMin, entry.versionMax)), ...record.sourceIds.map((sourceId) => database.prepare('INSERT INTO dd_knowledge_sources (knowledge_id,source_id) VALUES (?,?)').bind(record.id, sourceId))]); return record; };

export const saveResearch = async (database, input, subject) => { const record = { id: id(input.id), title: text(input.title, 240, true), candidateFindings: text(input.candidateFindings, 6000), links: strings(input.links || []), internalNotes: text(input.internalNotes, 6000), aiSuggestions: text(input.aiSuggestions, 6000), reviewStatus: text(input.reviewStatus || 'new', 20, true) }; if (!['new', 'in-review', 'accepted', 'rejected'].includes(record.reviewStatus)) throw new Error('Research review status is invalid.'); const now = new Date().toISOString(); await database.prepare(`INSERT INTO dd_research_records (id,title,candidate_findings,links_json,internal_notes,ai_suggestions,review_status,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,candidate_findings=excluded.candidate_findings,links_json=excluded.links_json,internal_notes=excluded.internal_notes,ai_suggestions=excluded.ai_suggestions,review_status=excluded.review_status,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(record.id, record.title, record.candidateFindings, json(record.links), record.internalNotes, record.aiSuggestions, record.reviewStatus, now, now, subject, subject).run(); return record; };

export const publishDataset = async (database, subject) => {
  const rows = await database.prepare("SELECT * FROM dd_knowledge_records WHERE publication_state = 'approved' AND retired = 0 ORDER BY id").all();
  const publishable = rows.results || [];
  if (publishable.some((row) => row.evidence_status === 'research' || row.evidence_status === 'retired')) throw new Error('Research or retired knowledge cannot be published.');
  const [knowledgeDaws, sourceLinks] = await Promise.all([getDawLinks(database, 'dd_knowledge_daws', 'knowledge_id'), getSourceLinks(database)]);
  for (const row of publishable) {
    validateKnowledge({ ...knowledgeProjection(row, knowledgeDaws[row.id] || [], sourceLinks[row.id] || [], false), internalResearchNotes: '', futureRule: {} });
  }
  const sourceIds = [...new Set(publishable.flatMap((row) => sourceLinks[row.id] || []))].sort(); await ensureIdsExist(database, 'dd_sources', sourceIds);
  const sourceRows = sourceIds.length ? await database.prepare(`SELECT * FROM dd_sources WHERE id IN (${sourceIds.map(() => '?').join(',')}) AND active = 1`).bind(...sourceIds).all() : { results: [] };
  if ((sourceRows.results || []).length !== sourceIds.length) throw new Error('Published knowledge references an inactive source.');
  const sourceDawRows = sourceIds.length ? await database.prepare(`SELECT source_id,daw_id FROM dd_source_daws WHERE source_id IN (${sourceIds.map(() => '?').join(',')})`).bind(...sourceIds).all() : { results: [] };
  const sourceDaws = (sourceDawRows.results || []).reduce((result, row) => { (result[row.source_id] ||= []).push(row.daw_id); return result; }, {});
  const records = publishable.map((row) => knowledgeProjection(row, (knowledgeDaws[row.id] || []).sort((a,b) => a.dawId.localeCompare(b.dawId)), (sourceLinks[row.id] || []).sort(), false));
  const sources = (sourceRows.results || []).map((row) => sourceProjection(row, (sourceDaws[row.id] || []).sort())).sort((a,b) => a.id.localeCompare(b.id));
  const next = await database.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS version FROM dd_database_versions').first(); const version = Number(next.version); const publishedAt = new Date().toISOString();
  const dataset = { format: DD_FORMAT, schema_version: DD_SCHEMA_VERSION, database_version: version, published_at_utc: publishedAt, records, sources };
  const datasetJson = canonicalJson(dataset); const hash = await sha256(datasetJson); const size = new TextEncoder().encode(datasetJson).byteLength;
  await database.batch([database.prepare('INSERT INTO dd_database_versions (version,schema_version,dataset_json,content_sha256,content_size_bytes,published_at_utc,published_by,record_count,source_count) VALUES (?,?,?,?,?,?,?,?,?)').bind(version, DD_SCHEMA_VERSION, datasetJson, hash, size, publishedAt, subject, records.length, sources.length), database.prepare('INSERT INTO dd_current_manifest (singleton,current_version,updated_at_utc,updated_by) VALUES (1,?,?,?) ON CONFLICT(singleton) DO UPDATE SET current_version=excluded.current_version,updated_at_utc=excluded.updated_at_utc,updated_by=excluded.updated_by').bind(version, publishedAt, subject)]);
  return { version, publishedAt, hash, size, recordCount: records.length, sourceCount: sources.length };
};

export const rollbackDataset = async (database, version, subject) => { const target = await database.prepare('SELECT version FROM dd_database_versions WHERE version = ?').bind(Number(version)).first(); if (!target) throw new Error('The requested published database version does not exist.'); const now = new Date().toISOString(); await database.prepare('INSERT INTO dd_current_manifest (singleton,current_version,updated_at_utc,updated_by) VALUES (1,?,?,?) ON CONFLICT(singleton) DO UPDATE SET current_version=excluded.current_version,updated_at_utc=excluded.updated_at_utc,updated_by=excluded.updated_by').bind(target.version, now, subject).run(); return { version: target.version, rolledBackAt: now }; };
