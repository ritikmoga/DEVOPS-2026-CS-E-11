import { useState } from "react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Archive,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileCheck2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Search,
  Settings,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "./api/client";
import EventAdminDetail from "./EventAdminDetail";
import AdminLoginPage from "./pages/AdminLoginPage";
import DashboardOverviewPage from "./pages/DashboardOverviewPage";
import EventManagementPage from "./pages/EventManagementPage";
import EventDetailsPage from "./pages/EventDetailsPage";
import RegistrationManagementPage from "./pages/RegistrationManagementPage";
import AttendanceManagementPage from "./pages/AttendanceManagementPage";
import ProofReviewPage from "./pages/ProofReviewPage";
import CertificateManagementPage from "./pages/CertificateManagementPage";
import UserManagementPage from "./pages/UserManagementPage";
import AnalyticsDashboardPage from "./pages/AnalyticsDashboardPage";
import ReportsRoutePage from "./pages/ReportsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import SettingsRoutePage from "./pages/SettingsPage";

const publicAppUrl = import.meta.env.VITE_PUBLIC_APP_URL || "http://localhost:5173";
const DEMO_ADMIN_EMAIL = "demo.admin@eventhub.local";
const DEMO_ADMIN_PASSWORD = "DemoAdmin123!";
const DEMO_ADMIN_TOKEN = "demo-admin-session";
const DEMO_ADMIN_PROFILE = {
  fullName: "Demo Administrator",
  email: DEMO_ADMIN_EMAIL,
  roles: ["ADMIN"],
};
const DEMO_ADMIN_OVERVIEW = {
  totalEvents: 12,
  upcomingEvents: 7,
  registrations: 248,
  pendingProofs: 4,
  todayCheckins: 36,
};

