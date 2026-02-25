// src/lib/api.ts
// Copy-paste ready helpers from the Integration Guide, fully typed.

import axios from 'axios';
import type {
  HealthResponse,
  ParseResumeResponse,
  ListResumesResponse,
  GetResumeResponse,
  CreateJobRequest,
  CreateJobResponse,
  ListJobsResponse,
  MatchResumeToJobResponse,
  RankCandidatesResponse,
  RecommendJobsResponse,
  SkillGapResponse,
} from '@/types';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 120_000, // ML models are slow on first load
});

export default api;

// ── Health ────────────────────────────────────────────────────────────────────
export const healthCheck = () =>
  api.get<HealthResponse>('/api/health');

// ── Resume ────────────────────────────────────────────────────────────────────
/** Upload a .pdf or .docx file. Validate extension BEFORE calling. */
export const parseResume = (file: File) => {
  const form = new FormData();
  form.append('file', file); // field name MUST be "file"
  return axios.post<ParseResumeResponse>(`${BASE}/api/resume/parse`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  });
};

export const listResumes = (page = 1, limit = 20) =>
  api.get<ListResumesResponse>('/api/resume/', { params: { page, limit } });

export const getResume = (resumeId: string) =>
  api.get<GetResumeResponse>(`/api/resume/${resumeId}`);

export const deleteResume = (resumeId: string) =>
  api.delete(`/api/resume/${resumeId}`);

// ── Jobs ──────────────────────────────────────────────────────────────────────
/** title, company, description are REQUIRED. Everything else is optional. */
export const createJob = (jobData: CreateJobRequest) =>
  api.post<CreateJobResponse>('/api/jobs/', jobData);

export const listJobs = (page = 1, limit = 20) =>
  api.get<ListJobsResponse>('/api/jobs/', { params: { page, limit } });

export const getJob = (jobId: string) =>
  api.get(`/api/jobs/${jobId}`);

export const deleteJob = (jobId: string) =>
  api.delete(`/api/jobs/${jobId}`);

// ── Match ─────────────────────────────────────────────────────────────────────
/**
 * ⚠️  response.data.scores  — top level, NO nested "data"
 * CORRECT:  res.data.scores.final_score
 * WRONG:    res.data.data.scores  ← undefined
 */
export const matchResumeToJob = (resumeId: string, jobId: string) =>
  api.post<MatchResumeToJobResponse>('/api/match/resume-to-job', {
    resume_id: resumeId,
    job_id: jobId,
  });

/**
 * ⚠️  response.data.data  is a FLAT ARRAY
 * CORRECT:  res.data.data[0].rank
 * WRONG:    res.data.data.data[0]  ← undefined
 */
export const rankCandidates = (jobId: string, topN = 10) =>
  api.post<RankCandidatesResponse>('/api/match/rank-candidates', {
    job_id: jobId,
    top_n: topN,
  });

// ── Recommend ─────────────────────────────────────────────────────────────────
/**
 * ⚠️  response.data.data  is a FLAT ARRAY
 * CORRECT:  res.data.data[0].title
 */
export const recommendJobs = (resumeId: string, topN = 5) =>
  api.post<RecommendJobsResponse>('/api/recommend/jobs-for-candidate', {
    resume_id: resumeId,
    top_n: topN,
  });

/**
 * job_id is optional — omit for broad analysis.
 * ⚠️  response.data.data  is an OBJECT
 * CORRECT:  res.data.data.current_skills
 * WRONG:    res.data.data.data  ← undefined
 */
export const getSkillGap = (resumeId: string, jobId?: string) =>
  api.post<SkillGapResponse>('/api/recommend/skill-gap', {
    resume_id: resumeId,
    ...(jobId ? { job_id: jobId } : {}),
  });
