/**
 * Spintax — randomizes phrasing to avoid spam filters
 * Example: "{Hi|Hello|Hey} {name}!" → randomly picks one option per group
 */
export function applySpintax(text: string): string {
  return text.replace(/\{([^{}]+)\}/g, (_match, options: string) => {
    const choices = options.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}
