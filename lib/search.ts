// Every word of the query must appear somewhere in the text, in any order,
// so "science basic" finds "Basics of Science".
export function matchesSearch(text: unknown, query: string): boolean {
  const haystack = String(text ?? "").toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
