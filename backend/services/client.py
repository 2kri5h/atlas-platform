import imaplib
import ssl
import email
from .email_cleaner import clean_email_dataset
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv()

import os
from cryptography.fernet import Fernet

 #TODO Attachment reading

# --- CONFIGURATION ---
IMAP_SERVER = "imap.iitb.ac.in" 
IMAP_PORT = 993                         
# EMAIL_USER = os.environ["EMAIL_USER"]
# TOKEN_KEY = os.environ["EMAIL_APP_PASSWORD"]

def fetch_email(mail ,mail_id):
    status , msg_data= mail.fetch(mail_id , "(RFC822)")
    if status!="OK":
        return None
    mail_bytes=msg_data[0][1]
    msg=email.message_from_bytes(mail_bytes)
    return msg

def search_recent_emails(mail, date):
    status , data=mail.search(None, "SINCE",date)
    if status != "OK":
        return []
    mail_ids=data[0].split()
    return mail_ids
from email.header import decode_header

def decode_mime_words(s):
    if not s:
        return ""
    decoded_parts = decode_header(s)
    result = []
    for text, charset in decoded_parts:
        if isinstance(text, bytes):
            result.append(text.decode(charset or "utf-8", errors="replace"))
        else:
            result.append(text)
    return "".join(result)

def extract_bodyv2(msg):
    html_body=""
    plain_body=""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition", ""))

            if "attachment" in disposition.lower():
                continue
            if content_type == "text/plain" and not plain_body:
                payload=part.get_payload(decode=True)
                if payload is None:
                    continue
                charset = part.get_content_charset() or "utf-8"
                plain_body= payload.decode(charset, errors="replace")
            elif content_type=="text/html" and not html_body:
                payload=part.get_payload(decode=True)
                if payload is None:
                    continue    
                charset = part.get_content_charset() or "utf-8"
                html=payload.decode(charset ,errors="replace")
                soup =BeautifulSoup(html, "html.parser")
                html_body=soup.get_text(separator="\n", strip=True)  

    content_type = msg.get_content_type()   
    if not msg.is_multipart():         
        if content_type=="text/plain":
            payload=msg.get_payload(decode=True)
            if payload is None:
                return {
            "plain": plain_body,
            "html": html_body
        }
            charset = msg.get_content_charset() or "utf-8"
            plain_body=payload.decode(charset,errors="replace")

        if content_type=="text/html":
            payload=msg.get_payload(decode=True)
            if payload is None:
                return {
            "plain": plain_body,
            "html": html_body
        }
            charset = msg.get_content_charset() or "utf-8"
            html=payload.decode(charset, errors="replace")
            soup =BeautifulSoup(html, "html.parser")
            html_body=soup.get_text(separator="\n", strip=True)
                    
    return {
    "plain": plain_body,
    "html": html_body}    
def extract_emailv2(msg):
    bodies = extract_bodyv2(msg)

    return {
        "message_id": msg.get("Message-ID", ""),
        "subject": decode_mime_words(msg.get("Subject", "")),
        "sender": msg.get("From", ""),
        "date": msg.get("Date", ""),
        "body_plain": bodies["plain"],
        "body_html": bodies["html"]
    }        

def connect_imap(email_user , token_key, since_date=None):
    """
    since_date: optional datetime.date or datetime.datetime marking the
    earliest email to fetch. If not provided, falls back to a 2-day
    lookback window (used on first run / when no sync state exists yet).
    """
    if since_date is not None:
        date = since_date.strftime("%d-%b-%Y")
    else:
        date = (datetime.now() - timedelta(days=2)).strftime("%d-%b-%Y")
    try:
        print(f"Configuring legacy-compatible SSL context...")
        
        # Create a custom SSL context
        context = ssl.create_default_context()
        
        # 1. Allow older TLS versions (TLS 1.0, 1.1) which colleges often use
        context.minimum_version = ssl.TLSVersion.TLSv1
        
        # 2. Lower the cipher string security level to accept older server ciphers
        context.set_ciphers('DEFAULT@SECLEVEL=1')

        print(f"Connecting to {IMAP_SERVER} on port {IMAP_PORT}...")
        # Pass the custom SSL context into IMAP4_SSL
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT, ssl_context=context)
        
        # mail.debug = 4 
        print("Connected safely! Attempting authentication...")

        # --- APPROACH A: App Password ---
        clean_password = token_key.replace(" ", "")
        mail.login(email_user, clean_password)
        
        print("\n[SUCCESS] Successfully authenticated!")
        # selecting inbox
        status , msg=mail.select("INBOX")
        print("Status",status)
        print("No of emails:",msg[0].decode())       

  #searching the  mail

        mail_ids = search_recent_emails(mail, date)
        emails=[]

        for mail_id in mail_ids :
            try:

                msg = fetch_email(mail, mail_id)
                if msg is None:
                    continue            


                email_data=extract_emailv2(msg) 
                emails.append(email_data)           
                

            except Exception as e:

                print(f"[SKIP] {mail_id.decode()}: {e}")

                continue

        mail.logout()
        return emails

    except imaplib.IMAP4.error as e:
        print(f"\n[IMAP ERROR] Auth or protocol failure: {e}")
        return []
    except Exception as e:
        print(f"\n[SYSTEM ERROR] Connection or unexpected error: {e}")
        return []

