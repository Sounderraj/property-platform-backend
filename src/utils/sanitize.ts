import sanitizeHtml from 'sanitize-html';

export function sanitizeText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
}

export function sanitizeOptional(input: string | undefined): string | undefined {
  if (!input) return undefined;
  return sanitizeText(input);
}
