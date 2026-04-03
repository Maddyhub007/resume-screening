"""
seeds.py — Populate the database with realistic fake data.

Usage:
    python seeds.py           # seed all tables (20 records each)
    python seeds.py --clear   # wipe and re-seed
"""

import argparse
import json
import random
import uuid
from datetime import datetime, timedelta, timezone

from faker import Faker

fake = Faker()

# ── Bootstrap Flask app ───────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.core.database import db
from app.models.candidate    import Candidate
from app.models.recruiter    import Recruiter
from app.models.job          import Job
from app.models.resume       import Resume
from app.models.application  import Application
from app.models.ats_score    import AtsScore
from app.models.refresh_token import RefreshToken

app = create_app("development")

# ── Constants ─────────────────────────────────────────────────────────────────
N = 20  # records per table

SKILLS_POOL = [
    "Python", "JavaScript", "TypeScript", "React", "Node.js", "Flask",
    "Django", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Docker",
    "Kubernetes", "AWS", "GCP", "Azure", "Git", "CI/CD", "REST APIs",
    "GraphQL", "Machine Learning", "Data Analysis", "SQL", "Linux",
    "FastAPI", "Vue.js", "Angular", "Java", "C++", "Go",
]

JOB_TITLES = [
    "Software Engineer", "Backend Developer", "Frontend Developer",
    "Full Stack Developer", "Data Scientist", "ML Engineer",
    "DevOps Engineer", "Cloud Architect", "Product Manager",
    "QA Engineer", "Mobile Developer", "Data Engineer",
]

INDUSTRIES = [
    "Technology", "Finance", "Healthcare", "Education",
    "E-commerce", "Gaming", "Media", "Consulting",
]

COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"]

JOB_TYPES = ["full-time", "part-time", "contract", "internship"]

JOB_STATUSES = ["active", "closed", "draft"]

APP_STAGES = ["applied", "screening", "interview", "offer", "rejected", "hired"]

SCORE_LABELS = ["excellent", "good", "fair", "weak"]

ROLES = ["candidate", "recruiter"]


def _skills(n=8):
    return json.dumps(random.sample(SKILLS_POOL, n))

def _utc_now():
    return datetime.now(timezone.utc)

def _past(days=365):
    return _utc_now() - timedelta(days=random.randint(1, days))

def _future(days=90):
    return _utc_now() + timedelta(days=random.randint(1, days))


# ── Seeders ───────────────────────────────────────────────────────────────────

def seed_candidates():
    print("  Seeding candidates...")
    candidates = []
    for _ in range(N):
        c = Candidate(
            id=str(uuid.uuid4()),
            full_name=fake.name(),
            email=fake.unique.email(),
            phone=fake.phone_number()[:30],
            location=f"{fake.city()}, {fake.country()}",
            headline=fake.job(),
            password_hash="hashed_password_placeholder",
            linkedin_url=f"https://linkedin.com/in/{fake.user_name()}",
            github_url=f"https://github.com/{fake.user_name()}",
            portfolio_url=fake.url(),
            preferred_roles=json.dumps(random.sample(JOB_TITLES, 3)),
            preferred_locations=json.dumps([fake.city() for _ in range(2)]),
            open_to_work=random.choice([True, False]),
            is_active=True,
            created_at=_past(500),
            updated_at=_past(100),
        )
        db.session.add(c)
        candidates.append(c)
    db.session.flush()
    print(f"    ✓ {len(candidates)} candidates")
    return candidates


def seed_recruiters():
    print("  Seeding recruiters...")
    recruiters = []
    for _ in range(N):
        r = Recruiter(
            id=str(uuid.uuid4()),
            full_name=fake.name(),
            email=fake.unique.email(),
            company_name=fake.company(),
            industry=random.choice(INDUSTRIES),
            phone=fake.phone_number()[:30],
            password_hash="hashed_password_placeholder",
            company_size=random.choice(COMPANY_SIZES),
            website_url=fake.url(),
            linkedin_url=f"https://linkedin.com/company/{fake.slug()}",
            total_jobs_posted=random.randint(0, 50),
            total_hires=random.randint(0, 20),
            platform_rank=random.randint(1, 100),
            is_active=True,
            created_at=_past(500),
            updated_at=_past(100),
        )
        db.session.add(r)
        recruiters.append(r)
    db.session.flush()
    print(f"    ✓ {len(recruiters)} recruiters")
    return recruiters


