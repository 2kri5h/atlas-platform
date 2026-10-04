import sys
import os
import uuid
from datetime import datetime, timedelta

from ..core.database import engine, Base, SessionLocal
from ..models import (
    AnonymousCategory,
    AnonymousAccount,
    AnonymousPostV2,
    AnonymousReplyV2,
    Student,
)
from .anonymous_crypto import generate_recovery_key, hash_recovery_key, normalize_recovery_key

CATEGORIES = [
    {
        "slug": "hostel-mess",
        "name": "Hostel & Mess",
        "description": "Mess food quality, rooms, hygiene, water, WiFi/LAN, maintenance, and hostel councils.",
        "sort_order": 1,
    },
    {
        "slug": "academics",
        "name": "Academics & Grading",
        "description": "Courses, grading curves, quiz leaks/policy, TAs, academic probation, and DAMP.",
        "sort_order": 2,
    },
    {
        "slug": "wellbeing",
        "name": "Wellbeing & Mind",
        "description": "Stress, burnout, loneliness, relationship pressure, and imposter syndrome.",
        "sort_order": 3,
    },
    {
        "slug": "placements",
        "name": "Placements & Interns",
        "description": "PT Cell, JAF policies, shortlists, interview fundae, and internship experiences.",
        "sort_order": 4,
    },
    {
        "slug": "harassment",
        "name": "Harassment & Safety",
        "description": "Ragging, unsafe campus areas, discrimination, and situations that feel unsafe.",
        "sort_order": 5,
    },
    {
        "slug": "administration",
        "name": "Administration & SAC",
        "description": "Dean SA, ASC portal, Gymkhana, fee hikes, mess rebate, cycle/vehicle rules.",
        "sort_order": 6,
    },
    {
        "slug": "insti-life",
        "name": "Insti Life & General",
        "description": "Mood Indigo, Techfest, tech teams, cult, hostel banter, and general campus fundae.",
        "sort_order": 7,
    },
    {
        "slug": "official",
        "name": "Official Announcements",
        "description": "Verified updates from Atlas Team, Student Council, and Institute bodies.",
        "sort_order": 8,
    },
]


