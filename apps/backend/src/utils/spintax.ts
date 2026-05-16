// Spintax — linear parser, immune to ReDoS
// Example: "{Hi|Hello|Hey} {{firstName}}!" — spintax uses | separator, variables use {{}}
export function applySpintax(text: string): string {
  const result: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '{') {
      const end = text.indexOf('}', i + 1);
      if (end === -1) { result.push(text.slice(i)); break; }
      const inner = text.slice(i + 1, end);
      if (inner.includes('|')) {
        const choices = inner.split('|');
        result.push(choices[Math.floor(Math.random() * choices.length)]);
      } else {
        result.push('{' + inner + '}');
      }
      i = end + 1;
    } else {
      result.push(text[i++]);
    }
  }
  return result.join('');
}
