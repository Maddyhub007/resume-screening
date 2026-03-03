"use client";
import { useEffect, useState, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, queryKeys, getFriendlyError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/authStore";
import { toast } from "sonner";
import { Loader2, Save, X, Plus } from "lucide-react";

const schema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  location: z.string().optional(),
  headline: z.string().optional(),
  linkedin_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  github_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  portfolio_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  open_to_work: z.boolean(),
});

type FormData = z.infer<typeof schema>;

// Tag input component for preferred_roles / preferred_locations arrays
function TagInput({
  label, values, onChange, placeholder,
}: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState("");

  const add = () => {
    const tag = input.trim();
    if (tag && !values.includes(tag)) {
      onChange([...values, tag]);
    }
    setInput("");
  };

  const remove = (tag: string) => onChange(values.filter((v) => v !== tag));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
    if (e.key === "Backspace" && !input && values.length) remove(values[values.length - 1]);
  };

  return (
    <div>
      <label className="label">{label}</label>
      <div className="input min-h-[42px] flex flex-wrap gap-1.5 cursor-text" onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}>
        {values.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-electric-500/15 text-electric-300 text-xs border border-electric-500/25">
            {tag}
            <button type="button" onClick={() => remove(tag)} className="hover:text-red-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder={values.length === 0 ? placeholder : ""}
          className="bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted flex-1 min-w-[120px]"
        />
      </div>
      <p className="text-text-muted text-xs mt-1">Press Enter or comma to add</p>
    </div>
  );
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { userId, setAuth } = useAuthStore();

  const [preferredRoles, setPreferredRoles] = useState<string[]>([]);
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.candidate(userId!),
    queryFn: () => api.getCandidate(userId!),
    enabled: !!userId,
  });

  const { register, handleSubmit, reset, formState: { errors, isPending } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (data?.data) {
      const c = data.data;
      reset({
        full_name: c.full_name,
        phone: c.phone ?? "",
        location: c.location ?? "",
        headline: c.headline ?? "",
        linkedin_url: c.linkedin_url ?? "",
        github_url: c.github_url ?? "",
        portfolio_url: c.portfolio_url ?? "",
        open_to_work: c.open_to_work,
      });
      setPreferredRoles(c.preferred_roles ?? []);
      setPreferredLocations(c.preferred_locations ?? []);
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (body: Partial<FormData> & { preferred_roles?: string[]; preferred_locations?: string[] }) =>
      api.updateCandidate(userId!, body),
    onSuccess: (res) => {
      toast.success("Profile updated!");
      setAuth("candidate", userId!, res.data.full_name);
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate(userId!) });
    },
    onError: (err) => toast.error(getFriendlyError(err)),
  });

  const onSubmit = (d: FormData) => {
    mutation.mutate({
      ...d,
      preferred_roles: preferredRoles,
      preferred_locations: preferredLocations,
    });
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-1">Profile</h1>
        <p className="text-text-secondary">Manage your personal information and job preferences</p>
      </div>

      {isLoading ? (
        <div className="card p-6 space-y-4">
          {[1,2,3,4,5].map((i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Identity card */}
          <div className="card p-6 space-y-4">
            <h2 className="section-title">Personal Info</h2>

            {/* Avatar preview */}
            <div className="flex items-center gap-4 pb-4 border-b border-white/[0.06]">
              <div className="w-14 h-14 rounded-2xl bg-electric-500/15 border border-electric-500/30 flex items-center justify-center">
                <span className="font-display text-xl font-bold text-electric-400">
                  {data?.data.full_name?.[0]?.toUpperCase()}
                </span>
              </div>
              <div>
                <div className="font-display font-semibold text-text-primary">{data?.data.full_name}</div>
                <div className="text-text-muted text-sm">{data?.data.email}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Full Name *</label>
                <input {...register("full_name")} className="input" />
                {errors.full_name && <p className="text-red-400 text-xs mt-1">{errors.full_name.message}</p>}
              </div>
              <div>
                <label className="label">Phone</label>
                <input {...register("phone")} className="input" placeholder="+1 555 000 0000" />
              </div>
              <div>
                <label className="label">Location</label>
                <input {...register("location")} className="input" placeholder="San Francisco, CA" />
              </div>
              <div className="col-span-2">
                <label className="label">Headline</label>
                <input {...register("headline")} className="input" placeholder="Senior Software Engineer · Open to remote" />
              </div>
            </div>
          </div>

          {/* Links card */}
          <div className="card p-6 space-y-4">
            <h2 className="section-title">Links</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">LinkedIn URL</label>
                <input {...register("linkedin_url")} className="input" placeholder="https://linkedin.com/in/..." />
                {errors.linkedin_url && <p className="text-red-400 text-xs mt-1">{errors.linkedin_url.message}</p>}
              </div>
              <div>
                <label className="label">GitHub URL</label>
                <input {...register("github_url")} className="input" placeholder="https://github.com/..." />
                {errors.github_url && <p className="text-red-400 text-xs mt-1">{errors.github_url.message}</p>}
              </div>
              <div className="col-span-2">
                <label className="label">Portfolio URL</label>
                <input {...register("portfolio_url")} className="input" placeholder="https://yoursite.com" />
                {errors.portfolio_url && <p className="text-red-400 text-xs mt-1">{errors.portfolio_url.message}</p>}
              </div>
            </div>
          </div>

          {/* Job preferences card */}
          <div className="card p-6 space-y-4">
            <h2 className="section-title">Job Preferences</h2>

            <TagInput
              label="Preferred Roles"
              values={preferredRoles}
              onChange={setPreferredRoles}
              placeholder="e.g. Software Engineer, Product Manager"
            />

            <TagInput
              label="Preferred Locations"
              values={preferredLocations}
              onChange={setPreferredLocations}
              placeholder="e.g. Remote, San Francisco, New York"
            />

            {/* Open to work toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-charcoal-900 border border-white/[0.06]">
              <div>
                <div className="font-medium text-text-primary text-sm">Open to Work</div>
                <div className="text-text-muted text-xs">Recruiters can find you in candidate search</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" {...register("open_to_work")} className="sr-only peer" />
                <div className="w-11 h-6 bg-charcoal-600 rounded-full peer peer-checked:bg-electric-500/80 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
              </label>
            </div>
          </div>

          <button type="submit" disabled={mutation.isPending} className="btn-primary w-full flex items-center justify-center gap-2">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </form>
      )}
    </div>
  );
}
