"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
import { ApiError, api, getFriendlyError } from "@/lib/api/client";
import { Briefcase, User, ArrowRight, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

type Role = "candidate" | "recruiter";
type Step = "role" | "email" | "register";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<Role | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Register form
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");

  const handleRoleSelect = (r: Role) => {
    setRole(r);
    setStep("email");
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !role) return;
    setLoading(true);
    try {
      const res = await api.login({ email, role });
      setAuth(role, res.data.user_id, res.data.user.full_name);
      router.push(role === "candidate" ? "/candidate/dashboard" : "/recruiter/dashboard");
      return;
    } catch (err) {
      if (err instanceof ApiError && err.code === "USER_NOT_FOUND") {
        setNotFound(true);
        setStep("register");
      } else {
        toast.error(getFriendlyError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role || !fullName || !email) return;
    setLoading(true);
    try {
      if (role === "candidate") {
        const res = await api.registerCandidate({ full_name: fullName, email });
        setAuth("candidate", res.data.user_id, res.data.user.full_name);
        toast.success("Account created! Welcome aboard.");
        router.push("/candidate/dashboard");
      } else {
        const res = await api.registerRecruiter({ full_name: fullName, email, company_name: companyName });
        setAuth("recruiter", res.data.user_id, res.data.user.full_name);
        toast.success("Account created! Welcome aboard.");
        router.push("/recruiter/dashboard");
      }
    } catch (err) {
      toast.error(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal-950 flex items-center justify-center relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-40" />
      <div className="absolute inset-0 bg-glow-radial" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-electric-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-electric-500/15 border border-electric-500/30 flex items-center justify-center glow-electric">
              <Zap className="w-5 h-5 text-electric-400" />
            </div>
            <span className="font-display text-2xl font-bold text-text-primary">
              ATS<span className="text-electric-400">Pro</span>
            </span>
          </div>
          <p className="text-text-secondary text-sm">AI-powered Resume Intelligence Platform</p>
        </div>

        <div className="card p-8 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          {/* Step: Role */}
          {step === "role" && (
            <>
              <h1 className="font-display text-2xl font-bold text-text-primary mb-2">Welcome back</h1>
              <p className="text-text-secondary text-sm mb-8">Select your role to continue</p>
              <div className="grid grid-cols-2 gap-4">
                <RoleCard
                  icon={<User className="w-6 h-6" />}
                  label="Candidate"
                  description="Find jobs & track applications"
                  onClick={() => handleRoleSelect("candidate")}
                />
                <RoleCard
                  icon={<Briefcase className="w-6 h-6" />}
                  label="Recruiter"
                  description="Post jobs & rank applicants"
                  onClick={() => handleRoleSelect("recruiter")}
                />
              </div>
            </>
          )}

          {/* Step: Email */}
          {step === "email" && (
            <>
              <button onClick={() => setStep("role")} className="text-text-muted hover:text-text-secondary text-xs mb-6 flex items-center gap-1 transition-colors">
                ← Back
              </button>
              <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
                Sign in as {role === "candidate" ? "Candidate" : "Recruiter"}
              </h1>
              <p className="text-text-secondary text-sm mb-8">Enter your email to continue</p>
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            </>
          )}

          {/* Step: Register */}
          {step === "register" && (
            <>
              <button onClick={() => { setStep("email"); setNotFound(false); }} className="text-text-muted hover:text-text-secondary text-xs mb-6 flex items-center gap-1 transition-colors">
                ← Back
              </button>
              <h1 className="font-display text-2xl font-bold text-text-primary mb-2">Create account</h1>
              <p className="text-text-secondary text-sm mb-8">
                No account found for <span className="text-electric-400">{email}</span>. Let&apos;s create one.
              </p>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="label">Full name</label>
                  <input className="input" placeholder="Jane Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" value={email} readOnly />
                </div>
                {role === "recruiter" && (
                  <div>
                    <label className="label">Company name</label>
                    <input className="input" placeholder="Acme Corp" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create account <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-text-muted text-xs mt-6">
          AI-powered by Groq · Semantic matching · Real-time scoring
        </p>
      </div>
    </div>
  );
}

function RoleCard({ icon, label, description, onClick }: {
  icon: React.ReactNode; label: string; description: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-3 p-5 rounded-xl bg-charcoal-900
                 border border-white/[0.07] hover:border-electric-500/40 hover:bg-charcoal-800
                 transition-all duration-200 text-center"
    >
      <div className="w-12 h-12 rounded-xl bg-electric-500/10 flex items-center justify-center
                      text-electric-400 group-hover:bg-electric-500/20 transition-colors">
        {icon}
      </div>
      <div>
        <div className="font-display font-semibold text-text-primary text-sm">{label}</div>
        <div className="text-text-muted text-xs mt-0.5">{description}</div>
      </div>
    </button>
  );
}
