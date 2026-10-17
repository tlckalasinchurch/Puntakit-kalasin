import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { pageViewTabsFor } from "@/lib/pageViews";

/**
 * The segmented pill bar that links pages working in the same context
 * (see `lib/pageViews.ts`). These are real links to separate routes, so the
 * markup is a navigation landmark with `aria-current`, not an ARIA tablist.
 * Renders nothing unless the user can reach at least two of the pages.
 */
export function PageViewTabs() {
  const [location] = useLocation();
  const { user } = useAuth();
  const tabs = pageViewTabsFor(user?.role, location);
  if (tabs.length === 0) return null;

  return (
    <nav aria-label="มุมมองของหน้านี้" className="pk-view-tabs" data-testid="page-view-tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.path}
          href={tab.path}
          aria-current={tab.path === location ? "page" : undefined}
          className="pk-view-tab"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