def seed_anonymous_v2():
    print("[Anonymous V2] Ensuring tables exist...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 1. Seed Categories
        cat_map = {}
        for cat_data in CATEGORIES:
            existing = db.query(AnonymousCategory).filter(AnonymousCategory.slug == cat_data["slug"]).first()
            if not existing:
                cat = AnonymousCategory(**cat_data)
                db.add(cat)
                db.flush()
                cat_map[cat.slug] = cat.id
                print(f"[Anonymous V2] Created category: {cat.name}")
            else:
                cat_map[existing.slug] = existing.id

        db.commit()

        # 2. Check if sample threads exist
        if db.query(AnonymousPostV2).count() > 0:
            print("[Anonymous V2] Threads already seeded.")
            return

        print("[Anonymous V2] Seeding initial campus threads...")
        # Create a sample anonymous account
        sample_key = generate_recovery_key()
        normalized = normalize_recovery_key(sample_key)
        account_id = str(uuid.uuid4())
        anon_acc = AnonymousAccount(
            id=account_id,
            secret_hash=hash_recovery_key(normalized),
            valid_until=datetime.utcnow() + timedelta(days=180),
            status="active",
        )
        db.add(anon_acc)

        # Get Amit Patel (senior student)
        senior = db.query(Student).filter(Student.roll_number == "21001001").first()

        # Thread 1: Grievance (Hostel & Mess) with "Affects me too"
        post1 = AnonymousPostV2(
            slug=uuid.uuid4().hex[:12],
            category_id=cat_map["hostel-mess"],
            is_anonymous=True,
            account_id=account_id,
            kind="grievance",
            title="Hostel 16 water purifiers on 3rd & 4th floor taste of rust again",
            body="This has been an ongoing issue since midsems. Both coolers in B-wing are giving yellowish water with metallic taste. Already filed a complaint on the maintenance portal 5 days ago with zero response. Anyone else having throat irritation?",
            upvotes=28,
            downvotes=1,
            metoo=43,
            reply_count=3,
            created_at=datetime.utcnow() - timedelta(hours=8),
        )
        db.add(post1)
        db.flush()

        # Reply 1.1: Anonymous
        rep1 = AnonymousReplyV2(
            post_id=post1.id,
            is_anonymous=True,
            account_id=account_id,
            body="Facing the exact same issue in C-wing 2nd floor as well. Spoke to the hostel caretaker yesterday, he said the filter cartridge order is pending approval.",
            upvotes=12,
            created_at=datetime.utcnow() - timedelta(hours=6),
        )
        db.add(rep1)
        db.flush()

        # Nested Reply 1.1.1: Nested under Reply 1.1
        rep1_child = AnonymousReplyV2(
            post_id=post1.id,
            parent_id=rep1.id,
            is_anonymous=True,
            account_id=account_id,
            body="Can the Mess Sec escalate this to the Hall Management Committee? We shouldn't have to walk down to Ground floor at 2 AM for drinking water.",
            upvotes=9,
            created_at=datetime.utcnow() - timedelta(hours=4),
        )
        db.add(rep1_child)

        # Reply 1.2: Identified response by Senior
        if senior:
            rep1_senior = AnonymousReplyV2(
                post_id=post1.id,
                is_anonymous=False,
                student_id=senior.id,
                body="I've forwarded this thread link directly to the General Secretary of Hostel Affairs (GSHA). If it isn't resolved by tomorrow evening, please DM me or raise it in the open house on Friday.",
                is_senior_verified=True,
                upvotes=34,
                created_at=datetime.utcnow() - timedelta(hours=2),
            )
            db.add(rep1_senior)

        # Thread 2: Conversation (Academics) with LaTeX math
        post2 = AnonymousPostV2(
            slug=uuid.uuid4().hex[:12],
            category_id=cat_map["academics"],
            is_anonymous=True,
            account_id=account_id,
            kind="conversation",
            title="How strictly is the relative grading curved in IE courses?",
            body="First time taking an operations research elective with IE code. The class average in midsem was 42/100, standard deviation was $\\sigma = 14.5$. Does the prof stick to a rigid bell curve for AA/AB or is there cutoff leniency if you show improvement in the final project?",
            upvotes=19,
            downvotes=0,
            metoo=15,
            reply_count=2,
            created_at=datetime.utcnow() - timedelta(hours=14),
        )
        db.add(post2)
        db.flush()

        # Reply 2.1: Senior verified
        if senior:
            rep2_1 = AnonymousReplyV2(
                post_id=post2.id,
                is_anonymous=False,
                student_id=senior.id,
                body="Took this course last autumn. The professor is quite reasonable: if your final project implementation is solid and you score above $\\mu + 1.2\\sigma$ overall, you comfortably land an AB or AA. Do not skip tutorial problem sets; midsem problems were 70% direct variations.",
                is_senior_verified=True,
                upvotes=21,
                created_at=datetime.utcnow() - timedelta(hours=10),
            )
            db.add(rep2_1)

        # Thread 3: Official Announcement
        post3 = AnonymousPostV2(
            slug=uuid.uuid4().hex[:12],
            category_id=cat_map["official"],
            is_anonymous=False,
            student_id=senior.id if senior else None,
            is_official=True,
            kind="conversation",
            title="✓ Welcome to ATLAS Anonymous Portal — Privacy & Community Guidelines",
            body="ATLAS Anonymous Portal is designed for the IIT Bombay community to raise grievances, ask vulnerable questions, and share experiences without fear of tracking.\n\n- **Zero-knowledge Privacy:** Your anonymous posts are cryptographically decoupled from your roll number.\n- **Support is Always Near:** Emergency campus contacts (Hospital, SWC, QRT, Angel) are available on every page.\n- **Dual-Mode Choice:** You can choose to post anonymously or as your verified student profile when answering peers.\n\nPlease be respectful, protect fellow students' privacy, and report any abusive content.",
            upvotes=65,
            downvotes=0,
            metoo=0,
            reply_count=0,
            created_at=datetime.utcnow() - timedelta(days=1),
        )
        db.add(post3)

        db.commit()
        print("[Anonymous V2] Seeding completed successfully.")

    except Exception as e:
        db.rollback()
        print(f"[Anonymous V2 Seed Error] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_anonymous_v2()
