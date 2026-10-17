/**
 * AADHITHAN GROUPS - MEMBER VERIFICATION FORM APPLICATION
 * Handles camera capture (WebRTC + fallback), signature pad (Canvas),
 * conditional logic for all 31 questions, autosave, print dossier, and submission database.
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // APPLICATION STATE
  // =========================================================================
  const state = {
    refId: generateRefId(),
    photoDataUrl: null,
    photoTimestamp: null,
    signatureDataUrl: null,
    signatureTimestamp: null,
    cameraStream: null,
    facingMode: 'user', // 'user' (front) or 'environment' (back)
    hasUnsavedChanges: false,
    strokes: [] // For signature undo functionality
  };

  // Storage keys
  const STORAGE_KEY_DRAFT = 'aadhithan_groups_form_draft';
  const STORAGE_KEY_RECORDS = 'aadhithan_groups_records_db';

  // =========================================================================
  // DOM ELEMENT REFERENCES
  // =========================================================================
  const form = document.getElementById('verification-form');
  const docRefNo = document.getElementById('doc-ref-no');
  const printRefCopies = document.querySelectorAll('.print-ref-copy');
  const docCurDate = document.getElementById('doc-cur-date');
  const progressFill = document.getElementById('progress-fill');
  const progressPercent = document.getElementById('progress-percent');
  const progressStatusText = document.getElementById('progress-status-text');

  // Photo elements
  const webcamVideo = document.getElementById('webcam');
  const faceGuide = document.getElementById('face-guide');
  const cameraPlaceholder = document.getElementById('camera-placeholder');
  const photoPreviewImg = document.getElementById('photo-preview-img');
  const photoCanvas = document.getElementById('photo-canvas');
  const btnStartCamera = document.getElementById('btn-start-camera');
  const btnSnapPhoto = document.getElementById('btn-snap-photo');
  const btnSwitchCamera = document.getElementById('btn-switch-camera');
  const btnStopCamera = document.getElementById('btn-stop-camera');
  const btnRetakePhoto = document.getElementById('btn-retake-photo');
  const photoFileInput = document.getElementById('photo-file-input');
  const photoCameraInput = document.getElementById('photo-camera-input');
  const photoGalleryInput = document.getElementById('photo-gallery-input');
  const photoStatusBadge = document.getElementById('photo-status-badge');
  const photoMetaStatus = document.getElementById('photo-meta-status');
  const photoMetaTime = document.getElementById('photo-meta-time');

  // Signature elements
  const sigCanvas = document.getElementById('signature-pad');
  const sigHint = document.getElementById('sig-hint');
  const btnSigClear = document.getElementById('btn-sig-clear');
  const btnSigUndo = document.getElementById('btn-sig-undo');
  const sigStatusDot = document.getElementById('sig-status-dot');
  const sigStatusText = document.getElementById('sig-status-text');
  const sigTimestampLabel = document.getElementById('sig-timestamp-label');

  // Declaration & Member elements
  const q1FullName = document.getElementById('q1_full_name');
  const declMemberName = document.getElementById('decl_member_name');
  const declDate = document.getElementById('decl_date');
  const btnSyncName = document.getElementById('btn-sync-name');
  const adminVerifiedDate = document.getElementById('admin_verified_date');

  // Action buttons
  const btnSaveDraft = document.getElementById('btn-save-draft');
  const btnViewRecords = document.getElementById('btn-view-records');
  const btnPrint = document.getElementById('btn-print');
  const btnResetForm = document.getElementById('btn-reset-form');
  const btnExportJson = document.getElementById('btn-export-json');
  const recordCountBadge = document.getElementById('record-count-badge');

  // Top nav & mobile action triggers
  const btnTopNew = document.getElementById('btn-top-new');
  const topBtnNewForm = document.getElementById('top-btn-new-form');
  const topBtnRecords = document.getElementById('top-btn-records');
  const topRecordCountBadge = document.getElementById('top-record-count-badge');
  const mBtnNewForm = document.getElementById('m-btn-new-form');
  const btnModalNewRecord = document.getElementById('btn-modal-new-record');
  const recordsCardsContainer = document.getElementById('records-cards-container');

  // Modals
  const recordsModal = document.getElementById('records-modal');
  const btnCloseRecords = document.getElementById('btn-close-records');
  const btnCloseRecordsFooter = document.getElementById('btn-close-records-footer');
  const recordsTableBody = document.getElementById('records-table-body');
  const recordsEmptyView = document.getElementById('records-empty');
  const recordsListWrapper = document.getElementById('records-list');
  const btnClearAllRecords = document.getElementById('btn-clear-all-records');

  // Record Detail Modal
  const recordDetailModal = document.getElementById('record-detail-modal');
  const btnCloseDetail = document.getElementById('btn-close-detail');
  const btnCloseDetailFooter = document.getElementById('btn-close-detail-footer');
  const btnDetailLoad = document.getElementById('btn-detail-load');
  const btnDetailPrint = document.getElementById('btn-detail-print');
  const detailModalRef = document.getElementById('detail-modal-ref');
  const detailModalSub = document.getElementById('detail-modal-sub');
  const detailModalBody = document.getElementById('detail-modal-body');
  let currentDetailRecord = null;

  const successModal = document.getElementById('success-modal');
  const succRefId = document.getElementById('succ-ref-id');
  const succMemberName = document.getElementById('succ-member-name');
  const succStatus = document.getElementById('succ-status');
  const btnPrintSuccess = document.getElementById('btn-print-success');
  const btnNewVerification = document.getElementById('btn-new-verification');

  // Toast container
  const toastContainer = document.getElementById('toast-container');

  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  function init() {
    // Set Ref ID
    docRefNo.textContent = state.refId;
    printRefCopies.forEach(el => el.textContent = state.refId);

    // Set Dates
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    docCurDate.textContent = today.toLocaleDateString('en-GB', options);

    if (declDate) declDate.value = formattedDate;
    if (adminVerifiedDate) adminVerifiedDate.value = formattedDate;

    // Initialize Signature Pad Canvas
    initSignaturePad();

    // Setup Conditional Questions
    setupConditionalQuestions();

    // Setup Event Listeners
    setupEventListeners();

    // Check Past Records count
    updateRecordsBadge();

    // Check for existing draft in localStorage
    checkAndRestoreDraft();

    // Update Progress
    updateProgress();
  }

  function generateRefId() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const year = new Date().getFullYear();
    return `AG-VRF-${year}-${randomNum}`;
  }

  // =========================================================================
  // CAMERA & PHOTO CAPTURE MODULE
  // =========================================================================

  async function startCamera() {
    // Detect mobile device or insecure HTTP origin (e.g. accessing via local IP over Wi-Fi)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth <= 820);
    const isSecureContext = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const canUseWebcamStream = isSecureContext && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && !isMobile;

    // On mobile devices or non-localhost HTTP, modern browsers disable getUserMedia API for security.
    // Instead, HTML5 device camera (capture="user") opens the native camera app directly without any errors or SSL needed!
    if (!canUseWebcamStream) {
      if (photoCameraInput) {
        photoCameraInput.click();
      } else if (photoFileInput) {
        photoFileInput.click();
      }
      return;
    }

    // On desktop browsers with secure context / localhost, open live stream
    try {
      if (state.cameraStream) {
        stopCameraTracks();
      }

      const constraints = {
        video: {
          facingMode: state.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      state.cameraStream = stream;
      webcamVideo.srcObject = stream;

      // Adjust UI
      webcamVideo.classList.remove('hidden');
      faceGuide.classList.remove('hidden');
      cameraPlaceholder.classList.add('hidden');
      photoPreviewImg.classList.add('hidden');

      btnStartCamera.classList.add('hidden');
      btnSnapPhoto.classList.remove('hidden');
      btnSwitchCamera.classList.remove('hidden');
      btnStopCamera.classList.remove('hidden');
      btnRetakePhoto.classList.add('hidden');

      showToast('Live camera ready. Align face and capture.', 'success');
    } catch (err) {
      console.warn('Live WebRTC camera error, falling back to device camera:', err);
      // Fallback seamlessly to native camera without error prompt
      if (photoCameraInput) {
        photoCameraInput.click();
      } else if (photoFileInput) {
        photoFileInput.click();
      }
    }
  }

  function stopCameraTracks() {
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach(track => track.stop());
      state.cameraStream = null;
    }
  }

  function closeCameraUI() {
    stopCameraTracks();
    webcamVideo.classList.add('hidden');
    faceGuide.classList.add('hidden');

    if (!state.photoDataUrl) {
      cameraPlaceholder.classList.remove('hidden');
      btnStartCamera.classList.remove('hidden');
    } else {
      photoPreviewImg.classList.remove('hidden');
      btnRetakePhoto.classList.remove('hidden');
    }

    btnSnapPhoto.classList.add('hidden');
    btnSwitchCamera.classList.add('hidden');
    btnStopCamera.classList.add('hidden');
  }

  function snapPhoto() {
    if (!state.cameraStream || !webcamVideo.videoWidth) {
      showToast('Camera feed not ready yet.', 'warning');
      return;
    }

    const videoW = webcamVideo.videoWidth;
    const videoH = webcamVideo.videoHeight;

    photoCanvas.width = videoW;
    photoCanvas.height = videoH;
    const ctx = photoCanvas.getContext('2d');

    // If using front camera, mirror image for natural snapshot
    if (state.facingMode === 'user') {
      ctx.translate(videoW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(webcamVideo, 0, 0, videoW, videoH);

    // Save as JPEG data URL
    const dataUrl = photoCanvas.toDataURL('image/jpeg', 0.88);
    setCapturedPhoto(dataUrl, 'Live Camera Capture');

    // Close camera stream and show snapshot
    stopCameraTracks();
    webcamVideo.classList.add('hidden');
    faceGuide.classList.add('hidden');
    photoPreviewImg.src = dataUrl;
    photoPreviewImg.classList.remove('hidden');

    btnSnapPhoto.classList.add('hidden');
    btnSwitchCamera.classList.add('hidden');
    btnStopCamera.classList.add('hidden');
    btnRetakePhoto.classList.remove('hidden');

    showToast('Member photo captured successfully!', 'success');
    updateProgress();
  }

  function handlePhotoFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WebP).', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Normalize / downscale if image is overly large (> 1600px)
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        photoCanvas.width = w;
        photoCanvas.height = h;
        const ctx = photoCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const compressedDataUrl = photoCanvas.toDataURL('image/jpeg', 0.85);

        setCapturedPhoto(compressedDataUrl, `File: ${file.name}`);

        // Update preview
        stopCameraTracks();
        webcamVideo.classList.add('hidden');
        faceGuide.classList.add('hidden');
        cameraPlaceholder.classList.add('hidden');
        photoPreviewImg.src = compressedDataUrl;
        photoPreviewImg.classList.remove('hidden');

        btnStartCamera.classList.add('hidden');
        btnSnapPhoto.classList.add('hidden');
        btnSwitchCamera.classList.add('hidden');
        btnStopCamera.classList.add('hidden');
        btnRetakePhoto.classList.remove('hidden');

        showToast('Member photo uploaded successfully!', 'success');
        updateProgress();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function setCapturedPhoto(dataUrl, sourceLabel) {
    state.photoDataUrl = dataUrl;
    state.photoTimestamp = new Date().toLocaleString('en-GB');

    photoStatusBadge.innerHTML = '<span class="badge badge-success">Photo Verified</span>';
    photoMetaStatus.textContent = sourceLabel || 'Captured';
    photoMetaTime.textContent = state.photoTimestamp;
    state.hasUnsavedChanges = true;
  }

  function retakePhoto() {
    resetPhotoState();
    startCamera();
    updateProgress();
  }

  function resetPhotoState() {
    state.photoDataUrl = null;
    state.photoTimestamp = null;
    stopCameraTracks();
    if (webcamVideo) webcamVideo.classList.add('hidden');
    if (faceGuide) faceGuide.classList.add('hidden');
    if (photoPreviewImg) {
      photoPreviewImg.classList.add('hidden');
      photoPreviewImg.src = '';
    }
    if (cameraPlaceholder) cameraPlaceholder.classList.remove('hidden');
    if (photoStatusBadge) photoStatusBadge.innerHTML = '<span class="badge badge-warning">Photo Pending</span>';
    if (photoMetaStatus) photoMetaStatus.textContent = 'Not captured';
    if (photoMetaTime) photoMetaTime.textContent = '—';
    if (btnRetakePhoto) btnRetakePhoto.classList.add('hidden');
    if (btnStartCamera) btnStartCamera.classList.remove('hidden');
    if (btnSnapPhoto) btnSnapPhoto.classList.add('hidden');
    if (btnSwitchCamera) btnSwitchCamera.classList.add('hidden');
    if (btnStopCamera) btnStopCamera.classList.add('hidden');
    if (photoFileInput) photoFileInput.value = '';
    if (photoCameraInput) photoCameraInput.value = '';
    if (photoGalleryInput) photoGalleryInput.value = '';
  }

  function toggleCameraFacing() {
    state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
    startCamera();
  }

  // =========================================================================
  // CUSTOMER SIGNATURE PAD (HTML5 CANVAS)
  // =========================================================================
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let currentStroke = [];

  function initSignaturePad() {
    resizeCanvas();
    window.addEventListener('resize', debounce(resizeCanvas, 200));

    // Pointer / Mouse / Touch events for smooth signing
    sigCanvas.addEventListener('pointerdown', startSigDrawing);
    sigCanvas.addEventListener('pointermove', drawSig);
    sigCanvas.addEventListener('pointerup', stopSigDrawing);
    sigCanvas.addEventListener('pointercancel', stopSigDrawing);
    sigCanvas.addEventListener('pointerleave', stopSigDrawing);
  }

  function resizeCanvas() {
    const rect = sigCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Save existing drawing if any
    let tempImg = null;
    if (state.strokes.length > 0) {
      tempImg = sigCanvas.toDataURL();
    }

    sigCanvas.width = rect.width * dpr;
    sigCanvas.height = rect.height * dpr;

    const ctx = sigCanvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a'; // Deep navy black
    ctx.lineWidth = 2.4;

    // Restore strokes
    if (state.strokes.length > 0) {
      redrawAllStrokes();
    }
  }

  function getCanvasCoords(e) {
    const rect = sigCanvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function startSigDrawing(e) {
    e.preventDefault();
    try {
      if (e.pointerId && sigCanvas.setPointerCapture) {
        sigCanvas.setPointerCapture(e.pointerId);
      }
    } catch (_) {}

    isDrawing = true;
    const { x, y } = getCanvasCoords(e);
    lastX = x;
    lastY = y;
    currentStroke = [{ x, y }];

    if (sigHint) sigHint.style.display = 'none';

    const ctx = sigCanvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(x, y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
  }

  function drawSig(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);

    const ctx = sigCanvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastX = x;
    lastY = y;
    currentStroke.push({ x, y });
  }

  function stopSigDrawing(e) {
    if (!isDrawing) return;
    try {
      if (e.pointerId && sigCanvas.releasePointerCapture) {
        sigCanvas.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    isDrawing = false;
    if (currentStroke.length > 0) {
      state.strokes.push([...currentStroke]);
      currentStroke = [];
      updateSignatureState();
    }
  }

  function redrawAllStrokes() {
    const ctx = sigCanvas.getContext('2d');
    const rect = sigCanvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;

    state.strokes.forEach(stroke => {
      if (stroke.length === 0) return;
      if (stroke.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke[0].x, stroke[0].y, 1.2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    });
  }

  function updateSignatureState() {
    if (state.strokes.length > 0) {
      state.signatureDataUrl = sigCanvas.toDataURL('image/png');
      state.signatureTimestamp = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: 'short'
      });
      sigStatusDot.classList.add('signed');
      sigStatusText.textContent = 'Customer Signature Captured';
      sigTimestampLabel.textContent = `Signed on: ${state.signatureTimestamp}`;
      if (sigHint) sigHint.style.display = 'none';
      state.hasUnsavedChanges = true;
    } else {
      state.signatureDataUrl = null;
      state.signatureTimestamp = null;
      sigStatusDot.classList.remove('signed');
      sigStatusText.textContent = 'Signature required';
      sigTimestampLabel.textContent = 'Not signed yet';
      if (sigHint) sigHint.style.display = 'block';
    }
    updateProgress();
  }

  function clearSignature(silent = false) {
    state.strokes = [];
    if (sigCanvas) {
      const ctx = sigCanvas.getContext('2d');
      const rect = sigCanvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
    }
    updateSignatureState();
    if (!silent) {
      showToast('Signature cleared.', 'warning');
    }
  }

  function undoSigStroke() {
    if (state.strokes.length > 0) {
      state.strokes.pop();
      redrawAllStrokes();
      updateSignatureState();
    }
  }

  // =========================================================================
  // CONDITIONAL QUESTIONS LOGIC
  // =========================================================================
  function setupConditionalQuestions() {
    // Helper to toggle conditional details box
    function bindConditional(radioName, triggerValue, boxId, inputId) {
      const radios = document.querySelectorAll(`input[name="${radioName}"]`);
      const box = document.getElementById(boxId);
      const input = document.getElementById(inputId);

      radios.forEach(radio => {
        radio.addEventListener('change', () => {
          if (radio.checked && radio.value === triggerValue) {
            box.classList.remove('hidden');
            if (input) input.focus();
          } else if (radio.checked) {
            box.classList.add('hidden');
            if (input) input.value = '';
          }
          updateProgress();
        });
      });
    }

    // Question 7: Previous funds received
    bindConditional('q7_received_funds_previously', 'Yes', 'q7_details_box', 'q7_amount_received');

    // Question 8: Registration fees paid
    bindConditional('q8_paid_registration_fees', 'Yes', 'q8_details_box', 'q8_fee_amount_reason');

    // Question 17: Written communication received
    bindConditional('q17_written_communication', 'Yes', 'q17_details_box', 'q17_reference_number');

    // Question 19: Pending documents / steps
    bindConditional('q19_pending_steps', 'Yes', 'q19_details_box', 'q19_pending_details');

    // Question 21: Additional fee demanded
    bindConditional('q21_additional_fee_asked', 'Yes', 'q21_details_box', 'q21_fee_details');

    // Question 23: Discrepancy concerns
    bindConditional('q23_discrepancy_concerns', 'Yes', 'q23_details_box', 'q23_discrepancy_details');

    // Question 24: Additional info or supporting documents
    bindConditional('q24_additional_info_submit', 'Yes', 'q24_details_box', 'q24_additional_details');
  }

  // =========================================================================
  // PROGRESS TRACKER
  // =========================================================================
  function updateProgress() {
    // Total required checklist points:
    // 31 questions + photo + signature + member declaration name + declaration date = 35 checkpoints
    let totalItems = 35;
    let completedItems = 0;

    // Check Question 1 to 5 (Section 1)
    if (getVal('q1_full_name')) completedItems++;
    if (getVal('q2_member_id')) completedItems++;
    if (getVal('q3_project_name')) completedItems++;
    if (getVal('q4_project_role')) completedItems++;
    if (getVal('q5_allocated_amount')) completedItems++;

    // Check Section 2 (Q6 to Q12)
    if (getRadio('q6_received_agreement')) completedItems++;
    if (getRadio('q7_received_funds_previously')) completedItems++;
    if (getRadio('q8_paid_registration_fees')) completedItems++;
    if (getRadio('q9_details_match_agreement')) completedItems++;
    if (getRadio('q10_info_accurate')) completedItems++;
    if (getRadio('q11_authorize_verification')) completedItems++;
    if (getRadio('q12_receive_status_update')) completedItems++;

    // Check Section 3 (Q13 to Q25)
    if (getVal('q13_mobile_number')) completedItems++;
    if (getVal('q14_agreement_date')) completedItems++;
    if (getRadio('q15_confirmed_individual_allocation')) completedItems++;
    if (getRadio('q16_confirmed_amount')) completedItems++;
    if (getRadio('q17_written_communication')) completedItems++;
    if (getRadio('q18_completed_requirements')) completedItems++;
    if (getRadio('q19_pending_steps')) completedItems++;
    if (getRadio('q20_channel_verified')) completedItems++;
    if (getRadio('q21_additional_fee_asked')) completedItems++;
    if (getRadio('q22_independently_verified')) completedItems++;
    if (getRadio('q23_discrepancy_concerns')) completedItems++;
    if (getRadio('q24_additional_info_submit')) completedItems++;
    if (getRadio('q25_recorded_in_org_records')) completedItems++;

    // Check Section 4 (Q26 to Q31)
    if (getRadio('q26_officially_approved')) completedItems++;
    if (getVal('q27_approved_amount')) completedItems++;
    if (getRadio('q28_written_confirmation')) completedItems++;
    if (getRadio('q29_release_date_confirmed')) completedItems++;
    if (getRadio('q30_payment_order_received')) completedItems++;
    if (getVal('q31_release_reference_no') !== undefined) completedItems++; // Q31 optional or completed

    // Photo verification
    if (state.photoDataUrl) completedItems++;

    // Member declaration fields & signature
    if (getVal('decl_member_name')) completedItems++;
    if (getVal('decl_date')) completedItems++;
    if (state.signatureDataUrl) completedItems++;

    const percent = Math.min(100, Math.round((completedItems / totalItems) * 100));
    progressFill.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;

    const mProgressText = document.getElementById('m-progress-text');
    if (mProgressText) mProgressText.textContent = `${percent}%`;

    if (percent === 100) {
      progressStatusText.textContent = 'All Sections Complete - Ready to Submit';
    } else {
      progressStatusText.textContent = `${completedItems} of ${totalItems} Items Completed`;
    }
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el && el.value.trim() !== '' ? el.value.trim() : null;
  }

  function getRadio(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : null;
  }

  // =========================================================================
  // FORM SERIALIZATION & DRAFT SAVE
  // =========================================================================
  function collectFormData() {
    const data = {
      refId: state.refId,
      timestamp: new Date().toISOString(),
      section1: {
        q1_full_name: getVal('q1_full_name'),
        q2_member_id: getVal('q2_member_id'),
        q3_project_name: getVal('q3_project_name'),
        q4_project_role: getVal('q4_project_role'),
        q5_allocated_amount: getVal('q5_allocated_amount'),
        q5_currency: getVal('q5_currency')
      },
      section2: {
        q6_received_agreement: getRadio('q6_received_agreement'),
        q7_received_funds_previously: getRadio('q7_received_funds_previously'),
        q7_amount_received: getVal('q7_amount_received'),
        q8_paid_registration_fees: getRadio('q8_paid_registration_fees'),
        q8_fee_amount_reason: getVal('q8_fee_amount_reason'),
        q9_details_match_agreement: getRadio('q9_details_match_agreement'),
        q10_info_accurate: getRadio('q10_info_accurate'),
        q11_authorize_verification: getRadio('q11_authorize_verification'),
        q12_receive_status_update: getRadio('q12_receive_status_update')
      },
      section3: {
        q13_mobile_number: getVal('q13_mobile_number'),
        q14_agreement_date: getVal('q14_agreement_date'),
        q15_confirmed_individual_allocation: getRadio('q15_confirmed_individual_allocation'),
        q16_confirmed_amount: getRadio('q16_confirmed_amount'),
        q17_written_communication: getRadio('q17_written_communication'),
        q17_reference_number: getVal('q17_reference_number'),
        q18_completed_requirements: getRadio('q18_completed_requirements'),
        q19_pending_steps: getRadio('q19_pending_steps'),
        q19_pending_details: getVal('q19_pending_details'),
        q20_channel_verified: getRadio('q20_channel_verified'),
        q21_additional_fee_asked: getRadio('q21_additional_fee_asked'),
        q21_fee_details: getVal('q21_fee_details'),
        q22_independently_verified: getRadio('q22_independently_verified'),
        q23_discrepancy_concerns: getRadio('q23_discrepancy_concerns'),
        q23_discrepancy_details: getVal('q23_discrepancy_details'),
        q24_additional_info_submit: getRadio('q24_additional_info_submit'),
        q24_additional_details: getVal('q24_additional_details'),
        q25_recorded_in_org_records: getRadio('q25_recorded_in_org_records')
      },
      section4: {
        q26_officially_approved: getRadio('q26_officially_approved'),
        q27_approved_amount: getVal('q27_approved_amount'),
        q27_currency: getVal('q27_currency'),
        q28_written_confirmation: getRadio('q28_written_confirmation'),
        q29_release_date_confirmed: getRadio('q29_release_date_confirmed'),
        q30_payment_order_received: getRadio('q30_payment_order_received'),
        q31_release_reference_no: getVal('q31_release_reference_no')
      },
      photo: {
        dataUrl: state.photoDataUrl,
        timestamp: state.photoTimestamp
      },
      declaration: {
        member_name: getVal('decl_member_name'),
        date: getVal('decl_date'),
        signatureDataUrl: state.signatureDataUrl,
        signatureTimestamp: state.signatureTimestamp
      },
      admin: {
        verification_status: getRadio('admin_verification_status'),
        officer_name: getVal('admin_officer_name'),
        officer_id: getVal('admin_officer_id'),
        verified_date: getVal('admin_verified_date'),
        official_notes: getVal('admin_official_notes')
      }
    };
    return data;
  }

  function saveDraft(silent = false) {
    try {
      const data = collectFormData();
      localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(data));
      state.hasUnsavedChanges = false;
      if (!silent) {
        showToast('Draft progress saved locally.', 'success');
      }
    } catch (err) {
      console.warn('Failed to save draft:', err);
    }
  }

  function checkAndRestoreDraft() {
    const raw = localStorage.getItem(STORAGE_KEY_DRAFT);
    if (!raw) return;

    try {
      const draft = JSON.parse(raw);
      if (!draft) return;

      // Restore text inputs
      restoreInputValue('q1_full_name', draft.section1?.q1_full_name);
      restoreInputValue('q2_member_id', draft.section1?.q2_member_id);
      restoreInputValue('q3_project_name', draft.section1?.q3_project_name);
      restoreInputValue('q4_project_role', draft.section1?.q4_project_role);
      restoreInputValue('q5_allocated_amount', draft.section1?.q5_allocated_amount);
      restoreInputValue('q5_currency', draft.section1?.q5_currency);

      restoreRadioValue('q6_received_agreement', draft.section2?.q6_received_agreement);
      restoreRadioValue('q7_received_funds_previously', draft.section2?.q7_received_funds_previously);
      restoreInputValue('q7_amount_received', draft.section2?.q7_amount_received);
      restoreRadioValue('q8_paid_registration_fees', draft.section2?.q8_paid_registration_fees);
      restoreInputValue('q8_fee_amount_reason', draft.section2?.q8_fee_amount_reason);
      restoreRadioValue('q9_details_match_agreement', draft.section2?.q9_details_match_agreement);
      restoreRadioValue('q10_info_accurate', draft.section2?.q10_info_accurate);
      restoreRadioValue('q11_authorize_verification', draft.section2?.q11_authorize_verification);
      restoreRadioValue('q12_receive_status_update', draft.section2?.q12_receive_status_update);

      restoreInputValue('q13_mobile_number', draft.section3?.q13_mobile_number);
      restoreInputValue('q14_agreement_date', draft.section3?.q14_agreement_date);
      restoreRadioValue('q15_confirmed_individual_allocation', draft.section3?.q15_confirmed_individual_allocation);
      restoreRadioValue('q16_confirmed_amount', draft.section3?.q16_confirmed_amount);
      restoreRadioValue('q17_written_communication', draft.section3?.q17_written_communication);
      restoreInputValue('q17_reference_number', draft.section3?.q17_reference_number);
      restoreRadioValue('q18_completed_requirements', draft.section3?.q18_completed_requirements);
      restoreRadioValue('q19_pending_steps', draft.section3?.q19_pending_steps);
      restoreInputValue('q19_pending_details', draft.section3?.q19_pending_details);
      restoreRadioValue('q20_channel_verified', draft.section3?.q20_channel_verified);
      restoreRadioValue('q21_additional_fee_asked', draft.section3?.q21_additional_fee_asked);
      restoreInputValue('q21_fee_details', draft.section3?.q21_fee_details);
      restoreRadioValue('q22_independently_verified', draft.section3?.q22_independently_verified);
      restoreRadioValue('q23_discrepancy_concerns', draft.section3?.q23_discrepancy_concerns);
      restoreInputValue('q23_discrepancy_details', draft.section3?.q23_discrepancy_details);
      restoreRadioValue('q24_additional_info_submit', draft.section3?.q24_additional_info_submit);
      restoreInputValue('q24_additional_details', draft.section3?.q24_additional_details);
      restoreRadioValue('q25_recorded_in_org_records', draft.section3?.q25_recorded_in_org_records);

      restoreRadioValue('q26_officially_approved', draft.section4?.q26_officially_approved);
      restoreInputValue('q27_approved_amount', draft.section4?.q27_approved_amount);
      restoreInputValue('q27_currency', draft.section4?.q27_currency);
      restoreRadioValue('q28_written_confirmation', draft.section4?.q28_written_confirmation);
      restoreRadioValue('q29_release_date_confirmed', draft.section4?.q29_release_date_confirmed);
      restoreRadioValue('q30_payment_order_received', draft.section4?.q30_payment_order_received);
      restoreInputValue('q31_release_reference_no', draft.section4?.q31_release_reference_no);

      // Restore declaration
      restoreInputValue('decl_member_name', draft.declaration?.member_name);
      restoreInputValue('decl_date', draft.declaration?.date);

      // Restore Admin
      restoreRadioValue('admin_verification_status', draft.admin?.verification_status);
      restoreInputValue('admin_officer_name', draft.admin?.officer_name);
      restoreInputValue('admin_officer_id', draft.admin?.officer_id);
      restoreInputValue('admin_verified_date', draft.admin?.verified_date);
      restoreInputValue('admin_official_notes', draft.admin?.official_notes);

      // Restore Photo
      if (draft.photo?.dataUrl) {
        setCapturedPhoto(draft.photo.dataUrl, 'Restored from Draft');
        photoPreviewImg.src = draft.photo.dataUrl;
        photoPreviewImg.classList.remove('hidden');
        cameraPlaceholder.classList.add('hidden');
        btnStartCamera.classList.add('hidden');
        btnRetakePhoto.classList.remove('hidden');
      }

      // Restore Signature
      if (draft.declaration?.signatureDataUrl) {
        state.signatureDataUrl = draft.declaration.signatureDataUrl;
        state.signatureTimestamp = draft.declaration.signatureTimestamp;
        const img = new Image();
        img.onload = () => {
          const ctx = sigCanvas.getContext('2d');
          const rect = sigCanvas.getBoundingClientRect();
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          sigStatusDot.classList.add('signed');
          sigStatusText.textContent = 'Customer Signature Restored';
          sigTimestampLabel.textContent = `Signed on: ${state.signatureTimestamp}`;
          if (sigHint) sigHint.style.display = 'none';
        };
        img.src = draft.declaration.signatureDataUrl;
      }

      showToast('Restored saved draft.', 'success');
      updateProgress();
    } catch (err) {
      console.warn('Error restoring draft:', err);
    }
  }

  function restoreInputValue(id, val) {
    if (val === undefined || val === null) return;
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function restoreRadioValue(name, val) {
    if (!val) return;
    const radio = document.querySelector(`input[name="${name}"][value="${val}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
    }
  }

  // =========================================================================
  // SUBMISSION & RECORDS MANAGEMENT
  // =========================================================================
  function handleFormSubmit(e) {
    e.preventDefault();

    // Check Member Photo
    if (!state.photoDataUrl) {
      showToast('Please capture or upload the Member Photo before submitting.', 'warning');
      const photoSec = document.getElementById('section-photo');
      photoSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Check Customer Signature
    if (!state.signatureDataUrl) {
      showToast('Customer signature is required in the Member Declaration section.', 'warning');
      const decSec = document.getElementById('section-declaration');
      decSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Validate all required radio questions
    const requiredRadios = [
      'q6_received_agreement',
      'q7_received_funds_previously',
      'q8_paid_registration_fees',
      'q9_details_match_agreement',
      'q10_info_accurate',
      'q11_authorize_verification',
      'q12_receive_status_update',
      'q15_confirmed_individual_allocation',
      'q16_confirmed_amount',
      'q17_written_communication',
      'q18_completed_requirements',
      'q19_pending_steps',
      'q20_channel_verified',
      'q21_additional_fee_asked',
      'q22_independently_verified',
      'q23_discrepancy_concerns',
      'q24_additional_info_submit',
      'q25_recorded_in_org_records',
      'q26_officially_approved',
      'q28_written_confirmation',
      'q29_release_date_confirmed',
      'q30_payment_order_received',
      'admin_verification_status'
    ];

    for (const rName of requiredRadios) {
      if (!getRadio(rName)) {
        const firstRadio = document.querySelector(`input[name="${rName}"]`);
        if (firstRadio) {
          const block = firstRadio.closest('.question-block') || firstRadio.closest('.form-card');
          block.scrollIntoView({ behavior: 'smooth', block: 'center' });
          block.style.boxShadow = '0 0 0 2px #ef4444';
          setTimeout(() => { block.style.boxShadow = ''; }, 2000);
          showToast(`Please answer ${firstRadio.name.replace(/_/g, ' ')}.`, 'warning');
          return;
        }
      }
    }

    // Form is completely valid!
    const submission = collectFormData();

    // Save into Records DB in localStorage
    saveRecordToDB(submission);

    // Clear Draft
    localStorage.removeItem(STORAGE_KEY_DRAFT);
    state.hasUnsavedChanges = false;

    // Show Success Modal
    succRefId.textContent = submission.refId;
    succMemberName.textContent = submission.section1.q1_full_name || 'Member';
    succStatus.textContent = submission.admin.verification_status;
    successModal.classList.remove('hidden');

    showToast('Member Verification successfully recorded and saved!', 'success');
  }

  function getRecordsDB() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_RECORDS);
      if (!raw) return [];
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      // Deduplicate by refId (preserving most recent)
      const seen = new Set();
      const deduped = [];
      for (const item of list) {
        if (item && item.refId && !seen.has(item.refId)) {
          seen.add(item.refId);
          deduped.push(item);
        }
      }
      return deduped;
    } catch {
      return [];
    }
  }

  async function saveRecordToDB(record) {
    const list = getRecordsDB();
    const existingIndex = list.findIndex(r => r.refId === record.refId);
    if (existingIndex >= 0) {
      list[existingIndex] = record;
    } else {
      list.unshift(record);
    }
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(list));
    updateRecordsBadge();

    // Persist to Server Disk (creates JSON, photo JPG, signature PNG, and deduplicated CSV)
    try {
      const res = await fetch('/api/save-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      const data = await res.json();
      if (data.success) {
        console.log('[SERVER DISK SAVE SUCCESS]', data.details);
      }
    } catch (err) {
      console.log('Saved to browser localStorage (server save offline/unreachable).');
    }
  }

  function updateRecordsBadge() {
    const count = getRecordsDB().length;
    if (recordCountBadge) recordCountBadge.textContent = count;
    const mCountBadge = document.getElementById('m-record-count-badge');
    if (mCountBadge) mCountBadge.textContent = count;
    if (topRecordCountBadge) topRecordCountBadge.textContent = count;
  }

  async function openRecordsModal() {
    let records = getRecordsDB();
    try {
      const res = await fetch('/api/records');
      if (res.ok) {
        const serverRecs = await res.json();
        if (Array.isArray(serverRecs) && serverRecs.length > 0) {
          const map = new Map();
          records.forEach(r => map.set(r.refId, r));
          serverRecs.forEach(r => {
            if (!map.has(r.refId)) map.set(r.refId, r);
          });
          records = Array.from(map.values());
          localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
          updateRecordsBadge();
        }
      }
    } catch (e) {
      // offline fallback
    }

    renderRecordsList(records);
    recordsModal.classList.remove('hidden');
  }

  function renderRecordsList(records) {
    if (!recordsCardsContainer) return;
    recordsCardsContainer.innerHTML = '';

    if (!records || records.length === 0) {
      recordsEmptyView.classList.remove('hidden');
      recordsListWrapper.classList.add('hidden');
      return;
    }

    recordsEmptyView.classList.add('hidden');
    recordsListWrapper.classList.remove('hidden');

    records.forEach((rec, idx) => {
      const card = document.createElement('div');
      card.className = 'record-item-card';

      const formattedDate = rec.timestamp ? new Date(rec.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
      const statusText = rec.admin?.verification_status || 'Submitted';
      const isApproved = statusText.toLowerCase().includes('approved') || statusText.toLowerCase().includes('verified');
      const statusBadgeClass = isApproved ? 'badge-status-approved' : 'badge-status-pending';

      const fullName = rec.section1?.q1_full_name || 'Member (Name Pending)';
      const memberId = rec.section1?.q2_member_id || 'ID Pending';
      const role = rec.section1?.q4_project_role || 'Member';
      const projectName = rec.section1?.q3_project_name || 'Project Allocation';
      const currency = rec.section1?.q5_currency || 'INR (₹)';
      const amount = rec.section1?.q5_allocated_amount ? Number(rec.section1.q5_allocated_amount).toLocaleString() : '0.00';

      card.innerHTML = `
        <div class="rc-header">
          <span class="rc-ref-pill">${escapeHtml(rec.refId)}</span>
          <span class="rc-status-badge ${statusBadgeClass}">${escapeHtml(statusText)}</span>
          <span class="rc-date">${formattedDate}</span>
        </div>
        <div class="rc-body">
          <div class="rc-avatar-box">
            ${rec.photo?.dataUrl ? `<img src="${rec.photo.dataUrl}" class="rc-avatar-img" alt="Photo">` : `<div class="rc-avatar-empty">👤</div>`}
          </div>
          <div class="rc-details">
            <h4 class="rc-member-name">${escapeHtml(fullName)}</h4>
            <div class="rc-subline"><span class="rc-chip-id">${escapeHtml(memberId)}</span> &bull; <span>${escapeHtml(role)}</span></div>
            <div class="rc-proj-line"><strong>${escapeHtml(projectName)}</strong> &bull; <span class="rc-amount-highlight">${escapeHtml(currency)} ${escapeHtml(amount)}</span></div>
          </div>
        </div>
        <div class="rc-footer-actions">
          <button type="button" class="btn btn-outline btn-rc-view">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            View Dossier
          </button>
          <button type="button" class="btn btn-primary btn-rc-load">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            Load into Form
          </button>
        </div>
      `;

      // Entire card tap opens Detail Modal
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-rc-load')) {
          e.stopPropagation();
          loadRecordIntoForm(rec);
          return;
        }
        openRecordDetailModal(rec);
      });

      recordsCardsContainer.appendChild(card);
    });
  }

  function openRecordDetailModal(rec) {
    if (!rec) return;
    currentDetailRecord = rec;

    detailModalRef.textContent = rec.refId;
    detailModalSub.textContent = `Member Verification Dossier — ${rec.section1?.q1_full_name || 'Member'}`;

    const formattedDate = rec.timestamp ? new Date(rec.timestamp).toLocaleString('en-GB') : '—';
    const statusText = rec.admin?.verification_status || 'Verified & Submitted';

    const sec1 = rec.section1 || {};
    const sec2 = rec.section2 || {};
    const sec3 = rec.section3 || {};
    const sec4 = rec.section4 || {};
    const decl = rec.declaration || {};
    const admin = rec.admin || {};

    detailModalBody.innerHTML = `
      <div class="dossier-preview-layout">
        <!-- Photo and Signature Visual Proof Box -->
        <div class="dossier-visuals-row">
          <div class="dossier-photo-card">
            <span class="dossier-caption">Captured Member Photo</span>
            <div class="dossier-photo-frame">
              ${rec.photo?.dataUrl ? `<img src="${rec.photo.dataUrl}" alt="Photo" class="dossier-full-img">` : `<div class="dossier-no-img">No photo captured</div>`}
            </div>
            <span class="dossier-subtext">Verified at ${rec.photo?.timestamp || formattedDate}</span>
          </div>

          <div class="dossier-sig-card">
            <span class="dossier-caption">Customer Digital Signature</span>
            <div class="dossier-sig-frame">
              ${decl.signatureDataUrl ? `<img src="${decl.signatureDataUrl}" alt="Signature" class="dossier-full-sig">` : `<div class="dossier-no-img">No signature captured</div>`}
            </div>
            <span class="dossier-subtext">${escapeHtml(decl.member_name || sec1.q1_full_name || 'Member')} &bull; ${escapeHtml(decl.date || 'Signed')}</span>
          </div>
        </div>

        <!-- Identification Summary -->
        <div class="dossier-summary-card">
          <h4 class="dossier-section-title">1. Identification & Allocation</h4>
          <div class="dossier-info-grid">
            <div class="dossier-cell"><span class="d-label">Full Name:</span> <strong class="d-val">${escapeHtml(sec1.q1_full_name || '—')}</strong></div>
            <div class="dossier-cell"><span class="d-label">Member ID:</span> <strong class="d-val mono">${escapeHtml(sec1.q2_member_id || '—')}</strong></div>
            <div class="dossier-cell"><span class="d-label">Project:</span> <span class="d-val">${escapeHtml(sec1.q3_project_name || '—')}</span></div>
            <div class="dossier-cell"><span class="d-label">Role:</span> <span class="d-val">${escapeHtml(sec1.q4_project_role || '—')}</span></div>
            <div class="dossier-cell"><span class="d-label">Allocated Amount:</span> <strong class="d-val text-primary">${escapeHtml(sec1.q5_currency || 'INR')} ${escapeHtml(sec1.q5_allocated_amount || '0.00')}</strong></div>
            <div class="dossier-cell"><span class="d-label">Mobile:</span> <span class="d-val mono">${escapeHtml(sec3.q13_mobile_number || '—')}</span></div>
            <div class="dossier-cell"><span class="d-label">Agreement Date:</span> <span class="d-val">${escapeHtml(sec3.q14_agreement_date || '—')}</span></div>
            <div class="dossier-cell"><span class="d-label">Verification Status:</span> <span class="badge badge-success">${escapeHtml(statusText)}</span></div>
          </div>
        </div>

        <!-- Question Highlights -->
        <div class="dossier-summary-card">
          <h4 class="dossier-section-title">2. Verification Questionnaire Highlights</h4>
          <div class="dossier-chips-wrap">
            <div class="d-chip"><span class="dc-q">Q6 Agreement Copy Received:</span> <strong class="dc-a">${escapeHtml(sec2.q6_received_agreement || '—')}</strong></div>
            <div class="d-chip"><span class="dc-q">Q7 Previous Funds Received:</span> <strong class="dc-a">${escapeHtml(sec2.q7_received_funds_previously || '—')}</strong></div>
            <div class="d-chip"><span class="dc-q">Q8 Registration Fee Paid:</span> <strong class="dc-a">${escapeHtml(sec2.q8_paid_registration_fees || '—')}</strong></div>
            <div class="d-chip"><span class="dc-q">Q9 Details Match Agreement:</span> <strong class="dc-a">${escapeHtml(sec2.q9_details_match_agreement || '—')}</strong></div>
            <div class="d-chip"><span class="dc-q">Q15 Individual Allocation Confirmed:</span> <strong class="dc-a">${escapeHtml(sec3.q15_confirmed_individual_allocation || '—')}</strong></div>
            <div class="d-chip"><span class="dc-q">Q26 Officially Approved:</span> <strong class="dc-a">${escapeHtml(sec4.q26_officially_approved || '—')}</strong></div>
            <div class="d-chip"><span class="dc-q">Q27 Approved Amount:</span> <strong class="dc-a">${escapeHtml(sec4.q27_currency || 'INR')} ${escapeHtml(sec4.q27_approved_amount || '0.00')}</strong></div>
          </div>
        </div>

        <!-- Administrative Sign-Off -->
        <div class="dossier-summary-card">
          <h4 class="dossier-section-title">3. Compliance Sign-Off</h4>
          <div class="dossier-info-grid">
            <div class="dossier-cell"><span class="d-label">Officer Name:</span> <span class="d-val">${escapeHtml(admin.officer_name || '—')}</span></div>
            <div class="dossier-cell"><span class="d-label">Officer ID:</span> <span class="d-val mono">${escapeHtml(admin.officer_id || '—')}</span></div>
            <div class="dossier-cell"><span class="d-label">Verified Date:</span> <span class="d-val">${escapeHtml(admin.verified_date || '—')}</span></div>
            <div class="dossier-cell"><span class="d-label">Official Notes:</span> <span class="d-val">${escapeHtml(admin.official_notes || 'None')}</span></div>
          </div>
        </div>
      </div>
    `;

    recordDetailModal.classList.remove('hidden');
  }

  function loadRecordIntoForm(rec) {
    if (!rec) return;
    localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(rec));
    state.refId = rec.refId;
    docRefNo.textContent = rec.refId;
    printRefCopies.forEach(el => el.textContent = rec.refId);
    checkAndRestoreDraft();

    if (recordsModal) recordsModal.classList.add('hidden');
    if (recordDetailModal) recordDetailModal.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Loaded record ${rec.refId} (${rec.section1?.q1_full_name || 'Member'}) into the form!`, 'success');
  }

  window.viewArchivedRecord = function(idx) {
    const records = getRecordsDB();
    const rec = records[idx];
    if (!rec) return;
    openRecordDetailModal(rec);
  };

  function clearAllRecords() {
    if (confirm('Are you sure you want to delete all saved verification records from this browser? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY_RECORDS);
      updateRecordsBadge();
      openRecordsModal();
      showToast('All local records cleared.', 'warning');
    }
  }

  // =========================================================================
  // EXPORT JSON & PRINT DOSSIER
  // =========================================================================
  function exportJson() {
    const data = collectFormData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.refId}_${(data.section1.q1_full_name || 'member').replace(/\s+/g, '_')}_verification.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported record to JSON file.', 'success');
  }

  function printDossier() {
    // Before printing, ensure that full name and ref numbers are synchronized
    window.print();
  }

  function startNewVerification() {
    if (state.hasUnsavedChanges || state.photoDataUrl || state.signatureDataUrl) {
      if (!confirm('Start a new verification form for another member? Current unsaved form entries will be cleared.')) {
        return;
      }
    }

    // 1. Reset form fields
    form.reset();

    // 2. Generate a new reference ID
    state.refId = generateRefId();
    docRefNo.textContent = state.refId;
    printRefCopies.forEach(el => el.textContent = state.refId);

    // 3. Clear signature canvas cleanly
    clearSignature(true);

    // 4. Reset photo state cleanly
    resetPhotoState();

    // 5. Hide all conditional detail boxes
    document.querySelectorAll('[id$="_details_box"]').forEach(box => {
      box.classList.add('hidden');
      const input = box.querySelector('input, textarea');
      if (input) input.value = '';
    });

    // 6. Reset dates
    const today = new Date().toISOString().split('T')[0];
    if (declDate) declDate.value = today;
    if (adminVerifiedDate) adminVerifiedDate.value = today;

    // 7. Clear saved draft
    localStorage.removeItem(STORAGE_KEY_DRAFT);
    state.hasUnsavedChanges = false;

    // 8. Close any open modals
    if (recordsModal) recordsModal.classList.add('hidden');
    if (successModal) successModal.classList.add('hidden');
    if (recordDetailModal) recordDetailModal.classList.add('hidden');

    // 9. Smooth scroll to top and update progress
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`New form initialized: ${state.refId}. Ready for next member!`, 'success');
    updateProgress();
  }

  // =========================================================================
  // SETUP EVENT LISTENERS
  // =========================================================================
  function setupEventListeners() {
    // Camera listeners
    btnStartCamera.addEventListener('click', startCamera);
    btnSnapPhoto.addEventListener('click', snapPhoto);
    btnSwitchCamera.addEventListener('click', toggleCameraFacing);
    btnStopCamera.addEventListener('click', closeCameraUI);
    btnRetakePhoto.addEventListener('click', retakePhoto);
    if (photoFileInput) photoFileInput.addEventListener('change', handlePhotoFileUpload);
    if (photoCameraInput) photoCameraInput.addEventListener('change', handlePhotoFileUpload);
    if (photoGalleryInput) photoGalleryInput.addEventListener('change', handlePhotoFileUpload);

    // Tapping placeholder area directly opens camera
    if (cameraPlaceholder) {
      cameraPlaceholder.addEventListener('click', () => {
        if (!state.photoDataUrl && !state.cameraStream) {
          startCamera();
        }
      });
    }

    // Signature listeners
    btnSigClear.addEventListener('click', clearSignature);
    btnSigUndo.addEventListener('click', undoSigStroke);

    // Name Synchronization
    btnSyncName.addEventListener('click', () => {
      if (q1FullName.value.trim()) {
        declMemberName.value = q1FullName.value.trim();
        showToast('Member name synced with Question 1.', 'success');
        updateProgress();
      } else {
        showToast('Please enter full name in Question 1 first.', 'warning');
      }
    });

    q1FullName.addEventListener('blur', () => {
      if (!declMemberName.value.trim() && q1FullName.value.trim()) {
        declMemberName.value = q1FullName.value.trim();
        updateProgress();
      }
    });

    // Form inputs change listener (for progress bar & auto-save)
    form.addEventListener('input', debounce(() => {
      state.hasUnsavedChanges = true;
      saveDraft(true);
      updateProgress();
    }, 400));

    form.addEventListener('change', () => {
      state.hasUnsavedChanges = true;
      saveDraft(true);
      updateProgress();
    });

    // Action buttons
    if (btnSaveDraft) btnSaveDraft.addEventListener('click', () => saveDraft(false));
    if (btnPrint) btnPrint.addEventListener('click', printDossier);
    if (btnExportJson) btnExportJson.addEventListener('click', exportJson);
    if (btnResetForm) btnResetForm.addEventListener('click', startNewVerification);
    if (btnViewRecords) btnViewRecords.addEventListener('click', openRecordsModal);

    // Top Header & Modal New Form triggers
    if (btnTopNew) btnTopNew.addEventListener('click', startNewVerification);
    if (topBtnNewForm) topBtnNewForm.addEventListener('click', startNewVerification);
    if (topBtnRecords) topBtnRecords.addEventListener('click', openRecordsModal);
    if (btnModalNewRecord) btnModalNewRecord.addEventListener('click', startNewVerification);

    // Mobile Sticky Floating Bar Actions
    if (mBtnNewForm) mBtnNewForm.addEventListener('click', startNewVerification);
    const mBtnSaveDraft = document.getElementById('m-btn-save-draft');
    const mBtnViewRecords = document.getElementById('m-btn-view-records');
    const mBtnSubmitQuick = document.getElementById('m-btn-submit-quick');

    if (mBtnSaveDraft) mBtnSaveDraft.addEventListener('click', () => saveDraft(false));
    if (mBtnViewRecords) mBtnViewRecords.addEventListener('click', openRecordsModal);
    if (mBtnSubmitQuick) mBtnSubmitQuick.addEventListener('click', (e) => {
      handleFormSubmit(e);
    });

    // Detail Modal actions
    if (btnCloseDetail) btnCloseDetail.addEventListener('click', () => recordDetailModal.classList.add('hidden'));
    if (btnCloseDetailFooter) btnCloseDetailFooter.addEventListener('click', () => recordDetailModal.classList.add('hidden'));
    if (btnDetailLoad) btnDetailLoad.addEventListener('click', () => loadRecordIntoForm(currentDetailRecord));
    if (btnDetailPrint) btnDetailPrint.addEventListener('click', () => {
      loadRecordIntoForm(currentDetailRecord);
      setTimeout(() => window.print(), 350);
    });

    // Form Submission
    form.addEventListener('submit', handleFormSubmit);

    // Modals
    btnCloseRecords.addEventListener('click', () => recordsModal.classList.add('hidden'));
    btnCloseRecordsFooter.addEventListener('click', () => recordsModal.classList.add('hidden'));
    btnClearAllRecords.addEventListener('click', clearAllRecords);

    btnPrintSuccess.addEventListener('click', () => {
      printDossier();
    });
    btnNewVerification.addEventListener('click', startNewVerification);

    // Close modals on clicking outside
    [recordsModal, successModal, recordDetailModal].forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) modal.classList.add('hidden');
        });
      }
    });

    // Warn on beforeunload if unsaved
    window.addEventListener('beforeunload', (e) => {
      if (state.hasUnsavedChanges) {
        saveDraft(true);
      }
    });
  }

  // =========================================================================
  // TOAST NOTIFICATIONS HELPER
  // =========================================================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
    } else {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3800);
  }

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
      switch (m) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return m;
      }
    });
  }

  // Run initialization
  init();
});
