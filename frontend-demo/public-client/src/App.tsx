import { createContext, useContext, useState } from "react";
import {
  Link,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
  Navigate,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  LogIn,
  LogOut,
  Menu,
  QrCode,
  Search,
  ShieldCheck,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import api from "./api/client";
import HomePage from "./pages/HomePage";
import EventsPage from "./pages/EventsPage";
import EventDetailsPage from "./pages/EventDetailsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyCertificatePage from "./pages/VerifyCertificatePage";
import DashboardPage from "./pages/DashboardPage";

const DEMO_PUBLIC_EMAIL = "demo.user@eventhub.local";
const DEMO_PUBLIC_PASSWORD = "DemoUser123!";
const DEMO_PUBLIC_TOKEN = "demo-public-session";
const DEMO_PUBLIC_PROFILE = {
  fullName: "Demo Student",
  email: DEMO_PUBLIC_EMAIL,
  roles: ["STUDENT"],
};
const DEMO_PUBLIC_REGISTRATIONS = {
  pagination: { total: 2 },
  data: [
    {
      id: "demo-registration-1",
      status: "CONFIRMED",
      event: {
        title: "Campus Innovation Summit",
        startAt: "2026-09-12T09:00:00.000Z",
        venueName: "Main Auditorium",
      },
    },
    {
      id: "demo-registration-2",
      status: "CONFIRMED",
      event: {
        title: "Design Thinking Workshop",
        startAt: "2026-09-20T10:00:00.000Z",
        venueName: "Innovation Lab",
      },
    },
  ],
};

type EventRecord = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  bannerUrl?: string;
  startAt: string;
  endAt: string;
  venueName?: string;
  city?: string;
  mode: string;
  capacity: number;
  availableSeats?: number;
  category?: { name: string };
  organizer?: { name: string };
  _count?: { registrations: number };
};

type AuthContextValue = {
  signedIn: boolean;
  signingOut: boolean;
  setSignedIn: (signedIn: boolean) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside the application shell");
  return context;
}

const money = (value: string | undefined) =>
  value ? format(new Date(value), "EEE, dd MMM yyyy") : "Date to be announced";

