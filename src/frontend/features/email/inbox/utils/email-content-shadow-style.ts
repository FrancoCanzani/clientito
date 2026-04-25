export const EMAIL_CONTENT_SHADOW_STYLE = `
  :host {
    display: block;
    width: 100%;
    max-width: 100%;
    color: inherit;
    font-size: 12px;
    line-height: 1.45;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  :host > * {
    max-width: 100%;
  }

  :host {
    color: inherit;
    font-family: inherit;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  p, div, span, td, th, li, blockquote, pre {
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  table {
    border-collapse: collapse;
    table-layout: auto;
    max-width: 100% !important;
  }

  img, video, iframe, svg, canvas {
    max-width: 100% !important;
    height: auto !important;
  }

  pre {
    white-space: pre-wrap;
    max-width: 100%;
    overflow-x: auto;
  }
`;
