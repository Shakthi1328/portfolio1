document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contactForm');
    const formStatus = document.getElementById('formStatus');
    const submitBtn = contactForm.querySelector('.btn-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const loader = submitBtn.querySelector('.loader');

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Reset status
        formStatus.className = 'form-status hidden';
        formStatus.textContent = '';
        
        // Show loading state
        submitBtn.disabled = true;
        btnText.textContent = 'Sending...';
        loader.classList.remove('hidden');

        // Gather data
        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            subject: document.getElementById('subject').value,
            message: document.getElementById('message').value
        };

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Success
                formStatus.textContent = result.message || 'Message sent! Check your email.';
                formStatus.className = 'form-status success';
                contactForm.reset();
            } else {
                // Error from server
                formStatus.textContent = result.message || 'Failed to send message.';
                formStatus.className = 'form-status error';
            }
        } catch (error) {
            // Network error
            formStatus.textContent = 'A network error occurred. Please try again later.';
            formStatus.className = 'form-status error';
            console.error('Submission error:', error);
        } finally {
            // Restore button state
            submitBtn.disabled = false;
            btnText.textContent = 'Send Message';
            loader.classList.add('hidden');
        }
    });
});
