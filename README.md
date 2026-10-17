# Aadhithan Groups - Member Verification & Compliance Portal

A clean, modern, mobile-optimized single-page member verification and compliance application built for **Aadhithan Groups - Global Capital Division (GCD)**. It collects complete member identification, project details, agreement verification, funding compliance questions, and features live **portrait photo capture**, **customer digital signature**, **automatic server disk storage**, and **mobile-first responsive design**.

<p align="center">
  <img src="assets/logo.png" alt="Aadhithan Groups - Global Capital Division Logo" width="160">
</p>

---

## Key Features

1. **Member Photo Verification**:
   - **Live Camera Capture**: Real-time webcam feed with portrait alignment guide overlay (`navigator.mediaDevices.getUserMedia`).
   - **Camera Switch**: Switch between front (selfie) and rear cameras on mobile/tablet devices.
   - **File Upload Fallback**: Upload member photo directly from disk or mobile gallery/camera app (`<input type="file" capture="user">`).
   - Photo preview card with verification status badge and timestamp.

2. **Customer Digital Signature Pad**:
   - High-DPI canvas-based signature pad.
   - Smooth stylus, touch, pen, and mouse drawing support.
   - Touch scrolling disabled on the signature box to prevent accidental page jumps on smartphones or tablets.
   - **Undo** and **Clear** stroke controls.
   - Cryptographic timestamp of signature recording.

3. **Complete Structured Questionnaire (All 31 Questions)**:
   - **Section 1: Member Details** (Questions 1 – 5: Name, Member ID, Project Name, Role, Allocated Amount & Currency).
   - **Section 2: Agreement and Payment Details** (Questions 6 – 12: Agreement copy, prior funds received, registration fees paid, agreement match check, authorization, updates).
   - **Section 3: Contact and Agreement Verification** (Questions 13 – 25: Registered mobile, agreement date, funding confirmation, release communication, fee demand compliance audit, independent verification).
   - **Section 4: Additional Fund Confirmation Questions** (Questions 26 – 31: Official approval, approved amount, release orders, reference tracking).

4. **Dynamic Conditional Inputs**:
   - Intelligent disclosure boxes reveal follow-up detail fields when specific answers are chosen (e.g. previous amount received, fee details, discrepancy reasons).
   - Statutory compliance warning for Question 21 regarding unauthorized fee demands.

5. **Member Declaration & Administrative Sign-off**:
   - Formal declaration undertaking text.
   - Name synchronization button ("Sync with Q1").
   - 5-stage Administrative Verification Status selector (Verification Pending, Additional Documentation Required, Allocation Officially Confirmed, Release Officially Approved, Payment Confirmed).
   - Administrative mandate notice advising verification against authentic master records.

6. **Printing & Exporting**:
   - **Print / PDF Dossier**: Custom `@media print` CSS formats the entire questionnaire into a legal compliance record with official letterhead, watermarks, stamps, and side-by-side member photo and signature.
   - **JSON Export**: Downloads the complete structured record with base64 photo and signature.
   - **Local Database Records Manager**: Saves past submissions into browser storage with preview thumbnails, search, reload, and batch management.
   - **Automatic Draft Auto-Save**: Preserves progress continuously in `localStorage` so accidental tab closure never loses entered data.

---

## How to Run

### Option 1: Direct Double-Click (Easiest)
Simply double-click `start.bat` in Windows. It starts the local server and automatically opens the portal in your default browser.

### Option 2: Using Python in Terminal
```powershell
python server.py
```
This serves the application on `http://localhost:8080` and displays your local network IP (e.g., `http://192.168.1.xxx:8080`) so you can open it on your phone or tablet on the same Wi-Fi.

### Option 3: Direct Browser File Open
You can also open `index.html` directly in any web browser. (Note: Photo upload and signature pad work everywhere; live webcam stream works on `http://localhost`, `https://`, or local server).
