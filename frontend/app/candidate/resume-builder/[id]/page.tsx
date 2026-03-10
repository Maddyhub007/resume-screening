"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store/authStore";
import { api, getFriendlyError } from "@/lib/api/client";
import {
  ResumeDraft, BuilderContent, BuilderAtsPreview,
  BuilderExperienceEntry, BuilderEducationEntry, BuilderProjectEntry,
} from "@/lib/types";
import { SkillBadge, Skeleton, ScoreBadge } from "@/components/shared";
import { getScoreColors } from "@/lib/utils/scoreColors";
import { motion as m } from "framer-motion";
import {
  Wand2, RefreshCw, Save, ChevronLeft, Plus, Trash2,
  Loader2, Check, AlertCircle, Sparkles, Eye, Edit3,
  ChevronDown, ChevronUp, CheckCircle2, XCircle, Info,
  FileOutput, Zap,
} from "lucide-react";

// ─── Query keys ───────────────────────────────────────────────────────────────
const bKeys = {
  draft:  (id: string) => ["builder", "draft", id] as const,
  drafts: (status?: string, p?: number) => ["builder", "drafts", status, p] as const,
};

// ─── Mini ATS preview gauge ───────────────────────────────────────────────────
function MiniScoreGauge({ preview }: { preview: BuilderAtsPreview }) {
  const colors = getScoreColors(preview.label as any);
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (preview.final_score * circumference);
  const pct = Math.round(preview.final_score * 100);

  return (
    <div className="card p-5">
      <div className="flex items-center gap-4">
        {/* Gauge */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 84 84">
            <circle cx="42" cy="42" r="38" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <motion.circle
              cx="42" cy="42" r="38" fill="none"
              stroke={colors?.hex ?? "#ccc"} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              style={{ filter: `drop-shadow(0 0 6px ${colors?.hex ?? "#ccc"}60)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-xl font-bold text-text-primary leading-none">{pct}</span>
            <span className="text-text-muted text-[10px]">/ 100</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex-1 space-y-1.5">
          <ScoreRow label="Keyword"  value={preview.keyword_score}         hex={colors?.hex} />
          <ScoreRow label="Semantic" value={preview.semantic_score}        hex={colors?.hex} />
          <ScoreRow label="Experience" value={preview.experience_score}    hex={colors?.hex} />
          <ScoreRow label="Sections"  value={preview.section_quality_score} hex={colors?.hex} />
        </div>
      </div>

      {/* Skills gap */}
      {(preview.matched_skills.length > 0 || preview.missing_skills.length > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-3 pt-4 border-t border-white/[0.06]">
          <div>
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              <CheckCircle2 className="w-3 h-3" /> Matched ({preview.matched_skills.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {preview.matched_skills.slice(0, 6).map((s) => (
                <SkillBadge key={s} skill={s} variant="matched" />
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
              <XCircle className="w-3 h-3" /> Missing ({preview.missing_skills.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {preview.missing_skills.slice(0, 6).map((s) => (
                <SkillBadge key={s} skill={s} variant="missing" />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreRow({ label, value, hex }: { label: string; value: number; hex?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-text-muted w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-charcoal-900 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: hex ?? "#38bdf8" }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(value * 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-[11px] text-text-muted w-8 text-right">{Math.round(value * 100)}%</span>
    </div>
  );
}

// ─── Editable skill tag ───────────────────────────────────────────────────────
function SkillTag({ skill, onRemove }: { skill: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-electric-500/10 text-electric-300 border border-electric-500/20 group">
      {skill}
      <button
        type="button"
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
      >
        <Trash2 className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  title, icon, children, defaultOpen = true,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary uppercase tracking-wider">
          {icon} {title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/[0.06]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main draft editor page ───────────────────────────────────────────────────
export default function DraftEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuthStore();
  const queryClient = useQueryClient();

  // Load draft
  const { data: draftData, isLoading } = useQuery({
    queryKey: bKeys.draft(id),
    queryFn: () => (api as any).getBuilderDraft(id),
    enabled: !!id,
  });
  const draft: ResumeDraft | null = draftData?.data ?? null;

  // Local editable content
  const [content, setContent] = useState<BuilderContent | null>(null);
  const [livePreview, setLivePreview] = useState<BuilderAtsPreview | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const [newCert, setNewCert] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  // Hydrate editor from draft
  useEffect(() => {
    if (draft?.content && !content) {
      setContent(draft.content);
      // Show stored preview score
      if (draft.predicted_score !== null && draft.score_breakdown) {
        setLivePreview({
          final_score: draft.predicted_score,
          label: (draft.score_breakdown.label ?? "fair") as any,
          keyword_score: draft.score_breakdown.keyword_score ?? 0,
          semantic_score: draft.score_breakdown.semantic_score ?? 0,
          experience_score: draft.score_breakdown.experience_score ?? 0,
          section_quality_score: draft.score_breakdown.section_quality_score ?? 0,
          matched_skills: draft.matched_skills ?? [],
          missing_skills: draft.missing_skills ?? [],
        });
      }
    }
  }, [draft]);

  // Live predict-score debounce
  const predictScore = useCallback(
    (newContent: BuilderContent) => {
      if (!draft?.job_id) return;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        try {
          const res = await (api as any).predictScore({
            job_id: draft.job_id,
            content: newContent,
          });
          setLivePreview(res.data);
        } catch {
          // Silently ignore preview errors
        }
      }, 1200);
    },
    [draft?.job_id]
  );

  const updateContent = useCallback(
    (updater: (c: BuilderContent) => BuilderContent) => {
      setContent((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        predictScore(next);
        return next;
      });
    },
    [predictScore]
  );

  // Refine mutation
  const refineMutation = useMutation({
    mutationFn: () => (api as any).refineResume({ draft_id: id }),
    onSuccess: (res: any) => {
      const updated = res.data;
      toast.success(`Refined! ATS score: ${Math.round(updated.ats_preview.final_score * 100)}%`);
      setContent(updated.content);
      setLivePreview(updated.ats_preview);
      queryClient.invalidateQueries({ queryKey: bKeys.draft(id) });
    },
    onError: (err) => toast.error(getFriendlyError(err)),
  });

  // Save draft mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      (api as any).saveDraft({ draft_id: id, content: content ?? undefined }),
    onSuccess: (res: any) => {
      const result = res.data;
      toast.success(
        `Resume saved! Final ATS: ${Math.round(result.final_score * 100)}% (${result.score_label})`
      );
      queryClient.invalidateQueries({ queryKey: bKeys.drafts() });
      router.push("/candidate/resume-builder");
    },
    onError: (err) => toast.error(getFriendlyError(err)),
  });

  if (isLoading || !draft) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const isFinalized = draft.is_finalized;
  const canRefine = !isFinalized && draft.iteration_count < 2;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={() => router.push("/candidate/resume-builder")}
            className="flex items-center gap-1.5 text-text-muted hover:text-text-primary transition-colors text-sm mb-3"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Resume Builder
          </button>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-text-primary">
              {draft.job_id ? "Targeted Resume" : "General Resume"}
            </h1>
            <DraftStatusBadge status={draft.status} />
            {draft.iteration_count > 0 && (
              <span className="text-xs text-text-muted border border-white/[0.07] px-2 py-0.5 rounded-full">
                {draft.iteration_count} refinement{draft.iteration_count !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2">
          {canRefine && (
            <button
              onClick={() => refineMutation.mutate()}
              disabled={refineMutation.isPending || isFinalized}
              className="btn-ghost flex items-center gap-2 border border-white/[0.07] hover:border-electric-500/40 disabled:opacity-40"
            >
              {refineMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RefreshCw className="w-4 h-4" />}
              Refine
            </button>
          )}
          {!isFinalized && (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="btn-primary flex items-center gap-2 disabled:opacity-60"
            >
              {saveMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Save className="w-4 h-4" />}
              Save as Resume
            </button>
          )}
          {isFinalized && (
            <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Check className="w-4 h-4" /> Saved to Resumes
            </span>
          )}
        </div>
      </div>

      {/* Max iterations notice */}
      {!isFinalized && draft.iteration_count >= 2 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400 mb-5">
          <Info className="w-4 h-4 flex-shrink-0" />
          Maximum refinements reached. Edit manually below, then save.
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* ── Left: Editor ── */}
        <div className="col-span-2 space-y-4">
          {!content ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))
          ) : (
            <>
              {/* Summary */}
              <Section title="Summary" icon={<Edit3 className="w-3.5 h-3.5 text-electric-400" />}>
                <textarea
                  value={content.summary}
                  onChange={(e) => updateContent(c => ({ ...c, summary: e.target.value }))}
                  disabled={isFinalized}
                  rows={4}
                  className="input w-full mt-3 resize-none text-sm leading-relaxed"
                  placeholder="Professional summary…"
                />
              </Section>

              {/* Skills */}
              <Section title="Skills" icon={<Zap className="w-3.5 h-3.5 text-electric-400" />}>
                <div className="mt-3 flex flex-wrap gap-2 mb-3">
                  {content.skills.map((skill, i) => (
                    <SkillTag
                      key={i}
                      skill={skill}
                      onRemove={() => updateContent(c => ({
                        ...c, skills: c.skills.filter((_, idx) => idx !== i),
                      }))}
                    />
                  ))}
                </div>
                {!isFinalized && (
                  <div className="flex gap-2">
                    <input
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newSkill.trim()) {
                          e.preventDefault();
                          updateContent(c => ({ ...c, skills: [...c.skills, newSkill.trim()] }));
                          setNewSkill("");
                        }
                      }}
                      placeholder="Add skill and press Enter…"
                      className="input flex-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newSkill.trim()) {
                          updateContent(c => ({ ...c, skills: [...c.skills, newSkill.trim()] }));
                          setNewSkill("");
                        }
                      }}
                      className="btn-ghost px-3 border border-white/[0.07]"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </Section>

              {/* Experience */}
              <Section title="Experience" icon={<FileOutput className="w-3.5 h-3.5 text-electric-400" />}>
                <div className="mt-3 space-y-4">
                  {content.experience.map((exp, i) => (
                    <ExperienceBlock
                      key={i}
                      entry={exp}
                      index={i}
                      disabled={isFinalized}
                      onChange={(updated) => updateContent(c => ({
                        ...c,
                        experience: c.experience.map((e, idx) => idx === i ? updated : e),
                      }))}
                      onRemove={() => updateContent(c => ({
                        ...c, experience: c.experience.filter((_, idx) => idx !== i),
                      }))}
                    />
                  ))}
                  {!isFinalized && (
                    <button
                      type="button"
                      onClick={() => updateContent(c => ({
                        ...c,
                        experience: [...c.experience, {
                          role: "", company: "", date_range: "", impact_points: [""],
                        }],
                      }))}
                      className="btn-ghost w-full border border-dashed border-white/[0.10] flex items-center justify-center gap-2 text-text-muted hover:text-text-primary py-3"
                    >
                      <Plus className="w-4 h-4" /> Add experience
                    </button>
                  )}
                </div>
              </Section>

              {/* Education */}
              <Section title="Education" icon={<span className="text-sm">🎓</span>} defaultOpen={false}>
                <div className="mt-3 space-y-3">
                  {content.education.map((edu, i) => (
                    <EducationBlock
                      key={i}
                      entry={edu}
                      disabled={isFinalized}
                      onChange={(updated) => updateContent(c => ({
                        ...c,
                        education: c.education.map((e, idx) => idx === i ? updated : e),
                      }))}
                      onRemove={() => updateContent(c => ({
                        ...c, education: c.education.filter((_, idx) => idx !== i),
                      }))}
                    />
                  ))}
                  {!isFinalized && (
                    <button
                      type="button"
                      onClick={() => updateContent(c => ({
                        ...c,
                        education: [...c.education, { degree: "", institution: "", year: "", gpa: "" }],
                      }))}
                      className="btn-ghost w-full border border-dashed border-white/[0.10] flex items-center justify-center gap-2 text-text-muted py-2"
                    >
                      <Plus className="w-4 h-4" /> Add education
                    </button>
                  )}
                </div>
              </Section>

              {/* Certifications */}
              <Section title="Certifications" icon={<span className="text-sm">🏆</span>} defaultOpen={false}>
                <div className="mt-3 flex flex-wrap gap-2 mb-3">
                  {content.certifications.map((cert, i) => (
                    <SkillTag
                      key={i}
                      skill={cert}
                      onRemove={() => updateContent(c => ({
                        ...c, certifications: c.certifications.filter((_, idx) => idx !== i),
                      }))}
                    />
                  ))}
                </div>
                {!isFinalized && (
                  <div className="flex gap-2">
                    <input
                      value={newCert}
                      onChange={(e) => setNewCert(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newCert.trim()) {
                          e.preventDefault();
                          updateContent(c => ({ ...c, certifications: [...c.certifications, newCert.trim()] }));
                          setNewCert("");
                        }
                      }}
                      placeholder="Add certification and press Enter…"
                      className="input flex-1 text-sm"
                    />
                  </div>
                )}
              </Section>

              {/* Projects */}
              <Section title="Projects" icon={<span className="text-sm">🚀</span>} defaultOpen={false}>
                <div className="mt-3 space-y-3">
                  {content.projects.map((proj, i) => (
                    <ProjectBlock
                      key={i}
                      entry={proj}
                      disabled={isFinalized}
                      onChange={(updated) => updateContent(c => ({
                        ...c,
                        projects: c.projects.map((p, idx) => idx === i ? updated : p),
                      }))}
                      onRemove={() => updateContent(c => ({
                        ...c, projects: c.projects.filter((_, idx) => idx !== i),
                      }))}
                    />
                  ))}
                  {!isFinalized && (
                    <button
                      type="button"
                      onClick={() => updateContent(c => ({
                        ...c,
                        projects: [...c.projects, { name: "", description: "", tech_used: [] }],
                      }))}
                      className="btn-ghost w-full border border-dashed border-white/[0.10] flex items-center justify-center gap-2 text-text-muted py-2"
                    >
                      <Plus className="w-4 h-4" /> Add project
                    </button>
                  )}
                </div>
              </Section>
            </>
          )}
        </div>

        {/* ── Right: Live Score ── */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-electric-400" />
              Live ATS Preview
            </h2>
            {livePreview ? (
              <MiniScoreGauge preview={livePreview} />
            ) : (
              <div className="card p-5 text-center">
                <Skeleton className="w-20 h-20 rounded-full mx-auto mb-3" />
                <Skeleton className="h-3 w-3/4 mx-auto" />
              </div>
            )}
          </div>

          {/* Tips */}
          {livePreview && livePreview.final_score < 0.75 && !isFinalized && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-4"
            >
              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Score below 75%
              </div>
              <p className="text-text-muted text-xs leading-relaxed mb-3">
                {livePreview.missing_skills.length > 0
                  ? `Add missing skills: ${livePreview.missing_skills.slice(0, 3).join(", ")}${livePreview.missing_skills.length > 3 ? "…" : ""}`
                  : "Strengthen your experience bullets with quantified impact."}
              </p>
              {canRefine && (
                <button
                  onClick={() => refineMutation.mutate()}
                  disabled={refineMutation.isPending}
                  className="btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                >
                  {refineMutation.isPending
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <RefreshCw className="w-3 h-3" />}
                  Auto-refine now
                </button>
              )}
            </motion.div>
          )}

          {/* Score hit */}
          {livePreview && livePreview.final_score >= 0.75 && !isFinalized && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card p-4 border-emerald-500/20 bg-emerald-500/5"
            >
              <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> ATS target met
              </div>
              <p className="text-text-muted text-xs leading-relaxed">
                Great score! Review the content and save when ready.
              </p>
            </motion.div>
          )}

          {/* Template info */}
          {draft.template_id && (
            <div className="card p-4">
              <div className="text-xs text-text-muted uppercase tracking-wider mb-2">Template</div>
              <div className="text-sm font-medium text-text-primary capitalize">{draft.template_id}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-editors ──────────────────────────────────────────────────────────────

function ExperienceBlock({
  entry, index, disabled, onChange, onRemove,
}: {
  entry: BuilderExperienceEntry;
  index: number;
  disabled?: boolean;
  onChange: (v: BuilderExperienceEntry) => void;
  onRemove: () => void;
}) {
  return (
    <div className="p-4 rounded-xl bg-charcoal-900/60 border border-white/[0.06] space-y-3">
      <div className="flex justify-between">
        <span className="text-xs text-text-muted uppercase tracking-wider font-medium">
          Experience #{index + 1}
        </span>
        {!disabled && (
          <button onClick={onRemove} className="text-text-muted hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={entry.role}
          onChange={(e) => onChange({ ...entry, role: e.target.value })}
          disabled={disabled}
          placeholder="Role / Title"
          className="input text-sm"
        />
        <input
          value={entry.company}
          onChange={(e) => onChange({ ...entry, company: e.target.value })}
          disabled={disabled}
          placeholder="Company"
          className="input text-sm"
        />
      </div>
      <input
        value={entry.date_range}
        onChange={(e) => onChange({ ...entry, date_range: e.target.value })}
        disabled={disabled}
        placeholder="e.g. Jan 2022 – Present"
        className="input w-full text-sm"
      />
      <div className="space-y-1.5">
        <span className="text-[11px] text-text-muted uppercase tracking-wider">Impact points</span>
        {entry.impact_points.map((pt, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-text-muted text-xs mt-2.5 flex-shrink-0">•</span>
            <textarea
              value={pt}
              onChange={(e) => {
                const pts = [...entry.impact_points];
                pts[i] = e.target.value;
                onChange({ ...entry, impact_points: pts });
              }}
              disabled={disabled}
              rows={2}
              placeholder="Strong action verb + achievement + impact…"
              className="input flex-1 text-sm resize-none"
            />
            {!disabled && entry.impact_points.length > 1 && (
              <button
                onClick={() => onChange({ ...entry, impact_points: entry.impact_points.filter((_, idx) => idx !== i) })}
                className="text-text-muted hover:text-red-400 mt-1 flex-shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange({ ...entry, impact_points: [...entry.impact_points, ""] })}
            className="text-electric-400 text-xs flex items-center gap-1 mt-1 hover:text-electric-300"
          >
            <Plus className="w-3 h-3" /> Add bullet
          </button>
        )}
      </div>
    </div>
  );
}

function EducationBlock({
  entry, disabled, onChange, onRemove,
}: {
  entry: BuilderEducationEntry;
  disabled?: boolean;
  onChange: (v: BuilderEducationEntry) => void;
  onRemove: () => void;
}) {
  return (
    <div className="p-3 rounded-xl bg-charcoal-900/60 border border-white/[0.06] space-y-2">
      <div className="flex justify-end">
        {!disabled && (
          <button onClick={onRemove} className="text-text-muted hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={entry.degree} onChange={(e) => onChange({ ...entry, degree: e.target.value })} disabled={disabled} placeholder="Degree" className="input text-sm" />
        <input value={entry.institution} onChange={(e) => onChange({ ...entry, institution: e.target.value })} disabled={disabled} placeholder="Institution" className="input text-sm" />
        <input value={entry.year} onChange={(e) => onChange({ ...entry, year: e.target.value })} disabled={disabled} placeholder="Year" className="input text-sm" />
        <input value={entry.gpa} onChange={(e) => onChange({ ...entry, gpa: e.target.value })} disabled={disabled} placeholder="GPA (optional)" className="input text-sm" />
      </div>
    </div>
  );
}

function ProjectBlock({
  entry, disabled, onChange, onRemove,
}: {
  entry: BuilderProjectEntry;
  disabled?: boolean;
  onChange: (v: BuilderProjectEntry) => void;
  onRemove: () => void;
}) {
  const [techInput, setTechInput] = useState("");
  return (
    <div className="p-3 rounded-xl bg-charcoal-900/60 border border-white/[0.06] space-y-2">
      <div className="flex justify-end">
        {!disabled && (
          <button onClick={onRemove} className="text-text-muted hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <input value={entry.name} onChange={(e) => onChange({ ...entry, name: e.target.value })} disabled={disabled} placeholder="Project name" className="input w-full text-sm" />
      <textarea value={entry.description} onChange={(e) => onChange({ ...entry, description: e.target.value })} disabled={disabled} rows={2} placeholder="Description…" className="input w-full text-sm resize-none" />
      <div className="flex flex-wrap gap-1 mb-1">
        {entry.tech_used.map((t, i) => (
          <SkillTag key={i} skill={t} onRemove={() => onChange({ ...entry, tech_used: entry.tech_used.filter((_, idx) => idx !== i) })} />
        ))}
      </div>
      {!disabled && (
        <input
          value={techInput}
          onChange={(e) => setTechInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && techInput.trim()) {
              e.preventDefault();
              onChange({ ...entry, tech_used: [...entry.tech_used, techInput.trim()] });
              setTechInput("");
            }
          }}
          placeholder="Add tech and press Enter…"
          className="input w-full text-sm"
        />
      )}
    </div>
  );
}

// ─── DraftStatusBadge (local copy so this file is self-contained) ─────────────
function DraftStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft:     "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    refined:   "bg-electric-500/10 text-electric-400 border border-electric-500/20",
    finalized: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  };
  return <span className={`badge capitalize ${map[status] ?? "badge-neutral"}`}>{status}</span>;
}