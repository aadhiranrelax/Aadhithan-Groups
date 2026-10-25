/**
 * AADHIRAN AYURVEDA, SIDDHA & NATUROPATHY SANCTUARY
 * Interactive Client-Side Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Mobile Drawer Controls ---
  const mobileToggle = document.getElementById('mobile-toggle');
  const mobileDrawer = document.getElementById('mobile-drawer');
  const drawerBackdrop = document.getElementById('drawer-backdrop');
  const drawerClose = document.getElementById('drawer-close');
  const drawerLinks = document.querySelectorAll('.drawer-link');

  function openDrawer() {
    if (mobileDrawer) mobileDrawer.classList.add('open');
    if (drawerBackdrop) drawerBackdrop.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    if (mobileDrawer) mobileDrawer.classList.remove('open');
    if (drawerBackdrop) drawerBackdrop.style.display = 'none';
    document.body.style.overflow = '';
  }

  if (mobileToggle) mobileToggle.addEventListener('click', openDrawer);
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);
  drawerLinks.forEach(link => link.addEventListener('click', closeDrawer));

  // --- Booking Modal Controls ---
  const bookingModal = document.getElementById('booking-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const bookingForm = document.getElementById('booking-form');
  const bookTriggers = document.querySelectorAll('[data-book-trigger]');
  const selectService = document.getElementById('booking-service');
  const selectTherapist = document.getElementById('booking-therapist');

  function openBookingModal(serviceName = '', therapistName = '') {
    if (bookingModal) bookingModal.classList.add('open');
    document.body.style.overflow = 'hidden';

    if (serviceName && selectService) {
      selectService.value = serviceName;
    }
    if (therapistName && selectTherapist) {
      selectTherapist.value = therapistName;
    }
  }

  function closeBookingModal() {
    if (bookingModal) bookingModal.classList.remove('open');
    document.body.style.overflow = '';
  }

  bookTriggers.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const service = btn.getAttribute('data-service') || '';
      const therapist = btn.getAttribute('data-therapist') || '';
      openBookingModal(service, therapist);
    });
  });

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeBookingModal);
  if (bookingModal) {
    bookingModal.addEventListener('click', (e) => {
      if (e.target === bookingModal) closeBookingModal();
    });
  }

  // --- Booking Form Submit -> WhatsApp or Direct ---
  if (bookingForm) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('book-name').value.trim();
      const phone = document.getElementById('book-phone').value.trim();
      const service = selectService ? selectService.value : 'Sanctuary Session';
      const therapist = selectTherapist ? selectTherapist.value : 'Any Verified Healer';
      const date = document.getElementById('book-date').value;
      const notes = document.getElementById('book-notes').value.trim();

      const msg = `*AADHIRAN SANCTUARY APPOINTMENT REQUEST*\n\n` +
        `👤 *Client Name:* ${name}\n` +
        `📞 *Contact:* ${phone}\n` +
        `🌿 *Treatment:* ${service}\n` +
        `🩺 *Preferred Therapist:* ${therapist}\n` +
        `📅 *Requested Date:* ${date || 'Earliest Available'}\n` +
        (notes ? `📝 *Notes/Health Concerns:* ${notes}\n\n` : '\n') +
        `📍 *Location:* Sri Bhagavathy Complex, Tiruppur`;

      const waUrl = `https://wa.me/918220267077?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank');
      closeBookingModal();
      bookingForm.reset();
    });
  }
});
