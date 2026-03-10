"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store/authStore";
import { api, getFriendlyError } from "@/lib/api/client";
import { BuilderTemplate, Job } from "@/lib/types";
import { SkillBadge, Skeleton } from "@/components/shared";
import {
  Search, ChevronRight, ChevronLeft, Briefcase, Wand2,
  MapPin, Clock, Loader2, Check, Sparkles, LayoutTemplate,
  FileText, ArrowRight, AlertCircle,
} from "lucide-react";

// ─── Zod schemas ──────────────────────────────────────────────────────────────
const step1Schema = z.object({
  job_id: z.string().min(1, "Please select a target job"),
});
const step2Schema = z.object({
  template_id: z.string().min(1, "Please choose a template"),
  user_prompt: z.string().max(2000).optional(),
});
type Step1Form = z.infer<typeof step1Schema>;
type Step2Form = z.infer<typeof step2Schema>;

// ─── Template card ────────────────────────────────────────────────────────────
function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: BuilderTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  const layoutIcons: Record<string, string> = {
    "two-column":   "▤",
    "single-column":"▥",
    "skills-first": "▦",
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative p-4 rounded-xl border text-left transition-all duration-200 ${
        selected
          ? "border-electric-500/60 bg-electric-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.3)]"
          : "border-white/[0.07] bg-charcoal-800 hover:border-white/[0.15] hover:bg-charcoal-750"
      }`}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-electric-500 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Mock layout preview */}
      <div
        className="w-full h-20 rounded-lg mb-3 flex gap-1.5 p-2 overflow-hidden"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {template.layout === "two-column" ? (
          <>
            <div className="w-1/3 space-y-1">
              <div className="h-1.5 rounded bg-electric-500/30 w-full" />
              <div className="h-1 rounded bg-white/10 w-4/5" />
              <div className="h-1 rounded bg-white/10 w-3/5" />
              <div className="h-1 rounded bg-white/10 w-4/5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="h-1.5 rounded bg-white/20 w-3/4" />
              <div className="h-1 rounded bg-white/10 w-full" />
              <div className="h-1 rounded bg-white/10 w-5/6" />
              <div className="h-1 rounded bg-white/10 w-full" />
              <div className="h-1 rounded bg-white/10 w-4/5" />
            </div>
          </>
        ) : template.layout === "skills-first" ? (
          <div className="w-full space-y-1">
            <div className="flex gap-1">
              {[1,2,3,4].map(i => <div key={i} className="h-2 rounded-full bg-emerald-500/30 px-2" style={{width:`${20+i*5}px`}} />)}
            </div>
            <div className="h-1.5 rounded bg-white/20 w-2/3 mt-1" />
            <div className="h-1 rounded bg-white/10 w-full" />
            <div className="h-1 rounded bg-white/10 w-4/5" />
          </div>
        ) : (
          <div className="w-full space-y-1">
            <div className="h-1.5 rounded bg-white/20 w-1/2 mx-auto" />
            <div className="h-1 rounded bg-white/10 w-3/4 mx-auto" />
            <div className="h-px bg-white/10 my-1" />
            <div className="h-1 rounded bg-white/10 w-full" />
            <div className="h-1 rounded bg-white/10 w-5/6" />
          </div>
        )}
      </div>

      <div className="font-medium text-text-primary text-sm mb-0.5">{template.name}</div>
      <div className="text-text-muted text-[11px] leading-relaxed">{template.description}</div>

      <div className="flex flex-wrap gap-1 mt-2">
        {template.best_for.slice(0, 3).map((tag) => (
          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-charcoal-700 text-text-muted border border-white/[0.05] capitalize">
            {tag.replace(/_/g, " ")}
          </span>
        ))}
      </div>
    </button>
  );
}

// ─── Job picker row ───────────────────────────────────────────────────────────
function JobRow({
  job,
  selected,
  onSelect,
}: {
  job: Job;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
        selected
          ? "border-electric-500/60 bg-electric-500/10"
          : "border-white/[0.07] bg-charcoal-800 hover:border-white/[0.15]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          selected ? "border-electric-400 bg-electric-400" : "border-white/20"
        }`}>
          {selected && <Check className="w-3 h-3 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-text-primary text-sm">{job.title}</div>
          <div className="flex items-center gap-2 text-text-muted text-xs mt-0.5">
            <span>{job.company}</span>
            {job.location && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-3 h-3" />{job.location}
                </span>
              </>
            )}
            <span>·</span>
            <span className="flex items-center gap-0.5">
              <Clock className="w-3 h-3" />{job.job_type}
            </span>
          </div>
          {job.required_skills?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {job.required_skills.slice(0, 5).map((s) => (
                <SkillBadge key={s} skill={s} />
              ))}
              {job.required_skills.length > 5 && (
                <span className="text-xs text-text-muted">+{job.required_skills.length - 5}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Wizard steps indicator ───────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 }) {
  const steps = [
    { n: 1, label: "Target Job" },
    { n: 2, label: "Template & Prompt" },
  ];
  return (
    <div className="flex items-center gap-3 mb-8">
      {steps.map(({ n, label }, i) => (
        <div key={n} className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              step >= n
                ? "bg-electric-500 text-white"
                : "bg-charcoal-700 text-text-muted border border-white/[0.07]"
            }`}>
              {step > n ? <Check className="w-3.5 h-3.5" /> : n}
            </div>
            <span className={`text-sm font-medium ${step >= n ? "text-text-primary" : "text-text-muted"}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-12 transition-colors ${step > n ? "bg-electric-500/50" : "bg-white/[0.07]"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main wizard page ─────────────────────────────────────────────────────────
export default function NewResumeBuilderPage() {
  const { userId } = useAuthStore();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [search]);

  // Step 1 form
  const step1 = useForm<Step1Form>({ resolver: zodResolver(step1Schema) });
  // Step 2 form
  const step2 = useForm<Step2Form>({
    resolver: zodResolver(step2Schema),
    defaultValues: { template_id: "modern", user_prompt: "" },
  });

  // Load jobs for picker
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["builder", "jobs", debouncedSearch],
    queryFn: () =>
      (api as any).listBuilderJobs({
        search: debouncedSearch || undefined,
        page: 1,
        limit: 30,
      }),
  });

  // Load templates
  const { data: templatesData } = useQuery({
    queryKey: ["builder", "templates"],
    queryFn: () => (api as any).listBuilderTemplates(),
  });

  const jobs: Job[] = jobsData?.data ?? [];
  const templates: BuilderTemplate[] = templatesData?.data ?? [];

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: (body: { job_id: string; user_prompt?: string; template_id: string }) =>
      (api as any).generateResume(body),
    onSuccess: (res: any) => {
      const draftId = res.data?.draft_id;
      toast.success("Resume generated! Reviewing your draft...");
      router.push(`/candidate/resume-builder/${draftId}`);
    },
    onError: (err) => toast.error(getFriendlyError(err)),
  });

  // Step 1 submit
  const onStep1Submit = step1.handleSubmit(() => {
    if (!selectedJob) return;
    setStep(2);
  });

  // Step 2 submit
  const onStep2Submit = step2.handleSubmit((data) => {
    if (!selectedJob) return;
    generateMutation.mutate({
      job_id: selectedJob.id,
      template_id: data.template_id,
      user_prompt: data.user_prompt?.trim() || undefined,
    });
  });

  const selectedTemplateId = step2.watch("template_id");

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Back */}
      <button
        onClick={() => step === 2 ? setStep(1) : router.push("/candidate/resume-builder")}
        className="flex items-center gap-1.5 text-text-muted hover:text-text-primary transition-colors text-sm mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        {step === 2 ? "Back to job selection" : "Back to Resume Builder"}
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-text-primary mb-1">
          {step === 1 ? "Choose a target job" : "Customise your resume"}
        </h1>
        <p className="text-text-secondary text-sm">
          {step === 1
            ? "Select the job you want to tailor this resume for."
            : "Pick a template and optionally describe your background."}
        </p>
      </div>

      <StepIndicator step={step} />

      <AnimatePresence mode="wait">
        {/* ── STEP 1: Job picker ── */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Search jobs by title, company, or skill..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input w-full pl-10"
              />
            </div>

            {/* Job list */}
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
              {jobsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-xl border border-white/[0.07] space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))
              ) : jobs.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                  <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No jobs found{search ? ` for "${search}"` : ""}.</p>
                </div>
              ) : (
                jobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    selected={selectedJob?.id === job.id}
                    onSelect={() => {
                      setSelectedJob(job);
                      step1.setValue("job_id", job.id);
                    }}
                  />
                ))
              )}
            </div>

            {step1.formState.errors.job_id && (
              <p className="flex items-center gap-1.5 text-red-400 text-sm mt-3">
                <AlertCircle className="w-3.5 h-3.5" />
                {step1.formState.errors.job_id.message}
              </p>
            )}

            {/* Selected preview */}
            {selectedJob && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 rounded-xl bg-electric-500/8 border border-electric-500/20 flex items-center gap-2 text-sm"
              >
                <Check className="w-4 h-4 text-electric-400 flex-shrink-0" />
                <span className="text-electric-300 font-medium">{selectedJob.title}</span>
                <span className="text-text-muted">at {selectedJob.company}</span>
              </motion.div>
            )}

            <button
              onClick={onStep1Submit}
              disabled={!selectedJob}
              className="btn-primary w-full mt-5 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* ── STEP 2: Template + Prompt ── */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Target job reminder */}
            {selectedJob && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-charcoal-800 border border-white/[0.07] mb-5 text-sm">
                <Target className="w-4 h-4 text-electric-400 flex-shrink-0" />
                <span className="text-text-muted">Targeting:</span>
                <span className="text-text-primary font-medium">{selectedJob.title}</span>
                <span className="text-text-muted">at {selectedJob.company}</span>
              </div>
            )}

            {/* Template picker */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-text-secondary mb-3">
                <LayoutTemplate className="w-4 h-4 inline mr-1.5" />
                Choose a template
              </label>
              {templates.length === 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {templates.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      selected={selectedTemplateId === t.id}
                      onSelect={() => step2.setValue("template_id", t.id)}
                    />
                  ))}
                </div>
              )}
              {step2.formState.errors.template_id && (
                <p className="text-red-400 text-sm mt-2">
                  {step2.formState.errors.template_id.message}
                </p>
              )}
            </div>

            {/* User prompt */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                <FileText className="w-4 h-4 inline mr-1.5" />
                Describe yourself{" "}
                <span className="text-text-muted font-normal">(optional — max 2000 chars)</span>
              </label>
              <textarea
                {...step2.register("user_prompt")}
                rows={4}
                placeholder="e.g. I have 3 years of backend experience with Python and FastAPI, worked on fintech products, looking to transition into ML engineering…"
                className="input w-full resize-none text-sm leading-relaxed"
              />
              <div className="flex justify-between mt-1">
                <p className="text-text-muted text-xs">
                  The AI uses your profile and uploaded resumes automatically. This is extra context.
                </p>
                <span className="text-text-muted text-xs">
                  {(step2.watch("user_prompt") ?? "").length}/2000
                </span>
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={onStep2Submit}
              disabled={generateMutation.isPending}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating your resume…
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Generate AI Resume
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {generateMutation.isPending && (
              <p className="text-center text-text-muted text-xs mt-3 animate-pulse">
                Analysing job requirements · Optimising content · Running ATS scoring…
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Inline Target icon to avoid extra import collision
function Target({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  );
}