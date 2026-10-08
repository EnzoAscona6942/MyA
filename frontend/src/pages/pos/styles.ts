// ============================================================
// POS - STYLES (Google Fonts + Global CSS)
// ============================================================

export function initStyles(): void {
  if (typeof document !== 'undefined') {
    // ── Fuentes via Google Fonts ─────────────────────────────────
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap';
    document.head.appendChild(fontLink);

    // ── Estilos globales ─────────────────────────────────────────
    const globalStyles = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'DM Mono', monospace; background: #F5F5F0; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 99px; }

      @keyframes slideIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes scanPulse {
        0%   { box-shadow: 0 0 0 0 rgba(22,163,74,0.4); }
        70%  { box-shadow: 0 0 0 10px rgba(22,163,74,0); }
        100% { box-shadow: 0 0 0 0 rgba(22,163,74,0); }
      }
      @keyframes flashGreen {
        0%   { background: #DCFCE7; }
        100% { background: #FFFFFF; }
      }
      .item-enter { animation: slideIn 0.2s ease forwards; }
      .flash-green { animation: flashGreen 0.6s ease forwards; }
    `;
    const styleTag = document.createElement('style');
    styleTag.textContent = globalStyles;
    document.head.appendChild(styleTag);
  }
}