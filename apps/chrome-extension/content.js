// Inject "Add to AI SDR" button on LinkedIn profile pages
(function () {
  if (document.getElementById('aisdr-btn')) return;

  function injectButton() {
    // Find the actions section on LinkedIn profile
    const actionsArea =
      document.querySelector('.pvs-profile-actions') ||
      document.querySelector('.pv-top-card--list-bullet') ||
      document.querySelector('[data-control-name="contact_see_more"]')?.parentElement;

    if (!actionsArea || document.getElementById('aisdr-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'aisdr-btn';
    btn.textContent = '+ AI SDR';
    btn.style.cssText = `
      display: inline-flex; align-items: center; gap: 4px;
      padding: 6px 16px; border-radius: 16px;
      background: #6366f1; color: white; border: none;
      font-size: 14px; font-weight: 600; cursor: pointer;
      margin-left: 8px; transition: background 0.15s;
    `;
    btn.onmouseover = () => (btn.style.background = '#4f46e5');
    btn.onmouseout = () => (btn.style.background = '#6366f1');
    btn.onclick = () => chrome.runtime.sendMessage({ action: 'openPopup' });

    actionsArea.appendChild(btn);
  }

  // Try immediately and after a delay (LinkedIn is SPA)
  injectButton();
  setTimeout(injectButton, 2000);

  const observer = new MutationObserver(() => injectButton());
  observer.observe(document.body, { childList: true, subtree: true });
})();
