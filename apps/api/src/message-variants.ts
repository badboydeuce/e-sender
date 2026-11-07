export function parseMessageVariants(source: string): string[] {
  return source.split(/^\s*==\s*$/m).map(message => message.trim()).filter(Boolean);
}
