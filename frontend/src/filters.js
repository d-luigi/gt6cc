export function availableTypes(cheats, categories) {
  return [...new Set(cheats.filter(cheat => categories.has(cheat.category)).map(cheat => cheat.subcategory))];
}

export function matchesCheat(cheat, { q, category, sub, status }) {
  const query = q.trim().toLowerCase();
  const discovery = cheat.discovered ? 'discovered' : 'undiscovered';
  return (
    (!category.size || category.has(cheat.category)) &&
    (!sub.size || sub.has(cheat.subcategory)) &&
    (!status.size || status.has(discovery)) &&
    (!query || [cheat.title, cheat.description, cheat.unlock].join(' ').toLowerCase().includes(query))
  );
}
