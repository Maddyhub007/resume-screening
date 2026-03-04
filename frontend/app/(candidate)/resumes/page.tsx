"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, queryKeys, getFriendlyError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/authStore";
import { Upload, FileText, CheckCircle2, XCircle, Clock, Trash2, Loader2, Zap, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { SkillBadge } from "@/components/shared";
import { formatFileSize, formatRelativeDate } from "@/lib/utils/formatters";
import { Resume } from "@/lib/types";

const ALLOWED = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const MAX_BYTES = 10 * 1024 * 1024;

export default function ResumesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useAuthStore();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.candidateResumes(userId!),
    queryFn: () => api.getCandidateResumes(userId!),
    enabled: !!userId,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadResume(userId!, file),
    onSuccess: () => {
      toast.success("Resume uploaded and parsed!");
      queryClient.invalidateQueries({ queryKey: queryKeys.candidateResumes(userId!) });
    },
    onError: (err) => toast.error(getFriendlyError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (resumeId: string) => api.deleteResume(resumeId),
    onSuccess: () => {
      toast.success("Resume deleted.");
      queryClient.invalidateQueries({ queryKey: queryKeys.candidateResumes(userId!) });
    },
    onError: (err) => toast.error(getFriendlyError(err)),
  });

  const handleAnalyze = async (resumeId: string) => {
    setAnalyzingId(resumeId);
    try {
      await api.analyzeResume(resumeId);
      toast.success("AI analysis complete!");
      queryClient.invalidateQueries({ queryKey: queryKeys.candidateResumes(userId!) });
    } catch (err) { toast.error(getFriendlyError(err)); }
    finally { setAnalyzingId(null); }
  };

  const onDrop = useCallback((accepted: File[], rejected: { errors: { code: string }[] }[]) => {
    if (rejected.length) {
      toast.error("Only PDF and DOCX files under 10MB are accepted.");
      return;
    }
    const file = accepted[0];
    if (!ALLOWED.includes(file.type)) { toast.error("Only PDF and DOCX files accepted"); return; }
    if (file.size > MAX_BYTES) { toast.error("File must be under 10 MB"); return; }
    uploadMutation.mutate(file);
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxSize: MAX_BYTES,
    multiple: false,
  });

  const resumes = data?.data ?? [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-1">My Resumes</h1>
          <p className="text-text-secondary">Upload and manage your resumes</p>
        </div>
        <Link href="/candidate/resumes/upload" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Upload Resume
        </Link>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`card p-8 border-2 border-dashed text-center cursor-pointer mb-8 transition-all duration-200 ${
          isDragActive
            ? "border-electric-500/60 bg-electric-500/5 glow-electric"
            : uploadMutation.isPending
            ? "border-charcoal-600 opacity-60 cursor-not-allowed"
            : "border-white/[0.1] hover:border-electric-500/40 hover:bg-electric-500/3"
        }`}
      >
        <input {...getInputProps()} disabled={uploadMutation.isPending} />
        {uploadMutation.isPending ? (
          <div className="space-y-3">
            <Loader2 className="w-10 h-10 text-electric-400 mx-auto animate-spin" />
            <p className="text-electric-400 font-medium">Uploading & parsing your resume...</p>
            <p className="text-text-muted text-sm">This may take a few seconds</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className={`w-10 h-10 mx-auto transition-colors ${isDragActive ? "text-electric-400" : "text-text-muted"}`} />
            <p className="text-text-primary font-medium">
              {isDragActive ? "Drop your resume here" : "Drag & drop your resume"}
            </p>
            <p className="text-text-muted text-sm">or <span className="text-electric-400">click to browse</span></p>
            <p className="text-text-muted text-xs">PDF or DOCX · Max 10MB</p>
          </div>
        )}
      </div>

      {/* Resume list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => <div key={i} className="card p-5 skeleton h-32" />)}
        </div>
      ) : resumes.length === 0 ? (
        <div className="card p-8 text-center text-text-muted">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No resumes yet. Upload your first one above!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {resumes.map((resume) => (
            <ResumeCard
              key={resume.id}
              resume={resume}
              onDelete={() => deleteMutation.mutate(resume.id)}
              onAnalyze={() => handleAnalyze(resume.id)}
              isAnalyzing={analyzingId === resume.id}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ResumeCard({ resume, onDelete, onAnalyze, isAnalyzing, isDeleting }: {
  resume: Resume; onDelete: () => void; onAnalyze: () => void;
  isAnalyzing: boolean; isDeleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    success: { icon: <CheckCircle2 className="w-4 h-4" />, className: "text-emerald-400", label: "Parsed" },
    pending: { icon: <Clock className="w-4 h-4 animate-pulse" />, className: "text-amber-400", label: "Pending" },
    failed: { icon: <XCircle className="w-4 h-4" />, className: "text-red-400", label: "Failed" },
  }[resume.parse_status];

  return (
    <div className="card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-charcoal-700 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-electric-400" />
            </div>
            <div>
              <h3 className="font-medium text-text-primary">{resume.file_name}</h3>
              <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                <span className={`flex items-center gap-1 ${statusConfig.className}`}>
                  {statusConfig.icon} {statusConfig.label}
                </span>
                <span>{formatFileSize(resume.file_size_bytes)}</span>
                <span>{formatRelativeDate(resume.created_at)}</span>
                {resume.parse_status === "success" && (
                  <span>{resume.total_experience_years.toFixed(1)} yrs exp · {resume.skill_count} skills</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {resume.parse_status === "success" && (
              <button
                onClick={onAnalyze}
                disabled={isAnalyzing}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 text-electric-400" />}
                AI Analyze
              </button>
            )}
            <button onClick={() => setExpanded(!expanded)} className="btn-ghost text-xs py-1.5 px-3">
              {expanded ? "Collapse" : "View Details"}
            </button>
            <button onClick={onDelete} disabled={isDeleting} className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && resume.parse_status === "success" && (
          <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-4 animate-fade-in">
            {/* Summary */}
            {resume.resume_summary && (
              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">AI Summary</h4>
                <p className="text-sm text-text-secondary leading-relaxed">{resume.resume_summary}</p>
              </div>
            )}

            {/* Skills */}
            {resume.skills.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Skills ({resume.skills.length})</h4>
                <div className="flex flex-wrap gap-1.5">
                  {resume.skills.map((s, i) => <SkillBadge key={i} skill={s} />)}
                </div>
              </div>
            )}

            {/* Experience */}
            {resume.experience.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Experience</h4>
                <div className="space-y-2">
                  {resume.experience.map((exp, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-electric-500/60 mt-2 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-text-primary">{exp.title}</span>
                        {exp.company && <span className="text-text-muted"> at {exp.company}</span>}
                        {exp.start_date && <span className="text-text-muted text-xs ml-1">({exp.start_date} – {exp.end_date ?? "Present"})</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Role suggestions */}
            {resume.role_suggestions && resume.role_suggestions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Suggested Roles</h4>
                <div className="flex flex-wrap gap-1.5">
                  {resume.role_suggestions.map((r, i) => (
                    <span key={i} className="badge badge-electric">{r}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
