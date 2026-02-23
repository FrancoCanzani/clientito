export function getBaseStyles(customCss?: string | null): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .rl-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
      animation: rl-fade-in 0.2s ease;
    }

    .rl-modal {
      background: #fff;
      border-radius: 12px;
      max-width: 520px;
      width: 90vw;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      animation: rl-slide-up 0.25s ease;
    }

    .rl-modal-header {
      padding: 20px 24px 0;
    }

    .rl-modal-title {
      font-size: 18px;
      font-weight: 600;
      color: #111;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .rl-modal-body {
      padding: 16px 24px 24px;
      font-size: 14px;
      line-height: 1.6;
      color: #374151;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .rl-modal-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #9ca3af;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }
    .rl-modal-close:hover { background: #f3f4f6; color: #374151; }

    .rl-banner {
      position: fixed;
      left: 0;
      right: 0;
      background: #1e40af;
      color: #fff;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 1;
      animation: rl-slide-down 0.3s ease;
    }
    .rl-banner-top { top: 0; }
    .rl-banner-bottom { bottom: 0; }

    .rl-banner-close {
      background: none;
      border: none;
      color: #fff;
      font-size: 18px;
      cursor: pointer;
      opacity: 0.8;
      margin-left: 12px;
    }
    .rl-banner-close:hover { opacity: 1; }

    .rl-changelog {
      position: fixed;
      right: 20px;
      bottom: 20px;
      width: 380px;
      max-height: 500px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: rl-slide-up 0.25s ease;
      z-index: 1;
    }

    .rl-changelog-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .rl-changelog-title {
      font-size: 15px;
      font-weight: 600;
      color: #111;
    }

    .rl-changelog-item {
      padding: 16px 20px;
      border-bottom: 1px solid #f3f4f6;
    }

    .rl-changelog-item-title {
      font-size: 14px;
      font-weight: 500;
      color: #111;
      margin-bottom: 4px;
    }

    .rl-changelog-item-body {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.5;
    }

    .rl-changelog-item-date {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 6px;
    }

    .rl-branding {
      text-align: center;
      padding: 8px;
      font-size: 10px;
      color: #9ca3af;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .rl-branding a { color: #9ca3af; text-decoration: none; }
    .rl-branding a:hover { color: #6b7280; }

    @keyframes rl-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes rl-slide-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes rl-slide-down { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

    ${customCss ?? ""}
  `;
}