def seed_jobs(recruiters):
    print("  Seeding jobs...")
    jobs = []
    for _ in range(N):
        recruiter = random.choice(recruiters)
        salary_min = random.randint(40, 120) * 1000
        j = Job(
            id=str(uuid.uuid4()),
            title=random.choice(JOB_TITLES),
            company=recruiter.company_name,
            description=fake.paragraph(nb_sentences=6),
            responsibilities=json.dumps([fake.sentence() for _ in range(4)]),
            required_skills=_skills(6),
            nice_to_have_skills=_skills(4),
            additional_requirements=json.dumps([fake.sentence() for _ in range(2)]),
            experience_years=round(random.uniform(0, 10), 1),
            location=random.choice([fake.city(), "Remote", "Hybrid"]),
            job_type=random.choice(JOB_TYPES),
            status=random.choice(JOB_STATUSES),
            salary_min=salary_min,
            salary_max=salary_min + random.randint(10, 40) * 1000,
            salary_currency="USD",
            quality_score=round(random.uniform(0.5, 1.0), 2),
            completeness_score=round(random.uniform(0.5, 1.0), 2),
            applicant_count=random.randint(0, 100),
            recruiter_id=recruiter.id,
            is_deleted=False,
            created_at=_past(300),
            updated_at=_past(50),
        )
        db.session.add(j)
        jobs.append(j)
    db.session.flush()
    print(f"    ✓ {len(jobs)} jobs")
    return jobs


def seed_resumes(candidates):
    print("  Seeding resumes...")
    resumes = []
    for candidate in candidates:
        r = Resume(
            id=str(uuid.uuid4()),
            candidate_id=candidate.id,
            filename=f"resume_{fake.user_name()}.pdf",
            file_path=f"uploads/{uuid.uuid4()}.pdf",
            file_size_kb=random.randint(100, 500),
            file_type="pdf",
            raw_text=fake.paragraph(nb_sentences=20),
            skills=_skills(10),
            education=json.dumps([{
                "degree": random.choice(["B.Tech", "M.Tech", "MBA", "B.Sc", "M.Sc"]),
                "field": fake.job(),
                "institution": fake.company() + " University",
                "year": random.randint(2010, 2023),
            }]),
            experience=json.dumps([{
                "title": fake.job(),
                "company": fake.company(),
                "years": round(random.uniform(0.5, 5), 1),
                "description": fake.sentence(),
            }]),
            certifications=json.dumps([fake.bs() for _ in range(2)]),
            projects=json.dumps([{
                "name": fake.catch_phrase(),
                "description": fake.sentence(),
                "tech": random.sample(SKILLS_POOL, 3),
            }]),
            summary_text=fake.paragraph(nb_sentences=3),
            contact_info=json.dumps({
                "email": candidate.email,
                "phone": candidate.phone,
                "location": candidate.location,
            }),
            total_experience_years=round(random.uniform(0, 12), 1),
            skill_count=random.randint(5, 20),
            resume_summary=fake.paragraph(nb_sentences=2),
            issues_detected=json.dumps(["Missing LinkedIn URL"] if random.random() > 0.5 else []),
            role_suggestions=json.dumps(random.sample(JOB_TITLES, 3)),
            improvement_tips=json.dumps([fake.sentence() for _ in range(3)]),
            parse_status="completed",
            is_active=True,
            is_deleted=False,
            created_at=_past(200),
            updated_at=_past(30),
        )
        db.session.add(r)
        resumes.append(r)
    db.session.flush()
    print(f"    ✓ {len(resumes)} resumes")
    return resumes


def seed_applications(candidates, jobs, resumes):
    print("  Seeding applications...")
    applications = []
    used_pairs = set()

    # Match each candidate with a unique job
    shuffled_jobs = random.sample(jobs, min(N, len(jobs)))

    for i, candidate in enumerate(candidates[:N]):
        job = shuffled_jobs[i % len(shuffled_jobs)]
        pair = (candidate.id, job.id)
        if pair in used_pairs:
            continue
        used_pairs.add(pair)

        resume = next((r for r in resumes if r.candidate_id == candidate.id), None)
        if not resume:
            continue

        stage = random.choice(APP_STAGES)
        a = Application(
            id=str(uuid.uuid4()),
            candidate_id=candidate.id,
            job_id=job.id,
            resume_id=resume.id,
            stage=stage,
            stage_history=json.dumps([
                {"stage": "applied", "at": _past(60).isoformat()},
                {"stage": stage,     "at": _past(30).isoformat()},
            ]),
            recruiter_notes=fake.sentence() if random.random() > 0.5 else None,
            rejection_reason=fake.sentence() if stage == "rejected" else None,
            cover_letter=fake.paragraph(nb_sentences=4) if random.random() > 0.5 else None,
            improvement_plan=fake.paragraph(nb_sentences=2) if random.random() > 0.5 else None,
            created_at=_past(60),
            updated_at=_past(10),
        )
        db.session.add(a)
        applications.append(a)

    db.session.flush()
    print(f"    ✓ {len(applications)} applications")
    return applications


