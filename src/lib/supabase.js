import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('candidates').select('count').limit(1);
    if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
      return { ok: false, message: error.message };
    }
    return { ok: true, message: 'Connected' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

export const DB_SETUP_SQL = `
-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  file_hash text UNIQUE NOT NULL,
  full_name text,
  email text,
  phone text,
  location text,
  current_title text,
  years_experience numeric,
  skills jsonb DEFAULT '[]',
  notice_period_days integer,
  work_mode_preference text,
  expected_salary numeric,
  raw_text text,
  parsed_json jsonb DEFAULT '{}',
  embedding vector(768),
  created_at timestamptz DEFAULT now()
);

-- 3. JDs table
CREATE TABLE IF NOT EXISTS jds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  role_title text,
  raw_text text,
  parsed_json jsonb DEFAULT '{}',
  required_skills jsonb DEFAULT '[]',
  min_experience_years numeric,
  location text,
  work_mode text,
  budget_max numeric,
  embedding vector(768),
  created_at timestamptz DEFAULT now()
);

-- 4. Patch ALL missing columns on existing tables (safe to re-run)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS file_hash text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_title text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS years_experience numeric;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS skills jsonb DEFAULT '[]';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS notice_period_days integer;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS work_mode_preference text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS expected_salary numeric;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS raw_text text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS parsed_json jsonb DEFAULT '{}';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS embedding vector(768);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE jds ADD COLUMN IF NOT EXISTS role_title text;
ALTER TABLE jds ADD COLUMN IF NOT EXISTS raw_text text;
ALTER TABLE jds ADD COLUMN IF NOT EXISTS parsed_json jsonb DEFAULT '{}';
ALTER TABLE jds ADD COLUMN IF NOT EXISTS required_skills jsonb DEFAULT '[]';
ALTER TABLE jds ADD COLUMN IF NOT EXISTS min_experience_years numeric;
ALTER TABLE jds ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE jds ADD COLUMN IF NOT EXISTS work_mode text;
ALTER TABLE jds ADD COLUMN IF NOT EXISTS budget_max numeric;
ALTER TABLE jds ADD COLUMN IF NOT EXISTS embedding vector(768);
ALTER TABLE jds ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- 5. Matches table
CREATE TABLE IF NOT EXISTS matches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  jd_id uuid REFERENCES jds(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE,
  final_score numeric,
  skill_match_score numeric,
  experience_score numeric,
  location_score numeric,
  salary_score numeric,
  work_mode_score numeric,
  missing_skills jsonb DEFAULT '[]',
  reason text,
  confidence text,
  created_at timestamptz DEFAULT now()
);

-- 6. Vector similarity search function
CREATE OR REPLACE FUNCTION match_candidates(
  query_embedding vector(768),
  match_count int DEFAULT 50,
  min_similarity float DEFAULT 0.4
)
RETURNS TABLE(candidate_id uuid, similarity float)
LANGUAGE sql AS $$
  SELECT id AS candidate_id,
    1 - (embedding <=> query_embedding) AS similarity
  FROM candidates
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 7. Enable RLS on all tables
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE jds        ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches    ENABLE ROW LEVEL SECURITY;

-- 8. Grant permissions
GRANT ALL ON candidates TO anon, authenticated;
GRANT ALL ON jds        TO anon, authenticated;
GRANT ALL ON matches    TO anon, authenticated;

-- 9. RLS policies: allow full access for anon (internal app, no user auth)
DROP POLICY IF EXISTS "anon_all_candidates" ON candidates;
CREATE POLICY "anon_all_candidates" ON candidates FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_jds" ON jds;
CREATE POLICY "anon_all_jds" ON jds FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_matches" ON matches;
CREATE POLICY "anon_all_matches" ON matches FOR ALL TO anon USING (true) WITH CHECK (true);

-- 9. Force PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';
`;

export async function setupDatabase() {
  try {
    // Supabase exposes a direct SQL endpoint for service role via the pg REST proxy
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ sql: DB_SETUP_SQL })
    });

    // If exec_sql RPC doesn't exist, try the pg extension direct query endpoint
    if (!response.ok) {
      const res2 = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify({ query: DB_SETUP_SQL })
      });
      if (!res2.ok) {
        return {
          ok: false,
          message: 'Auto-setup not available. Please run the SQL manually in Supabase Dashboard → SQL Editor. Click "Copy SQL" button below.'
        };
      }
    }
    return { ok: true, message: 'Database setup complete! Tables and functions created.' };
  } catch (e) {
    return {
      ok: false,
      message: 'Auto-setup not available. Please run the SQL manually in Supabase Dashboard → SQL Editor.'
    };
  }
}

