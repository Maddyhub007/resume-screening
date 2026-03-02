"use client";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, queryKeys, getFriendlyError } from "@/lib/api/client";
import { AtsScoreCard } from "@/components/shared/AtsScoreCard";
import { StageBadge, ScoreBadge } from "@/components/shared";
import { formatRelativeDate } from "@/lib/utils/formatters";
import { ArrowLeft, X, Save, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useState } from "react";
import { Application, ApplicationStage } from "@/lib/types";

const COLUMNS: { stage: ApplicationStage; label: string }[] = [
  { stage: "applied", label: "Applied" },
  { stage: "reviewed", label: "Reviewed" },
  { stage: "shortlisted", label: "Shortlisted" },
  { stage: "interviewing", label: "Interviewing" },
  { stage: "offered", label: "Offered" },
];

const TERMINAL: { stage: ApplicationStage; label: string }[] = [
  { stage: "hired", label: "Hired" },
  { stage: "rejected", label: "Rejected" },
];

export default function ApplicantsKanbanPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [stageModal, setStageModal] = useState<Application | null>(null);
  const [newStage, setNewStage] = useState<ApplicationStage>("reviewed");
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.applications({ job_id: id }),
    queryFn: () => api.listApplications({ job_id: id, limit: 100 }),
  });

  const { data: jobData } = useQuery({
    queryKey: queryKeys.job(id),
    queryFn: () => api.getJob(id),
  });

  const stageMutation = useMutation({
    mutationFn: ({ appId, stage, recruiter_notes, rejection_reason }: {
      appId: string; stage: ApplicationStage; recruiter_notes?: string; rejection_reason?: string;
    }) => api.updateApplicationStage(appId, { stage, recruiter_notes, rejection_reason }),
    onMutate: async ({ appId, stage }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.applications({ job_id: id }) });
      const prev = queryClient.getQueryData(queryKeys.applications({ job_id: id }));
      queryClient.setQueryData(queryKeys.applications({ job_id: id }), (old: any) => ({
        ...old,
        data: old?.data?.map((a: Application) => a.id === appId ? { ...a, stage } : a),
      }));
      return { prev };
    },
    onError: (err, _, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.applications({ job_id: id }), ctx.prev);
      toast.error(getFriendlyError(err));
    },
    onSuccess: () => {
      toast.success("Stage updated!");
      setStageModal(null);
      setNotes("");
      setRejectionReason("");
    },
  });

  const applications = data?.data ?? [];
  const grouped = (stages: { stage: ApplicationStage }[]) =>
    stages.reduce((acc, { stage }) => {
      acc[stage] = applications.filter((a) => a.stage === stage);
      return acc;
    }, {} as Record<ApplicationStage, Application[]>);

  const columnGroups = grouped(COLUMNS);
  const terminalGroups = grouped(TERMINAL);

  const openStageModal = (app: Application) => {
    setStageModal(app);
    const stages: ApplicationStage[] = ["applied","reviewed","shortlisted","interviewing","offered","hired","rejected","withdrawn"];
    const idx = stages.indexOf(app.stage);
    setNewStage(stages[Math.min(idx + 1, stages.length - 1)]);
    setNotes("");
    setRejectionReason("");
  };

  return (
    <div className="p-8 max-w-full">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/recruiter/jobs/${id}`} className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            Pipeline — {jobData?.data?.title ?? "Job"}
          </h1>
          <p className="text-text-secondary text-sm">{applications.length} total applicants</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1,2,3,4,5].map((i) => <div key={i} className="card w-64 flex-shrink-0 h-80 skeleton" />)}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6">
          {COLUMNS.map(({ stage, label }) => {
            const apps = columnGroups[stage] ?? [];
            return (
              <KanbanColumn key={stage} stage={stage} label={label} apps={apps}
                onCardClick={setSelectedApp} onMoveClick={openStageModal} />
            );
          })}
          {/* Terminal columns */}
          <div className="flex flex-col gap-4 flex-shrink-0 w-64">
            {TERMINAL.map(({ stage, label }) => {
              const apps = terminalGroups[stage] ?? [];
              return (
                <KanbanColumn key={stage} stage={stage} label={label} apps={apps}
                  onCardClick={setSelectedApp} onMoveClick={() => {}} isTerminal />
              );
            })}
          </div>
        </div>
      )}

      {/* Application detail drawer */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSelectedApp(null)}>
          <div className="flex-1 bg-black/60" />
          <div className="w-[560px] bg-charcoal-900 border-l border-white/[0.07] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h2 className="font-display font-semibold text-text-primary">{selectedApp.candidate?.full_name ?? "Applicant"}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <StageBadge stage={selectedApp.stage} />
                  <span className="text-text-muted text-xs">{formatRelativeDate(selectedApp.applied_at)}</span>
                </div>
              </div>
              <button onClick={() => setSelectedApp(null)} className="p-2 rounded-lg hover:bg-charcoal-700 transition-colors">
                <X className="w-4 h-4 text-text-muted" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {selectedApp.ats_score ? (
                <AtsScoreCard score={selectedApp.ats_score} mode="full" />
              ) : (
                <div className="card p-6 text-center text-text-muted">
                  <p className="text-sm">No ATS score available.</p>
                </div>
              )}
              <button
                onClick={() => { setSelectedApp(null); openStageModal(selectedApp); }}
                className="btn-primary w-full"
              >
                Update Stage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage update modal */}
      {stageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setStageModal(null)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative card p-6 w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-semibold text-text-primary">Update Stage</h2>
            <p className="text-text-muted text-sm">{stageModal.candidate?.full_name ?? "Applicant"}</p>

            <div>
              <label className="label">New Stage</label>
              <select
                className="input"
                value={newStage}
                onChange={(e) => setNewStage(e.target.value as ApplicationStage)}
              >
                {["applied","reviewed","shortlisted","interviewing","offered","hired","rejected","withdrawn"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Recruiter Notes (optional)</label>
              <textarea
                className="input min-h-[80px]"
                placeholder="Add notes for your team..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {newStage === "rejected" && (
              <div>
                <label className="label">Rejection Reason *</label>
                <input
                  className="input"
                  placeholder="Not enough experience..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStageModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => stageMutation.mutate({
                  appId: stageModal.id,
                  stage: newStage,
                  recruiter_notes: notes || undefined,
                  rejection_reason: newStage === "rejected" ? rejectionReason : undefined,
                })}
                disabled={stageMutation.isPending || (newStage === "rejected" && !rejectionReason)}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {stageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ stage, label, apps, onCardClick, onMoveClick, isTerminal = false }: {
  stage: ApplicationStage; label: string; apps: Application[];
  onCardClick: (a: Application) => void; onMoveClick: (a: Application) => void;
  isTerminal?: boolean;
}) {
  const headerColors: Record<string, string> = {
    applied: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    reviewed: "bg-electric-500/10 text-electric-400 border-electric-500/20",
    shortlisted: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    interviewing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    offered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    hired: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <div className={`flex-shrink-0 ${isTerminal ? "w-full" : "w-64"}`}>
      <div className={`flex items-center justify-between px-3 py-2 rounded-lg border mb-3 ${headerColors[stage] ?? "bg-charcoal-700 text-text-secondary border-white/[0.07]"}`}>
        <span className="text-sm font-semibold capitalize">{label}</span>
        <span className="text-xs opacity-70">{apps.length}</span>
      </div>
      <div className="space-y-2 min-h-[100px]">
        {apps.map((app) => (
          <ApplicantCard key={app.id} app={app} onClick={() => onCardClick(app)} onMove={() => onMoveClick(app)} isTerminal={isTerminal} />
        ))}
      </div>
    </div>
  );
}

function ApplicantCard({ app, onClick, onMove, isTerminal }: {
  app: Application; onClick: () => void; onMove: () => void; isTerminal: boolean;
}) {
  return (
    <div className="card-hover p-3 cursor-pointer group" onClick={onClick}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-charcoal-600 flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-text-muted" />
          </div>
          <span className="text-sm font-medium text-text-primary truncate">
            {app.candidate?.full_name ?? "Candidate"}
          </span>
        </div>
        {app.ats_score && (
          <ScoreBadge score={app.ats_score.final_score} label={app.ats_score.score_label} />
        )}
      </div>

      {app.ats_score && (
        <div className="flex flex-wrap gap-1 mb-2">
          {app.ats_score.matched_skills.slice(0, 3).map((s, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{s}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-muted">{formatRelativeDate(app.applied_at)}</span>
        {!isTerminal && (
          <button
            onClick={(e) => { e.stopPropagation(); onMove(); }}
            className="text-[10px] text-electric-400 hover:text-electric-300 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Move →
          </button>
        )}
      </div>
    </div>
  );
}
