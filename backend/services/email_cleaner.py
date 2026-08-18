import re
import difflib

def clean_email_body(text):
    """
    Cleans the body of a single email.
    Removes common IITB mailing-list boilerplate, normalizes formatting,
    and strips quoted replies.
    """

    if not text:
        return ""

    text = text.replace("\r\n", "\n")
    text = text.replace("\xa0", " ")
    text = text.replace("\t", " ")

    # Remove IITB mailing-list header

    header_pattern = (
        r"={3,}.*?please take care \*\*NOT\*\*.*?={3,}\n*"
    )

    text = re.sub(
        header_pattern,
        "",
        text,
        flags=re.DOTALL | re.IGNORECASE
    )

    # Remove common footers
    footer_markers = [
        "IMPORTANT !! PLEASE READ BELOW",
        "The student-notices mailing list is",
        "The student-events mailing list is",
        "This mailing list is meant for dissemination",
        "To unsubscribe send an email to",
        "This mail has been sent through Instiapp Events",
        "This is a copy of a message posted in",
    ]

    for marker in footer_markers:
        if marker in text:
            text = text.split(marker)[0]

    # Remove forwarded / original message chains

    forwarded_patterns = [
        r"\n-{2,}\s*Original Message\s*-{2,}.*",
        r"\n-{2,}\s*Forwarded Message\s*-{2,}.*",
    ]

    for pattern in forwarded_patterns:
        text = re.sub(
            pattern,
            "",
            text,
            flags=re.DOTALL | re.IGNORECASE
        )

    # Remove quoted reply lines (> ...)

    cleaned_lines = []

    for line in text.split("\n"):
        if line.strip().startswith(">"):
            continue
        cleaned_lines.append(line)

    text = "\n".join(cleaned_lines)

    # Remove excessive whitespace

    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ ]{2,}", " ", text)

    return text.strip()
def is_near_duplicate(a, b, threshold=0.8):
    if not a or not b:
        return False

    a_low = a.lower().strip()
    b_low = b.lower().strip()

    # If one body is completely contained in the other,
    # treat them as duplicates.
    if a_low in b_low or b_low in a_low:
        return True

    ratio = difflib.SequenceMatcher(
        None,
        a_low,
        b_low
    ).ratio()

    return ratio >= threshold

def pick_best_body(email_data):

    plain_clean = clean_email_body(
        email_data.get("body_plain", "")
    )

    html_clean = clean_email_body(
        email_data.get("body_html", "")
    )

    if not plain_clean:
        return html_clean

    if not html_clean:
        return plain_clean

    if is_near_duplicate(plain_clean, html_clean):
        return (
            plain_clean
            if len(plain_clean) >= len(html_clean)
            else html_clean
        )

    return plain_clean + "\n\n" + html_clean


def clean_email(email_data):
    """
    Cleans a single email dictionary.
    """

    cleaned = email_data.copy()

    cleaned["body"] = pick_best_body(email_data)

    cleaned.pop("body_plain", None)
    cleaned.pop("body_html", None)

    return cleaned

def clean_email_dataset(emails):
    """
    Cleans a list of email dictionaries.
    Removes emails whose body becomes empty after cleaning.
    """

    cleaned_emails = []

    for email_data in emails:

        cleaned = clean_email(email_data)

        if cleaned["body"].strip():
            cleaned_emails.append(cleaned)
# Debug plain vs HTML one
        # else:
        #     print("=" * 80)
        #     print("DROPPED EMAIL")
        #     print("Subject:", email_data["subject"])

        #     print("\n----- PLAIN BODY -----\n")
        #     print(email_data.get("body_plain")[:800])

        #     print("\n----- HTML BODY -----\n")
        #     print(email_data.get("body_html")[:800])
        #     print("=" * 80)
    return cleaned_emails