// src/lib/hooks/useQueries.ts
// All server-state hooks using TanStack Query.
// Components import from here — never call api.* directly in components.

'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, queryKeys, getFriendlyError } from '@/lib/api/client';
import { useAppStore } from '@/lib/store/appStore';
import type { CreateJobRequest } from '@/types';

// ─── Resume ────────────────────────────────────────────────────────────────────

export function useListResumes(page = 1, limit = 20) {
  return useQuery({
    queryKey: queryKeys.resumes(page, limit),
    queryFn: () => api.listResumes(page, limit),
    staleTime: 30_000,
  });
}

export function useResume(resumeId: string | null) {
  return useQuery({
    queryKey: queryKeys.resume(resumeId ?? ''),
    queryFn: () => api.getResume(resumeId!),
    enabled: !!resumeId,
    staleTime: 60_000,
  });
}

export function useParseResume() {
  const setResume = useAppStore(s => s.setResume);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.parseResume(file),
    onSuccess: (data) => {
      // Store resume_id + parsed data in Zustand
      setResume(data.resume_id, data.data);
      // Invalidate resume list so recruiter view refreshes
      qc.invalidateQueries({ queryKey: ['resumes'] });
      toast.success('Resume parsed!', {
        description: `${data.data.skills.length} skills extracted`,
      });
    },
    onError: (err) => {
      toast.error('Parse failed', { description: getFriendlyError(err) });
    },
  });
}

export function useDeleteResume() {
  const qc = useQueryClient();
  const clearResume = useAppStore(s => s.clearResume);
  return useMutation({
    mutationFn: (resumeId: string) => api.deleteResume(resumeId),
    onSuccess: () => {
      clearResume();
      qc.invalidateQueries({ queryKey: ['resumes'] });
      toast.success('Resume deleted');
    },
    onError: (err) => toast.error('Delete failed', { description: getFriendlyError(err) }),
  });
}

// ─── Jobs ──────────────────────────────────────────────────────────────────────

export function useListJobs(page = 1, limit = 20) {
  return useQuery({
    queryKey: queryKeys.jobs(page, limit),
    queryFn: () => api.listJobs(page, limit),
    staleTime: 30_000,
  });
}

export function useCreateJob() {
  const setJobId = useAppStore(s => s.setJobId);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateJobRequest) => api.createJob(body),
    onSuccess: (data) => {
      setJobId(data.job_id);
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job posted!', {
        description: `"${data.data.title}" is live. Ranking candidates now.`,
      });
    },
    onError: (err) => toast.error('Failed to post job', { description: getFriendlyError(err) }),
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.deleteJob(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job deleted');
    },
    onError: (err) => toast.error('Delete failed', { description: getFriendlyError(err) }),
  });
}

// ─── Match ─────────────────────────────────────────────────────────────────────

export function useMatch(resumeId: string | null, jobId: string | null) {
  return useQuery({
    queryKey: queryKeys.match(resumeId ?? '', jobId ?? ''),
    queryFn: () => api.matchResumeToJob(resumeId!, jobId!),
    enabled: !!resumeId && !!jobId,
    staleTime: 120_000,
  });
}

export function useMatchMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ resumeId, jobId }: { resumeId: string; jobId: string }) =>
      api.matchResumeToJob(resumeId, jobId),
    onSuccess: (data, vars) => {
      qc.setQueryData(queryKeys.match(vars.resumeId, vars.jobId), data);
    },
    onError: (err) => toast.error('Match failed', { description: getFriendlyError(err) }),
  });
}

export function useRankCandidates(jobId: string | null) {
  return useQuery({
    queryKey: queryKeys.rankCandidates(jobId ?? ''),
    queryFn: () => api.rankCandidates(jobId!, 20),
    enabled: !!jobId,
    staleTime: 60_000,
  });
}

// ─── Recommendations ───────────────────────────────────────────────────────────

export function useRecommendJobs(resumeId: string | null) {
  return useQuery({
    queryKey: queryKeys.recommendJobs(resumeId ?? ''),
    queryFn: () => api.recommendJobs(resumeId!, 10),
    enabled: !!resumeId,
    staleTime: 60_000,
  });
}

export function useSkillGap(resumeId: string | null, jobId?: string) {
  return useQuery({
    queryKey: queryKeys.skillGap(resumeId ?? '', jobId),
    queryFn: () => api.getSkillGap(resumeId!, jobId),
    enabled: !!resumeId,
    staleTime: 60_000,
  });
}

// ─── Health ────────────────────────────────────────────────────────────────────
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health(),
    queryFn: api.health,
    staleTime: 10_000,
    retry: 1,
  });
}
