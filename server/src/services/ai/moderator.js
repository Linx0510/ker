const bannedFragments = ['<script', '</script>', 'javascript:', 'DROP TABLE', 'DELETE FROM users'];

function scrubString(value) {
  let output = String(value || '');
  for (const fragment of bannedFragments) {
    output = output.replace(new RegExp(fragment, 'ig'), '');
  }
  return output.trim();
}

function walk(value) {
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map(walk);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, walk(nested)])
    );
  }
  return value;
}

export function moderateAiOutput(value) {
  return walk(value);
}
