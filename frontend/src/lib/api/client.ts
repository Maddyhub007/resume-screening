// src/lib/api/client.ts
// ALL API calls go through here. Never call fetch/axios directly in components.

import axios, { AxiosError } from 'axios';
import type {
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
  HealthResponse,
} from '@/types';

// ─── Error class ──────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Friendly messages for known error codes
const ERROR_MESSAGES: Record<string, string> = {
  RESUME_NOT_FOUND:      'Resume not found. Please upload your resume first.',
  JOB_NOT_FOUND:         'Job not found. It may have been deleted.',
  PARSE_FAILED:          'Could not parse resume. Try a different PDF or DOCX.',
  INVALID_FILE_TYPE:     'Only PDF and DOCX files are accepted.',
  FILE_TOO_LARGE:        'File is too large. Maximum size is 5 MB.',
  MATCH_FAILED:          'Matching failed. Please try again.',
  NO_JOBS_AVAILABLE:     'No jobs have been posted yet.',
  NO_RESUMES_AVAILABLE:  'No resumes have been uploaded yet.',
  NETWORK_ERROR:         'Cannot connect to the server. Is the backend running?',
};

export function getFriendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    return ERROR_MESSAGES[err.code] ?? err.message;
  }
  if (err instanceof AxiosError) {
    if (!err.response) return ERROR_MESSAGES.NETWORK_ERROR;
    const data = err.response.data as { error?: { error_code?: string; message?: string }; message?: string } | undefined;
    if (data?.error?.error_code) return ERROR_MESSAGES[data.error.error_code] ?? data.error.message ?? 'Something went wrong.';
    if (data?.message) return data.message;
    return `Server error (${err.response.status})`;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

// ─── Axios instance ────────────────────────────────────────────────────────────
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const apiClient = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 120_000,
});

// Response interceptor — map API errors to ApiError
apiClient.interceptors.response.use(
  res => res,
  (err: AxiosError) => {
    const data = err.response?.data as { error?: { error_code?: string; message?: string } } | undefined;
    if (data?.error) {
      throw new ApiError(
        data.error.error_code ?? 'UNKNOWN',
        data.error.message ?? 'An error occurred',
        err.response?.status,
      );
    }
    throw err;
  },
);

// ─── Query key factory — stable keys for TanStack Query ───────────────────────
export const queryKeys = {
  health:        () => ['health'] as const,
  resumes:       (page: number, limit: number) => ['resumes', page, limit] as const,
  resume:        (id: string) => ['resume', id] as const,
  jobs:          (page: number, limit: number) => ['jobs', page, limit] as const,
  job:           (id: string) => ['job', id] as const,
  match:         (resumeId: string, jobId: string) => ['match', resumeId, jobId] as const,
  rankCandidates:(jobId: string) => ['rank-candidates', jobId] as const,
  recommendJobs: (resumeId: string) => ['recommend-jobs', resumeId] as const,
  skillGap:      (resumeId: string, jobId?: string) => ['skill-gap', resumeId, jobId ?? 'all'] as const,
} as const;

// ─── API functions ─────────────────────────────────────────────────────────────

export const api = {

  // Health
  health: () =>
    apiClient.get<HealthResponse>('/api/health').then(r => r.data),

  // Resume
  parseResume: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return axios.post<ParseResumeResponse>(
      `${BASE}/api/resume/parse`, form,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 },
    ).then(r => r.data);
  },

  listResumes: (page = 1, limit = 20) =>
    apiClient.get<ListResumesResponse>('/api/resume/', { params: { page, limit } }).then(r => r.data),

  getResume: (resumeId: string) =>
    apiClient.get<GetResumeResponse>(`/api/resume/${resumeId}`).then(r => r.data),

  deleteResume: (resumeId: string) =>
    apiClient.delete(`/api/resume/${resumeId}`).then(r => r.data),

  // Jobs
  createJob: (body: CreateJobRequest) =>
    apiClient.post<CreateJobResponse>('/api/jobs/', body).then(r => r.data),

  listJobs: (page = 1, limit = 20) =>
    apiClient.get<ListJobsResponse>('/api/jobs/', { params: { page, limit } }).then(r => r.data),

  getJob: (jobId: string) =>
    apiClient.get(`/api/jobs/${jobId}`).then(r => r.data),

  deleteJob: (jobId: string) =>
    apiClient.delete(`/api/jobs/${jobId}`).then(r => r.data),

  // Match — ⚠️ fields at TOP LEVEL, no nested "data"
  matchResumeToJob: (resumeId: string, jobId: string) =>
    apiClient.post<MatchResumeToJobResponse>('/api/match/resume-to-job', {
      resume_id: resumeId, job_id: jobId,
    }).then(r => r.data),

  // Rank — ⚠️ data is flat array at r.data.data
  rankCandidates: (jobId: string, topN = 10) =>
    apiClient.post<RankCandidatesResponse>('/api/match/rank-candidates', {
      job_id: jobId, top_n: topN,
    }).then(r => r.data),

  // Recommend — ⚠️ data is flat array at r.data.data
  recommendJobs: (resumeId: string, topN = 5) =>
    apiClient.post<RecommendJobsResponse>('/api/recommend/jobs-for-candidate', {
      resume_id: resumeId, top_n: topN,
    }).then(r => r.data),

  // Skill gap — ⚠️ data is object at r.data.data
  getSkillGap: (resumeId: string, jobId?: string) =>
    apiClient.post<SkillGapResponse>('/api/recommend/skill-gap', {
      resume_id: resumeId,
      ...(jobId ? { job_id: jobId } : {}),
    }).then(r => r.data),
};
