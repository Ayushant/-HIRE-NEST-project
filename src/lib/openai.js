import { SUPABASE_URL } from './supabase';

const RESUME_PARSE_PROMPT = `You are an expert resume parser. Extract structured information. Return ONLY valid JSON: {"full_name": "", "email": "", "phone": "", "location": "", "current_title": "", "years_experience": 0, "skills": [], "notice_period_days": null, "work_mode_preference": "", "expected_salary": null, "role_keywords": []}. Null for unknown fields.`;

const JD_PARSE_PROMPT = `You are an expert JD parser. Return ONLY valid JSON: {"role_title": "", "required_skills": [], "preferred_skills": [], "min_experience_years": 0, "location": "", "work_mode": "", "budget_min": null, "budget_max": null, "keywords": []}. Null for unknown.`;

const SCORING_PROMPT = `Score this candidate against the JD. Weights: skills 40%, experience 25%, location 15%, salary 10%, work_mode 10%. Return ONLY valid JSON: {"skill_match_score": 0, "experience_score": 0, "location_score": 0, "salary_score": 0, "work_mode_score": 0, "final_score": 0, "missing_skills": [], "reason": "", "confidence": "HIGH|MEDIUM|LOW"}. All scores out of 10. Be strict and consistent.`;

// ── User-overridable keys (optional — set in Settings) ────────────────────
// If not set, all calls are proxied through Supabase Edge Functions server-side.
function getGroqKey() { return localStorage.getItem('groq_api_key') || ''; }
function getJinaKey() { return localStorage.getItem('jina_api_key') || ''; }

// ── Proxy URLs (Supabase Edge Functions — keys stored as server secrets) ──
const ANON_KEY   = import.meta.env.VITE_SUPABASE_KEY;
const GROQ_PROXY = `${SUPABASE_URL}/functions/v1/groq-proxy`;
const JINA_PROXY = `${SUPABASE_URL}/functions/v1/jina-proxy`;

// ── Groq LLM (OpenAI-compatible) ───────────────────────────────────────────
const GROQ_BASE  = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function groqChat(systemPrompt, userContent, apiKey) {
  const userKey = apiKey || getGroqKey();
  const useProxy = !userKey;

  const url     = useProxy ? GROQ_PROXY : GROQ_BASE;
  const headers = useProxy
    ? { 'Content-Type': 'application/json', 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userKey}` };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  });

  if (response.status === 429) {
    const err = new Error('Rate limit exceeded');
    err.status = 429;
    throw err;
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Groq error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code block if wrapped
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    try { return JSON.parse(match?.[1] || '{}'); } catch { return {}; }
  }
}

// ── Jina embeddings ─────────────────────────────────────────────────────────
const JINA_EMBED_URL   = 'https://api.jina.ai/v1/embeddings';
const JINA_EMBED_MODEL = 'jina-embeddings-v3';

async function jinaEmbed(text, task = 'retrieval.passage', apiKey) {
  const userKey = apiKey || getJinaKey();
  const useProxy = !userKey;

  const url     = useProxy ? JINA_PROXY : JINA_EMBED_URL;
  const headers = useProxy
    ? { 'Content-Type': 'application/json', 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userKey}` };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: JINA_EMBED_MODEL,
      input: [text.slice(0, 8000)],
      task,
      dimensions: 768
    })
  });

  if (response.status === 429) {
    const err = new Error('Rate limit exceeded');
    err.status = 429;
    throw err;
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.detail || errData?.message || `Jina error: ${response.status}`);
  }

  const data = await response.json();
  return data.data?.[0]?.embedding || null;
}

// ── Public API ──────────────────────────────────────────────────────────────
export async function parseResume(rawText, apiKey) {
  return groqChat(RESUME_PARSE_PROMPT, `Parse this resume:\n\n${rawText.slice(0, 6000)}`, apiKey);
}

export async function parseJD(rawText, apiKey) {
  return groqChat(JD_PARSE_PROMPT, `Parse this job description:\n\n${rawText.slice(0, 4000)}`, apiKey);
}

export async function scoreCandidate(candidateJson, jdJson, weights, apiKey) {
  const scoringPrompt = weights
    ? `Score this candidate against the JD. Weights: skills ${weights.skills}%, experience ${weights.experience}%, location ${weights.location}%, salary ${weights.salary}%, work_mode ${weights.workMode}%. Return ONLY valid JSON: {"skill_match_score": 0, "experience_score": 0, "location_score": 0, "salary_score": 0, "work_mode_score": 0, "final_score": 0, "missing_skills": [], "reason": "", "confidence": "HIGH|MEDIUM|LOW"}. All scores out of 10. Be strict and consistent.`
    : SCORING_PROMPT;

  const userContent = `JD: ${JSON.stringify(jdJson)}\n\nCandidate: ${JSON.stringify(candidateJson)}`;
  return groqChat(scoringPrompt, userContent, apiKey);
}

// Resumes use "retrieval.passage" — documents being indexed
export async function getResumeEmbedding(rawText, apiKey) {
  return jinaEmbed(rawText, 'retrieval.passage', apiKey);
}

// JDs use "retrieval.query" — the search query side
export async function getJDEmbedding(rawText, apiKey) {
  return jinaEmbed(rawText, 'retrieval.query', apiKey);
}

export async function testGroq(apiKey) {
  try {
    const userKey = apiKey || getGroqKey();
    const useProxy = !userKey;
    if (useProxy) {
      // Test the proxy with a minimal chat request
      const result = await groqChat('Say only: ok', 'ping', null);
      return result ? { ok: true, message: 'Groq connected via proxy ✓' } : { ok: false, message: 'Proxy returned empty response' };
    }
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${userKey}` }
    });
    if (response.ok) return { ok: true, message: 'Groq connected ✓ (personal key)' };
    return { ok: false, message: `HTTP ${response.status}` };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

export async function testJina(apiKey) {
  try {
    const result = await jinaEmbed('test connection', 'retrieval.passage', apiKey || null);
    if (result) {
      const via = (apiKey || getJinaKey()) ? '(personal key)' : 'via proxy';
      return { ok: true, message: `Jina connected ${via} ✓ (${result.length}-dim)` };
    }
    return { ok: false, message: 'No embedding returned' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

// Keep legacy export name so existing imports don't break
export const testOpenAI = testGroq;

export async function withRateLimit(fn, onPause) {
  let attempt = 0;
  while (attempt < 3) {
    try {
      return await fn();
    } catch (e) {
      if (e.status === 429 && attempt < 2) {
        const delay = (attempt + 1) * 3000;
        if (onPause) onPause(Math.round(delay / 1000));
        await new Promise(r => setTimeout(r, delay));
        attempt++;
      } else {
        throw e;
      }
    }
  }
}

