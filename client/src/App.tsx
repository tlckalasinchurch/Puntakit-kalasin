import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { ClerkProvider } from "@clerk/react";
import { clerkThTH } from "./lib/clerkLocalization";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import NotFound from "@/pages/NotFound";

// Every page is code-split. Before this, all 24 pages sat in one entry chunk, so
// any heavy dependency used by any single page was downloaded by everyone on
// first paint — leaflet + leaflet.markercluster (~456 kB unminified) used only
// by /map, qrcode (~58 kB) used by three pages, and so on. Router paths, shells
// and access rules are unchanged; this only changes when a page's code arrives.
//
// NotFound stays a static import on purpose: it is the route fallback, so it
// must render without ever suspending.
const ClerkSignInPage = lazy(() => import("./pages/ClerkSignInPage"));
const ClerkSignUpPage = lazy(() => import("./pages/ClerkSignUpPage"));
const Home = lazy(() => import("./pages/Home"));
const Feed = lazy(() => import("./pages/Feed"));
const FollowUps = lazy(() => import("./pages/FollowUps"));
const Inbox = lazy(() => import("./pages/Inbox"));
const ImportData = lazy(() => import("./pages/ImportData"));
const ImportDuplicates = lazy(() => import("./pages/ImportDuplicates"));
const CareToday = lazy(() => import("./pages/CareToday"));
const OrgChart = lazy(() => import("./pages/OrgChart"));
const ImportOrgData = lazy(() => import("./pages/ImportOrgData"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const Members = lazy(() => import("./pages/Members"));
const Groups = lazy(() => import("./pages/Groups"));
const MapPage = lazy(() => import("./pages/Map"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Announcements = lazy(() => import("./pages/Announcements"));
const Events = lazy(() => import("./pages/Events"));
const Church = lazy(() => import("./pages/Church"));
const Ministries = lazy(() => import("./pages/Ministries"));
const Reports = lazy(() => import("./pages/Reports"));
const Profile = lazy(() => import("./pages/Profile"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));

// Member PWA Pages
const MemberHome = lazy(() => import("./pages/member/MemberHome"));
const MemberEvents = lazy(() => import("./pages/member/MemberEvents"));
const MemberGroup = lazy(() => import("./pages/member/MemberGroup"));
const MemberAttendance = lazy(() => import("./pages/member/MemberAttendance"));
const MemberProfile = lazy(() => import("./pages/member/MemberProfile"));

// Clerk owns production sign-in/sign-out flows. Local demo mode is explicit,
// requires VITE_PUNTAKIT_DEMO_MODE=1, and is never enabled by default.
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const IS_DEMO_MODE = import.meta.env.VITE_PUNTAKIT_DEMO_MODE === "1";
if (!CLERK_PUBLISHABLE_KEY && !IS_DEMO_MODE) {
  throw new Error(
    "Missing VITE_CLERK_PUBLISHABLE_KEY. Add the Clerk publishable key or explicitly enable VITE_PUNTAKIT_DEMO_MODE=1 for local development."
  );
}

/** Page-content loading → skeleton (design.md §8); never "..." text. */
function RouteSkeleton() {
  return (
    <div
      className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8"
      data-testid="route-skeleton"
    >
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={ClerkSignInPage} />
      <Route path="/signup" component={ClerkSignUpPage} />

      {/* Public legal routes (accessible without login) */}
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />

      {/* Member PWA Routes */}
      <Route path="/app">
        <ProtectedRoute>
          <MemberHome />
        </ProtectedRoute>
      </Route>
      <Route path="/app/events">
        <ProtectedRoute>
          <MemberEvents />
        </ProtectedRoute>
      </Route>
      <Route path="/app/group">
        <ProtectedRoute>
          <MemberGroup />
        </ProtectedRoute>
      </Route>
      <Route path="/app/attendance">
        <ProtectedRoute>
          <MemberAttendance />
        </ProtectedRoute>
      </Route>
      <Route path="/app/profile">
        <ProtectedRoute>
          <MemberProfile />
        </ProtectedRoute>
      </Route>

      <Route path="/">
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      </Route>
      <Route path="/feed">
        <ProtectedRoute>
          <Feed />
        </ProtectedRoute>
      </Route>
      <Route path="/follow-up">
        <ProtectedRoute>
          <FollowUps />
        </ProtectedRoute>
      </Route>
      <Route path="/inbox">
        <ProtectedRoute>
          <Inbox />
        </ProtectedRoute>
      </Route>
      <Route path="/import">
        <ProtectedRoute>
          <ImportData />
        </ProtectedRoute>
      </Route>
      <Route path="/care">
        <ProtectedRoute>
          <CareToday />
        </ProtectedRoute>
      </Route>
      <Route path="/org">
        <ProtectedRoute>
          <OrgChart />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute>
          <AdminUsers />
        </ProtectedRoute>
      </Route>
      <Route path="/import/org">
        <ProtectedRoute>
          <ImportOrgData />
        </ProtectedRoute>
      </Route>
      <Route path="/import/duplicates">
        <ProtectedRoute>
          <ImportDuplicates />
        </ProtectedRoute>
      </Route>
      <Route path="/members">
        <ProtectedRoute>
          <Members />
        </ProtectedRoute>
      </Route>
      <Route path="/groups">
        <ProtectedRoute>
          <Groups />
        </ProtectedRoute>
      </Route>
      <Route path="/map">
        <ProtectedRoute>
          <MapPage />
        </ProtectedRoute>
      </Route>
      <Route path="/attendance">
        <ProtectedRoute>
          <Attendance />
        </ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      </Route>
      <Route path="/announcements">
        <ProtectedRoute>
          <Announcements />
        </ProtectedRoute>
      </Route>
      <Route path="/events">
        <ProtectedRoute>
          <Events />
        </ProtectedRoute>
      </Route>
      <Route path="/worship">
        <ProtectedRoute>
          <Events />
        </ProtectedRoute>
      </Route>
      <Route path="/church">
        <ProtectedRoute>
          <Church />
        </ProtectedRoute>
      </Route>
      <Route path="/ministries">
        <ProtectedRoute>
          <Ministries />
        </ProtectedRoute>
      </Route>
      <Route path="/reports">
        <ProtectedRoute>
          <Reports />
        </ProtectedRoute>
      </Route>
      <Route path="/media">
        <ProtectedRoute>
          <ComingSoon />
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <ComingSoon />
        </ProtectedRoute>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const content = (
    <ThemeProvider defaultTheme="light" switchable>
      <AuthProvider>
        <Suspense fallback={<RouteSkeleton />}>
          <Router />
        </Suspense>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );

  return (
    <ErrorBoundary>
      {IS_DEMO_MODE ? (
        content
      ) : (
        // Thai localization belongs on the provider: Clerk v6 removed the
        // per-component `localization` prop from <SignIn/>/<SignUp/>.
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} localization={clerkThTH}>
          {content}
        </ClerkProvider>
      )}
    </ErrorBoundary>
  );
}

export default App;
