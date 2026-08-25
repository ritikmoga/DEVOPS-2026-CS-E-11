
import { useState } from "react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bell,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  CalendarDays,
  ClipboardCheck,
  QrCode,
  FileCheck2,
  CheckCircle2,
  Users,
  BarChart3,
  FileText,
  Archive,
  Settings,
  X,
} from "lucide-react";

import api from "./api/client";

import EventDetailsPage from "./pages/EventDetailsPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import DashboardOverviewPage from "./pages/DashboardOverviewPage";
import EventManagementPage from "./pages/EventManagementPage";
import RegistrationManagementPage from "./pages/RegistrationManagementPage";
import AttendanceManagementPage from "./pages/AttendanceManagementPage";
import ProofReviewPage from "./pages/ProofReviewPage";
import CertificateManagementPage from "./pages/CertificateManagementPage";
import UserManagementPage from "./pages/UserManagementPage";
import AnalyticsDashboardPage from "./pages/AnalyticsDashboardPage";
import ReportsRoutePage from "./pages/ReportsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import SettingsRoutePage from "./pages/SettingsPage";

/* =========================================================
   CONFIG
========================================================= */

const publicAppUrl =
  import.meta.env.VITE_PUBLIC_APP_URL || "http://localhost:5173";

const DEMO_ADMIN_TOKEN = "demo-admin-session";

const DEMO_ADMIN_PROFILE = {
  fullName: "Demo Administrator",
  email: "demo.admin@eventhub.local",
  roles: ["ADMIN"],
};

/* =========================================================
   NAVIGATION
========================================================= */

const navigationItems = [
  {
    to: "/dashboard",
    label: "Overview",
    icon: <LayoutDashboard />,
  },
  {
    to: "/dashboard/events",
    label: "Events",
    icon: <CalendarDays />,
  },
  {
    to: "/dashboard/registrations",
    label: "Registrations",
    icon: <ClipboardCheck />,
  },
  {
    to: "/dashboard/attendance",
    label: "Attendance scanner",
    icon: <QrCode />,
  },
  {
    to: "/dashboard/proof-review",
    label: "Proof review",
    icon: <FileCheck2 />,
  },
  {
    to: "/dashboard/certificates",
    label: "Certificates",
    icon: <CheckCircle2 />,
  },
  {
    to: "/dashboard/users",
    label: "Users",
    icon: <Users />,
  },
  {
    to: "/dashboard/analytics",
    label: "Analytics",
    icon: <BarChart3 />,
  },
  {
    to: "/dashboard/reports",
    label: "Reports",
    icon: <FileText />,
  },
  {
    to: "/dashboard/audit-logs",
    label: "Audit logs",
    icon: <Archive />,
  },
  {
    to: "/dashboard/settings",
    label: "Settings",
    icon: <Settings />,
  },
];

/* =========================================================
   HELPER
========================================================= */

function getAdminToken() {
  return localStorage.getItem("eventhub_admin_access");
}

function clearAdminToken() {
  localStorage.removeItem("eventhub_admin_access");
}

/* =========================================================
   NAV ITEM
========================================================= */

function NavItem({
  item,
  onClick,
}: {
  item: {
    to: string;
    label: string;
    icon: React.ReactNode;
  };
  onClick: () => void;
}) {
  const location = useLocation();

  const isActive =
    item.to === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(item.to);

  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={isActive ? "nav-item active" : "nav-item"}
    >
      {item.icon}

      <span>{item.label}</span>

      {item.label === "Proof review" && <b>4</b>}
    </Link>
  );
}

/* =========================================================
   ADMIN SHELL
========================================================= */

function AdminShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = useNavigate();

  const token = getAdminToken();
  const isDemo = token === DEMO_ADMIN_TOKEN;

  const {
    data: fetchedMe,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin-me"],
    enabled: Boolean(token) && !isDemo,
    queryFn: async () => {
      const response = await api.get("/auth/me");
      return response.data.data;
    },
  });

  const me = isDemo ? DEMO_ADMIN_PROFILE : fetchedMe;

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (!isDemo) {
        await api.post("/auth/logout");
      }
    },

    onSettled: () => {
      clearAdminToken();
      navigate("/login", { replace: true });
    },
  });

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading && !isDemo) {
    return (
      <div className="loading">
        Loading admin workspace…
      </div>
    );
  }

  if (isError && !isDemo) {
    clearAdminToken();

    return <Navigate to="/login" replace />;
  }

  if (!me) {
    return (
      <div className="loading">
        Loading admin workspace…
      </div>
    );
  }

  const canAccessAdmin = me.roles?.some((role: string) =>
    ["ADMIN", "SUPER_ADMIN"].includes(role)
  );

  if (!canAccessAdmin) {
    clearAdminToken();

    return <Navigate to="/login" replace />;
  }

  return (
    <div className="admin-shell">

      {/* ================= SIDEBAR ================= */}

      <aside
        className={
          mobileMenuOpen
            ? "admin-side open"
            : "admin-side"
        }
      >
        <div className="admin-logo">
          <span className="logo-mark">
            E
          </span>

          <div>
            <strong>
              EventHub
            </strong>

            <small>
              OPERATIONS CONSOLE
            </small>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X />
          </button>
        </div>

        {/* ================= USER ================= */}

        <div className="admin-user">

          <div className="admin-avatar">
            {me.fullName
              ?.slice(0, 2)
              .toUpperCase()}
          </div>

          <div>
            <strong>
              {me.fullName}
            </strong>

            <small>
              {me.roles?.join(" · ")}
            </small>
          </div>

          <ChevronDown size={15} />

        </div>

        {/* ================= NAVIGATION ================= */}

        <nav>
          {navigationItems.map((item) => (
            <NavItem
              key={item.to}
              item={item}
              onClick={() =>
                setMobileMenuOpen(false)
              }
            />
          ))}
        </nav>

        {/* ================= LOGOUT ================= */}

        <button
          type="button"
          className="logout"
          onClick={() =>
            logoutMutation.mutate()
          }
          disabled={logoutMutation.isPending}
        >
          <LogOut size={16} />

          {logoutMutation.isPending
            ? "Signing out…"
            : "Sign out"}
        </button>

      </aside>

      {/* ================= MAIN CONTENT ================= */}

      <section className="admin-content">

        <header className="admin-top">

          <button
            type="button"
            className="mobile-toggle"
            onClick={() =>
              setMobileMenuOpen(true)
            }
          >
            <Menu />
          </button>

          <div className="crumb">
            EVENTHUB
            <span>/</span>
            OPERATIONS
          </div>

          <div className="top-actions">

            <a
              className="public-site-link"
              href={publicAppUrl}
            >
              Public site
            </a>

            <Bell size={18} />

            <span className="online">
              <i />
              System operational
            </span>

          </div>

        </header>

        <main>
          <Outlet />
        </main>

      </section>

    </div>
  );
}

/* =========================================================
   AUTH ROUTE WRAPPER
========================================================= */

function ProtectedRoute() {
  const token = getAdminToken();

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return <AdminShell />;
}

/* =========================================================
   APP
========================================================= */

export default function App() {
  const token = getAdminToken();

  return (
    <Routes>

      {/* ================= LOGIN ================= */}

      <Route
        path="/login"
        element={
          token ? (
            <Navigate
              to="/dashboard"
              replace
            />
          ) : (
            <AdminLoginPage />
          )
        }
      />

      {/* ================= PROTECTED ADMIN ROUTES ================= */}

      <Route element={<ProtectedRoute />}>

        <Route
          path="/dashboard"
          element={<DashboardOverviewPage />}
        />

        <Route
          path="/dashboard/events"
          element={<EventManagementPage />}
        />

        <Route
          path="/dashboard/events/:id"
          element={<EventDetailsPage />}
        />

        <Route
          path="/dashboard/registrations"
          element={<RegistrationManagementPage />}
        />

        <Route
          path="/dashboard/attendance"
          element={<AttendanceManagementPage />}
        />

        <Route
          path="/dashboard/proof-review"
          element={<ProofReviewPage />}
        />

        <Route
          path="/dashboard/certificates"
          element={<CertificateManagementPage />}
        />

        <Route
          path="/dashboard/users"
          element={<UserManagementPage />}
        />

        <Route
          path="/dashboard/analytics"
          element={<AnalyticsDashboardPage />}
        />

        <Route
          path="/dashboard/reports"
          element={<ReportsRoutePage />}
        />

        <Route
          path="/dashboard/audit-logs"
          element={<AuditLogsPage />}
        />

        <Route
          path="/dashboard/settings"
          element={<SettingsRoutePage />}
        />

      </Route>

      {/* ================= FALLBACK ================= */}

      <Route
        path="*"
        element={
          <Navigate
            to={
              token
                ? "/dashboard"
                : "/login"
            }
            replace
          />
        }
      />

    </Routes>
  );
}
```
