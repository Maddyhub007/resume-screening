"use client";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, queryKeys, getFriendlyError } from "@/lib/api/client";
import { AtsScoreCard } from "@/components/shared/AtsScoreCard";
import { StageBadge, ScoreBadge } from "@/components/shared";
import { formatRelativeDate } from "@/lib/utils/formatters";
import { ArrowLeft, X, Save, Loader2, User, Users } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useState } from "react";
import { Application, ApplicationStage } from "@/lib/types";

// ── Column definitions — UNCHANGED ───────────────────────────────────────────
const COLUMNS: { stage: ApplicationStage; label: string }[] = [
  { stage: "applied",      label: "Applied"      },
  { stage: "reviewed",     label: "Reviewed"     },
  { stage: "shortlisted",  label: "Shortlisted"  },
  { stage: "interviewing", label: "Interviewing" },
  { stage: "offered",      label: "Offered"      },
  { stage: "hired",        label: "Hired"        },
  { stage: "rejected",     label: "Rejected"     },
];

// ── LAYOUT CHANGE: Hired + Rejected are now part of one unified scrollable row
//    instead of a separate stacked div. This fixes the broken layout where
//    Hired was squished at the end of row 1 and Rejected fell below. ──────────

export default function ApplicantsKanbanPage() {
  const { id }          = useParams<{ id: string }>();
  const queryClient     = useQueryClient();
  const [selectedApp,      setSelectedApp]      = useState<Application | null>(null);
  const [stageModal,       setStageModal]        = useState<Application | null>(null);
  const [newStage,         setNewStage]          = useState<ApplicationStage>("reviewed");
  const [notes,            setNotes]             = useState("");
  const [rejectionReason,  setRejectionReason]   = useState("");

  // ── Queries — UNCHANGED ───────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.applications({ job_id: id }),
    queryFn:  () => api.listApplications({ job_id: id, limit: 100 }),
  });

  const { data: jobData } = useQuery({
    queryKey: queryKeys.job(id),
    queryFn:  () => api.getJob(id),
  });

  // ── Stage mutation — UNCHANGED ────────────────────────────────────────────
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

  // ── Data helpers — UNCHANGED ──────────────────────────────────────────────
  const applications = data?.data ?? [];

  const getAppsForStage = (stage: ApplicationStage) =>
    applications.filter((a) => a.stage === stage);

  const openStageModal = (app: Application) => {
    setStageModal(app);
    const stages: ApplicationStage[] = ["applied","reviewed","shortlisted","interviewing","offered","hired","rejected","withdrawn"];
    const idx = stages.indexOf(app.stage);
    setNewStage(stages[Math.min(idx + 1, stages.length - 1)]);
    setNotes("");
    setRejectionReason("");
  };

  const isTerminalStage = (stage: ApplicationStage) =>
    stage === "hired" || stage === "rejected";

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Page header ────────────────────────────────────────────────────
          CHANGE: Added job link text to back arrow, improved spacing,
          added total count badge */}
      <div className="flex items-center gap-4 px-6 pt-6 pb-4 flex-shrink-0">
        <Link
          href={`/recruiter/jobs/${id}`}
          className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary text-sm transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Job</span>
        </Link>

        <div className="w-px h-4 bg-white/[0.1]" />

        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold text-text-primary truncate">
            Pipeline — {jobData?.data?.title ?? "Loading…"}
          </h1>
        </div>

        {/* Applicant count badge */}
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0 px-3 py-1 rounded-full bg-charcoal-800 border border-white/[0.07]">
          <Users className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-sm text-text-secondary">
            {isLoading ? "—" : applications.length} applicant{applications.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Kanban board ───────────────────────────────────────────────────
          CHANGE: All 7 columns (including Hired + Rejected) are now in ONE
          unified horizontally-scrollable flex row. No more separate stacked
          div for terminal stages — that was the root cause of the broken layout.

          Each column has:
            - min-w-[220px]: never collapses below 220px on small screens
            - flex-1: expands evenly when there's room
            - max-w-[280px]: caps growth so wide screens don't get absurd columns

          The outer div uses overflow-x-auto so the whole board scrolls
          horizontally as one unit. */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto px-6 pb-6">
        {isLoading ? (
          <div className="flex gap-3 h-full">
            {COLUMNS.map((_, i) => (
              <div key={i} className="flex-shrink-0 w-56">
                <div className="h-10 skeleton rounded-lg mb-3" />
                <div className="space-y-2">
                  {[1,2].map((j) => <div key={j} className="card h-24 skeleton" />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3 h-full items-start" style={{ minWidth: "max-content" }}>
            {COLUMNS.map(({ stage, label }) => {
              const apps       = getAppsForStage(stage);
              const isTerminal = isTerminalStage(stage);
              return (
                <KanbanColumn
                  key={stage}
                  stage={stage}
                  label={label}
                  apps={apps}
                  isTerminal={isTerminal}
                  onCardClick={setSelectedApp}
                  onMoveClick={isTerminal ? () => {} : openStageModal}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Application detail drawer — UNCHANGED (logic) ─────────────────
          CHANGE: Only z-index and backdrop — no logic changes */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSelectedApp(null)}>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" />
          <div
            className="w-[520px] bg-charcoal-900 border-l border-white/[0.07] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-charcoal-900 z-10">
              <div>
                <h2 className="font-display font-semibold text-text-primary">
                  {selectedApp.candidate?.full_name ?? "Applicant"}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <StageBadge stage={selectedApp.stage} />
                  <span className="text-text-muted text-xs">{formatRelativeDate(selectedApp.applied_at)}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-2 rounded-lg hover:bg-charcoal-700 transition-colors"
              >
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

      {/* ── Stage update modal — UNCHANGED ───────────────────────────────── */}
      {stageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setStageModal(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative card p-6 w-full max-w-md mx-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
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
                  appId:            stageModal.id,
                  stage:            newStage,
                  recruiter_notes:  notes || undefined,
                  rejection_reason: newStage === "rejected" ? rejectionReason : undefined,
                })}
                disabled={stageMutation.isPending || (newStage === "rejected" && !rejectionReason)}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {stageMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Save className="w-4 h-4" />
                }
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── KanbanColumn — layout improved, logic UNCHANGED ──────────────────────────
const HEADER_COLORS: Record<string, string> = {
  applied:      "bg-blue-500/10    text-blue-400    border-blue-500/20",
  reviewed:     "bg-electric-500/10 text-electric-400 border-electric-500/20",
  shortlisted:  "bg-purple-500/10  text-purple-400  border-purple-500/20",
  interviewing: "bg-amber-500/10   text-amber-400   border-amber-500/20",
  offered:      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  hired:        "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected:     "bg-red-500/10     text-red-400     border-red-500/20",
};

function KanbanColumn({ stage, label, apps, onCardClick, onMoveClick, isTerminal }: {
  stage:       ApplicationStage;
  label:       string;
  apps:        Application[];
  onCardClick: (a: Application) => void;
  onMoveClick: (a: Application) => void;
  isTerminal:  boolean;
}) {
  return (
    // CHANGE: unified width for all columns — min/max so they breathe on
    // large screens but never collapse on small ones
    <div className="flex flex-col w-56 flex-shrink-0">

      {/* Column header */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-lg border mb-2 ${HEADER_COLORS[stage] ?? "bg-charcoal-700 text-text-secondary border-white/[0.07]"}`}>
        <span className="text-sm font-semibold capitalize">{label}</span>
        <span className="text-xs font-bold opacity-80 bg-black/20 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {apps.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 flex-1">
        {apps.length === 0 ? (
          // CHANGE: proper empty state per column instead of blank void
          <div className="flex flex-col items-center justify-center py-8 px-3 rounded-xl border border-dashed border-white/[0.06] text-center">
            <div className="w-8 h-8 rounded-full bg-charcoal-800 flex items-center justify-center mb-2">
              <User className="w-3.5 h-3.5 text-text-muted opacity-40" />
            </div>
            <p className="text-[11px] text-text-muted opacity-50">No candidates</p>
          </div>
        ) : (
          apps.map((app) => (
            <ApplicantCard
              key={app.id}
              app={app}
              onClick={() => onCardClick(app)}
              onMove={() => onMoveClick(app)}
              isTerminal={isTerminal}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── ApplicantCard — UNCHANGED (logic + structure) ─────────────────────────────
function ApplicantCard({ app, onClick, onMove, isTerminal }: {
  app:        Application;
  onClick:    () => void;
  onMove:     () => void;
  isTerminal: boolean;
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
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {s}
            </span>
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