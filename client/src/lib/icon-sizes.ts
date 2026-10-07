// Shared lucide-react icon sizes, keyed by role so the same kind of icon
// stays the same size everywhere it appears instead of drifting by 1-2px.
export const ICON_SIZE = {
  xs: 15, // inline clear (X) buttons, small chevrons, icons inline with a text label
  sm: 16, // section mini-icons, inline icons on primary/filter buttons
  md: 18, // search fields, list-row action icons, modal close buttons
  lg: 20, // topbar/nav utility icons, directional chevrons
  xl: 25, // circular icon badges (metric cards, detail modals, status tiles)
  "2xl": 28, // large centered feature icons (empty state, success state)
} as const;
