import http.server
import socketserver
import json
import smtplib
import socket
import sys
import os
import time
import base64
import csv
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

PORT = 8080
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'email_config.json')

# Server Data Storage Directories
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
RECORDS_DIR = os.path.join(DATA_DIR, 'records')
PHOTOS_DIR = os.path.join(DATA_DIR, 'photos')
SIGNATURES_DIR = os.path.join(DATA_DIR, 'signatures')
CSV_FILE = os.path.join(DATA_DIR, 'submissions.csv')

def ensure_data_dirs():
    os.makedirs(RECORDS_DIR, exist_ok=True)
    os.makedirs(PHOTOS_DIR, exist_ok=True)
    os.makedirs(SIGNATURES_DIR, exist_ok=True)

# In-memory OTP storage: email -> { 'otp': '123456', 'expires': timestamp }
otp_store = {}

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def load_email_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[CONFIG ERROR] Could not read email_config.json: {e}")
    return {
        "smtp_server": "smtp.gmail.com",
        "smtp_port": 587,
        "use_tls": True,
        "sender_name": "Aadhithan Groups Verification",
        "sender_email": "",
        "sender_password": "",
        "configured": False
    }

def save_email_config(config):
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2)

def send_via_brevo_api(api_key, sender_email, sender_name, recipient_email, otp_code, html_content):
    import urllib.request, urllib.error
    url = "https://api.brevo.com/v3/smtp/email"
    payload = {
        "sender": { "name": sender_name, "email": sender_email },
        "to": [{ "email": recipient_email }],
        "subject": f"Your Verification OTP: {otp_code} - Aadhithan Groups",
        "htmlContent": html_content
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            "api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as res:
            resp_data = json.loads(res.read().decode('utf-8'))
            print(f"[BREVO API SUCCESS] Message ID: {resp_data.get('messageId')}")
            return True, "Email successfully sent to your inbox."
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        print(f"[BREVO API ERROR] {e.code}: {err_body}")
        if "unrecognised IP address" in err_body:
            return False, "Brevo IP authorization required: Please visit https://app.brevo.com/security/authorised_ips to authorize your current IP."
        return False, err_body
    except Exception as e:
        return False, str(e)

def send_real_email_otp(recipient_email, otp_code):
    config = load_email_config()
    sender_email = config.get("sender_email", "").strip()
    sender_password = config.get("sender_password", "").strip()
    smtp_server = config.get("smtp_server", "smtp.gmail.com").strip()
    smtp_port = int(config.get("smtp_port", 587))
    sender_name = config.get("sender_name", "Aadhithan Groups Compliance")
    use_tls = config.get("use_tls", True)
    brevo_api_key = config.get("brevo_api_key", "").strip()

    # Plain text fallback
    text_content = f"""AADHITHAN GROUPS - MEMBER VERIFICATION

Your 6-digit One-Time Password (OTP) for member verification is: {otp_code}

This code is valid for 10 minutes.
Please enter this code on the verification form to verify your email address.

If you did not request this verification, please ignore this email.
Aadhithan Groups Department of Compliance
"""

    # Rich HTML Email
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }}
    .email-card {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08); }}
    .email-header {{ background: linear-gradient(135deg, #1e3a8a, #0f172a); padding: 28px 24px; text-align: center; color: #ffffff; }}
    .email-logo-badge {{ display: inline-block; width: 48px; height: 48px; line-height: 48px; background: rgba(255,255,255,0.15); border-radius: 10px; font-weight: 800; font-size: 20px; letter-spacing: 1px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.25); }}
    .email-header h1 {{ margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }}
    .email-header p {{ margin: 4px 0 0; font-size: 12px; color: #94a3b8; letter-spacing: 0.5px; text-transform: uppercase; }}
    .email-body {{ padding: 32px 28px; text-align: center; }}
    .email-body h2 {{ margin: 0 0 10px; font-size: 18px; color: #0f172a; font-weight: 700; }}
    .email-body p {{ margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.6; }}
    .otp-display-box {{ display: inline-block; background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 14px 28px; margin: 10px 0 24px; }}
    .otp-digits {{ font-family: 'JetBrains Mono', Consolas, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; display: block; }}
    .otp-expiry-note {{ font-size: 12px; color: #64748b; margin-top: 6px; }}
    .security-notice {{ background: #f8fafc; border-radius: 8px; padding: 12px; font-size: 12px; color: #64748b; line-height: 1.4; border-left: 3px solid #f59e0b; text-align: left; margin-top: 15px; }}
    .email-footer {{ background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; line-height: 1.5; }}
  </style>
</head>
<body>
  <div class="email-card">
    <div class="email-header">
      <div class="email-logo-badge">AG</div>
      <h1>AADHITHAN GROUPS</h1>
      <p>Official Verification & Compliance Portal</p>
    </div>
    <div class="email-body">
      <h2>Email Address Verification</h2>
      <p>You are receiving this email because you initiated a Member Verification record. Please enter the following 6-digit verification code to authenticate your email address:</p>
      
      <div class="otp-display-box">
        <span class="otp-digits">{otp_code}</span>
        <div class="otp-expiry-note">Valid for 10 minutes &bull; Single-use security code</div>
      </div>

      <div class="security-notice">
        <strong>Security Notice:</strong> Never share this verification code with anyone. Aadhithan Groups officials will never ask you for your verification OTP.
      </div>
    </div>
    <div class="email-footer">
      This is an automated system dispatch from the Aadhithan Groups Compliance Portal.<br>
      &copy; 2026 Aadhithan Groups. All rights reserved. &bull; Confidential
    </div>
  </div>
</body>
</html>
"""

    # 1. Try Brevo REST API first if API key is provided
    if brevo_api_key:
        brevo_sender = config.get("verified_sender_email") or "bhuvaneshkarnan@gmail.com"
        print(f"[EMAIL DISPATCH] Attempting Brevo API dispatch via {brevo_sender} to {recipient_email}...")
        ok, msg = send_via_brevo_api(brevo_api_key, brevo_sender, sender_name, recipient_email, otp_code, html_content)
        if ok:
            return True, msg
        print(f"[EMAIL DISPATCH] Brevo API failed: {msg}. Trying SMTP relay as fallback...")

    # 2. Try SMTP Relay
    if not sender_email or not sender_password:
        return False, "SMTP sender credentials not configured. Please enter sender email & app password in Email Settings."

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"Your Verification OTP: {otp_code} - Aadhithan Groups"
        msg['From'] = f"{sender_name} <{sender_email}>"
        msg['To'] = recipient_email

        part1 = MIMEText(text_content, 'plain')
        part2 = MIMEText(html_content, 'html')
        msg.attach(part1)
        msg.attach(part2)

        print(f"[SMTP] Connecting to {smtp_server}:{smtp_port}...")
        server = smtplib.SMTP(smtp_server, smtp_port, timeout=12)
        if use_tls:
            server.starttls()
        
        login_user = config.get("smtp_login") or sender_email
        print(f"[SMTP AUTH] Logging in as {login_user}...")
        server.login(login_user, sender_password)
        server.sendmail(sender_email, [recipient_email], msg.as_string())
        server.quit()
        print(f"[SMTP SUCCESS] Real email sent successfully to {recipient_email}")
        return True, "Email successfully sent to your inbox."
    except Exception as e:
        print(f"[SMTP ERROR] Failed to send email to {recipient_email}: {e}")
        return False, str(e)



def save_submission_to_disk(submission):
    ensure_data_dirs()
    ref_id = submission.get('refId', f"AG-VRF-{int(time.time())}")
    safe_ref = "".join(c for c in ref_id if c.isalnum() or c in ('-', '_'))

    photo_rel_path = None
    sig_rel_path = None

    # 1. Save Photo as an image file on disk
    photo_data = submission.get('photo', {}).get('dataUrl', '')
    if photo_data and ',' in photo_data:
        try:
            header, encoded = photo_data.split(',', 1)
            ext = 'png' if 'png' in header else 'jpg'
            photo_filename = f"{safe_ref}_photo.{ext}"
            photo_disk_path = os.path.join(PHOTOS_DIR, photo_filename)
            with open(photo_disk_path, 'wb') as f:
                f.write(base64.b64decode(encoded))
            photo_rel_path = f"data/photos/{photo_filename}"
            print(f"[DISK SAVE] Photo saved: {photo_disk_path}")
        except Exception as e:
            print(f"[DISK SAVE ERROR] Photo saving failed: {e}")

    # 2. Save Signature as a transparent PNG image file on disk
    sig_data = submission.get('declaration', {}).get('signatureDataUrl', '')
    if sig_data and ',' in sig_data:
        try:
            header, encoded = sig_data.split(',', 1)
            sig_filename = f"{safe_ref}_signature.png"
            sig_disk_path = os.path.join(SIGNATURES_DIR, sig_filename)
            with open(sig_disk_path, 'wb') as f:
                f.write(base64.b64decode(encoded))
            sig_rel_path = f"data/signatures/{sig_filename}"
            print(f"[DISK SAVE] Signature saved: {sig_disk_path}")
        except Exception as e:
            print(f"[DISK SAVE ERROR] Signature saving failed: {e}")

    # 3. Save Structured Record JSON file
    record_filename = f"{safe_ref}.json"
    record_disk_path = os.path.join(RECORDS_DIR, record_filename)

    record_to_save = dict(submission)
    record_to_save['saved_files'] = {
        'photo_file': photo_rel_path,
        'signature_file': sig_rel_path
    }

    with open(record_disk_path, 'w', encoding='utf-8') as f:
        json.dump(record_to_save, f, indent=2, ensure_ascii=False)
    print(f"[DISK SAVE] JSON Record saved: {record_disk_path}")

    # 4. Append to Master CSV Spreadsheet for Excel
    save_to_csv(record_to_save)

    return {
        "refId": safe_ref,
        "record_file": f"data/records/{record_filename}",
        "photo_file": photo_rel_path,
        "signature_file": sig_rel_path,
        "csv_file": "data/submissions.csv"
    }


def save_to_csv(rec):
    ensure_data_dirs()
    sec1 = rec.get('section1', {})
    sec2 = rec.get('section2', {})
    sec3 = rec.get('section3', {})
    sec4 = rec.get('section4', {})
    admin = rec.get('admin', {})
    decl = rec.get('declaration', {})

    row = {
        'Reference_ID': rec.get('refId', ''),
        'Timestamp': rec.get('timestamp', ''),
        'Full_Name': sec1.get('q1_full_name', ''),
        'Member_ID': sec1.get('q2_member_id', ''),
        'Project_Name': sec1.get('q3_project_name', ''),
        'Role': sec1.get('q4_project_role', ''),
        'Allocated_Amount': f"{sec1.get('q5_currency', '')} {sec1.get('q5_allocated_amount', '')}".strip(),
        'Received_Agreement': sec2.get('q6_received_agreement', ''),
        'Previous_Funds_Received': sec2.get('q7_received_funds_previously', ''),
        'Previous_Funds_Amount': sec2.get('q7_amount_received', ''),
        'Registration_Fees_Paid': sec2.get('q8_paid_registration_fees', ''),
        'Fees_Amount_Reason': sec2.get('q8_fee_amount_reason', ''),
        'Details_Match_Agreement': sec2.get('q9_details_match_agreement', ''),
        'Info_Accurate': sec2.get('q10_info_accurate', ''),
        'Authorize_Verification': sec2.get('q11_authorize_verification', ''),
        'Receive_Status_Update': sec2.get('q12_receive_status_update', ''),
        'Mobile_Number': sec3.get('q13_mobile_number', ''),
        'Agreement_Date': sec3.get('q14_agreement_date', ''),
        'Allocation_Confirmed': sec3.get('q15_confirmed_individual_allocation', ''),
        'Amount_Confirmed': sec3.get('q16_confirmed_amount', ''),
        'Written_Communication': sec3.get('q17_written_communication', ''),
        'Communication_Ref_No': sec3.get('q17_reference_number', ''),
        'Completed_Requirements': sec3.get('q18_completed_requirements', ''),
        'Pending_Documents': sec3.get('q19_pending_steps', ''),
        'Pending_Details': sec3.get('q19_pending_details', ''),
        'Official_Channel_Verified': sec3.get('q20_channel_verified', ''),
        'Additional_Fee_Asked': sec3.get('q21_additional_fee_asked', ''),
        'Additional_Fee_Details': sec3.get('q21_fee_details', ''),
        'Independently_Verified': sec3.get('q22_independently_verified', ''),
        'Discrepancy_Concerns': sec3.get('q23_discrepancy_concerns', ''),
        'Discrepancy_Details': sec3.get('q23_discrepancy_details', ''),
        'Additional_Info_Submit': sec3.get('q24_additional_info_submit', ''),
        'Additional_Info_Details': sec3.get('q24_additional_details', ''),
        'Recorded_In_Records': sec3.get('q25_recorded_in_org_records', ''),
        'Officially_Approved': sec4.get('q26_officially_approved', ''),
        'Approved_Amount': f"{sec4.get('q27_currency', '')} {sec4.get('q27_approved_amount', '')}".strip(),
        'Written_Confirmation_Received': sec4.get('q28_written_confirmation', ''),
        'Release_Date_Confirmed': sec4.get('q29_release_date_confirmed', ''),
        'Payment_Order_Received': sec4.get('q30_payment_order_received', ''),
        'Release_Ref_No': sec4.get('q31_release_reference_no', ''),
        'Declaration_Name': decl.get('member_name', ''),
        'Declaration_Date': decl.get('date', ''),
        'Admin_Verification_Status': admin.get('verification_status', ''),
        'Admin_Officer_Name': admin.get('officer_name', ''),
        'Admin_Officer_ID': admin.get('officer_id', ''),
        'Admin_Verified_Date': admin.get('verified_date', ''),
        'Admin_Notes': admin.get('official_notes', ''),
        'Photo_File': rec.get('saved_files', {}).get('photo_file', ''),
        'Signature_File': rec.get('saved_files', {}).get('signature_file', '')
    }

    fieldnames = list(row.keys())
    existing_rows = []
    if os.path.isfile(CSV_FILE):
        try:
            with open(CSV_FILE, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for r in reader:
                    existing_rows.append(r)
        except Exception as e:
            print(f"[CSV READ ERROR] {e}")

    # Deduplicate: if Reference_ID matches, replace row in place
    updated = False
    ref_id = row['Reference_ID']
    deduped_rows = []
    for r in existing_rows:
        if r.get('Reference_ID') == ref_id:
            if not updated:
                deduped_rows.append(row)
                updated = True
        else:
            deduped_rows.append(r)

    if not updated:
        deduped_rows.append(row)

    try:
        with open(CSV_FILE, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(deduped_rows)
        print(f"[DISK SAVE] Master CSV updated without duplicates ({len(deduped_rows)} total rows): {CSV_FILE}")
    except Exception as e:
        print(f"[CSV SAVE ERROR] {e}")


class PortalHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/smtp-status':
            config = load_email_config()
            status = {
                "configured": bool(config.get("sender_email") and config.get("sender_password")),
                "sender_email": config.get("sender_email", ""),
                "smtp_server": config.get("smtp_server", "smtp.gmail.com")
            }
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(status).encode('utf-8'))
        if self.path == '/api/records':
            ensure_data_dirs()
            records = []
            if os.path.exists(RECORDS_DIR):
                for fname in sorted(os.listdir(RECORDS_DIR), reverse=True):
                    if fname.endswith('.json'):
                        try:
                            with open(os.path.join(RECORDS_DIR, fname), 'r', encoding='utf-8') as f:
                                records.append(json.load(f))
                        except Exception:
                            pass
            self.send_json_response(200, records)
            return

        # Default static file serving
        super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        try:
            req_data = json.loads(post_data.decode('utf-8'))
        except Exception:
            req_data = {}

        # -------------------------------------------------------------
        # Endpoint: POST /api/send-otp
        # -------------------------------------------------------------
        if self.path == '/api/send-otp':
            email = req_data.get('email', '').strip().lower()
            if not email or '@' not in email:
                self.send_json_response(400, { "success": False, "message": "Invalid email address." })
                return

            # Generate 6-digit OTP
            otp = f"{random.randint(100000, 999999)}"
            otp_store[email] = {
                "otp": otp,
                "expires": time.time() + 600  # 10 minutes
            }

            print(f"\n[NEW OTP REQUEST] For: {email}", flush=True)
            print(f"[SECURITY CODE] Generated OTP: {otp}", flush=True)

            try:
                with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'latest_otp.json'), 'w') as f:
                    json.dump({"email": email, "otp": otp, "time": time.strftime("%Y-%m-%d %H:%M:%S")}, f, indent=2)
            except Exception as e:
                print(f"[LOG ERROR] {e}", flush=True)

            # Try to send real email
            config = load_email_config()
            is_configured = bool(config.get("sender_email") and config.get("sender_password"))

            email_sent = False
            email_msg = ""
            if is_configured:
                email_sent, email_msg = send_real_email_otp(email, otp)
            else:
                email_msg = "SMTP not configured yet. Set up sender email in Email Settings."
                print(f"[ACTION REQUIRED] To deliver emails directly to {email}'s inbox, configure your Gmail/SMTP in Email Settings.")

            # IMPORTANT: We NEVER return the OTP in the JSON response!
            self.send_json_response(200, {
                "success": True,
                "email_sent": email_sent,
                "smtp_configured": is_configured,
                "message": f"Verification code sent to {email}. Please check your inbox and spam folder.",
                "smtp_feedback": email_msg
            })
            return

        # -------------------------------------------------------------
        # Endpoint: POST /api/verify-otp
        # -------------------------------------------------------------
        elif self.path == '/api/verify-otp':
            email = req_data.get('email', '').strip().lower()
            otp_attempt = req_data.get('otp', '').strip()

            record = otp_store.get(email)
            if not record:
                self.send_json_response(400, { "success": False, "verified": false, "message": "No active OTP found. Please click Send OTP first." })
                return

            if time.time() > record['expires']:
                del otp_store[email]
                self.send_json_response(400, { "success": False, "verified": false, "message": "Verification code has expired. Please request a new code." })
                return

            if record['otp'] == otp_attempt:
                del otp_store[email]
                print(f"[VERIFY SUCCESS] Email {email} verified successfully!")
                self.send_json_response(200, { "success": True, "verified": True, "message": "Email verified successfully!" })
                return
            else:
                print(f"[VERIFY FAILED] Incorrect OTP attempt '{otp_attempt}' for {email}")
                self.send_json_response(400, { "success": False, "verified": False, "message": "Incorrect verification code. Please check your inbox and try again." })
                return

        # -------------------------------------------------------------
        # Endpoint: POST /api/save-smtp-config
        # -------------------------------------------------------------
        elif self.path == '/api/save-smtp-config':
            sender_email = req_data.get('sender_email', '').strip()
            sender_password = req_data.get('sender_password', '').strip()
            smtp_server = req_data.get('smtp_server', 'smtp.gmail.com').strip()
            smtp_port = int(req_data.get('smtp_port', 587))
            sender_name = req_data.get('sender_name', 'Aadhithan Groups Verification').strip()

            # Test connection
            try:
                print(f"[TEST SMTP] Testing connection with {sender_email} on {smtp_server}:{smtp_port}...")
                s = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
                s.starttls()
                s.login(sender_email, sender_password)
                s.quit()
                print("[TEST SMTP] Authentication successful!")

                config = {
                    "smtp_server": smtp_server,
                    "smtp_port": smtp_port,
                    "use_tls": True,
                    "sender_name": sender_name,
                    "sender_email": sender_email,
                    "sender_password": sender_password,
                    "configured": True
                }
                save_email_config(config)

                self.send_json_response(200, {
                    "success": True,
                    "message": "SMTP connection verified and saved! Real emails will now be sent directly to recipient inboxes."
                })
            except Exception as e:
                err_str = str(e)
                print(f"[TEST SMTP FAILED] {err_str}")
                self.send_json_response(400, {
                    "success": False,
                    "message": f"SMTP Authentication failed: {err_str}. For Gmail, use an App Password (not your regular login password)."
                })
            return

        # -------------------------------------------------------------
        # Endpoint: POST /api/save-record (Saves to server disk & CSV)
        # -------------------------------------------------------------
        elif self.path == '/api/save-record':
            try:
                res = save_submission_to_disk(req_data)
                self.send_json_response(200, {
                    "success": True,
                    "message": "Submission recorded, images, and master CSV spreadsheet saved successfully to server disk.",
                    "details": res
                })
            except Exception as e:
                print(f"[SAVE RECORD ERROR] {e}")
                self.send_json_response(500, {
                    "success": False,
                    "message": f"Server error saving record: {e}"
                })
            return

        super().do_POST()

    def send_json_response(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))


def run():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    local_ip = get_local_ip()

    port = PORT
    for attempt in range(10):
        try:
            with socketserver.TCPServer(("", port), PortalHandler) as httpd:
                print("=" * 64)
                print("   AADHITHAN GROUPS - MEMBER VERIFICATION PORTAL SERVER")
                print("=" * 64)
                print(f" * Local Address:   http://localhost:{port}")
                print(f" * Network Address: http://{local_ip}:{port}")
                print("=" * 64)
                print(" * Email Dispatch: Real SMTP Relay + Server-side Verification")
                print("=" * 64)
                httpd.serve_forever()
                break
        except OSError as e:
            if "address already in use" in str(e).lower() or e.errno in (98, 10048):
                port += 1
            else:
                raise e

if __name__ == '__main__':
    try:
        run()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        sys.exit(0)
