export interface SelectorOption {
  value: string;
  label: string;
  searchText?: string;
}

/** Pure filtering rule shared by the grouped and flat selector views. */
export function filterSelectorOptions(
  items: SelectorOption[],
  query: string
): SelectorOption[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return items;
  return items.filter(option =>
    `${option.label} ${option.searchText ?? ""}`
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  );
}