def seed_ats_scores(resumes, jobs, applications):
    print("  Seeding ATS scores...")
    scores = []
    used_pairs = set()

    for application in applications:
        resume_id = application.resume_id
        job_id    = application.job_id
        pair = (resume_id, job_id)
        if pair in used_pairs:
            continue
        used_pairs.add(pair)

        semantic  = round(random.uniform(0.3, 1.0), 3)
        keyword   = round(random.uniform(0.3, 1.0), 3)
        experience = round(random.uniform(0.3, 1.0), 3)
        section   = round(random.uniform(0.3, 1.0), 3)
        final     = round(semantic * 0.4 + keyword * 0.35 + experience * 0.15 + section * 0.10, 3)

        if   final >= 0.80: label = "excellent"
        elif final >= 0.65: label = "good"
        elif final >= 0.50: label = "fair"
        else:               label = "weak"

        s = AtsScore(
            id=str(uuid.uuid4()),
            resume_id=resume_id,
            job_id=job_id,
            application_id=application.id,
            semantic_score=semantic,
            keyword_score=keyword,
            experience_score=experience,
            section_quality_score=section,
            final_score=final,
            score_label=label,
            semantic_available=True,
            matched_skills=_skills(5),
            missing_skills=_skills(3),
            extra_skills=_skills(2),
            improvement_tips=json.dumps([fake.sentence() for _ in range(3)]),
            summary_text=fake.paragraph(nb_sentences=2),
            weights_used=json.dumps({
                "semantic": 0.40,
                "keyword":  0.35,
                "experience": 0.15,
                "section_quality": 0.10,
            }),
            created_at=_past(30),
            updated_at=_past(5),
        )
        db.session.add(s)
        scores.append(s)

    db.session.flush()
    print(f"    ✓ {len(scores)} ATS scores")
    return scores


def seed_refresh_tokens(candidates, recruiters):
    print("  Seeding refresh tokens...")
    tokens = []
    import hashlib

    users = (
        [(c.id, "candidate") for c in random.sample(candidates, 5)] +
        [(r.id, "recruiter") for r in random.sample(recruiters, 5)]
    )

    for user_id, role in users:
        raw = str(uuid.uuid4())
        t = RefreshToken(
            id=str(uuid.uuid4()),
            jti=str(uuid.uuid4()),
            token_hash=hashlib.sha256(raw.encode()).hexdigest(),
            user_id=user_id,
            role=role,
            expires_at=_future(7),
            revoked=False,
            created_at=_past(3),
            updated_at=_past(1),
        )
        db.session.add(t)
        tokens.append(t)

    db.session.flush()
    print(f"    ✓ {len(tokens)} refresh tokens")
    return tokens


def clear_all():
    print("  Clearing all tables...")
    db.session.execute(db.text("TRUNCATE TABLE refresh_tokens, ats_scores, applications, resumes, jobs, recruiters, candidates RESTART IDENTITY CASCADE;"))
    db.session.commit()
    print("  ✓ All tables cleared")


def run_seeds(clear=False):
    with app.app_context():
        if clear:
            clear_all()

        print("\n🌱 Seeding database...\n")
        try:
            candidates = seed_candidates()
            recruiters = seed_recruiters()
            jobs       = seed_jobs(recruiters)
            resumes    = seed_resumes(candidates)
            applications = seed_applications(candidates, jobs, resumes)
            seed_ats_scores(resumes, jobs, applications)
            seed_refresh_tokens(candidates, recruiters)

            db.session.commit()
            print("\n✅ Database seeded successfully!\n")

        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Seeding failed: {e}")
            raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the database")
    parser.add_argument("--clear", action="store_true", help="Clear all data before seeding")
    args = parser.parse_args()
    run_seeds(clear=args.clear)