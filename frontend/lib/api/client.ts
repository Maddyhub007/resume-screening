import axios, { AxiosInstance } from "axios";
import {
  ApiResponse, PaginationMeta, Candidate, Recruiter, Job, Resume, AuthPayload,
  Application, AtsScore, ScoreMatchResult, RankedCandidate, JobRecommendation,
  JobEnhancement, RecruiterDashboard, PipelineData,
  CreateCandidateForm, CreateRecruiterForm, CreateJobForm, StageUpdateForm,
  SkillGapSingle,
} from "@/lib/types";

// ─── Error class ──────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Friendly error messages ──────────────────────────────────────────────────
const ERROR_MESSAGES: Record<string, string> = {
  CANDIDATE_EMAIL_CONFLICT: "This email is already registered.",
  RECRUITER_EMAIL_CONFLICT: "This email is already registered.",
  USER_NOT_FOUND: "No account found for this email.",
  DUPLICATE_APPLICATION: "You have already applied to this job.",
  JOB_NOT_ACTIVE: "This job is no longer accepting applications.",
  RESUME_OWNERSHIP_MISMATCH: "Please select your own resume.",
  CANNOT_WITHDRAW: "Cannot withdraw a finalized application.",
  UNSUPPORTED_FILE_TYPE: "Only PDF and DOCX files are accepted.",
  NO_FILE_UPLOADED: "No file included in the request.",
  RESUME_NOT_PARSED: "Resume still processing — please try again shortly.",
  SCORING_FAILED: "Scoring failed — please try again.",
  MISSING_PARAM: "A required parameter is missing.",
  VALIDATION_ERROR: "Please check the highlighted fields.",
  NETWORK_ERROR: "Cannot reach server. Is the backend running?",
  CANDIDATE_NOT_FOUND: "Candidate not found.",
  RECRUITER_NOT_FOUND: "Recruiter not found.",
  JOB_NOT_FOUND: "Job not found.",
  RESUME_NOT_FOUND: "Resume not found.",
};

export function getFriendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    return ERROR_MESSAGES[err.code] ?? err.message;
  }
  return "Something went wrong. Please try again.";
}

// ─── Query key factory ────────────────────────────────────────────────────────
export const queryKeys = {
  health: () => ["health"] as const,
  healthServices: () => ["health", "services"] as const,
  candidates: (p?: number, l?: number, q?: string) => ["candidates", p, l, q] as const,
  candidate: (id: string) => ["candidate", id] as const,
  candidateResumes: (id: string) => ["candidate", id, "resumes"] as const,
  candidateRecommendations: (id: string) => ["candidate", id, "recommendations"] as const,
  recruiters: (p?: number, l?: number, q?: string) => ["recruiters", p, l, q] as const,
  recruiter: (id: string) => ["recruiter", id] as const,
  recruiterJobs: (id: string, status?: string) => ["recruiter", id, "jobs", status] as const,
  recruiterAnalytics: (id: string) => ["recruiter", id, "analytics"] as const,
  recruiterPipeline: (id: string) => ["recruiter", id, "pipeline"] as const,
  jobs: (p?: number, l?: number, filters?: Record<string, string>) => ["jobs", p, l, filters] as const,
  job: (id: string) => ["job", id] as const,
  jobCandidates: (id: string, p?: number) => ["job", id, "candidates", p] as const,
  jobSkillGaps: (id: string) => ["job", id, "skill-gaps"] as const,
  jobPerformance: (id: string) => ["job", id, "performance"] as const,
  resumes: (p?: number, l?: number) => ["resumes", p, l] as const,
  resume: (id: string) => ["resume", id] as const,
  scorePreview: (resumeId: string, jobId: string) => ["score-preview", resumeId, jobId] as const,
  applications: (filters?: Record<string, string>) => ["applications", filters] as const,
  application: (id: string) => ["application", id] as const,
  scores: (filters?: Record<string, string>) => ["scores", filters] as const,
  analyticsBoard: (recruiterId: string) => ["analytics", recruiterId, "dashboard"] as const,
  analyticsPipeline: (recruiterId: string) => ["analytics", recruiterId, "pipeline"] as const,
  analyticsScoreDist: (recruiterId: string) => ["analytics", recruiterId, "score-dist"] as const,
  analyticsSkillsDemand: (recruiterId: string) => ["analytics", recruiterId, "skills"] as const,
  analyticsTopJobs: (recruiterId: string) => ["analytics", recruiterId, "top-jobs"] as const,
};

