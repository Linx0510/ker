document.addEventListener('DOMContentLoaded', async () => {
  const existingUser = await auth.getCurrentUser();
  if (existingUser) {
    window.location.replace(existingUser.role === 'admin' ? 'admin.html' : 'courses.html');
    return;
  }

  const form = document.getElementById('login-form');
  const errorElement = document.getElementById('login-error');

  function showError(message) {
    if (!errorElement) return;
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorElement.style.display = 'none';

    await utils.withFormLoading(form, async () => {
      try {
        const user = await auth.login(
          document.getElementById('email').value.trim(),
          document.getElementById('password').value
        );
        window.location.href = user.role === 'admin' ? 'admin.html' : 'dashboard.html';
      } catch (error) {
        showError(error.message);
      }
    });
  });
});
