import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { ClerkProvider } from "@clerk/react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import ClerkSignInPage from "./pages/ClerkSignInPage";
import Home from "./pages/Home";
import Feed from "./pages/Feed";
import FollowUps from "./pages/FollowUps";
import Inbox from "./pages/Inbox";
import Members from "./pages/Members";
import Groups from "./pages/Groups";
import MapPage from "./pages/Map";
import Attendance from "./pages/Attendance";
import Announcements from "./pages/Announcements";
import Events from "./pages/Events";
import Church from "./pages/Church";
import Ministries from "./pages/Ministries";
import Reports from "./pages/Reports";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import ComingSoon from "./pages/ComingSoon";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

// Clerk mode is active when a publishable key is configured at build time.
// Without it the app keeps the legacy cookie/JWT flow (see AuthContext).
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;
const clerkEnabled = Boolean(CLERK_PUBLISHABLE_KEY);

// Member PWA Pages
import MemberHome from "./pages/member/MemberHome";
import MemberEvents from "./pages/member/MemberEvents";
import MemberGroup from "./pages/member/MemberGroup";
import MemberAttendance from "./pages/member/MemberAttendance";
import MemberProfile from "./pages/member/MemberProfile";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={clerkEnabled ? ClerkSignInPage : Login} />

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
  return (
    <ErrorBoundary>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
        <ThemeProvider defaultTheme="light" switchable>
          <AuthProvider>
            <Router />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
}

export default App;
