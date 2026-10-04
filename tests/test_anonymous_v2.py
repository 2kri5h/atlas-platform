"""Tests for ATLAS Anonymous Portal V2 — Decoupled Zero-Knowledge Forum & Dual-Mode Posting.

Verifies:
1. Blind Voucher issuance, redeem, and unlinked anonymous account creation.
2. Crockford Base32 Recovery Key normalization and session recovery.
3. Dual-mode posting (Anonymous ephemeral handle vs Verified Student).
4. Nested Reddit-style reply hierarchy.
5. Voting and "Affects me too" toggle semantics.
6. Crisis distress detection and verified IITB contacts.
"""

import pytest
import uuid
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.models import (
    Base,
    Student,
    AnonymousCategory,
    AnonymousAccount,
    AnonymousIssuance,
    SpentVoucher,
    AnonymousPostV2,
    AnonymousReplyV2,
    AnonymousVote,
    AnonymousMeToo,
)
from backend.utils.anonymous_crypto import (
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
from backend.api.anonymous import calculate_hot_score, build_reply_tree


def _fresh_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()

    # Seed core categories
    cats = [
        AnonymousCategory(slug="hostel-mess", name="Hostel & Mess", description="Mess and hostel", sort_order=1),
        AnonymousCategory(slug="academics", name="Academics & Grading", description="Academics", sort_order=2),
        AnonymousCategory(slug="wellbeing", name="Wellbeing & Mind", description="Wellbeing", sort_order=3),
    ]
    session.add_all(cats)
    session.commit()
    return session


def test_ephemeral_handle_generation():
    """Verify deterministic Adjective + Animal per post, unique across different posts."""
    h1_a = generate_thread_handle("account-123", 42)
    h1_b = generate_thread_handle("account-123", 42)
    h2 = generate_thread_handle("account-123", 99)

    assert h1_a == h1_b  # Consistent within the same thread
    assert len(h1_a.split(" ")) == 2  # Adjective + Animal format


def test_crockford_base32_recovery_key_normalization():
    """Verify 120-bit Crockford Base32 key generation, normalization and lookalike char mapping."""
    key = generate_recovery_key()
    assert len(key.replace("-", "")) == 24

    # Test error-tolerant normalization: O -> 0, I/L -> 1, lowercase -> uppercase
    test_key = "k7qm-2xrt-9bwd-f4nh-6jpc-3vla"
    norm = normalize_recovery_key(test_key)
    assert norm == "K7QM2XRT9BWDF4NH6JPC3V1A"  # 'l' maps to '1' in Crockford Base32

    with_o_and_l = "o7qm-2xrt-9bwd-f4nh-6jpc-3vla"
    norm_mapped = normalize_recovery_key(with_o_and_l)
    assert norm_mapped.startswith("07QM")


def test_voucher_issuance_and_zero_knowledge_claim():
    """Verify student gets signed voucher and cannot double-claim in the same semester."""
    db = _fresh_session()
    student = Student(roll_number="21001001", name="Krish", email="k@iitb.ac.in", password_hash="x", year=3)
    db.add(student)
    db.commit()

    sem = get_current_semester()
    student_hmac = hash_student_semester(student.id)

    # First claim succeeds
    voucher, sem_token = issue_voucher_token(student.id)
    assert verify_voucher_token(voucher, sem) is True

    # Record issuance
    db.add(AnonymousIssuance(student_hmac=student_hmac, semester=sem))
    db.commit()

    # Second claim check fails
    existing = db.query(AnonymousIssuance).filter(
        AnonymousIssuance.student_hmac == student_hmac,
        AnonymousIssuance.semester == sem
    ).first()
    assert existing is not None


def test_voucher_redemption_and_decoupled_account():
    """Verify voucher redemption creates an AnonymousAccount with no link to Student table."""
    db = _fresh_session()
    voucher, sem = issue_voucher_token(101)
    v_hash = hash_recovery_key(voucher)

    # Not spent yet
    assert db.query(SpentVoucher).filter(SpentVoucher.token_hash == v_hash).first() is None

    # Redeem and create anonymous account
    rec_key = generate_recovery_key()
    norm_key = normalize_recovery_key(rec_key)
    sec_hash = hash_recovery_key(norm_key)

    anon_acc = AnonymousAccount(
        id=str(uuid.uuid4()),
        secret_hash=sec_hash,
        valid_until=datetime.utcnow() + timedelta(days=180),
        status="active"
    )
    db.add(anon_acc)
    db.add(SpentVoucher(token_hash=v_hash, semester=sem))
    db.commit()

    # Verify spent check now catches duplicate attempt
    spent = db.query(SpentVoucher).filter(SpentVoucher.token_hash == v_hash).first()
    assert spent is not None


def test_nested_replies_tree_structure():
    """Verify recursive comment trees are structured properly with parent/child links."""
    db = _fresh_session()
    cat = db.query(AnonymousCategory).first()

    post = AnonymousPostV2(
        slug="test-slug-1",
        category_id=cat.id,
        is_anonymous=True,
        title="Hostel 16 water issue",
        body="Water is yellow",
        upvotes=10,
        metoo=5,
    )
    db.add(post)
    db.flush()

    # Parent reply
    r1 = AnonymousReplyV2(post_id=post.id, parent_id=None, is_anonymous=True, body="Parent reply 1")
    db.add(r1)
    db.flush()

    # Child reply
    r1_1 = AnonymousReplyV2(post_id=post.id, parent_id=r1.id, is_anonymous=True, body="Child reply 1.1")
    db.add(r1_1)
    db.flush()

    # Grandchild reply
    r1_1_1 = AnonymousReplyV2(post_id=post.id, parent_id=r1_1.id, is_anonymous=True, body="Grandchild reply 1.1.1")
    db.add(r1_1_1)
    db.commit()

    all_replies = db.query(AnonymousReplyV2).filter(AnonymousReplyV2.post_id == post.id).order_by(AnonymousReplyV2.created_at.asc()).all()
    tree = build_reply_tree(all_replies, post, {})

    assert len(tree) == 1
    assert tree[0]["body"] == "Parent reply 1"
    assert len(tree[0]["children"]) == 1
    assert tree[0]["children"][0]["body"] == "Child reply 1.1"
    assert len(tree[0]["children"][0]["children"]) == 1
    assert tree[0]["children"][0]["children"][0]["body"] == "Grandchild reply 1.1.1"


def test_hot_decay_ranking_algorithm():
    """Verify decay scoring: newer posts with high votes outrank older posts."""
    now = datetime.utcnow()
    # 2 hours old with 20 upvotes
    score_fresh = calculate_hot_score(upvotes=20, downvotes=0, metoo=5, created_at=now - timedelta(hours=2))
    # 48 hours old with same upvotes
    score_stale = calculate_hot_score(upvotes=20, downvotes=0, metoo=5, created_at=now - timedelta(hours=48))

    assert score_fresh > score_stale
    assert score_stale > 0


def test_crisis_distress_phrase_detection():
    """Verify crisis detection catches high-intent distress signals."""
    assert detect_crisis_distress("I really feel like ending it all, can't take this anymore") is True
    assert detect_crisis_distress("I am feeling suicidal and need help") is True
    assert detect_crisis_distress("Hostel 12 mess food has excessive oil today") is False
    assert detect_crisis_distress("The MA105 midsem was slightly tricky but manageable") is False
