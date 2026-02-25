// src/types/index.ts
// Exact field names from the Integration Guide. Do NOT rename.

// ── Health ────────────────────────────────────────────────────────────────────
export interface HealthResponse {
  success: boolean;
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
}

// ── Resume ────────────────────────────────────────────────────────────────────
export interface EducationEntry {
  degree: string;
  institution: string;
  year: string;
}

export interface ExperienceEntry {
  title: string;   // may include company e.g. "Software Intern at TechCorp"
  company: string; // may be empty string — handle gracefully
  years: number;
}

export interface ParsedResume {
  resume_id: string;
  filename: string;
  name: string;
  email: string;
  phone: string;
  skills: string[];              // alphabetically sorted
  education: EducationEntry[];   // may be []
  experience: ExperienceEntry[]; // may be []
  total_experience_years: number;
  raw_text: string;
}

// POST /api/resume/parse → 200
export interface ParseResumeResponse {
  success: true;
  resume_id: string;
  data: ParsedResume;
}

// GET /api/resume/ → 200
export interface ListResumesResponse {
  success: true;
  data: ParsedResume[];
  total: number;
  page: number;
  limit: number;
}

// GET /api/resume/<id> → 200
export interface GetResumeResponse {
  success: true;
  data: ParsedResume;
}

// ── Jobs ──────────────────────────────────────────────────────────────────────
export type JobType = 'full-time' | 'part-time' | 'contract' | 'remote' | 'hybrid';

export interface JobData {
  job_id: string;
  title: string;
  company: string;
  description: string;
  required_skills: string[];
  experience_years: number;
  location: string;
  job_type: JobType;
}

// POST /api/jobs/ request body
export interface CreateJobRequest {
  title: string;            // REQUIRED
  company: string;          // REQUIRED
  description: string;      // REQUIRED
  required_skills?: string[]; // optional — backend auto-extracts if omitted
  experience_years?: number;  // optional — backend auto-detects if omitted
  location?: string;
  job_type?: JobType;
}

// POST /api/jobs/ → 201
export interface CreateJobResponse {
  success: true;
  job_id: string;
  data: JobData;
}

// GET /api/jobs/ → 200
export interface ListJobsResponse {
  success: true;
  data: JobData[];
  total: number;
  page: number;
  limit: number;
}

// ── Match ─────────────────────────────────────────────────────────────────────
export interface MatchScores {
  semantic_score: number;    // 0.0–1.0  multiply by 100 for %
  keyword_score: number;
  experience_score: number;
  final_score: number;
}

export interface ImprovementTip {
  type: 'skill' | 'experience' | string;
  skill?: string;   // present when type === 'skill'
  priority: 'high' | 'medium' | 'low';
  message: string;
}

export interface Explainability {
  matched_skills: string[];
  missing_skills: string[];
  extra_skills: string[];
  skill_match_pct: number;   // 0–100 already (not 0–1)
  score_breakdown: MatchScores & { skill_match_pct: number };
  summary: string;
  improvement_tips: ImprovementTip[];
}

// POST /api/match/resume-to-job → 200
// ⚠️  Fields are at TOP LEVEL of response.data — there is NO nested "data" object
// CORRECT:  response.data.scores
// WRONG:    response.data.data.scores  ← undefined!
export interface MatchResumeToJobResponse {
  success: true;
  resume_id: string;
  job_id: string;
  scores: MatchScores;
  weights_used: { semantic: number; keyword: number; experience: number };
  explainability: Explainability;
}

// POST /api/match/rank-candidates → 200
// ⚠️  response.data.data  is a FLAT ARRAY
// CORRECT:  response.data.data[0].rank
// WRONG:    response.data.data.data[0].rank  ← undefined!
export interface RankedCandidate {
  rank: number;
  resume_id: string;
  name: string;
  email: string;
  final_score: number;
  scores: MatchScores;
  explainability: Explainability;
}

export interface RankCandidatesResponse {
  success: true;
  job_id: string;
  total_candidates: number;
  data: RankedCandidate[];
}

// ── Recommendations ───────────────────────────────────────────────────────────
// POST /api/recommend/jobs-for-candidate → 200
// ⚠️  response.data.data  is a FLAT ARRAY
export interface JobRecommendation {
  rank: number;
  job_id: string;
  title: string;
  company: string;
  location: string;
  job_type: JobType;
  final_score: number;
  skill_match_pct: number;
  matched_skills: string[];
  missing_skills: string[];
  summary: string;
  improvement_tips: ImprovementTip[];
}

export interface RecommendJobsResponse {
  success: true;
  resume_id: string;
  data: JobRecommendation[];
}

// POST /api/recommend/skill-gap → 200
// ⚠️  response.data.data  is an OBJECT (not array)
export interface UpskillSuggestion {
  skill: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  resource: string; // Google search link — make it clickable
}

export interface SkillGapData {
  current_skills: string[];
  missing_skills: string[];
  upskilling_suggestions: UpskillSuggestion[];
  closest_job_roles: string[];
}

export interface SkillGapResponse {
  success: true;
  resume_id: string;
  data: SkillGapData;
}

// ── API Error ─────────────────────────────────────────────────────────────────
export interface ApiError {
  success: false;
  error: string;
}