async function openProtectedFile(url: string) {
  const popup = window.open("about:blank", "_blank");
  if (!popup) throw new Error("Allow pop-ups to open this file.");
  const target = new URL(url, window.location.origin);
  if (!target.pathname.startsWith("/api/v1/files")) {
    popup.location.href = target.toString();
    return;
  }
  const apiPath = `${target.pathname.replace(/^\/api\/v1/, "")}${target.search}`;
  const response = await api.get(apiPath, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(response.data);
  popup.location.href = blobUrl;
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

function Shell() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(() => Boolean(localStorage.getItem("eventhub_access")));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const logout = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSettled: () => {
      localStorage.removeItem("eventhub_access");
      setSignedIn(false);
      ["home-me", "home-registrations", "home-certificates", "me", "my-registrations"].forEach(
        (queryKey) => queryClient.removeQueries({ queryKey: [queryKey] }),
      );
      navigate("/");
    },
  });
  const authValue = {
    signedIn,
    signingOut: logout.isPending,
    setSignedIn,
    signOut: () => logout.mutate(),
  };
  return (
    <AuthContext.Provider value={authValue}>
      <>
        <header className="site-header">
          <div className="container nav">
            <Link to="/" className="brand">
              <span className="brand-mark">E</span>
              <span>
                Event<span>Hub</span>
              </span>
            </Link>
            <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Toggle menu">
              {open ? <X /> : <Menu />}
            </button>
            <nav className={open ? "nav-links open" : "nav-links"}>
              <Link to="/events">Explore events</Link>
              <Link to="/verify-certificate">Verify certificate</Link>
              {signedIn ? (
                <>
                  <Link to="/dashboard">My workspace</Link>
                  <button
                    type="button"
                    className="nav-signout"
                    onClick={() => logout.mutate()}
                    disabled={logout.isPending}
                  >
                    {logout.isPending ? "Signing out…" : "Sign out"} <LogOut size={15} />
                  </button>
                </>
              ) : (
                <Link to="/login" className="button button-small">
                  Sign in <LogIn size={15} />
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
        <footer className="footer">
          <div className="container footer-grid">
            <div>
              <div className="brand">
                <span className="brand-mark">E</span>
                <span>EventHub</span>
              </div>
              <p>One trusted place for campus events, attendance, proof and certificates.</p>
            </div>
            <div>
              <strong>Discover</strong>
              <Link to="/events">All events</Link>
              <Link to="/verify-certificate">Certificate verification</Link>
            </div>
            <div>
              <strong>Account</strong>
              <Link to="/login">Sign in</Link>
              <Link to="/register">Create account</Link>
            </div>
          </div>
        </footer>
      </>
    </AuthContext.Provider>
  );
}

function Home() {
  const { signedIn, signOut, signingOut } = useAuth();
  const token = signedIn;
  const { data, isLoading } = useQuery({
    queryKey: ["events", "home"],
    queryFn: () => api.get("/events?limit=6&sort=upcoming").then((r) => r.data),
  });
  const { data: me } = useQuery({
    queryKey: ["home-me"],
    enabled: Boolean(token),
    queryFn: () => api.get("/auth/me").then((r) => r.data.data),
  });
  const { data: registrations } = useQuery({
    queryKey: ["home-registrations"],
    enabled: Boolean(token),
    queryFn: () => api.get("/registrations/me?limit=5").then((r) => r.data),
  });
  const { data: certificates } = useQuery({
    queryKey: ["home-certificates"],
    enabled: Boolean(token),
    queryFn: () => api.get("/certificates/me").then((r) => r.data.data),
  });
  const nextRegistration = registrations?.data?.find(
    (registration: any) => registration.event?.startAt,
  );
  const verifiedEvents = registrations?.data?.filter(
    (registration: any) => registration.attendance?.status === "PRESENT",
  ).length;
  const initials = me?.fullName
    ? me.fullName
        .split(" ")
        .slice(0, 2)
        .map((part: string) => part[0])
        .join("")
        .toUpperCase()
    : "?";
  return (
    <div>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">THE CAMPUS PARTICIPATION PLATFORM</p>
            <h1>
              Show up for what <em>matters.</em>
            </h1>
            <p className="hero-copy">
              Discover meaningful events, secure your seat, verify attendance and receive every
              certificate in one trusted workspace.
            </p>
            <div className="hero-actions">
              <Link to="/events" className="button">
                Explore upcoming events <ChevronRight size={17} />
              </Link>
              {signedIn ? (
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={signOut}
                  disabled={signingOut}
                >
                  {signingOut ? "Signing out…" : "Sign out"} <LogOut size={16} />
                </button>
              ) : (
                <Link to="/login" className="button button-ghost">
                  Sign in <LogIn size={16} />
                </Link>
              )}
              <Link to="/register" className="button button-ghost">
                Create your profile
              </Link>
            </div>
            <div className="trust-row">
              <ShieldCheck size={16} />
              <span>Attendance evidence is verified at the source</span>
            </div>
          </div>
          <div className="hero-card">
            <div className="hero-card-top">
              <span className="live-dot"></span>
              <span>YOUR PARTICIPATION PASSPORT</span>
              <QrCode size={22} />
            </div>
            <div className="passport-line">
              <div className="avatar">{initials}</div>
              <div>
                <strong>{me?.fullName || "Your passport"}</strong>
                <small>
                  {me
                    ? [me.department, me.year ? `Year ${me.year}` : undefined]
                        .filter(Boolean)
                        .join(" · ") || "Participation profile"
                    : "Sign in to view your records"}
                </small>
              </div>
            </div>
            <div className="passport-stats">
              <span>
                <strong>{token ? (registrations?.pagination?.total ?? "-") : "-"}</strong>
                <small>registrations</small>
              </span>
              <span>
                <strong>{token ? (certificates?.length ?? "-") : "-"}</strong>
                <small>certificates</small>
              </span>
              <span>
                <strong>{token && verifiedEvents ? verifiedEvents : "-"}</strong>
                <small>verified events</small>
              </span>
            </div>
            <div className="passport-event">
              <CalendarDays size={17} />
              <div>
                <small>{token ? "NEXT UP" : "GET STARTED"}</small>
                <strong>
                  {nextRegistration?.event?.title ||
                    (token ? "No upcoming registrations" : "Sign in to view your events")}
                </strong>
              </div>
              {nextRegistration && <CheckCircle2 className="check" size={18} />}
            </div>
          </div>
        </div>
      </section>
      <section className="section container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FIND YOUR NEXT EXPERIENCE</p>
            <h2>What’s happening</h2>
          </div>
          <Link to="/events" className="text-link">
            View all events <ChevronRight size={16} />
          </Link>
        </div>
        {isLoading ? (
          <div className="skeleton-grid">
            {[1, 2, 3].map((i) => (
              <div className="skeleton" key={i} />
            ))}
          </div>
        ) : data?.data?.length ? (
          <div className="event-grid">
            {data.data.map((event: EventRecord) => (
              <EventCard event={event} key={event.id} />
            ))}
          </div>
        ) : (
          <Empty text="No upcoming events are published yet." />
        )}
      </section>
      <section className="dark-band">
        <div className="container three-points">
          <div>
            <span className="point-number">01</span>
            <h3>Find your room</h3>
            <p>Search events by interest, department, date or mode.</p>
          </div>
          <div>
            <span className="point-number">02</span>
            <h3>Show up with proof</h3>
            <p>Your QR ticket and attendance timeline keep participation clear.</p>
          </div>
          <div>
            <span className="point-number">03</span>
            <h3>Keep the record</h3>
            <p>Attendance records, proof decisions and certificates stay in your workspace.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function EventCard({ event }: { event: EventRecord }) {
  return (
    <Link to={`/events/${event.slug}`} className="event-card">
      <div
        className="event-image"
        style={{
          backgroundImage: `url(${event.bannerUrl || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=900&q=80"})`,
        }}
      >
        <span className="pill">{event.category?.name || "Campus event"}</span>
        <span className="date-badge">
          <strong>{event.startAt ? format(new Date(event.startAt), "dd") : "—"}</strong>
          <small>{event.startAt ? format(new Date(event.startAt), "MMM") : ""}</small>
        </span>
      </div>
      <div className="event-content">
        <h3>{event.title}</h3>
        <p>{event.shortDescription}</p>
        <div className="event-meta">
          <span>
            <CalendarDays size={14} />
            {money(event.startAt)}
          </span>
          <span>
            <Clock3 size={14} />
            {event.venueName || event.mode}
          </span>
        </div>
        <div className="card-footer">
          <span>{event.availableSeats ?? event.capacity} seats available</span>
          <ChevronRight size={18} />
        </div>
      </div>
    </Link>
  );
}

function Events() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["events", search],
    queryFn: () =>
      api.get(`/events?limit=20&search=${encodeURIComponent(search)}`).then((r) => r.data),
  });
  return (
    <div className="page container">
      <div className="page-intro">
        <p className="eyebrow">DISCOVER</p>
        <h1>Find your next event</h1>
        <p>Talks, workshops, competitions and experiences worth showing up for.</p>
      </div>
      <div className="search-row">
        <div className="search-box">
          <Search size={19} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, topics or cities"
          />
        </div>
        <select aria-label="Sort events">
          <option>Upcoming first</option>
          <option>Newest</option>
          <option>Closing soon</option>
        </select>
      </div>
      {isLoading ? (
        <div className="skeleton-grid">
          {[1, 2, 3, 4].map((i) => (
            <div className="skeleton" key={i} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState />
      ) : data?.data?.length ? (
        <div className="event-grid">
          {data.data.map((event: EventRecord) => (
            <EventCard event={event} key={event.id} />
          ))}
        </div>
      ) : (
        <Empty text="No events match that search." />
      )}
    </div>
  );
}

function EventDetails() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["event", slug],
    queryFn: () => api.get(`/events/${slug}`).then((r) => r.data.data),
  });
  const mutation = useMutation({
    mutationFn: () => api.post(`/events/${data.id}/register`, { answers: {} }),
    onSuccess: (r) =>
      navigate(
        `/dashboard/tickets?registration=${r.data.data.registrationId}&token=${r.data.data.ticketToken || ""}`,
      ),
  });
  if (isLoading)
    return (
      <div className="container page">
        <div className="skeleton wide" />
      </div>
    );
  if (isError || !data)
    return (
      <div className="container page">
        <ErrorState />
      </div>
    );
  return (
    <div className="event-detail">
      <div
        className="detail-cover"
        style={{
          backgroundImage: `url(${data.bannerUrl || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80"})`,
        }}
      >
        <div className="container detail-cover-inner">
          <Link to="/events" className="back-link">
            ← Back to events
          </Link>
          <span className="pill">{data.category?.name || "Campus event"}</span>
          <h1>{data.title}</h1>
        </div>
      </div>
      <div className="container detail-layout">
        <article>
          <p className="lead">{data.shortDescription}</p>
          <div className="rich-copy">
            <h2>About this event</h2>
            <p>{data.description}</p>
            <h2>What to expect</h2>
            <p>
              Bring your curiosity and your student ID. Your QR ticket is the secure key for entry
              and attendance verification.
            </p>
          </div>
        </article>
        <aside className="register-card">
          <div className="register-card-row">
            <CalendarDays />
            <div>
              <small>WHEN</small>
              <strong>{money(data.startAt)}</strong>
              <span>
                {format(new Date(data.startAt), "p")} – {format(new Date(data.endAt), "p")}
              </span>
            </div>
          </div>
          <div className="register-card-row">
            <Ticket />
            <div>
              <small>WHERE</small>
              <strong>{data.venueName || data.mode}</strong>
              <span>{data.city || "Online experience"}</span>
            </div>
          </div>
          <div className="register-card-row">
            <UserRound />
            <div>
              <small>ORGANIZED BY</small>
              <strong>{data.organizer?.name || "EventHub"}</strong>
              <span>{data.availableSeats ?? data.capacity} seats remaining</span>
            </div>
          </div>
          <button
            className="button full"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Securing your seat…" : "Register for this event"}
          </button>
          {mutation.isError && (
            <p className="form-error">
              {(mutation.error as any)?.response?.data?.message ||
                "Please sign in before registering."}
            </p>
          )}
          <p className="fine-print">
            By registering, you agree to the event rules and attendance policy.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Auth({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const { setSignedIn } = useAuth();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: mode === "login" ? DEMO_PUBLIC_EMAIL : "",
    password: mode === "login" ? DEMO_PUBLIC_PASSWORD : "",
    confirmPassword: "",
    fullName: "",
    department: "",
    enrollmentNumber: "",
  });
  const mutation = useMutation({
    mutationFn: () => {
      if (
        mode === "login" &&
        form.email.trim().toLowerCase() === DEMO_PUBLIC_EMAIL &&
        form.password === DEMO_PUBLIC_PASSWORD
      ) {
        return Promise.resolve({ data: { data: { accessToken: DEMO_PUBLIC_TOKEN } } });
      }
      return api.post(
        `/auth/${mode}`,
        mode === "login" ? { email: form.email, password: form.password } : form,
      );
    },
    onSuccess: (r) => {
      if (mode === "login") {
        localStorage.setItem("eventhub_access", r.data.data.accessToken);
        setSignedIn(true);
        navigate("/dashboard");
      } else navigate("/login?registered=1");
    },
    onError: (e: any) => setError(e.response?.data?.message || "Something went wrong"),
  });
  return (
    <div className="auth-page">
      <div className="auth-panel">
        <Link to="/" className="brand">
          <span className="brand-mark">E</span>
          <span>EventHub</span>
        </Link>
        <p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "JOIN THE COMMUNITY"}</p>
        <h1>
          {mode === "login" ? "Your next experience is waiting." : "Make your participation count."}
        </h1>
        <p>
          {mode === "login"
            ? "Sign in to manage tickets, attendance records and certificates."
            : "Create one secure profile for every event, attendance record and certificate."}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            mutation.mutate();
          }}
        >
          {mode === "register" && (
            <>
              <label>
                Full name
                <input
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
              </label>
              <label>
                Department
                <input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </label>
              <label>
                Enrollment number
                <input
                  value={form.enrollmentNumber}
                  onChange={(e) => setForm({ ...form, enrollmentNumber: e.target.value })}
                />
              </label>
            </>
          )}
          <label>
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Password
            <input
              required
              minLength={8}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          {mode === "register" && (
            <label>
              Confirm password
              <input
                required
                minLength={8}
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              />
            </label>
          )}
          {error && <p className="form-error">{error}</p>}
          <button className="button full" disabled={mutation.isPending}>
            {mutation.isPending ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="switch-auth">
          {mode === "login" ? (
            <>
              New here? <Link to="/register">Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link to="/login">Sign in</Link>
            </>
          )}
        </p>
      </div>
      <div className="auth-art">
        <span className="eyebrow">EVENTHUB / 2026</span>
        <blockquote>“The best record of an event is the change it makes in you.”</blockquote>
        <div className="art-stamp">
          <CheckCircle2 size={17} /> Verified participation, built in
        </div>
      </div>
    </div>
  );
}

