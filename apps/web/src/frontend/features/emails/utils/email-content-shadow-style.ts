export const EMAIL_CONTENT_SHADOW_STYLE = `
  :host {
    display: block;
    color: inherit;
    font-size: 12px;
    line-height: 1.45;
  }

  *, *::before, *::after {
    box-sizing: border-box;
    max-width: 100%;
  }

  body {
    margin: 0;
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
    width: 100%;
    max-width: 100%;
    border-collapse: collapse;
    table-layout: auto;
  }

  img {
    max-width: 100% !important;
    height: auto !important;
  }

  pre {
    white-space: pre-wrap;
  }
`;
