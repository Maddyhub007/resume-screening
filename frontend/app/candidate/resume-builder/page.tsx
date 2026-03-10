"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store/authStore";
import { api, queryKeys, getFriendlyError } from "@/lib/api/client";
import { ResumeDraft } from "@/lib/types";
import {
  EmptyState, Skeleton, ScoreBadge,
} from "@/components/shared";
import {
  Wand2, Plus, ChevronRight, Clock, CheckCircle2,
  Sparkles, FileOutput, Trash2, Loader2, RefreshCw,
  LayoutTemplate, Target,
} from "lucide-react";
import { formatRelativeDate } from "@/lib/utils/formatters";

// ─── queryKeys additions (inline until you patch client.ts) ──────────────────
const bKeys = {
  drafts: (status?: string, p?: number) => ["builder", "drafts", status, p] as const,
};

// ─── Status helpers ───────────────────────────────────────────────────────────
function DraftStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft:     "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    refined:   "bg-electric-500/10 text-electric-400 border border-electric-500/20",
    finalized: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  };
  const icons: Record<string, React.ReactNode> = {
    draft:     <Clock className="w-3 h-3" />,
    refined:   <RefreshCw className="w-3 h-3" />,
    finalized: <CheckCircle2 className="w-3 h-3" />,
  };
  return (
    <span className={`badge inline-flex items-center gap-1 capitalize ${map[status] ?? "badge-neutral"}`}>
      {icons[status]} {status}
    </span>
  );
}

// ─── Template display name ────────────────────────────────────────────────────
const TEMPLATE_LABELS: Record<string, { label: string; color: string }> = {
  modern:    { label: "Modern",    color: "text-electric-400" },
  classic:   { label: "Classic",  color: "text-text-secondary" },
  minimal:   { label: "Minimal",  color: "text-text-muted" },
  technical: { label: "Technical",color: "text-emerald-400" },
};

// ─── Draft card ───────────────────────────────────────────────────────────────
function DraftCard({ draft }: { draft: ResumeDraft }) {
  const router = useRouter();
  const tmpl = TEMPLATE_LABELS[draft.template_id] ?? { label: draft.template_id, color: "text-text-muted" };
  const scoreLabel = (draft.predicted_score ?? 0) >= 0.80 ? "excellent"
    : (draft.predicted_score ?? 0) >= 0.65 ? "good"
    : (draft.predicted_score ?? 0) >= 0.50 ? "fair" : "weak";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/candidate/resume-builder/${draft.id}`}
        className="card-hover p-5 flex items-center gap-4 group "
      >
        {/* Icon */}
        <div className="w-11 h-11 rounded-xl bg-electric-500/10 border border-electric-500/20 flex items-center justify-center flex-shrink-0">
          <FileOutput className="w-5 h-5 text-electric-400" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-text-primary text-sm group-hover:text-electric-400 transition-colors truncate">
              {draft.job_id ? "Targeted Resume" : "General Resume"}
            </span>
            <DraftStatusBadge status={draft.status} />
          </div>
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className={`flex items-center gap-1 ${tmpl.color}`}>
              <LayoutTemplate className="w-3 h-3" />
              {tmpl.label}
            </span>
            <span>·</span>
            <span>{draft.iteration_count} refinement{draft.iteration_count !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{formatRelativeDate(draft.created_at)}</span>
          </div>
        </div>

        {/* Score */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {draft.predicted_score !== null && (
            <div className="text-right">
              <ScoreBadge score={draft.predicted_score} label={scoreLabel} />
              <div className="text-[10px] text-text-muted mt-0.5 text-right">ATS preview</div>
            </div>
          )}
          <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-electric-400 transition-colors" />
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Status filter tabs ───────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { value: "",          label: "All" },
  { value: "draft",     label: "Draft" },
  { value: "refined",   label: "Refined" },
  { value: "finalized", label: "Finalized" },
];

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ResumeBuilderPage() {
  const { userId } = useAuthStore();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");
  const [page] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: bKeys.drafts(statusFilter, page),
    queryFn: () =>
      (api as any).listBuilderDrafts({
        status: statusFilter || undefined,
        page,
        limit: 20,
      }),
    enabled: !!userId,
  });

  const drafts: ResumeDraft[] = data?.data ?? [];

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-electric-500/15 border border-electric-500/30 flex items-center justify-center">
              <Wand2 className="w-4.5 h-4.5 text-electric-400" />
            </div>
            <h1 className="font-display text-3xl font-bold text-text-primary">
              Resume Builder
            </h1>
          </div>
          <p className="text-text-secondary ml-12">
            AI-crafted resumes optimised for specific jobs
          </p>
        </div>

        <Link href="/candidate/resume-builder/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Resume
        </Link>
      </div>

      {/* ── Feature highlight (shown only when no drafts yet) ── */}
      {!isLoading && drafts.length === 0 && !statusFilter && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-4 mb-8"
        >
          {[
            {
              icon: Target,
              title: "Job-targeted",
              desc: "Tailored to each job's exact requirements and missing skills",
            },
            {
              icon: Sparkles,
              title: "AI-optimised",
              desc: "Groq LLM rewrites bullets with strong verbs and impact metrics",
            },
            {
              icon: RefreshCw,
              title: "Auto-refined",
              desc: "Iterates until ATS score clears 75% threshold",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-5">
              <div className="w-9 h-9 rounded-lg bg-charcoal-700 border border-white/[0.07] flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-electric-400" />
              </div>
              <div className="font-medium text-text-primary text-sm mb-1">{title}</div>
              <p className="text-text-muted text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Filter tabs ── */}
      {(drafts.length > 0 || statusFilter) && (
        <div className="flex gap-2 mb-5">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`badge cursor-pointer transition-all ${
                statusFilter === value ? "badge-electric" : "badge-neutral"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 flex items-center gap-4">
              <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <EmptyState
          icon={<Wand2 className="w-7 h-7" />}
          title={statusFilter ? `No ${statusFilter} drafts` : "No resumes yet"}
          description={
            statusFilter
              ? "Try a different filter or create a new resume."
              : "Generate your first AI-optimised resume in under 60 seconds."
          }
          action={
            <Link href="/candidate/resume-builder/new" className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create your first resume
            </Link>
          }
        />
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-2">
            {drafts.map((draft) => (
              <DraftCard key={draft.id} draft={draft} />
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}