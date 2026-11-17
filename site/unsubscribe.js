const form = document.getElementById('unsubscribe-form');
if (form) {
  const status = document.getElementById('unsub-status'), button = document.getElementById('unsub-submit'), fallback = document.getElementById('unsub-fallback');
  const send = async body => {
    button.disabled = true; fallback.hidden = true; status.textContent = 'Updating your email preferences…';
    try {
      const response = await fetch('/api/unsubscribe', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok === true) { status.textContent = result.message; form.reset(); return true; }
      status.textContent = result.error || 'That didn’t go through.'; fallback.hidden = false; return false;
    } catch { status.textContent = 'That didn’t go through.'; fallback.hidden = false; return false; }
    finally { button.disabled = false; }
  };
  // One-click links in our emails carry a personal code (?t=...), so no typing is needed.
  const token = new URLSearchParams(location.search).get('t');
  if (token && /^[a-f0-9]{64}$/.test(token)) { history.replaceState(null, '', location.pathname); send({token}); }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    send({email: form.elements.email.value, website: form.elements.website.value});
  });
}
