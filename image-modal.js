(function() {
    const modal = document.getElementById('imageModal');
    if (!modal) {
        return;
    }

    const modalImg = modal.querySelector('#modalImage, #imageModalImg, img');
    const modalCaption = modal.querySelector('#modalCaption, .modal-caption');
    const closeBtn = modal.querySelector('.modal-close, #imageModalClose, .image-modal-close');
    const zoomableSelector = '[data-zoomable], .image-container img';
    const modalMode = modal.dataset.modalMode || 'standard';
    const usesOverlayModal = modalMode === 'overlay';
    let lastFocusedElement = null;

    if (!modalImg || !closeBtn) {
        return;
    }

    const getCaptionText = (img) => {
        const container = img.closest('.image-container');
        const caption = container ? container.querySelector('.image-caption') : null;
        return caption ? caption.textContent.trim() : (img.alt || '');
    };

    const openModal = (img) => {
        lastFocusedElement = img;
        modalImg.src = img.src;
        modalImg.alt = img.alt || '';

        if (modalCaption) {
            modalCaption.textContent = getCaptionText(img);
        }

        if (usesOverlayModal) {
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        } else {
            modal.classList.add('active');
        }

        closeBtn.focus();
    };

    const closeModal = () => {
        if (usesOverlayModal) {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        } else {
            modal.classList.remove('active');
        }

        modalImg.src = '';
        modalImg.alt = '';

        if (modalCaption) {
            modalCaption.textContent = '';
        }

        if (lastFocusedElement) {
            lastFocusedElement.focus();
        }
    };

    document.querySelectorAll(zoomableSelector).forEach((img) => {
        if (!img.hasAttribute('tabindex')) {
            img.setAttribute('tabindex', '0');
        }

        if (!img.hasAttribute('role')) {
            img.setAttribute('role', 'button');
        }

        img.addEventListener('click', () => {
            openModal(img);
        });

        img.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openModal(img);
            }
        });
    });

    closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }

        if (modal.classList.contains('active') || modal.classList.contains('open')) {
            closeModal();
        }
    });
})();
