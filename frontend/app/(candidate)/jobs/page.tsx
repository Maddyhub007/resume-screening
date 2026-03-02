"use client";
import { useCallback, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, queryKeys, getFriendlyError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/authStore";
import { CardSkeleton, SkillBadge, ScoreBadge, EmptyState, PaginationBar } from "@/components/shared";
import { AtsScoreCard } from "@/components/shared/AtsScoreCard";
import { formatSalary, formatExperience, formatRelativeDate } from "@/lib/utils/formatters";
import { Search, MapPin, Briefcase, Clock, DollarSign, ChevronRight, X, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { Job, ScoreMatchResult } from "@/lib/types";

const JOB_TYPES = ["full-time", "part-time", "contract", "internship", "freelance"];

export default function JobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId } = useAuthStore();

  const page = Number(searchParams.get("page") ?? 1);
  const search = searchParams.get("search") ?? "";
  const jobType = searchParams.get("job_type") ?? "";
  const location = searchParams.get("location") ?? "";

  const [searchInput, setSearchInput] = useState(search);
  const [previewScores, setPreviewScores] = useState<Record<string, ScoreMatchResult>>({});
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setFilter("search", searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const setFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    value ? params.set(key, value) : params.delete(key);
    params.delete("page");
    router.push(`?${params}`);
  }, [searchParams, router]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.jobs(page, 20, { search, job_type: jobType, location }),
    queryFn: () => api.listJobs(page, 20, { search, job_type: jobType, location }),
  });

  // Get active resume for previews
  const { data: resumesData } = useQuery({
    queryKey: queryKeys.candidateResumes(userId!),
    queryFn: () => api.getCandidateResumes(userId!),
    enabled: !!userId,
  });
  const activeResume = resumesData?.data?.find((r) => r.is_active && r.parse_status === "success");

  const applyMutation = useMutation({
    mutationFn: ({ jobId }: { jobId: string }) =>
      api.createApplication({ candidate_id: userId!, job_id: jobId, resume_id: activeResume!.id }),
    onSuccess: () => toast.success("Application submitted!"),
    onError: (err) => toast.error(getFriendlyError(err)),
  });

  const handlePreview = async (job: Job) => {
    if (!activeResume) { toast.error("Upload a resume first to preview your match score."); return; }
    if (previewScores[job.id]) return;
    setLoadingPreview(job.id);
    try {
      const res = await api.getScorePreview(activeResume.id, job.id);
      setPreviewScores((p) => ({ ...p, [job.id]: res.data }));
    } catch { toast.error("Could not load preview."); }
    finally { setLoadingPreview(null); }
  };

  const jobs = data?.data ?? [];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-1">Job Board</h1>
        <p className="text-text-secondary">Find your next opportunity</p>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            className="input pl-9"
            placeholder="Search jobs, companies..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            className="input pl-9 w-44"
            placeholder="Location..."
            value={location}
            onChange={(e) => setFilter("location", e.target.value)}
          />
        </div>
        <select
          className="input w-40"
          value={jobType}
          onChange={(e) => setFilter("job_type", e.target.value)}
        >
          <option value="">All types</option>
          {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {(search || jobType || location) && (
          <button onClick={() => { setSearchInput(""); router.push("?"); }} className="btn-ghost flex items-center gap-1 text-text-muted">
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState icon={<Briefcase className="w-7 h-7" />} title="No jobs found" description="Try adjusting your filters." />
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="card-hover overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-charcoal-700 flex items-center justify-center flex-shrink-0">
                        <Briefcase className="w-5 h-5 text-text-muted" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold text-text-primary hover:text-electric-400 transition-colors">
                          {job.title}
                        </h3>
                        <p className="text-text-muted text-sm">{job.company}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{job.job_type}</span>
                      {(job.salary_min || job.salary_max) && (
                        <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{formatSalary(job.salary_min, job.salary_max, job.salary_currency)}</span>
                      )}
                      {job.experience_years && (
                        <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{formatExperience(job.experience_years)}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mt-3">
                      <div className="text-xs text-text-muted">{job.applicant_count ?? 0} applicants</div>
                      {job.required_skills.slice(0, 4).map((s, i) => <SkillBadge key={i} skill={s} />)}
                      {job.required_skills.length > 4 && (
                        <span className="text-xs text-text-muted self-center">+{job.required_skills.length - 4}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {previewScores[job.id] && (
                      <ScoreBadge score={previewScores[job.id].final_score} label={previewScores[job.id].score_label} />
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePreview(job)}
                        disabled={loadingPreview === job.id}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                      >
                        {loadingPreview === job.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                        Preview Match
                      </button>
                      <button
                        onClick={() => applyMutation.mutate({ jobId: job.id })}
                        disabled={applyMutation.isPending || !activeResume}
                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                      >
                        {applyMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Score preview panel */}
              {previewScores[job.id] && (
                <div className="border-t border-white/[0.06] bg-charcoal-900/50 p-4">
                  <AtsScoreCard score={previewScores[job.id]} mode="preview" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {data?.meta && <PaginationBar meta={data.meta} />}
    </div>
  );
}
