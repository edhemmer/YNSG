const form = document.getElementById('service-saturday-form');
if (form) {
  const status = document.getElementById('ss-status'), button = document.getElementById('ss-submit'), fallback = document.getElementById('ss-fallback');
  const nominee = document.getElementById('ss-nominee'), closed = document.getElementById('ss-closed');
  const nomineeFields = ['nomineeName', 'workStreet', 'workCity', 'workPostalCode'].map(name => form.elements[name]);
  const today = new Date().toLocaleDateString('en-CA', {timeZone: 'America/Chicago'});
  // After the last entry day the form hides itself, even before the site is switched off.
  if (form.dataset.deadline && today > form.dataset.deadline) { form.hidden = true; closed.hidden = false; }
  let requestKey = globalThis.crypto?.randomUUID?.() || '';
  const syncType = () => {
    const nominating = form.elements.entryType.value === 'nominate';
    nominee.hidden = !nominating;
    for (const field of nomineeFields) field.required = nominating;
  };
  for (const radio of form.querySelectorAll('input[name="entryType"]')) radio.addEventListener('change', syncType);
  syncType();
  form.addEventListener('submit', async event => {
    event.preventDefault(); fallback.hidden = true;
    if (!form.reportValidity()) return;
    if (!requestKey) { status.textContent = 'Please call or email us to enter.'; fallback.hidden = false; return; }
    const values = Object.fromEntries(new FormData(form).entries());
    const data = {...values, rulesAccepted: form.elements.rulesAccepted.checked, marketingConsent: form.elements.marketingConsent.checked, requestKey};
    button.disabled = true; status.textContent = 'Sending your entry…';
    try {
      const response = await fetch('/api/service-saturday', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok === true) {
        status.textContent = result.duplicate ? 'You’re already entered with that email. Good luck!' : 'You’re entered! Thank you. We’ll draw the winner soon and reach out by email or phone. Good luck!';
        form.reset(); syncType(); requestKey = globalThis.crypto?.randomUUID?.() || '';
      } else if (response.status === 400 || response.status === 410 || response.status === 429) {
        status.textContent = result.error || 'Please check the form and try again.';
      } else throw Error('Unavailable');
    } catch { status.textContent = 'We couldn’t confirm your entry was received.'; fallback.hidden = false; }
    finally { button.disabled = false; }
  });
}
