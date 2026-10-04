import os
import uuid
import math
import json
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Query, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from jose import jwt, JWTError

from ..core.database import get_db
from ..core.config import settings
from ..models import (
    Student,
    AnonymousCategory,
    AnonymousAccount,
    AnonymousIssuance,
    SpentVoucher,
    AnonymousPostV2,
    AnonymousReplyV2,
    AnonymousVote,
    AnonymousMeToo,
    AnonymousReport,
    # Legacy models
    AnonymousPost,
    AnonymousPostReport,
    PostReply,
)
from .auth import get_current_user, require_admin
from ..utils.rate_limit import SlidingWindowLimiter, rate_limit
from ..utils.anonymous_crypto import (
    generate_thread_handle,
    generate_recovery_key,
    normalize_recovery_key,
    hash_recovery_key,
    get_current_semester,
    hash_student_semester,
    issue_voucher_token,
    verify_voucher_token,
    detect_crisis_distress,
)
from ..utils.anonymous_image import sanitize_and_save_image, MEDIA_DIR

router = APIRouter()

post_limiter = SlidingWindowLimiter(max_requests=10, window_seconds=300)
reply_limiter = SlidingWindowLimiter(max_requests=25, window_seconds=300)
vote_limiter = SlidingWindowLimiter(max_requests=60, window_seconds=300)
report_limiter = SlidingWindowLimiter(max_requests=5, window_seconds=300)

ANON_TOKEN_ALGO = "HS256"


# ── Auth & Identity Helpers ──────────────────────────────────────────────────

def create_anon_jwt(account_id: str) -> str:
    """Create a long-lived JWT token for the decoupled anonymous account."""
    expire = datetime.now(timezone.utc) + timedelta(days=180)
    payload = {"sub": account_id, "type": "anon", "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ANON_TOKEN_ALGO)


def get_anon_account_id(request: Request) -> Optional[str]:
    """Extract anonymous account ID from Authorization header or cookie."""
    auth_header = request.headers.get("X-Anon-Token") or request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    elif auth_header:
        token = auth_header
    token = token or request.cookies.get("atlas_anon")
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ANON_TOKEN_ALGO, settings.ALGORITHM])
        if payload.get("type") == "anon" or payload.get("sub"):
            return payload.get("sub")
    except JWTError:
        return None
    return None


async def get_optional_student(request: Request, db: Session = Depends(get_db)) -> Optional[Student]:
    """Retrieve logged-in student if credentials are provided, without raising 401."""
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    token = token or request.cookies.get("atlas_access")
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        roll = payload.get("sub")
        if roll:
            return db.query(Student).filter(Student.roll_number == roll).first()
    except Exception:
        return None
    return None


def get_voter_fingerprint(request: Request, student: Optional[Student], anon_account_id: Optional[str]) -> str:
    """Derive an unlinked voter key to enforce 1-vote/1-metoo per participant."""
    if anon_account_id:
        return f"anon:{anon_account_id}"
    if student:
        return f"stud:{hash_student_semester(student.id).hex()[:32]}"
    client_ip = request.client.host if request.client else "unknown"
    return f"ip:{hash_student_semester(abs(hash(client_ip)) % 1000000).hex()[:32]}"


# ── Emergency Support Directory ──────────────────────────────────────────────

SUPPORT_TIERS = [
    {
        "id": "urgent",
        "title": "In danger right now",
        "items": [
            {
                "name": "IIT Bombay Hospital Emergency",
                "detail": "Open 24×7. Walk in directly or call ambulance.",
                "phone": "022 2159 1110",
                "tel": "02221591110",
            },
            {
                "name": "Hospital Emergency (Mobile)",
                "detail": "Duty medical officer mobile",
                "phone": "+91 82912 97051",
                "tel": "+918291297051",
            },
            {
                "name": "Quick Response Team (Male QRT)",
                "detail": "Campus security emergency response",
                "phone": "98333 38989",
                "tel": "9833338989",
            },
            {
                "name": "Quick Response Team (Female QRT)",
                "detail": "Campus security emergency response",
                "phone": "91673 98598",
                "tel": "9167398598",
            },
        ],
    },
    {
        "id": "now",
        "title": "Talk to someone now (24×7)",
        "items": [
            {
                "name": "Talk to Angel Helpline",
                "detail": "Free, confidential student psychological counselling",
                "phone": "080 4713 6761",
                "tel": "08047136761",
            },
            {
                "name": "Talk to Angel Online",
                "detail": "Chat or video call with a qualified counsellor",
                "url": "https://swc.iitb.ac.in/online",
                "cta": "Open SWC Online",
            },
        ],
    },
    {
        "id": "campus",
        "title": "On-Campus Walk-In",
        "items": [
            {
                "name": "Student Wellness Centre (SWC)",
                "detail": "NN Main Building, 3rd Floor. 10 AM – 6 PM daily, including weekends. Intercom 9070.",
                "phone": "022 2576 9070",
                "tel": "02225769070",
            },
            {
                "name": "Internal Complaints Committee (ICC) / Gender Cell",
                "detail": "Redressal of sexual harassment complaints on campus",
                "phone": "022 2576 7080",
                "tel": "02225767080",
            },
        ],
    },
    {
        "id": "outside",
        "title": "National Helplines",
        "items": [
            {
                "name": "Tele-MANAS",
                "detail": "Govt of India National Mental Health Helpline, 24×7",
                "phone": "14416",
                "tel": "14416",
            },
            {
                "name": "National Anti-Ragging Helpline",
                "detail": "Toll-free 24×7 anti-ragging complaints",
                "phone": "1800 180 5522",
                "tel": "18001805522",
            },
        ],
    },
]


