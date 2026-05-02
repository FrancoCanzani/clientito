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
    overflow-wrap: normal;
    word-break: normal;
  }

  p, div, span, li, blockquote, pre {
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  td, th {
    overflow-wrap: normal;
    word-break: normal;
  }

  table {
    border-collapse: collapse;
    table-layout: auto;
    max-width: none !important;
  }

  [data-transactional-table='true'] {
    max-width: none !important;
    table-layout: auto !important;
  }

  [data-transactional-cell='true'] {
    vertical-align: top;
    overflow-wrap: normal;
    word-break: normal;
  }

  [data-transactional-tight='true'] {
    padding: 6px 8px !important;
  }

  [data-transactional-image='true'] {
    max-width: 100% !important;
    height: auto !important;
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

  details[data-quoted-collapsible='true'] {
    margin: 8px 0;
  }

  details[data-quoted-collapsible='true'] > summary {
    list-style: none;
    cursor: pointer;
    user-select: none;
    color: #6b7280;
    font-size: 12px;
    font-weight: 600;
  }

  details[data-quoted-collapsible='true'] > summary::-webkit-details-marker {
    display: none;
  }

  details[data-quoted-collapsible='true'][open] > summary {
    margin-bottom: 8px;
  }

  @media (max-width: 640px) {
    :host {
      overflow-x: auto;
    }
  }
`;