const nav = [
  { to: "/dashboard", label: "Overview", icon: <LayoutDashboard /> },
  { to: "/dashboard/events", label: "Events", icon: <CalendarDays /> },
  { to: "/dashboard/registrations", label: "Registrations", icon: <ClipboardCheck /> },
  { to: "/dashboard/attendance", label: "Attendance scanner", icon: <QrCode /> },
  { to: "/dashboard/proof-review", label: "Proof review", icon: <FileCheck2 /> },
  { to: "/dashboard/certificates", label: "Certificates", icon: <CheckCircle2 /> },
  { to: "/dashboard/users", label: "Users", icon: <Users /> },
  { to: "/dashboard/analytics", label: "Analytics", icon: <BarChart3 /> },
  { to: "/dashboard/reports", label: "Reports", icon: <FileText /> },
  { to: "/dashboard/audit-logs", label: "Audit logs", icon: <Archive /> },
  { to: "/dashboard/settings", label: "Settings", icon: <Settings /> },
];
function AdminShell() {
  const [mobile, setMobile] = useState(false);
  const token = localStorage.getItem("eventhub_admin_access");
  const isDemo = token === DEMO_ADMIN_TOKEN;
  const { data: fetchedMe, isError: authError } = useQuery({
    queryKey: ["admin-me"],
    enabled: Boolean(token) && !isDemo,
    queryFn: () => api.get("/auth/me").then((r) => r.data.data),
  });
  const me = isDemo ? DEMO_ADMIN_PROFILE : fetchedMe;
  const navigate = useNavigate();
  const logout = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSettled: () => {
      localStorage.removeItem("eventhub_admin_access");
      navigate("/login");
    },
  });
  if (authError && !isDemo) {
    localStorage.removeItem("eventhub_admin_access");
    return <Navigate to="/login" replace />;
  }
  if (!me) return <div className="loading">Loading admin workspace…</div>;
  const canAccessAdmin = me.roles?.some((role: string) => ["ADMIN", "SUPER_ADMIN"].includes(role));
  if (!canAccessAdmin) {
    localStorage.removeItem("eventhub_admin_access");
    return <Navigate to="/login" replace />;
  }
  return (
    <div className="admin-shell">
      <aside className={mobile ? "admin-side open" : "admin-side"}>
        <div className="admin-logo">
          <span className="logo-mark">E</span>
          <div>
            <strong>EventHub</strong>
            <small>OPERATIONS CONSOLE</small>
          </div>
          <button onClick={() => setMobile(false)}>
            <X />
          </button>
        </div>
        <div className="admin-user">
          <div className="admin-avatar">{me.fullName.slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{me.fullName}</strong>
            <small>{me.roles?.join(" · ")}</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav>
          {nav.map((item) => (
            <NavItem key={item.to} item={item} onClick={() => setMobile(false)} />
          ))}
        </nav>
        <button className="logout" onClick={() => logout.mutate()}>
          <LogOut size={16} /> Sign out
        </button>
      </aside>
      <section className="admin-content">
        <header className="admin-top">
          <button className="mobile-toggle" onClick={() => setMobile(true)}>
            <Menu />
          </button>
          <div className="crumb">
            EVENTHUB <span>/</span> OPERATIONS
          </div>
          <div className="top-actions">
            <a className="public-site-link" href={publicAppUrl}>
              Public site
            </a>
            <Bell size={18} />
            <span className="online">
              <i /> System operational
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
function NavItem({ item, onClick }: { item: any; onClick: () => void }) {
  const location = useLocation();
  const active =
    item.to === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(item.to);
  return (
    <Link onClick={onClick} className={active ? "nav-item active" : "nav-item"} to={item.to}>
      {item.icon}
      <span>{item.label}</span>
      {item.label === "Proof review" && <b>4</b>}
    </Link>
  );
}
function AdminLogin() {
  const [form, setForm] = useState({
    email: DEMO_ADMIN_EMAIL,
    password: DEMO_ADMIN_PASSWORD,
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: () => {
      if (
        form.email.trim().toLowerCase() === DEMO_ADMIN_EMAIL &&
        form.password === DEMO_ADMIN_PASSWORD
      ) {
        return Promise.resolve({ data: { data: { accessToken: DEMO_ADMIN_TOKEN } } });
      }
      return api.post("/auth/login", form);
    },
    onSuccess: (r) => {
      localStorage.setItem("eventhub_admin_access", r.data.data.accessToken);
      navigate("/dashboard");
    },
    onError: (e: any) => setError(e.response?.data?.message || "Unable to sign in"),
  });
  return (
    <div className="login-page">
      <div className="login-box">
        <div className="admin-logo">
          <span className="logo-mark">E</span>
          <div>
            <strong>EventHub</strong>
            <small>OPERATIONS CONSOLE</small>
          </div>
        </div>
        <p className="kicker">SECURE ADMIN ACCESS</p>
        <h1>Good morning.</h1>
        <p className="muted">
          Sign in to manage participation, proof and event operations. Demo credentials are
          prefilled for presentation.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            mutation.mutate();
          }}
        >
          <label>
            Work email
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button className="primary wide" disabled={mutation.isPending}>
            {mutation.isPending ? "Signing in…" : "Sign in to console"}
          </button>
        </form>
        <a className="back-public" href={publicAppUrl}>
          ← Back to public site
        </a>
      </div>
      <div className="login-aside">
        <p className="kicker">CONTROL WITH CONFIDENCE</p>
        <h2>Every decision has a trace.</h2>
        <p>
          Attendance, proof decisions and certificates are connected to an immutable audit trail.
        </p>
        <div className="aside-status">
          <Activity size={16} />
          <span>
            Live operations
            <br />
            <strong>All services operational</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
function StatCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: any;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "metric accent" : "metric"}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function Overview() {
  const token = localStorage.getItem("eventhub_admin_access");
  const isDemo = token === DEMO_ADMIN_TOKEN;
  const { data: fetchedData, isLoading } = useQuery({
    queryKey: ["overview"],
    enabled: !isDemo,
    queryFn: () => api.get("/admin/analytics/overview").then((r) => r.data.data),
  });
  const data = isDemo ? DEMO_ADMIN_OVERVIEW : fetchedData;
  if (isLoading) return <PageLoading />;
  return (
    <div className="page-content">
      <PageTitle
        kicker="OPERATIONS / TODAY"
        title="Good morning, admin."
        subtitle="Here is what needs your attention across the platform."
      />
      <div className="metrics">
        {[
          ["Total events", data?.totalEvents ?? 0, "All lifecycle states"],
          ["Upcoming", data?.upcomingEvents ?? 0, "Published events"],
          ["Registrations", data?.registrations ?? 0, "All participants"],
          ["Pending proofs", data?.pendingProofs ?? 0, "Includes flagged"],
          ["Today’s check-ins", data?.todayCheckins ?? 0, "Live attendance"],
          ["System health", "100%", "All services operational", true],
        ].map((x: any, i) => (
          <StatCard key={i} label={x[0]} value={x[1]} detail={x[2]} accent={x[3]} />
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <PanelTitle
            kicker="ACTIVITY / LAST 30 DAYS"
            title="Participation pulse"
            action="View analytics"
          />
          <ResponsiveContainer width="100%" height={245}>
            <LineChart
              data={[
                { day: "01", registrations: 20, attendance: 12 },
                { day: "05", registrations: 38, attendance: 22 },
                { day: "10", registrations: 32, attendance: 27 },
                { day: "15", registrations: 61, attendance: 44 },
                { day: "20", registrations: 50, attendance: 38 },
                { day: "25", registrations: 78, attendance: 58 },
                { day: "30", registrations: 92, attendance: 71 },
              ]}
            >
              <CartesianGrid stroke="#e8eeeb" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="registrations"
                stroke="#176bff"
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="attendance"
                stroke="#51bd8c"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="legend">
            <span>
              <i className="blue" /> Registrations
            </span>
            <span>
              <i className="green" /> Attendance
            </span>
          </div>
        </section>
        <section className="panel attention">
          <PanelTitle kicker="WORK QUEUE" title="Needs attention" />
          <QueueRow
            icon={<FileCheck2 />}
            title="Proofs to review"
            count={data?.pendingProofs ?? 0}
            detail="manual evidence decisions"
            link="/dashboard/proof-review"
          />
          <QueueRow
            icon={<QrCode />}
            title="Live scanner"
            count={data?.todayCheckins ?? 0}
            detail="check-ins recorded today"
            link="/dashboard/attendance"
          />
        </section>
      </div>
    </div>
  );
}
function QueueRow({
  icon,
  title,
  count,
  detail,
  link,
}: {
  icon: any;
  title: string;
  count: any;
  detail: string;
  link: string;
}) {
  return (
    <Link className="queue-row" to={link}>
      <div className="queue-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <b>{count}</b>
    </Link>
  );
}
function PageTitle({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="page-title">
      <div>
        <p className="kicker">{kicker}</p>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
    </div>
  );
}
function PanelTitle({ kicker, title, action }: { kicker: string; title: string; action?: string }) {
  return (
    <div className="panel-title">
      <div>
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
      </div>
      {action && <Link to="/dashboard/analytics">{action} →</Link>}
    </div>
  );
}
function PageLoading() {
  return (
    <div className="page-content">
      <div className="skeleton large" />
    </div>
  );
}

function EventsPage() {
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    title: "",
    shortDescription: "",
    description: "",
    startAt: "",
    endAt: "",
    registrationStartAt: "",
    registrationEndAt: "",
    capacity: 100,
    mode: "OFFLINE",
  });
  const { data, isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: () => api.get("/admin/events?limit=50").then((r) => r.data),
  });
  const create = useMutation({
    mutationFn: () =>
      api.post("/admin/events", {
        ...form,
        capacity: Number(form.capacity),
        startAt: new Date(form.startAt),
        endAt: new Date(form.endAt),
        registrationStartAt: new Date(form.registrationStartAt),
        registrationEndAt: new Date(form.registrationEndAt),
      }),
    onSuccess: () => {
      setShow(false);
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
  });
  const publish = useMutation({
    mutationFn: (id: string) => api.post(`/admin/events/${id}/publish`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-events"] }),
  });
  return (
    <div className="page-content">
      <div className="page-title">
        <div>
          <p className="kicker">EVENT OPERATIONS</p>
          <h1>Events</h1>
          <p className="muted">Create, publish and steward the full event lifecycle.</p>
        </div>
        <button className="primary" onClick={() => setShow(true)}>
          + Create event
        </button>
      </div>
      <div className="toolbar">
        <div className="admin-search">
          <Search size={16} />
          <input placeholder="Search events" />
        </div>
        <select>
          <option>All statuses</option>
          <option>PUBLISHED</option>
          <option>DRAFT</option>
          <option>COMPLETED</option>
        </select>
        <button className="filter-button">
          Filters <ChevronDown size={14} />
        </button>
      </div>
      <section className="panel table-panel">
        {isLoading ? (
          <PageLoading />
        ) : (
          <table>
            <thead>
              <tr>
                <th>EVENT</th>
                <th>DATE</th>
                <th>STATUS</th>
                <th>REGISTRATIONS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((event: any) => (
                <tr key={event.id}>
                  <td>
                    <div className="table-primary">
                      <span className="table-icon">
                        <CalendarDays size={16} />
                      </span>
                      <span>
                        <strong>{event.title}</strong>
                        <small>{event.organizer?.name || "No organizer"}</small>
                      </span>
                    </div>
                  </td>
                  <td>{event.startAt ? format(new Date(event.startAt), "dd MMM yyyy") : "—"}</td>
                  <td>
                    <Status value={event.status} />
                  </td>
                  <td>
                    {event._count?.registrations ?? 0} / {event.capacity}
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link to={`/dashboard/events/${event.id}`}>View</Link>
                      {event.status === "DRAFT" && (
                        <button onClick={() => publish.mutate(event.id)}>Publish</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {show && (
        <Modal title="Create event" close={() => setShow(false)}>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <label className="span-2">
              Title
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              Short description
              <input
                required
                value={form.shortDescription}
                onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
              />
            </label>
            <label>
              Mode
              <select
                value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value })}
              >
                <option>OFFLINE</option>
                <option>ONLINE</option>
                <option>HYBRID</option>
              </select>
            </label>
            <label className="span-2">
              Description
              <textarea
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <label>
              Start
              <input
                required
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </label>
            <label>
              End
              <input
                required
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              />
            </label>
            <label>
              Registration opens
              <input
                required
                type="datetime-local"
                value={form.registrationStartAt}
                onChange={(e) => setForm({ ...form, registrationStartAt: e.target.value })}
              />
            </label>
            <label>
              Registration closes
              <input
                required
                type="datetime-local"
                value={form.registrationEndAt}
                onChange={(e) => setForm({ ...form, registrationEndAt: e.target.value })}
              />
            </label>
            <label>
              Capacity
              <input
                required
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
              />
            </label>
            <div className="span-2 modal-actions">
              <button type="button" className="secondary" onClick={() => setShow(false)}>
                Cancel
              </button>
              <button className="primary" disabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create draft"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function RegistrationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-registrations"],
    queryFn: () => api.get("/admin/registrations?limit=50").then((r) => r.data),
  });
  return (
    <div className="page-content">
      <PageTitle
        kicker="PARTICIPANTS"
        title="Registrations"
        subtitle="Search and manage every participant across events."
      />
      <Toolbar />
      <section className="panel table-panel">
        {isLoading ? (
          <PageLoading />
        ) : (
          <table>
            <thead>
              <tr>
                <th>PARTICIPANT</th>
                <th>EVENT</th>
                <th>REGISTRATION</th>
                <th>STATUS</th>
                <th>ATTENDANCE</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((row: any) => (
                <tr key={row.id}>
                  <td>
                    <div className="person">
                      <div className="mini-avatar">
                        {row.user.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <span>
                        <strong>{row.user.fullName}</strong>
                        <small>{row.user.email}</small>
                      </span>
                    </div>
                  </td>
                  <td>{row.event.title}</td>
                  <td className="mono">{row.registrationNumber}</td>
                  <td>
                    <Status value={row.status} />
                  </td>
                  <td>
                    <Status value={row.attendance?.status || "NOT_MARKED"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
function Toolbar() {
  return (
    <div className="toolbar">
      <div className="admin-search">
        <Search size={16} />
        <input placeholder="Search by participant, email or registration" />
      </div>
      <select>
        <option>All statuses</option>
        <option>CONFIRMED</option>
        <option>WAITLISTED</option>
        <option>CHECKED_IN</option>
      </select>
      <button className="filter-button">
        Filter <ChevronDown size={14} />
      </button>
    </div>
  );
}
function Status({ value }: { value: string }) {
  return <span className={`status ${value?.toLowerCase()}`}>{value?.replaceAll("_", " ")}</span>;
}

function AttendancePage() {
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<"check-in" | "check-out">("check-in");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () => api.post(`/admin/attendance/${mode}`, { token }),
    onSuccess: (r) => {
      setResult(r.data.data);
      setError("");
      setToken("");
    },
    onError: (e: any) => setError(e.response?.data?.message || "Could not process ticket"),
  });
  return (
    <div className="page-content">
      <PageTitle
        kicker="LIVE OPERATIONS"
        title="Attendance scanner"
        subtitle="Validate secure QR tickets and keep attendance evidence precise."
      />
      <div className="scanner-layout">
        <section className="panel scanner-panel">
          <div className="scanner-frame">
            <QrCode size={64} />
            <span>QR CAMERA READY</span>
            <small>
              Camera scanning can be enabled with the ZXing adapter; use ticket token input for
              kiosk fallback.
            </small>
          </div>
          <div className="scan-switch">
            <button
              className={mode === "check-in" ? "active" : ""}
              onClick={() => setMode("check-in")}
            >
              Check in
            </button>
            <button
              className={mode === "check-out" ? "active" : ""}
              onClick={() => setMode("check-out")}
            >
              Check out
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <label>
              Ticket token
              <input
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste or scan the opaque ticket token"
              />
            </label>
            {error && <p className="error-text">{error}</p>}
            <button className="primary wide" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Validating…"
                : mode === "check-in"
                  ? "Record check-in"
                  : "Record check-out"}
            </button>
          </form>
        </section>
        <section className="panel scan-result">
          {result ? (
            <>
              <div className="success-icon">
                <CheckCircle2 />
              </div>
              <p className="kicker">{mode.toUpperCase()} RECORDED</p>
              <h2>{result.participant?.fullName}</h2>
              <p className="muted">{result.participant?.email}</p>
              <div className="result-detail">
                <span>Attendance status</span>
                <Status value={result.attendance?.status} />
              </div>
              <div className="result-detail">
                <span>Registration</span>
                <strong>Verified secure ticket</strong>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <QrCode />
              <h3>Ready for the next participant</h3>
              <p>Scan a ticket to see the participant record and attendance result here.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ProofPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["proof-review"],
    queryFn: () => api.get("/admin/proofs?limit=50").then((r) => r.data),
  });
  const review = useMutation({
    mutationFn: (x: { id: string; status: string }) =>
      api.post(`/admin/proofs/${x.id}/${x.status}`, { metadata: { reviewer: "manual" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proof-review"] }),
  });
  return (
    <div className="page-content">
      <PageTitle
        kicker="EVIDENCE REVIEW"
        title="Proof review"
        subtitle="Use attendance, roster and manual context alongside uploaded evidence."
      />
      <Toolbar />
      <section className="panel table-panel">
        <table>
          <thead>
            <tr>
              <th>FILE</th>
              <th>PARTICIPANT</th>
              <th>CHECKSUM</th>
              <th>STATUS</th>
              <th>DECISION</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading &&
              data?.data?.map((row: any) => (
                <tr key={row.id}>
                  <td>
                    <div className="file-cell">
                      <FileText size={17} />
                      <span>
                        <strong>{row.originalFileName}</strong>
                        <small>
                          {row.mimeType} · {Math.round(row.fileSize / 1024)} KB
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>
                    {row.user.fullName}
                    <small className="block-muted">{row.event.title}</small>
                  </td>
                  <td className="mono checksum">{row.checksum.slice(0, 16)}…</td>
                  <td>
                    <Status value={row.verificationStatus} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="approve"
                        onClick={() => review.mutate({ id: row.id, status: "verify" })}
                      >
                        <Check size={14} /> Verify
                      </button>
                      <button
                        className="reject"
                        onClick={() => review.mutate({ id: row.id, status: "flag" })}
                      >
                        <X size={14} /> Flag
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function CertificatesPage() {
  const { data: events } = useQuery({
    queryKey: ["cert-events"],
    queryFn: () => api.get("/admin/events?limit=100").then((r) => r.data.data),
  });
  const [eventId, setEventId] = useState("");
  const [result, setResult] = useState<any>(null);
  const generate = useMutation({
    mutationFn: () => api.post(`/admin/events/${eventId}/certificates/generate`),
    onSuccess: (r) => setResult(r.data.data),
  });
  return (
    <div className="page-content">
      <PageTitle
        kicker="CREDENTIALS"
        title="Certificates"
        subtitle="Generate signed, publicly verifiable certificates for eligible attendance."
      />
      <section className="panel certificate-generator">
        <div className="generator-icon">
          <CheckCircle2 />
        </div>
        <div>
          <p className="kicker">EVENT COMPLETION</p>
          <h2>Generate eligible certificates</h2>
          <p className="muted">
            Only participants with finalized PRESENT attendance are included. Generation is
            idempotent.
          </p>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">Select a completed event</option>
            {events?.map((e: any) => (
              <option value={e.id} key={e.id}>
                {e.title} · {e.status}
              </option>
            ))}
          </select>
          <button
            className="primary"
            disabled={!eventId || generate.isPending}
            onClick={() => generate.mutate()}
          >
            {generate.isPending ? "Generating…" : "Generate certificates"}
          </button>
          {result && <p className="success-text">{result.length} certificates ready.</p>}
        </div>
      </section>
    </div>
  );
}

function UsersPage() {
  const { data } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get("/admin/users?limit=50").then((r) => r.data),
  });
  return (
    <div className="page-content">
      <PageTitle
        kicker="IDENTITY & ACCESS"
        title="Users"
        subtitle="Manage active accounts and inspect database-driven roles."
      />
      <Toolbar />
      <section className="panel table-panel">
        <table>
          <thead>
            <tr>
              <th>USER</th>
              <th>DEPARTMENT</th>
              <th>ROLES</th>
              <th>CREATED</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((u: any) => (
              <tr key={u.id}>
                <td>
                  <div className="person">
                    <div className="mini-avatar">{u.fullName.slice(0, 2).toUpperCase()}</div>
                    <span>
                      <strong>{u.fullName}</strong>
                      <small>{u.email}</small>
                    </span>
                  </div>
                </td>
                <td>{u.department || "—"}</td>
                <td>
                  <div className="role-pills">
                    {u.roles.map((r: any) => (
                      <span key={r.role.id}>{r.role.name}</span>
                    ))}
                  </div>
                </td>
                <td>{format(new Date(u.createdAt), "dd MMM yyyy")}</td>
                <td>
                  <Status value={u.isActive ? "ACTIVE" : "INACTIVE"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function AnalyticsPage() {
  const { data } = useQuery({
    queryKey: ["overview"],
    queryFn: () => api.get("/admin/analytics/overview").then((r) => r.data.data),
  });
  return (
    <div className="page-content">
      <PageTitle
        kicker="REPORTING & INSIGHT"
        title="Analytics"
        subtitle="Operational signals across events, attendance and evidence."
      />
      <div className="metrics">
        <StatCard label="Registrations" value={data?.registrations ?? 0} detail="All time" />
        <StatCard label="Attendance rate" value="—" detail="Derived per event" />
        <StatCard
          label="Proof queue"
          value={data?.pendingProofs ?? 0}
          detail="Needs human review"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <PanelTitle kicker="MONTHLY TREND" title="Registration volume" />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={[
                { month: "Jan", value: 42 },
                { month: "Feb", value: 70 },
                { month: "Mar", value: 52 },
                { month: "Apr", value: 94 },
                { month: "May", value: 86 },
                { month: "Jun", value: 118 },
              ]}
            >
              <CartesianGrid stroke="#e8eeeb" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#176bff" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel">
          <PanelTitle kicker="PARTICIPATION SIGNAL" title="What to watch" />
          <div className="signal">
            <span className="signal-dot green" />
            <div>
              <strong>Evidence-first verification</strong>
              <p>QR attendance is the strongest signal for verified participation.</p>
            </div>
          </div>
          <div className="signal">
            <span className="signal-dot orange" />
            <div>
              <strong>Manual proof review</strong>
              <p>AI results are risk signals; reviewers retain final control.</p>
            </div>
          </div>
          <div className="signal">
            <span className="signal-dot blue" />
            <div>
              <strong>Capacity safety</strong>
              <p>Registration allocation is transactionally serialized.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
function ReportsPage() {
  const download = () => {
    window.open(
      `${import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1"}/admin/reports/registrations`,
      "_blank",
    );
  };
  return (
    <div className="page-content">
      <PageTitle
        kicker="EXPORT CENTER"
        title="Reports"
        subtitle="Download operational data for institutional reporting."
      />
      <div className="report-grid">
        {[
          ["Event report", "Lifecycle, dates, capacity and organizers", CalendarDays],
          ["Registration report", "Participant status and attendance evidence", ClipboardCheck],
          ["Attendance report", "Check-in, check-out and duration", QrCode],
          ["Proof report", "Checksums and manual decisions", FileCheck2],
          ["Certificate report", "Issued and revoked credentials", CheckCircle2],
        ].map(([title, desc, Icon]: any) => (
          <div className="report-card" key={title}>
            <div className="report-icon">
              <Icon />
            </div>
            <h3>{title}</h3>
            <p>{desc}</p>
            <div>
              <button className="secondary" onClick={download}>
                CSV
              </button>
              <button className="secondary disabled" disabled>
                PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function AuditPage() {
  const { data } = useQuery({
    queryKey: ["audit"],
    queryFn: () => api.get("/admin/audit-logs?limit=50").then((r) => r.data),
  });
  return (
    <div className="page-content">
      <PageTitle
        kicker="IMMUTABLE HISTORY"
        title="Audit logs"
        subtitle="Every sensitive operation is attributed, timestamped and retained."
      />
      <section className="panel table-panel">
        <table>
          <thead>
            <tr>
              <th>ACTION</th>
              <th>ACTOR</th>
              <th>RESOURCE</th>
              <th>TIME</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((row: any) => (
              <tr key={row.id}>
                <td>
                  <span className="action-pill">
                    <Activity size={14} />
                    {row.action}
                  </span>
                </td>
                <td>
                  {row.actor?.fullName || "System"}
                  <small className="block-muted">{row.actor?.email}</small>
                </td>
                <td className="mono">
                  {row.resourceType} {row.resourceId?.slice(0, 8)}
                </td>
                <td>{format(new Date(row.createdAt), "dd MMM yyyy, HH:mm")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
function SettingsPage() {
  return (
    <div className="page-content">
      <PageTitle
        kicker="PLATFORM CONFIGURATION"
        title="Settings"
        subtitle="Environment-backed controls and safe workflow defaults."
      />
      <div className="settings-grid">
        <section className="panel">
          <PanelTitle kicker="ATTENDANCE" title="Verification policy" />
          <div className="setting-row">
            <div>
              <strong>Minimum attendance percentage</strong>
              <p>Events default to 75% for PRESENT status.</p>
            </div>
            <input value="75" readOnly />
          </div>
          <div className="setting-row">
            <div>
              <strong>Location validation</strong>
              <p>Calculated on the backend when event coordinates are configured.</p>
            </div>
            <span className="status active">AVAILABLE</span>
          </div>
        </section>
        <section className="panel">
          <PanelTitle kicker="STORAGE" title="File providers" />
          <div className="setting-row">
            <div>
              <strong>Provider abstraction</strong>
              <p>
                Local development storage is active. S3-compatible storage is configurable by
                environment.
              </p>
            </div>
            <span className="status active">CONFIGURED</span>
          </div>
          <div className="setting-row">
            <div>
              <strong>Proof access</strong>
              <p>Proofs and certificates are stored as private objects by default.</p>
            </div>
            <span className="status active">PRIVATE</span>
          </div>
        </section>
      </div>
    </div>
  );
}
function Modal({ title, close, children }: { title: string; close: () => void; children: any }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal">
        <div className="modal-head">
          <h2>{title}</h2>
          <button onClick={close}>
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  useLocation();
  const token = localStorage.getItem("eventhub_admin_access");
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/dashboard" /> : <AdminLoginPage />} />
      <Route element={token ? <AdminShell /> : <Navigate to="/login" />}>
        <Route path="/dashboard" element={<DashboardOverviewPage />} />
        <Route path="/dashboard/events" element={<EventManagementPage />} />
        <Route path="/dashboard/events/:id" element={<EventDetailsPage />} />
        <Route path="/dashboard/registrations" element={<RegistrationManagementPage />} />
        <Route path="/dashboard/attendance" element={<AttendanceManagementPage />} />
        <Route path="/dashboard/proof-review" element={<ProofReviewPage />} />
        <Route path="/dashboard/certificates" element={<CertificateManagementPage />} />
        <Route path="/dashboard/users" element={<UserManagementPage />} />
        <Route path="/dashboard/analytics" element={<AnalyticsDashboardPage />} />
        <Route path="/dashboard/reports" element={<ReportsRoutePage />} />
        <Route path="/dashboard/audit-logs" element={<AuditLogsPage />} />
        <Route path="/dashboard/settings" element={<SettingsRoutePage />} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Route>
    </Routes>
  );
}

export {
  AdminLogin as AdminLoginPageView,
  Overview as DashboardOverviewPageView,
  EventsPage as EventManagementPageView,
  RegistrationsPage as RegistrationManagementPageView,
  AttendancePage as AttendanceManagementPageView,
  ProofPage as ProofReviewPageView,
  CertificatesPage as CertificateManagementPageView,
  UsersPage as UserManagementPageView,
  AnalyticsPage as AnalyticsDashboardPageView,
  ReportsPage as ReportsPageView,
  AuditPage as AuditLogsPageView,
  SettingsPage as SettingsPageView,
};