export async function getCandidates({ search = '', page = 1, pageSize = 25, filters = {} } = {}) {
  let query = supabase.from('candidates').select('*', { count: 'exact' });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,current_title.ilike.%${search}%,location.ilike.%${search}%`);
  }
  if (filters.location) {
    query = query.ilike('location', `%${filters.location}%`);
  }
  if (filters.workMode) {
    query = query.ilike('work_mode_preference', `%${filters.workMode}%`);
  }
  if (filters.minExp !== undefined && filters.minExp !== null) {
    query = query.gte('years_experience', filters.minExp);
  }
  if (filters.maxExp !== undefined && filters.maxExp !== null) {
    query = query.lte('years_experience', filters.maxExp);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to).order('created_at', { ascending: false });

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function getJDs() {
  const { data, error } = await supabase
    .from('jds')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getMatchesForJD(jdId) {
  const { data, error } = await supabase
    .from('matches')
    .select('*, candidates(*)')
    .eq('jd_id', jdId)
    .order('final_score', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function checkDuplicate(fileHash) {
  const { data, error } = await supabase
    .from('candidates')
    .select('id, full_name')
    .eq('file_hash', fileHash)
    .single();
  if (error && error.code === 'PGRST116') return null;
  if (error) return null;
  return data;
}

export async function upsertCandidate(candidate) {
  // Insert without embedding first (vector type requires separate update via PATCH)
  const { embedding, ...payloadWithoutEmbedding } = candidate;
  const { data, error } = await supabase
    .from('candidates')
    .upsert(payloadWithoutEmbedding, { onConflict: 'file_hash' })
    .select()
    .single();
  if (error) throw error;

  // Update embedding separately as a postgres vector literal string
  if (embedding && data?.id) {
    const embStr = Array.isArray(embedding) ? `[${embedding.join(',')}]` : embedding;
    const { error: embErr } = await supabase
      .from('candidates')
      .update({ embedding: embStr })
      .eq('id', data.id);
    if (embErr) console.warn('[DB] embedding update failed:', embErr.message);
  }
  return data;
}

export async function saveJD(jd) {
  const { embedding, ...payloadWithoutEmbedding } = jd;

  // Try full insert first; fall back to minimal columns if schema mismatch
  let data, error;
  ({ data, error } = await supabase
    .from('jds')
    .insert(payloadWithoutEmbedding)
    .select()
    .single());

  if (error) {
    // PGRST204 = unknown column in schema cache — retry with safe minimal payload
    if (error.code === 'PGRST204' || error.message?.includes('schema cache') || error.message?.includes('column')) {
      const minimal = {
        role_title: payloadWithoutEmbedding.role_title,
        raw_text: payloadWithoutEmbedding.raw_text,
        location: payloadWithoutEmbedding.location,
        work_mode: payloadWithoutEmbedding.work_mode,
        budget_max: payloadWithoutEmbedding.budget_max,
        min_experience_years: payloadWithoutEmbedding.min_experience_years,
      };
      ({ data, error } = await supabase
        .from('jds')
        .insert(minimal)
        .select()
        .single());
    }
    if (error) throw new Error(error.message || JSON.stringify(error));
  }

  // Update embedding separately as postgres vector literal
  if (embedding && data?.id) {
    const embStr = Array.isArray(embedding) ? `[${embedding.join(',')}]` : embedding;
    const { error: embErr } = await supabase
      .from('jds')
      .update({ embedding: embStr })
      .eq('id', data.id);
    if (embErr) console.warn('[DB] JD embedding update failed:', embErr.message);
  }
  return data;
}

export async function saveMatches(matches) {
  const { data, error } = await supabase
    .from('matches')
    .insert(matches)
    .select();
  if (error) throw error;
  return data || [];
}

export async function getMatchHistory() {
  try {
    const { data: jds, error } = await supabase
      .from('jds')
      .select(`
        id, role_title, location, created_at,
        matches(id, final_score, candidate_id, skill_match_score, experience_score, location_score, salary_score, work_mode_score, missing_skills, reason, confidence)
      `)
      .order('created_at', { ascending: false });
    if (error) return [];
    return jds || [];
  } catch {
    return [];
  }
}

export async function callMatchCandidates(embedding, matchCount = 50, minSimilarity = 0.6) {
  const { data, error } = await supabase.rpc('match_candidates', {
    query_embedding: embedding,
    match_count: matchCount,
    min_similarity: minSimilarity
  });
  if (error) throw error;
  return data || [];
}

export async function getCandidatesByIds(ids) {
  const { data, error } = await supabase
    .from('candidates')
    .select('*')
    .in('id', ids);
  if (error) throw error;
  return data || [];
}

export async function deleteJDSession(jdId) {
  // Delete matches first (in case no CASCADE), then the JD row
  await supabase.from('matches').delete().eq('jd_id', jdId);
  const { error } = await supabase.from('jds').delete().eq('id', jdId);
  if (error) throw error;
}

export async function clearAllJDSessions() {
  // Wipe all matches then all jds
  await supabase.from('matches').delete().neq('id', '');
  const { error } = await supabase.from('jds').delete().neq('id', '');
  if (error) throw error;
}
