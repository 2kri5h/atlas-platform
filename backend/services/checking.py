from .students import register_student, get_student

sid = register_student("test@iitb.ac.in", "fake-token-123")
print(sid)

s = get_student(sid)
print(s)  # should show imap_token decrypted back to "fake-token-123"