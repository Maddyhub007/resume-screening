"use client";
import { useAuthStore } from "@/lib/store/authStore";
import { useQuery } from "@tanstack/react-query";
import { api, queryKeys } from "@/lib/api/client";
import { CardSkeleton, ScoreBadge, SkillBadge, EmptyState, StageBadge } from "@/components/shared";
import { formatRelativeDate, formatSalary } from "@/lib/utils/formatters";
import { Briefcase, FileText, ClipboardList, TrendingUp, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { JobRecommendation } from "@/lib/types";

export default function CandidateDashboard() {
  const { userId, userName } = useAuthStore();

  const { data: candidateData } = useQuery({
    queryKey: queryKeys.candidate(userId!),
    queryFn: () => api.getCandidate(userId!),
    enabled: !!userId,
  });

  const { data: resumesData } = useQuery({
    queryKey: queryKeys.candidateResumes(userId!),
    queryFn: () => api.getCandidateResumes(userId!),
    enabled: !!userId,
  });

  const { data: applicationsData } = useQuery({
    queryKey: queryKeys.applications({ candidate_id: userId! }),
    queryFn: () => api.listApplications({ candidate_id: userId!, limit: 5 }),
    enabled: !!userId,
  });

  const activeResume = resumesData?.data?.find((r) => r.is_active && r.parse_status === "success");

  // Master prompt: use POST /scores/job-recommendations with resume_id
  const { data: recommendationsData, isLoading: recLoading } = useQuery({
    queryKey: ["job-recommendations", activeResume?.id],
    queryFn: () => api.jobRecommendations(activeResume!.id, { top_n: 6 }),
    enabled: !!activeResume?.id,
  });

  const applications = applicationsData?.data ?? [];
  const recommendations = recommendationsData?.data?.recommendations ?? [];

  const stats = [
    { label: "Resumes", value: resumesData?.data?.length ?? 0, icon: FileText, href: "/candidate/resumes" },
    { label: "Applications", value: applications.length, icon: ClipboardList, href: "/candidate/applications" },
    { label: "Matches", value: recommendationsData?.data?.total ?? 0, icon: TrendingUp, href: "/candidate/jobs" },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-text-primary">
          Welcome back, <span className="text-electric-400">{userName?.split(" ")[0]}</span> 👋
        </h1>
        <p className="text-text-secondary mt-1">Here&apos;s what&apos;s happening with your job search.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card-hover p-5 flex items-center gap-4 group">
            <div className="w-10 h-10 rounded-xl bg-electric-500/10 flex items-center justify-center">
              <s.icon className="w-5 h-5 text-electric-400" />
            </div>
            <div>
              <div className="font-display text-2xl font-bold text-text-primary">{s.value}</div>
              <div className="text-text-muted text-sm">{s.label}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted ml-auto group-hover:text-electric-400 transition-colors" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Job recommendations */}
        <div className="col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Recommended Jobs</h2>
            <Link href="/candidate/jobs" className="text-electric-400 text-sm hover:text-electric-300 transition-colors">
              View all →
            </Link>
          </div>

          {!activeResume ? (
            <div className="card p-6 text-center">
              <FileText className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary text-sm mb-4">Upload a resume to get personalized job recommendations.</p>
              <Link href="/candidate/resumes/upload" className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Upload Resume
              </Link>
            </div>
          ) : recLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
            </div>
          ) : recommendations.length === 0 ? (
            <EmptyState icon={<Briefcase className="w-7 h-7" />} title="No recommendations yet" description="Your recommendations will appear here once jobs are available." />
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec) => (
                <RecommendationCard key={rec.job_id} rec={rec} />
              ))}
            </div>
          )}
        </div>

        {/* Recent applications */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Recent Applications</h2>
            <Link href="/candidate/applications" className="text-electric-400 text-sm hover:text-electric-300 transition-colors">
              View all →
            </Link>
          </div>

          {applications.length === 0 ? (
            <div className="card p-5 text-center">
              <p className="text-text-muted text-sm">No applications yet. Start applying!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {applications.slice(0, 5).map((app) => (
                <Link key={app.id} href={`/candidate/applications/${app.id}`} className="card-hover p-4 flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg bg-charcoal-700 flex items-center justify-center">
                    <Briefcase className="w-4 h-4 text-text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">Job Application</div>
                    <div className="text-xs text-text-muted">{formatRelativeDate(app.applied_at)}</div>
                  </div>
                  <StageBadge stage={app.stage} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: JobRecommendation }) {
  return (
    <Link href={`/candidate/jobs/${rec.job_id}`} className="card-hover p-4 flex items-start gap-3 group">
      <div className="w-10 h-10 rounded-xl bg-charcoal-700 flex items-center justify-center flex-shrink-0">
        <Briefcase className="w-5 h-5 text-text-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-medium text-text-primary text-sm group-hover:text-electric-400 transition-colors">{rec.title}</div>
            <div className="text-text-muted text-xs mt-0.5">{rec.company} · {rec.location}</div>
          </div>
          <ScoreBadge score={rec.final_score} label={rec.score_label} />
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {rec.matched_skills.slice(0, 4).map((s, i) => (
            <SkillBadge key={i} skill={s} variant="matched" />
          ))}
        </div>
      </div>
    </Link>
  );
}