function VerifyCertificate() {
  const [number, setNumber] = useState("");
  const [submitted, setSubmitted] = useState("");
  const { data, isFetching } = useQuery({
    queryKey: ["certificate", submitted],
    enabled: Boolean(submitted),
    queryFn: () =>
      api.get(`/certificates/verify/${encodeURIComponent(submitted)}`).then((r) => r.data.data),
  });
  return (
    <div className="container page narrow">
      <div className="center-intro">
        <span className="icon-circle">
          <ShieldCheck />
        </span>
        <p className="eyebrow">PUBLIC VERIFICATION</p>
        <h1>Verify a certificate</h1>
        <p>Confirm the authenticity of an EventHub certificate using its certificate number.</p>
      </div>
      <form
        className="verify-form"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(number.trim());
        }}
      >
        <label>
          Certificate number
          <input
            required
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="CERT-EVT-2026-000001"
          />
        </label>
        <button className="button full">{isFetching ? "Checking…" : "Verify certificate"}</button>
      </form>
      {data && (
        <div className={data.valid ? "verification-result valid" : "verification-result invalid"}>
          {data.valid ? (
            <>
              <CheckCircle2 />
              <div>
                <strong>Valid certificate</strong>
                <p>
                  {data.certificate.participant} participated in {data.certificate.event}.
                </p>
                <small>Issued {format(new Date(data.certificate.issuedAt), "dd MMM yyyy")}</small>
              </div>
            </>
          ) : (
            <>
              <X />
              <div>
                <strong>Certificate not found</strong>
                <p>Check the number and try again.</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const { section = "overview" } = useParams<{ section?: string }>();
  const { signOut, signingOut } = useAuth();
  const [sidebar, setSidebar] = useState(false);
  const token = localStorage.getItem("eventhub_access");
  const isDemo = token === DEMO_PUBLIC_TOKEN;
  const { data: fetchedMe, isError: meError } = useQuery({
    queryKey: ["me"],
    enabled: Boolean(token) && !isDemo,
    queryFn: () => api.get("/auth/me").then((r) => r.data.data),
  });
  const { data: fetchedRegs } = useQuery({
    queryKey: ["my-registrations"],
    enabled: Boolean(token) && !isDemo,
    queryFn: () => api.get("/registrations/me?limit=5").then((r) => r.data),
  });
  const me = isDemo ? DEMO_PUBLIC_PROFILE : fetchedMe;
  const regs = isDemo ? DEMO_PUBLIC_REGISTRATIONS : fetchedRegs;
  if (!token || (!isDemo && meError)) return <Navigate to="/login" replace />;
  if (!me) return <div className="loading-screen">Loading your workspace…</div>;
  const links = [
    { id: "overview", label: "Overview", icon: <CalendarDays />, to: "/dashboard" },
    { id: "events", label: "My events", icon: <Ticket />, to: "/dashboard/events" },
    { id: "tickets", label: "Tickets & QR", icon: <QrCode />, to: "/dashboard/tickets" },
    {
      id: "certificates",
      label: "Certificates",
      icon: <CheckCircle2 />,
      to: "/dashboard/certificates",
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <Clock3 />,
      to: "/dashboard/notifications",
    },
  ];
  return (
    <div className="dashboard-shell">
      <aside className={sidebar ? "dashboard-side open" : "dashboard-side"}>
        <div className="dash-brand">
          <Link to="/">
            <span className="brand-mark">E</span> EventHub
          </Link>
          <button onClick={() => setSidebar(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="user-chip">
          <div className="avatar">{me.fullName.slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{me.fullName}</strong>
            <small>{me.roles?.[0] || "Student"}</small>
          </div>
        </div>
        <nav>
          {links.map((link) => (
            <Link
              key={link.id}
              className={section === link.id ? "active" : ""}
              to={link.to}
              onClick={() => setSidebar(false)}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </nav>
        <button className="dash-logout" onClick={signOut} disabled={signingOut}>
          <LogOut size={16} /> {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </aside>
      <section className="dashboard-main">
        <div className="dash-top">
          <button className="mobile-menu" onClick={() => setSidebar(true)}>
            <Menu />
          </button>
          <div>
            <p className="eyebrow">MY WORKSPACE</p>
            <h1>{links.find((l) => l.id === section)?.label || "Overview"}</h1>
          </div>
          <Link to="/events" className="button button-small">
            Explore events <ChevronRight size={15} />
          </Link>
        </div>
        {section === "overview" && (
          <>
            <div className="stat-grid">
              <div className="stat-card">
                <small>Registrations</small>
                <strong>{regs?.pagination?.total ?? 0}</strong>
                <span>Across all events</span>
              </div>
              <div className="stat-card">
                <small>Certificates</small>
                <strong>—</strong>
                <span>Keep participating</span>
              </div>
              <div className="stat-card accent">
                <small>Verification status</small>
                <strong>Secure</strong>
                <span>Evidence-first records</span>
              </div>
            </div>
            <div className="dash-columns">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">UP NEXT</p>
                    <h2>Registered events</h2>
                  </div>
                  <Link to="/dashboard/events">See all</Link>
                </div>
                {regs?.data?.length ? (
                  regs.data.slice(0, 3).map((r: any) => (
                    <div className="list-row" key={r.id}>
                      <div className="list-icon">
                        <CalendarDays size={17} />
                      </div>
                      <div>
                        <strong>{r.event.title}</strong>
                        <small>
                          {money(r.event.startAt)} · {r.event.venueName || "Online"}
                        </small>
                      </div>
                      <span className={`status ${String(r.status).toLowerCase()}`}>{r.status}</span>
                    </div>
                  ))
                ) : (
                  <Empty text="Register for your first event to see it here." />
                )}
              </section>
            </div>
          </>
        )}
        {section !== "overview" && <SectionContent section={section} />}
      </section>
    </div>
  );
}

function SectionContent({ section }: { section: string }) {
  const [params] = useSearchParams();
  const [ticketToken, setTicketToken] = useState(params.get("token") || "");
  const [openingCertificate, setOpeningCertificate] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  const registrationId = params.get("registration");
  const { data, isLoading } = useQuery({
    queryKey: [section],
    queryFn: () =>
      api
        .get(
          section === "events" || section === "tickets"
            ? "/registrations/me?limit=50"
            : section === "certificates"
              ? "/certificates/me"
              : "/notifications?limit=50",
        )
        .then((r) => r.data),
  });
  const issue = useMutation({
    mutationFn: (id: string) => api.post(`/registrations/${id}/ticket`),
    onSuccess: (r) => setTicketToken(r.data.data.ticketToken),
  });
  const openCertificate = async (id: string, url: string) => {
    setOpeningCertificate(id);
    setFileError("");
    try {
      await openProtectedFile(url);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Unable to open certificate");
    } finally {
      setOpeningCertificate(null);
    }
  };
  if (isLoading)
    return (
      <div className="panel">
        <p>Loading your records…</p>
      </div>
    );
  if (section === "tickets") {
    const selected =
      data?.data?.find((r: any) => r.id === registrationId) ||
      data?.data?.find((r: any) => r.ticket);
    return (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">SECURE ENTRY</p>
            <h2>Your QR tickets</h2>
          </div>
        </div>
        {selected ? (
          <div className="ticket-view">
            <div className="qr-box">
              {ticketToken ? (
                <QRCodeSVG value={ticketToken} size={190} includeMargin />
              ) : (
                <Ticket size={60} />
              )}
            </div>
            <div>
              <strong>{selected.event.title}</strong>
              <p>
                {money(selected.event.startAt)} · {selected.event.venueName || "Online"}
              </p>
              <span className={`status ${selected.status.toLowerCase()}`}>{selected.status}</span>
              {ticketToken ? (
                <small className="ticket-token">
                  Ticket token is shown as a signed QR payload. Do not share it.
                </small>
              ) : selected.status === "CONFIRMED" ? (
                <button
                  className="button button-small ticket-issue"
                  onClick={() => issue.mutate(selected.id)}
                >
                  {issue.isPending ? "Issuing…" : "Show QR ticket"}
                </button>
              ) : (
                <small className="ticket-token">
                  Your ticket will appear when registration is confirmed.
                </small>
              )}
            </div>
          </div>
        ) : (
          <Empty text="Confirmed registrations will appear here with their QR ticket." />
        )}
      </div>
    );
  }
  if (section === "certificates")
    return (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">ACHIEVEMENTS</p>
            <h2>Your certificates</h2>
          </div>
        </div>
        {data?.data?.length ? (
          data.data.map((c: any) => (
            <div className="certificate-row" key={c.id}>
              <div className="certificate-seal">
                <CheckCircle2 />
              </div>
              <div>
                <strong>{c.event.title}</strong>
                <span>{c.certificateNumber}</span>
                <small>Issued {money(c.issuedAt)}</small>
              </div>
              <button
                className="button button-small"
                onClick={() => void openCertificate(c.id, c.certificateUrl)}
                disabled={openingCertificate === c.id}
              >
                <Download size={15} /> {openingCertificate === c.id ? "Opening…" : "Open"}
              </button>
            </div>
          ))
        ) : (
          <Empty text="Certificates appear after verified attendance." />
        )}
        {fileError && <p className="form-error">{fileError}</p>}
      </div>
    );
  const rows = data?.data || [];
  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">YOUR RECORDS</p>
          <h2>{section === "notifications" ? "Notifications" : "Registered events"}</h2>
        </div>
      </div>
      {rows.length ? (
        rows.map((row: any) => (
          <div className="list-row large" key={row.id || row.notification?.id}>
            <div className="list-icon">
              <CalendarDays size={17} />
            </div>
            <div>
              <strong>{row.event?.title || row.notification?.title || "Notification"}</strong>
              <small>
                {row.event?.startAt
                  ? money(row.event.startAt)
                  : row.notification?.message || row.applicationNumber}
              </small>
            </div>
            <span
              className={`status ${String(row.status || (row.readAt ? "read" : "unread")).toLowerCase()}`}
            >
              {row.status || (row.readAt ? "Read" : "Unread")}
            </span>
          </div>
        ))
      ) : (
        <Empty text="Nothing here yet." />
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <span>✦</span>
      <p>{text}</p>
    </div>
  );
}
function ErrorState() {
  return (
    <div className="empty error">
      <span>!</span>
      <p>We couldn’t load this right now. Please try again.</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:slug" element={<EventDetailsPage />} />
        <Route path="/verify-certificate" element={<VerifyCertificatePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/:section" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export {
  Home as HomePageView,
  Events as EventsPageView,
  EventDetails as EventDetailsPageView,
  Auth as AuthPageView,
  VerifyCertificate as VerifyCertificatePageView,
  Dashboard as DashboardPageView,
};