// ─── Axios instance ───────────────────────────────────────────────────────────
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/v1`,
    headers: { "Content-Type": "application/json" },
    timeout: 120_000,
  });

  client.interceptors.response.use(
    (res) => {
      // Handle success:false in 2xx responses (backend envelope)
      if (res.data?.success === false && res.data?.error) {
        throw new ApiError(res.data.error.error_code, res.data.error.message, res.status);
      }
      return res;
    },
    (err) => {
      const data = err.response?.data;
      if (data?.success === false && data?.error) {
        throw new ApiError(data.error.error_code, data.error.message, err.response?.status);
      }
      if (data?.error) {
        throw new ApiError(data.error.error_code, data.error.message, err.response?.status);
      }
      if (!err.response) {
        throw new ApiError("NETWORK_ERROR", "Cannot reach server.", 0);
      }
      throw err;
    }
  );

  return client;
};

export const apiClient = createApiClient();

// ─── Helper ───────────────────────────────────────────────────────────────────
async function get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
  const res = await apiClient.get<ApiResponse<T>>(url, { params });
  return res.data;
}
async function post<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await apiClient.post<ApiResponse<T>>(url, body);
  return res.data;
}
async function patch<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await apiClient.patch<ApiResponse<T>>(url, body);
  return res.data;
}
async function del<T>(url: string): Promise<ApiResponse<T>> {
  const res = await apiClient.delete<ApiResponse<T>>(url);
  return res.data;
}

// ─── API Functions ────────────────────────────────────────────────────────────
export const api = {
  // Auth
  login: (body: { email: string; role: "candidate" | "recruiter" }) =>
    post<AuthPayload>("/auth/login", body),
  registerCandidate: (body: CreateCandidateForm) =>
    post<AuthPayload>("/auth/register/candidate", body),
  registerRecruiter: (body: CreateRecruiterForm) =>
    post<AuthPayload>("/auth/register/recruiter", body),

  // Health
  getHealth: () => get<{ status: string; uptime_seconds: number }>("/health"),
  getHealthReady: () => get<{ status: string }>("/health/ready"),
  getHealthServices: () => get<{ services: { database: { available: boolean; description: string }; embedding: { available: boolean; description: string }; groq: { available: boolean; description: string } }; all_optional_services_available: boolean }>("/health/services"),

  // Candidates
  listCandidates: (page = 1, limit = 20, params?: Record<string, unknown>) =>
    get<Candidate[]>("/candidates", { page, limit, ...params }),
  getCandidate: (id: string) => get<Candidate>(`/candidates/${id}`),
  createCandidate: (body: CreateCandidateForm) => post<Candidate>("/candidates", body),
  updateCandidate: (id: string, body: Partial<CreateCandidateForm>) =>
    patch<Candidate>(`/candidates/${id}`, body),
  deleteCandidate: (id: string) => del(`/candidates/${id}`),
  getCandidateResumes: (id: string, page = 1, limit = 20) =>
    get<Resume[]>(`/candidates/${id}/resumes`, { page, limit }),
  uploadResume: async (candidateId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await apiClient.post<ApiResponse<Resume>>(
      `/candidates/${candidateId}/resumes`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return res.data;
  },
  getCandidateRecommendations: (id: string, params?: Record<string, unknown>) =>
    post<JobRecommendation[]>(`/candidates/${id}/recommendations`, params),

  // Recruiters
  listRecruiters: (page = 1, limit = 20, params?: Record<string, unknown>) =>
    get<Recruiter[]>("/recruiters", { page, limit, ...params }),
  getRecruiter: (id: string) => get<Recruiter>(`/recruiters/${id}`),
  createRecruiter: (body: CreateRecruiterForm) => post<Recruiter>("/recruiters", body),
  updateRecruiter: (id: string, body: Partial<CreateRecruiterForm>) =>
    patch<Recruiter>(`/recruiters/${id}`, body),
  deleteRecruiter: (id: string) => del(`/recruiters/${id}`),
  getRecruiterJobs: (id: string, params?: Record<string, unknown>) =>
    get<Job[]>(`/recruiters/${id}/jobs`, params),
  getRecruiterAnalytics: (id: string) =>
    get<RecruiterDashboard>(`/recruiters/${id}/analytics`),
  getRecruiterPipeline: (id: string) =>
    get<PipelineData>(`/recruiters/${id}/pipeline`),

  // Jobs
  listJobs: (page = 1, limit = 20, params?: Record<string, unknown>) =>
    get<Job[]>("/jobs", { page, limit, ...params }),
  getJob: (id: string) => get<Job>(`/jobs/${id}`),
  createJob: (body: CreateJobForm) => post<Job>("/jobs", body),
  updateJob: (id: string, body: Partial<CreateJobForm>) =>
    patch<Job>(`/jobs/${id}`, body),
  deleteJob: (id: string) => del(`/jobs/${id}`),
  enhanceJob: (id: string, useLlm = true) =>
    post<JobEnhancement>(`/jobs/${id}/enhance`, { use_llm: useLlm }),
  getJobCandidates: (id: string, params?: Record<string, unknown>) =>
    get<RankedCandidate[]>(`/jobs/${id}/candidates`, params),
  getJobSkillGaps: (id: string) =>
    get<{ top_missing_skills: { skill: string; count: number }[]; top_matched_skills: { skill: string; count: number }[] }>(`/jobs/${id}/skill-gaps`),
  getJobPerformance: (id: string) =>
    get<{ applicant_count: number; avg_score: number; stage_breakdown: Record<string, number>; top_skills_matched: string[] }>(`/jobs/${id}/performance`),

  // Resumes
  listResumes: (page = 1, limit = 20, params?: Record<string, unknown>) =>
    get<Resume[]>("/resumes", { page, limit, ...params }),
  getResume: (id: string) => get<Resume>(`/resumes/${id}`),
  deleteResume: (id: string) => del(`/resumes/${id}`),
  analyzeResume: (id: string, forceRefresh = false) =>
    post<Resume>(`/resumes/${id}/analyze`, { force_refresh: forceRefresh }),
  getScorePreview: (resumeId: string, jobId: string) =>
    get<ScoreMatchResult>(`/resumes/${resumeId}/score-preview`, { job_id: jobId }),

  // Applications
  listApplications: (params?: Record<string, unknown>) =>
    get<Application[]>("/applications", params),
  getApplication: (id: string) => get<Application>(`/applications/${id}`),
  createApplication: (body: { candidate_id: string; job_id: string; resume_id: string; cover_letter?: string }) =>
    post<Application>("/applications", body),
  updateApplicationStage: (id: string, body: StageUpdateForm) =>
    patch<Application>(`/applications/${id}/stage`, body),
  withdrawApplication: (id: string) => del<Application>(`/applications/${id}`),
  scoreApplication: (id: string, useLlm = true) =>
    post<AtsScore>(`/applications/${id}/score`, { use_llm: useLlm }),

  // Scoring
  scoreMatch: (resumeId: string, jobId: string, saveResult = true) =>
    post<ScoreMatchResult>("/scores/match", { resume_id: resumeId, job_id: jobId, save_result: saveResult }),
  rankCandidates: (jobId: string, params?: Record<string, unknown>) =>
    post<{ job_id: string; total: number; score_stats: Record<string, number>; candidates: RankedCandidate[] }>("/scores/rank-candidates", { job_id: jobId, ...params }),
  jobRecommendations: (resumeId: string, params?: Record<string, unknown>) =>
    post<{ resume_id: string; total: number; recommendations: JobRecommendation[] }>("/scores/job-recommendations", { resume_id: resumeId, ...params }),
  skillGap: (resumeId: string, jobId?: string) =>
    post<SkillGapSingle>("/scores/skill-gap", { resume_id: resumeId, ...(jobId ? { job_id: jobId } : {}) }),
  listScores: (params?: Record<string, unknown>) => get<AtsScore[]>("/scores", params),
  getScore: (id: string) => get<AtsScore>(`/scores/${id}`),

  // Analytics
  getAnalyticsDashboard: (recruiterId: string) =>
    get<RecruiterDashboard>("/analytics/dashboard", { recruiter_id: recruiterId }),
  getAnalyticsPipeline: (recruiterId: string) =>
    get<PipelineData>("/analytics/pipeline", { recruiter_id: recruiterId }),
  getAnalyticsScoreDistribution: (recruiterId: string) =>
    get<{ excellent: number; good: number; fair: number; weak: number }>("/analytics/score-distribution", { recruiter_id: recruiterId }),
  getAnalyticsSkillsDemand: (recruiterId: string, topN = 15) =>
    get<{ skills: { skill: string; count: number }[] }>("/analytics/skills-demand", { recruiter_id: recruiterId, top_n: topN }),
  getAnalyticsTopJobs: (recruiterId: string, topN = 5) =>
    get<{ jobs: { job_id: string; title: string; applicant_count: number; avg_score: number }[] }>("/analytics/top-jobs", { recruiter_id: recruiterId, top_n: topN }),
};