@router.get("/support")
def get_support_directory():
    """Return verified IIT Bombay emergency, wellness, and counselling contacts."""
    return {
        "disclaimer": "These verified campus contacts are listed for your safety. Help is always confidential.",
        "tiers": SUPPORT_TIERS,
    }


# ── Categories ───────────────────────────────────────────────────────────────

@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    """Return all categories with post counts."""
    categories = db.query(AnonymousCategory).order_by(AnonymousCategory.sort_order.asc()).all()
    result = []
    for c in categories:
        count = db.query(func.count(AnonymousPostV2.id)).filter(
            AnonymousPostV2.category_id == c.id,
            AnonymousPostV2.is_flagged == False,
        ).scalar() or 0
        result.append({
            "id": c.id,
            "slug": c.slug,
            "name": c.name,
            "description": c.description,
            "sort_order": c.sort_order,
            "post_count": count,
        })
    return result


# ── Cryptographic Voucher & Anonymous Account Setup ─────────────────────────

class VoucherClaimResponse(BaseModel):
    voucher: str
    semester: str


class VoucherRedeemRequest(BaseModel):
    voucher: str
    semester: str
    recovery_key: Optional[str] = None


class RecoverSessionRequest(BaseModel):
    recovery_key: str


@router.post("/voucher/claim", response_model=VoucherClaimResponse)
def claim_voucher(
    current_user: Student = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Authenticated student claims an unlinked blind voucher for the semester."""
    semester = get_current_semester()
    student_hmac = hash_student_semester(current_user.id)

    existing = db.query(AnonymousIssuance).filter(
        AnonymousIssuance.student_hmac == student_hmac,
        AnonymousIssuance.semester == semester,
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="You have already claimed an anonymous voucher for this semester. Use your Recovery Key to sign in.",
        )

    voucher, sem = issue_voucher_token(current_user.id)
    db.add(AnonymousIssuance(student_hmac=student_hmac, semester=semester))
    db.commit()

    return {"voucher": voucher, "semester": sem}


@router.post("/voucher/redeem")
def redeem_voucher(
    req: VoucherRedeemRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """Redeem a valid voucher to create a new anonymous account with a recovery key."""
    if not verify_voucher_token(req.voucher, req.semester):
        raise HTTPException(status_code=400, detail="Invalid or expired voucher token.")

    voucher_hash = hash_recovery_key(req.voucher)
    spent = db.query(SpentVoucher).filter(SpentVoucher.token_hash == voucher_hash).first()
    if spent:
        raise HTTPException(status_code=400, detail="Voucher has already been redeemed.")

    raw_key = req.recovery_key
    if raw_key:
        normalized = normalize_recovery_key(raw_key)
        if not normalized:
            raise HTTPException(status_code=400, detail="Invalid recovery key format.")
    else:
        raw_key = generate_recovery_key()
        normalized = normalize_recovery_key(raw_key)

    secret_hash = hash_recovery_key(normalized)
    existing_acc = db.query(AnonymousAccount).filter(AnonymousAccount.secret_hash == secret_hash).first()
    if existing_acc:
        raise HTTPException(status_code=400, detail="Account with this recovery key already exists.")

    account_id = str(uuid.uuid4())
    account = AnonymousAccount(
        id=account_id,
        secret_hash=secret_hash,
        valid_until=datetime.utcnow() + timedelta(days=180),
        status="active",
    )
    db.add(account)
    db.add(SpentVoucher(token_hash=voucher_hash, semester=req.semester))
    db.commit()

    token = create_anon_jwt(account_id)
    response.set_cookie(
        key="atlas_anon",
        value=token,
        max_age=180 * 24 * 3600,
        httponly=True,
        samesite="lax",
    )

    return {
        "status": "success",
        "account_id": account_id,
        "recovery_key": raw_key,
        "anon_token": token,
        "message": "Anonymous identity created. Save your Recovery Key to access your account anywhere.",
    }


@router.post("/session/recover")
def recover_session(
    req: RecoverSessionRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """Sign in to the anonymous portal using a 120-bit Crockford Base32 Recovery Key."""
    normalized = normalize_recovery_key(req.recovery_key)
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid recovery key format.")

    secret_hash = hash_recovery_key(normalized)
    account = db.query(AnonymousAccount).filter(AnonymousAccount.secret_hash == secret_hash).first()
    if not account or account.status != "active":
        raise HTTPException(status_code=404, detail="No active anonymous account found for this recovery key.")

    token = create_anon_jwt(account.id)
    response.set_cookie(
        key="atlas_anon",
        value=token,
        max_age=180 * 24 * 3600,
        httponly=True,
        samesite="lax",
    )

    return {
        "status": "success",
        "account_id": account.id,
        "anon_token": token,
    }


@router.get("/me")
def get_anonymous_me(
    request: Request,
    student: Optional[Student] = Depends(get_optional_student),
    db: Session = Depends(get_db),
):
    """Check current user status: whether logged in as student and/or has anonymous account."""
    anon_id = get_anon_account_id(request)
    anon_account = None
    if anon_id:
        anon_account = db.query(AnonymousAccount).filter(AnonymousAccount.id == anon_id).first()

    return {
        "has_anon_account": anon_account is not None,
        "anon_account_id": anon_account.id if anon_account else None,
        "is_student_logged_in": student is not None,
        "student": {
            "name": student.name,
            "roll_number": student.roll_number,
            "branch": student.branch,
            "year": student.year,
            "is_senior": (student.year or 0) >= 4,
            "role": student.role,
        } if student else None,
    }


# ── Feed & Thread List ───────────────────────────────────────────────────────

def calculate_hot_score(upvotes: int, downvotes: int, metoo: int, created_at: datetime) -> float:
    """Hacker News / Reddit style gravity decay score."""
    net_votes = upvotes - downvotes
    age_hours = max((datetime.utcnow() - created_at).total_seconds() / 3600.0, 0.0)
    numerator = max(net_votes + 2 * metoo + 1, 0)
    denominator = math.pow(age_hours + 2.0, 1.5)
    return numerator / denominator


@router.get("/feed")
def get_feed(
    request: Request,
    tab: str = Query("all", pattern="^(all|grievances|conversations|most-affected|unanswered|following)$"),
    sort: str = Query("hot", pattern="^(hot|new|top|affected)$"),
    category: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    student: Optional[Student] = Depends(get_optional_student),
    db: Session = Depends(get_db),
):
    """List posts with ranking, filtering, and ephemeral handle computation."""
    anon_id = get_anon_account_id(request)
    voter_key = get_voter_fingerprint(request, student, anon_id)

    query = db.query(AnonymousPostV2).filter(AnonymousPostV2.is_flagged == False)

    if tab == "grievances":
        query = query.filter(AnonymousPostV2.kind == "grievance")
    elif tab == "conversations":
        query = query.filter(AnonymousPostV2.kind == "conversation")
    elif tab == "unanswered":
        query = query.filter(AnonymousPostV2.reply_count == 0)
    elif tab == "most-affected":
        query = query.filter(AnonymousPostV2.metoo > 0)
        sort = "affected"

    if category:
        cat = db.query(AnonymousCategory).filter(AnonymousCategory.slug == category).first()
        if cat:
            query = query.filter(AnonymousPostV2.category_id == cat.id)

    all_posts = query.all()

    post_ids = [p.id for p in all_posts]
    user_votes = {}
    user_metoos = set()
    if post_ids:
        votes = db.query(AnonymousVote).filter(
            AnonymousVote.voter_key == voter_key,
            AnonymousVote.target_type == "post",
            AnonymousVote.target_id.in_(post_ids),
        ).all()
        for v in votes:
            user_votes[v.target_id] = v.vote

        metoos = db.query(AnonymousMeToo).filter(
            AnonymousMeToo.voter_key == voter_key,
            AnonymousMeToo.post_id.in_(post_ids),
        ).all()
        for m in metoos:
            user_metoos.add(m.post_id)

    if sort == "new":
        all_posts.sort(key=lambda p: p.created_at, reverse=True)
    elif sort == "top":
        all_posts.sort(key=lambda p: (p.upvotes - p.downvotes), reverse=True)
    elif sort == "affected":
        all_posts.sort(key=lambda p: p.metoo, reverse=True)
    else:  # "hot" default
        all_posts.sort(
            key=lambda p: (
                1 if p.is_official else 0,
                calculate_hot_score(p.upvotes, p.downvotes, p.metoo, p.created_at),
            ),
            reverse=True,
        )

    total = len(all_posts)
    start = (page - 1) * limit
    paginated = all_posts[start:start + limit]

    items = []
    for p in paginated:
        if p.is_anonymous:
            handle = generate_thread_handle(p.account_id or str(p.id), p.id)
            tint = sum(ord(c) for c in handle) % 6
            author_info = {
                "is_anonymous": True,
                "handle": f"{handle} (OP)",
                "tint": tint,
                "is_op": True,
            }
        else:
            stud = p.author_student
            author_info = {
                "is_anonymous": False,
                "name": stud.name if stud else "Verified Student",
                "branch": stud.branch if stud else "",
                "year": stud.year if stud else 1,
                "is_senior_verified": (stud.year or 0) >= 4 if stud else False,
                "role": stud.role if stud else "student",
            }

        image_list = []
        try:
            image_list = json.loads(p.images) if p.images else []
        except Exception:
            image_list = []

        items.append({
            "id": p.id,
            "slug": p.slug,
            "category": {
                "id": p.category.id,
                "slug": p.category.slug,
                "name": p.category.name,
            } if p.category else None,
            "kind": p.kind,
            "title": p.title,
            "body": p.body,
            "is_official": p.is_official,
            "images": [f"/api/anonymous/media/{img}" for img in image_list],
            "upvotes": p.upvotes,
            "downvotes": p.downvotes,
            "score": p.upvotes - p.downvotes,
            "metoo": p.metoo,
            "reply_count": p.reply_count,
            "created_at": p.created_at.isoformat(),
            "has_distress": detect_crisis_distress(p.title + " " + p.body),
            "author": author_info,
            "user_vote": user_votes.get(p.id, 0),
            "has_metoo": p.id in user_metoos,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if limit else 1,
    }


# ── Nested Thread View ───────────────────────────────────────────────────────

def build_reply_tree(
    replies: List[AnonymousReplyV2],
    post: AnonymousPostV2,
    user_votes: Dict[int, int],
) -> List[Dict[str, Any]]:
    """Convert flat replies list into a hierarchical Reddit-style nested comment tree."""
    by_id = {}
    tree = []

    for r in replies:
        is_op = (p_account := post.account_id) and r.account_id == p_account
        if r.is_anonymous:
            base_name = generate_thread_handle(r.account_id or str(r.id), post.id)
            handle = f"{base_name} (OP)" if is_op else base_name
            tint = sum(ord(c) for c in base_name) % 6
            author_info = {
                "is_anonymous": True,
                "handle": handle,
                "tint": tint,
                "is_op": is_op,
            }
        else:
            stud = r.author_student
            author_info = {
                "is_anonymous": False,
                "name": stud.name if stud else "Verified Student",
                "branch": stud.branch if stud else "",
                "year": stud.year if stud else 1,
                "is_senior_verified": r.is_senior_verified or ((stud.year or 0) >= 4 if stud else False),
                "role": stud.role if stud else "student",
            }

        node = {
            "id": r.id,
            "post_id": r.post_id,
            "parent_id": r.parent_id,
            "body": r.body,
            "is_official": r.is_official,
            "upvotes": r.upvotes,
            "downvotes": r.downvotes,
            "score": r.upvotes - r.downvotes,
            "created_at": r.created_at.isoformat(),
            "author": author_info,
            "user_vote": user_votes.get(r.id, 0),
            "children": [],
        }
        by_id[r.id] = node

    for r in replies:
        node = by_id[r.id]
        if r.parent_id and r.parent_id in by_id:
            by_id[r.parent_id]["children"].append(node)
        else:
            tree.append(node)

    return tree


@router.get("/posts/{slug_or_id}")
def get_thread(
    slug_or_id: str,
    request: Request,
    student: Optional[Student] = Depends(get_optional_student),
    db: Session = Depends(get_db),
):
    """Retrieve full post details with recursive Reddit-style nested replies."""
    anon_id = get_anon_account_id(request)
    voter_key = get_voter_fingerprint(request, student, anon_id)

    if slug_or_id.isdigit():
        post = db.query(AnonymousPostV2).filter(AnonymousPostV2.id == int(slug_or_id)).first()
    else:
        post = db.query(AnonymousPostV2).filter(AnonymousPostV2.slug == slug_or_id).first()

    if not post or post.is_flagged:
        raise HTTPException(status_code=404, detail="Post not found or unavailable.")

    vote_record = db.query(AnonymousVote).filter(
        AnonymousVote.voter_key == voter_key,
        AnonymousVote.target_type == "post",
        AnonymousVote.target_id == post.id,
    ).first()
    user_vote = vote_record.vote if vote_record else 0

    metoo_record = db.query(AnonymousMeToo).filter(
        AnonymousMeToo.voter_key == voter_key,
        AnonymousMeToo.post_id == post.id,
    ).first()
    has_metoo = metoo_record is not None

    replies = db.query(AnonymousReplyV2).filter(
        AnonymousReplyV2.post_id == post.id
    ).order_by(AnonymousReplyV2.created_at.asc()).all()

    reply_ids = [r.id for r in replies]
    reply_votes = {}
    if reply_ids:
        r_votes = db.query(AnonymousVote).filter(
            AnonymousVote.voter_key == voter_key,
            AnonymousVote.target_type == "reply",
            AnonymousVote.target_id.in_(reply_ids),
        ).all()
        for rv in r_votes:
            reply_votes[rv.target_id] = rv.vote

    reply_tree = build_reply_tree(replies, post, reply_votes)

    if post.is_anonymous:
        handle = generate_thread_handle(post.account_id or str(post.id), post.id)
        tint = sum(ord(c) for c in handle) % 6
        author_info = {
            "is_anonymous": True,
            "handle": f"{handle} (OP)",
            "tint": tint,
            "is_op": True,
        }
    else:
        stud = post.author_student
        author_info = {
            "is_anonymous": False,
            "name": stud.name if stud else "Verified Student",
            "branch": stud.branch if stud else "",
            "year": stud.year if stud else 1,
            "is_senior_verified": (stud.year or 0) >= 4 if stud else False,
            "role": stud.role if stud else "student",
        }

    image_list = []
    try:
        image_list = json.loads(post.images) if post.images else []
    except Exception:
        image_list = []

    return {
        "id": post.id,
        "slug": post.slug,
        "category": {
            "id": post.category.id,
            "slug": post.category.slug,
            "name": post.category.name,
        } if post.category else None,
        "kind": post.kind,
        "title": post.title,
        "body": post.body,
        "is_official": post.is_official,
        "images": [f"/api/anonymous/media/{img}" for img in image_list],
        "upvotes": post.upvotes,
        "downvotes": post.downvotes,
        "score": post.upvotes - post.downvotes,
        "metoo": post.metoo,
        "reply_count": post.reply_count,
        "created_at": post.created_at.isoformat(),
        "has_distress": detect_crisis_distress(post.title + " " + post.body),
        "author": author_info,
        "user_vote": user_vote,
        "has_metoo": has_metoo,
        "replies": reply_tree,
    }


# ── Create Post & Reply (Dual Mode) ──────────────────────────────────────────

class PostCreateV2(BaseModel):
    title: str = Field(min_length=3, max_length=250)
    body: str = Field(min_length=5, max_length=10000)
    category_slug: str
    kind: str = Field("grievance", pattern="^(grievance|conversation)$")
    is_anonymous: bool = True
    images: List[str] = []


class ReplyCreateV2(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
    parent_id: Optional[int] = None
    is_anonymous: bool = True


@router.post("/posts")
def create_post_v2(
    req: PostCreateV2,
    request: Request,
    response: Response,
    student: Optional[Student] = Depends(get_optional_student),
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit(post_limiter, "anon_create_post")),
):
    """Create a new post in either Anonymous mode (ephemeral animal) or Verified mode (real student)."""
    cat = db.query(AnonymousCategory).filter(AnonymousCategory.slug == req.category_slug).first()
    if not cat:
        raise HTTPException(status_code=400, detail="Invalid category selected.")

    account_id = None
    student_id = None

    if req.is_anonymous:
        account_id = get_anon_account_id(request)
        if not account_id:
            raw_key = generate_recovery_key()
            normalized = normalize_recovery_key(raw_key)
            account_id = str(uuid.uuid4())
            anon_acc = AnonymousAccount(
                id=account_id,
                secret_hash=hash_recovery_key(normalized),
                valid_until=datetime.utcnow() + timedelta(days=180),
                status="active",
            )
            db.add(anon_acc)
            db.commit()
            token = create_anon_jwt(account_id)
            response.set_cookie(
                key="atlas_anon",
                value=token,
                max_age=180 * 24 * 3600,
                httponly=True,
                samesite="lax",
            )
    else:
        if not student:
            raise HTTPException(status_code=401, detail="You must be logged in to post as yourself.")
        student_id = student.id

    is_official = False
    if not req.is_anonymous and student and student.role == "admin" and req.category_slug == "official":
        is_official = True

    post_slug = uuid.uuid4().hex[:12]
    post = AnonymousPostV2(
        slug=post_slug,
        category_id=cat.id,
        is_anonymous=req.is_anonymous,
        account_id=account_id,
        student_id=student_id,
        kind=req.kind,
        title=req.title.strip(),
        body=req.body.strip(),
        is_official=is_official,
        images=json.dumps(req.images),
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    return {
        "status": "success",
        "id": post.id,
        "slug": post.slug,
        "message": "Post published successfully.",
    }


@router.post("/posts/{post_id}/replies")
def create_reply_v2(
    post_id: int,
    req: ReplyCreateV2,
    request: Request,
    response: Response,
    student: Optional[Student] = Depends(get_optional_student),
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit(reply_limiter, "anon_create_reply")),
):
    """Add a nested reply to a post or comment in either Anonymous or Verified mode."""
    post = db.query(AnonymousPostV2).filter(AnonymousPostV2.id == post_id).first()
    if not post or post.is_flagged:
        raise HTTPException(status_code=404, detail="Post not found or unavailable for replies.")

    if req.parent_id:
        parent = db.query(AnonymousReplyV2).filter(
            AnonymousReplyV2.id == req.parent_id,
            AnonymousReplyV2.post_id == post_id,
        ).first()
        if not parent:
            raise HTTPException(status_code=400, detail="Parent reply not found in this thread.")

    account_id = None
    student_id = None
    is_senior_verified = False

    if req.is_anonymous:
        account_id = get_anon_account_id(request)
        if not account_id:
            raw_key = generate_recovery_key()
            normalized = normalize_recovery_key(raw_key)
            account_id = str(uuid.uuid4())
            anon_acc = AnonymousAccount(
                id=account_id,
                secret_hash=hash_recovery_key(normalized),
                valid_until=datetime.utcnow() + timedelta(days=180),
                status="active",
            )
            db.add(anon_acc)
            db.commit()
            token = create_anon_jwt(account_id)
            response.set_cookie(
                key="atlas_anon",
                value=token,
                max_age=180 * 24 * 3600,
                httponly=True,
                samesite="lax",
            )
    else:
        if not student:
            raise HTTPException(status_code=401, detail="You must be logged in to reply as yourself.")
        student_id = student.id
        is_senior_verified = (student.year or 0) >= 4

    reply = AnonymousReplyV2(
        post_id=post_id,
        parent_id=req.parent_id,
        is_anonymous=req.is_anonymous,
        account_id=account_id,
        student_id=student_id,
        body=req.body.strip(),
        is_senior_verified=is_senior_verified,
    )
    db.add(reply)
    post.reply_count = (post.reply_count or 0) + 1
    db.commit()
    db.refresh(reply)

    return {
        "status": "success",
        "id": reply.id,
        "post_id": post_id,
        "parent_id": reply.parent_id,
        "message": "Reply posted successfully.",
    }


# ── Reactions: Voting & "Affects Me Too" ──────────────────────────────────────

class VoteRequest(BaseModel):
    target_type: str = Field(pattern="^(post|reply)$")
    target_id: int
    value: int = Field(ge=-1, le=1)


@router.post("/vote")
def cast_vote(
    req: VoteRequest,
    request: Request,
    student: Optional[Student] = Depends(get_optional_student),
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit(vote_limiter, "anon_vote")),
):
    """Cast or toggle an upvote/downvote on a post or reply."""
    if req.value == 0:
        raise HTTPException(status_code=400, detail="Vote value must be 1 or -1.")

    anon_id = get_anon_account_id(request)
    voter_key = get_voter_fingerprint(request, student, anon_id)

    target_obj = None
    if req.target_type == "post":
        target_obj = db.query(AnonymousPostV2).filter(AnonymousPostV2.id == req.target_id).first()
    else:
        target_obj = db.query(AnonymousReplyV2).filter(AnonymousReplyV2.id == req.target_id).first()

    if not target_obj:
        raise HTTPException(status_code=404, detail="Target not found.")

    existing_vote = db.query(AnonymousVote).filter(
        AnonymousVote.voter_key == voter_key,
        AnonymousVote.target_type == req.target_type,
        AnonymousVote.target_id == req.target_id,
    ).first()

    new_user_vote = 0

    if existing_vote:
        if existing_vote.vote == req.value:
            if req.value == 1:
                target_obj.upvotes = max(target_obj.upvotes - 1, 0)
            else:
                target_obj.downvotes = max(target_obj.downvotes - 1, 0)
            db.delete(existing_vote)
            new_user_vote = 0
        else:
            if req.value == 1:
                target_obj.upvotes += 1
                target_obj.downvotes = max(target_obj.downvotes - 1, 0)
            else:
                target_obj.downvotes += 1
                target_obj.upvotes = max(target_obj.upvotes - 1, 0)
            existing_vote.vote = req.value
            new_user_vote = req.value
    else:
        if req.value == 1:
            target_obj.upvotes += 1
        else:
            target_obj.downvotes += 1
        db.add(AnonymousVote(
            voter_key=voter_key,
            target_type=req.target_type,
            target_id=req.target_id,
            vote=req.value,
        ))
        new_user_vote = req.value

    db.commit()

    return {
        "status": "success",
        "upvotes": target_obj.upvotes,
        "downvotes": target_obj.downvotes,
        "score": target_obj.upvotes - target_obj.downvotes,
        "user_vote": new_user_vote,
    }


@router.post("/posts/{post_id}/metoo")
def toggle_metoo(
    post_id: int,
    request: Request,
    student: Optional[Student] = Depends(get_optional_student),
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit(vote_limiter, "anon_metoo")),
):
    """Toggle 'Affects me too' / 'I feel this too' counter on a post."""
    post = db.query(AnonymousPostV2).filter(AnonymousPostV2.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")

    anon_id = get_anon_account_id(request)
    voter_key = get_voter_fingerprint(request, student, anon_id)

    existing = db.query(AnonymousMeToo).filter(
        AnonymousMeToo.voter_key == voter_key,
        AnonymousMeToo.post_id == post_id,
    ).first()

    has_metoo = False
    if existing:
        post.metoo = max(post.metoo - 1, 0)
        db.delete(existing)
        has_metoo = False
    else:
        post.metoo += 1
        db.add(AnonymousMeToo(voter_key=voter_key, post_id=post_id))
        has_metoo = True

    db.commit()

    return {
        "status": "success",
        "metoo": post.metoo,
        "has_metoo": has_metoo,
    }


# ── Search & Discovery (POST based for Privacy) ───────────────────────────────

class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=200)
    category: Optional[str] = None
    page: int = 1
    limit: int = 20


@router.post("/search")
def search_posts(
    req: SearchRequest,
    request: Request,
    student: Optional[Student] = Depends(get_optional_student),
    db: Session = Depends(get_db),
):
    """Full-text search over posts sent via POST so query never appears in access logs."""
    q_str = req.query.strip().lower()

    query = db.query(AnonymousPostV2).filter(
        AnonymousPostV2.is_flagged == False,
        or_(
            func.lower(AnonymousPostV2.title).contains(q_str),
            func.lower(AnonymousPostV2.body).contains(q_str),
        ),
    )

    if req.category:
        cat = db.query(AnonymousCategory).filter(AnonymousCategory.slug == req.category).first()
        if cat:
            query = query.filter(AnonymousPostV2.category_id == cat.id)

    results = query.order_by(AnonymousPostV2.created_at.desc()).offset((req.page - 1) * req.limit).limit(req.limit).all()

    items = []
    for p in results:
        handle = generate_thread_handle(p.account_id or str(p.id), p.id) if p.is_anonymous else ""
        items.append({
            "id": p.id,
            "slug": p.slug,
            "category": {"slug": p.category.slug, "name": p.category.name} if p.category else None,
            "kind": p.kind,
            "title": p.title,
            "body": p.body[:250] + "..." if len(p.body) > 250 else p.body,
            "is_anonymous": p.is_anonymous,
            "handle": f"{handle} (OP)" if p.is_anonymous else (p.author_student.name if p.author_student else "Verified Student"),
            "upvotes": p.upvotes,
            "downvotes": p.downvotes,
            "metoo": p.metoo,
            "reply_count": p.reply_count,
            "created_at": p.created_at.isoformat(),
        })

    return {"items": items, "count": len(items)}


# ── Media Upload & Serving ───────────────────────────────────────────────────

@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    _rl: None = Depends(rate_limit(post_limiter, "anon_upload_image")),
):
    """Upload a grievance photo with automated EXIF/GPS metadata stripping."""
    contents = await file.read()
    filename = sanitize_and_save_image(contents)
    if not filename:
        raise HTTPException(
            status_code=400,
            detail="Invalid image. Supported formats: JPEG, PNG, WebP. Maximum size: 5 MB.",
        )
    return {
        "status": "success",
        "filename": filename,
        "url": f"/api/anonymous/media/{filename}",
    }


@router.get("/media/{filename}")
def serve_media(filename: str):
    """Serve a sanitized WebP photo."""
    clean_name = os.path.basename(filename)
    filepath = os.path.join(MEDIA_DIR, clean_name)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image not found.")
    return FileResponse(filepath, media_type="image/webp", headers={"Cache-Control": "public, max-age=604800"})


# ── Moderation & Reporting ───────────────────────────────────────────────────

class ReportRequest(BaseModel):
    target_type: str = Field("post", pattern="^(post|reply)$")
    target_id: int
    reason: str = Field(pattern="^(hate|harassment|spam|danger|identifying|other)$")
    note: str = ""


@router.post("/report")
def report_content(
    req: ReportRequest,
    request: Request,
    student: Optional[Student] = Depends(get_optional_student),
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit(report_limiter, "anon_report")),
):
    """Report a post or reply. Enforces 1-report per participant without revealing reporter."""
    anon_id = get_anon_account_id(request)
    voter_key = get_voter_fingerprint(request, student, anon_id)
    reporter_hash = hash_recovery_key(f"report:{voter_key}:{req.target_type}:{req.target_id}")

    existing = db.query(AnonymousReport).filter(AnonymousReport.reporter_hash == reporter_hash).first()
    if not existing:
        db.add(AnonymousReport(
            reporter_hash=reporter_hash,
            target_type=req.target_type,
            target_id=req.target_id,
            reason=req.reason,
            note=req.note.strip(),
        ))
        db.commit()

    count = db.query(func.count(AnonymousReport.id)).filter(
        AnonymousReport.target_type == req.target_type,
        AnonymousReport.target_id == req.target_id,
    ).scalar() or 0

    if count >= settings.ANONYMOUS_REPORT_THRESHOLD:
        if req.target_type == "post":
            p = db.query(AnonymousPostV2).filter(AnonymousPostV2.id == req.target_id).first()
            if p:
                p.is_flagged = True
                db.commit()

    return {"status": "received", "message": "Report submitted for moderation review."}


# ── Admin Moderation Queue ───────────────────────────────────────────────────

@router.get("/admin/flagged")
def list_flagged_v2(
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin queue: flagged posts awaiting review."""
    posts = db.query(AnonymousPostV2).filter(AnonymousPostV2.is_flagged == True).order_by(
        AnonymousPostV2.created_at.desc()
    ).all()
    return [
        {
            "id": p.id,
            "title": p.title,
            "body": p.body,
            "kind": p.kind,
            "category": p.category.name if p.category else "",
            "created_at": p.created_at.isoformat(),
        }
        for p in posts
    ]


@router.post("/admin/{post_id}/approve")
def approve_post_v2(
    post_id: int,
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Restore a falsely flagged post."""
    post = db.query(AnonymousPostV2).filter(AnonymousPostV2.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    post.is_flagged = False
    db.query(AnonymousReport).filter(
        AnonymousReport.target_type == "post",
        AnonymousReport.target_id == post_id,
    ).delete()
    db.commit()
    return {"message": "Post restored to public feed."}


@router.delete("/admin/{post_id}")
def delete_post_v2(
    post_id: int,
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Permanently remove a violating post and its replies."""
    post = db.query(AnonymousPostV2).filter(AnonymousPostV2.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    db.delete(post)
    db.commit()
    return {"message": "Post removed."}


@router.post("/legacy/{post_id}/report")
def report_post(
    post_id: int,
    current_user: Student = Depends(get_current_user),
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit(report_limiter, "report")),
):
    """Record one report per student for legacy test compatibility."""
    post = db.query(AnonymousPost).filter(AnonymousPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = db.query(AnonymousPostReport.id).filter(
        AnonymousPostReport.post_id == post_id,
        AnonymousPostReport.student_id == current_user.id,
    ).first()
    if not existing:
        db.add(AnonymousPostReport(post_id=post_id, student_id=current_user.id))
        try:
            db.flush()
        except Exception:
            db.rollback()

    report_count = db.query(func.count(AnonymousPostReport.id)).filter(
        AnonymousPostReport.post_id == post_id
    ).scalar() or 0
    if report_count >= settings.ANONYMOUS_REPORT_THRESHOLD:
        post.is_flagged = True
    db.commit()
    return {"status": "received"}


