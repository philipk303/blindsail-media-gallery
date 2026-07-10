import path from 'node:path';

export function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function itemId(eventId, sourceFile) {
  const base = path.parse(sourceFile).name;
  return `${eventId}-${slugify(base)}`;
}
