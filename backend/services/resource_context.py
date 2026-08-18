"""Select and format Resource Library entries for the AI mentor."""

import re
from typing import Iterable

from sqlalchemy.orm import Session

from ..models import Resource, Student


def _keywords(*values: str | None) -> set[str]:
    """Return useful matching terms while ignoring short/common filler words."""
    stop_words = {
        "about", "after", "before", "from", "have", "into", "need",
        "that", "their", "these", "this", "with", "would", "should",
        "your", "what", "when", "where", "which", "will", "want",
    }
    terms: set[str] = set()
    for value in values:
        terms.update(re.findall(r"[a-z0-9_+#.-]{3,}", (value or "").lower()))
    return terms - stop_words


def _student_domains(domains: str | None) -> set[str]:
    return {
        domain.strip().lower()
        for domain in (domains or "").split(",")
        if domain.strip()
    }


def _score_resource(
    resource: Resource,
    domains: set[str],
    keywords: set[str],
) -> float:
    searchable = " ".join(
        filter(None, [
            resource.title,
            resource.description,
            resource.content,
            resource.course,
            resource.resource_type,
            resource.domain,
        ])
    ).lower()

    score = 20 if (resource.domain or "").lower() in domains else 0
    score += sum(4 for keyword in keywords if keyword in searchable)
    score += min(resource.upvotes or 0, 100) / 100
    return score


def get_resource_library_context(
    db: Session,
    student: Student,
    user_query: str = "",
    limit: int = 6,
) -> str:
    """Build a small, relevant catalogue that is safe to include in an LLM prompt."""
    domains = _student_domains(student.domains)
    keywords = _keywords(
        student.branch,
        student.goals,
        student.weak_subjects,
        user_query,
    )
    resources: Iterable[Resource] = db.query(Resource).all()
    ranked = sorted(
        resources,
        key=lambda resource: _score_resource(resource, domains, keywords),
        reverse=True,
    )

    # Prefer resources that match the student's domain or profile/question terms.
    relevant = [
        resource for resource in ranked
        if (resource.domain or "").lower() in domains
        or _score_resource(resource, set(), keywords) > 0
    ][:limit]

    if not relevant:
        return "No relevant entries are currently available in the ITSP Resource Library."

    entries = []
    for resource in relevant:
        details = [
            f"domain: {resource.domain}",
            f"type: {resource.resource_type or 'unspecified'}",
        ]
        if resource.course:
            details.append(f"course: {resource.course}")
        if resource.url:
            details.append(f"URL: {resource.url}")
        description = (resource.description or resource.content or "").strip()
        if description:
            details.append(f"description: {description[:500]}")
        entries.append(f"- {resource.title} ({'; '.join(details)})")

    return "\n".join(entries)
