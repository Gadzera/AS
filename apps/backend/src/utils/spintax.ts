// Spintax — only matches groups containing | so {firstName} variables are not consumed
// Example: "{Hi|Hello|Hey} {{firstName}}!" — spintax uses | separator, variables use {{}}
export function applySpintax(text: string): string {
  return text.replace(/\{([^{}]*\|[^{}]*)\}/g, (_match, options: string) => {
    const choices = options.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}
