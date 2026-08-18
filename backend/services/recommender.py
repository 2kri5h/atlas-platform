from sqlalchemy.orm import Session
from datetime import datetime
from ..models.models import Resource, Student


def get_recommended_resources(user: Student, db: Session, limit: int = 10):
    """Return top N resources personalized for this user using content-based filtering."""

    all_resources = db.query(Resource).filter(
        Resource.is_private == False
    ).all()

    if not all_resources:
        return []

    # Parse user profile
    user_domains = set(d.strip() for d in (user.domains or "").lower().split(",") if d.strip())
    user_goals = set(g.strip() for g in (user.goals or "").lower().split(",") if g.strip())
    user_weak = set(w.strip() for w in (user.weak_subjects or "").lower().split(",") if w.strip())

    # Score each resource
    max_upvotes = max((r.upvotes for r in all_resources), default=1) or 1
    now = datetime.utcnow()

    scored = []
    for resource in all_resources:
        score = 0.0
        reasons = []

        # 1. Domain match (40%)
        if resource.domain.lower() in user_domains:
            score += 0.40
            reasons.append(f"Matches your {resource.domain.upper()} interest")

        # 2. Year relevance (15%)
        course_level = _guess_course_level(resource)
        if user.year and user.year <= 2 and course_level == "beginner":
            score += 0.15
            reasons.append("Good for your year level")
        elif user.year and user.year >= 3 and course_level == "advanced":
            score += 0.15
            reasons.append("Advanced level for your year")
        else:
            score += 0.07  # partial credit

        # 3. Goal match (15%)
        desc_lower = (resource.description or "").lower()
        title_lower = resource.title.lower()
        combined_text = f"{desc_lower} {title_lower}"

        for goal in user_goals:
            if goal and goal in combined_text:
                score += 0.15
                reasons.append(f"Relevant to your '{goal}' goal")
                break

        # 4. Weak subject match (bonus 10%)
        for subject in user_weak:
            if subject and subject in combined_text:
                score += 0.10
                reasons.append(f"Helps with your weak area: {subject}")
                break

        # 5. Popularity (15%)
        popularity = resource.upvotes / max_upvotes
        score += 0.15 * popularity
        if popularity > 0.7:
            reasons.append(f"Highly upvoted ({resource.upvotes} upvotes)")

        # 6. Recency (15%)
        if resource.created_at:
            days_old = (now - resource.created_at).days
            recency = max(0, 1 - (days_old / 365))
            score += 0.15 * recency

        scored.append({
            "resource": resource,
            "score": round(score * 100, 1),
            "reasons": reasons if reasons else ["Popular in the community"]
        })

    # Sort by score descending, return top N
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]


def _guess_course_level(resource: Resource) -> str:
    """Guess if a resource is beginner or advanced based on text clues."""
    text = f"{resource.title} {resource.description or ''}".lower()

    advanced_keywords = ["advanced", "system design", "deep learning", "research",
                         "optimization", "distributed", "architect"]
    beginner_keywords = ["fundamentals", "basics", "introduction", "beginner",
                         "101", "primer", "getting started"]

    for kw in advanced_keywords:
        if kw in text:
            return "advanced"
    for kw in beginner_keywords:
        if kw in text:
            return "beginner"

    return "intermediate"
