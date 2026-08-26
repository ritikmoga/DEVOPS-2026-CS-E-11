import $ from "jquery";
import config from "./config.json";
import "./styles.css";

const API_URL = window.EVENTHUB_API_URL || config.apiBaseUrl;
const PUBLIC_APP_URL = window.EVENTHUB_PUBLIC_URL || config.publicAppUrl;
const TOKEN_KEY = "eventhub_admin_access";
const html = String.raw;
let refreshRequest = null;
let renderSequence = 0;

const navItems = [
  ["/dashboard", "Overview", "▦"],
  ["/dashboard/events", "Events", "▣"],
  ["/dashboard/registrations", "Registrations", "✓"],
  ["/dashboard/attendance", "Attendance scanner", "⌗"],
  ["/dashboard/proof-review", "Proof review", "▤"],
  ["/dashboard/certificates", "Certificates", "◉"],
  ["/dashboard/users", "Users", "♙"],
  ["/dashboard/analytics", "Analytics", "▥"],
  ["/dashboard/reports", "Reports", "▧"],
  ["/dashboard/audit-logs", "Audit logs", "◴"],
  ["/dashboard/settings", "Settings", "⚙"],
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function apiError(xhr, fallback = "The request could not be completed.") {
  return xhr?.responseJSON?.message || xhr?.responseJSON?.error || fallback;
}

function rawRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const request = {
    url: `${API_URL}${path}`,
    method: options.method || "GET",
    dataType: options.dataType || "json",
    xhrFields: { withCredentials: true },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };
  if (options.data !== undefined) {
    request.contentType = "application/json";
    request.data = JSON.stringify(options.data);
  }
  return $.ajax(request);
}

async function api(path, options = {}, retry = true) {
  try {
    return await rawRequest(path, options);
  } catch (xhr) {
    if (xhr?.status !== 401 || !retry || path.startsWith("/auth/")) throw xhr;
    refreshRequest ||= Promise.resolve(rawRequest("/auth/refresh", { method: "POST" }))
      .then((payload) => {
        localStorage.setItem(TOKEN_KEY, payload.data.accessToken);
        return payload.data.accessToken;
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        return null;
      })
      .finally(() => {
        refreshRequest = null;
      });
    const token = await refreshRequest;
    if (!token) throw xhr;
    return api(path, options, false);
  }
}

function navigate(path, replace = false) {
  history[replace ? "replaceState" : "pushState"]({}, "", path);
  renderApp();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function loading(message = "Loading admin workspace…") {
  return html`<div class="loading"><span class="spinner"></span>${escapeHtml(message)}</div>`;
}

function errorState(message) {
  return html`<div class="page-content">
    <section class="panel empty-state">
      <b>!</b>
      <h3>Unable to load this view</h3>
      <p>${escapeHtml(message)}</p>
      <button class="secondary" id="retry-page">Try again</button>
    </section>
  </div>`;
}

function status(value) {
  const safe = escapeHtml(value || "UNKNOWN");
  return html`<span class="status ${safe.toLowerCase()}">${safe}</span>`;
}

function pageTitle(kicker, title, subtitle = "", action = "") {
  return html`<div class="page-title">
    <div>
      <p class="kicker">${escapeHtml(kicker)}</p>
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? html`<p class="muted">${escapeHtml(subtitle)}</p>` : ""}
    </div>
    ${action}
  </div>`;
}

function panelTitle(kicker, title, action = "") {
  return html`<div class="panel-title">
    <div>
      <p class="kicker">${escapeHtml(kicker)}</p>
      <h2>${escapeHtml(title)}</h2>
    </div>
    ${action}
  </div>`;
}

function metric(label, value, detail, accent = false) {
  return html`<div class="metric${accent ? " accent" : ""}">
    <span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong
    ><small>${escapeHtml(detail)}</small>
  </div>`;
}

function renderLogin() {
  $("#app").html(
    html`<div class="login-page">
      <div class="login-box">
        <div class="admin-logo">
          <span class="logo-mark">E</span>
          <div><strong>EventHub</strong><small>OPERATIONS CONSOLE</small></div>
        </div>
        <p class="kicker">SECURE ADMIN ACCESS</p>
        <h1>Welcome back.</h1>
        <p class="muted">
          Sign in with an authorized administrator account to manage participation, proof and event
          operations.
        </p>
        <form id="admin-login-form">
          <label
            >Work email<input type="email" name="email" required autocomplete="username" /></label
          ><label
            >Password<input
              type="password"
              name="password"
              required
              autocomplete="current-password"
          /></label>
          <p class="error-text" id="login-error"></p>
          <button class="primary wide">Sign in to console</button>
        </form>
        <a class="back-public" href="${escapeHtml(PUBLIC_APP_URL)}">← Back to public site</a>
      </div>
      <div class="login-aside">
        <p class="kicker">CONTROL WITH CONFIDENCE</p>
        <h2>Every decision has a trace.</h2>
        <p>
          Attendance, proof decisions and certificates are connected to an immutable audit trail.
        </p>
        <div class="aside-status">
          <b>●</b><span>Live operations<br /><strong>All services operational</strong></span>
        </div>
      </div>
    </div>`,
  );
}

function shell(profile, content) {
  const path = location.pathname.replace(/\/+$/, "") || "/dashboard";
  return html`<div class="admin-shell">
    <aside class="admin-side" id="admin-side">
      <div class="admin-logo">
        <span class="logo-mark">E</span>
        <div><strong>EventHub</strong><small>OPERATIONS CONSOLE</small></div>
        <button id="close-menu">×</button>
      </div>
      <div class="admin-user">
        <div class="admin-avatar">${escapeHtml(profile.fullName.slice(0, 2).toUpperCase())}</div>
        <div>
          <strong>${escapeHtml(profile.fullName)}</strong
          ><small>${escapeHtml(profile.roles.join(" · "))}</small>
        </div>
        <span>⌄</span>
      </div>
      <nav>
        ${navItems
          .map(([url, label, icon]) => {
            const active = url === "/dashboard" ? path === url : path.startsWith(url);
            return html`<a href="${url}" data-link class="nav-item${active ? " active" : ""}">
              <b>${icon}</b><span>${label}</span>${label === "Proof review" ? html`<i>4</i>` : ""}
            </a>`;
          })
          .join("")}
      </nav>
      <button class="logout" id="admin-sign-out">↗ Sign out</button>
    </aside>
    <section class="admin-content">
      <header class="admin-top">
        <button class="mobile-toggle" id="open-menu">☰</button>
        <div class="crumb">EVENTHUB <span>/</span> OPERATIONS</div>
        <div class="top-actions">
          <a class="public-site-link" href="${escapeHtml(PUBLIC_APP_URL)}">Public site</a
          ><span>◉</span><span class="online"><i></i> System operational</span>
        </div>
      </header>
      <main id="admin-page">${content}</main>
    </section>
  </div>`;
}

async function getProfile() {
  const profile = (await api("/auth/me")).data;
  if (!profile.roles?.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role))) {
    throw new Error("This account does not have admin access.");
  }
  return profile;
}

async function renderOverview() {
  const data = (await api("/admin/analytics/overview")).data;
  return html`<div class="page-content">
    ${pageTitle(
      "OPERATIONS / TODAY",
      "Good morning, admin.",
      "Here is what needs your attention across the platform.",
    )}
    <div class="metrics">
      ${metric("Total events", data.totalEvents ?? 0, "All lifecycle states")}${metric(
        "Upcoming",
        data.upcomingEvents ?? 0,
        "Published events",
      )}${metric("Registrations", data.registrations ?? 0, "All participants")}${metric(
        "Pending proofs",
        data.pendingProofs ?? 0,
        "Includes flagged",
      )}${metric("Today's check-ins", data.todayCheckins ?? 0, "Live attendance")}${metric(
        "System health",
        "100%",
        "All services operational",
        true,
      )}
    </div>
    <div class="dashboard-grid">
      <section class="panel chart-panel">
        ${panelTitle(
          "ACTIVITY / LAST 30 DAYS",
          "Participation pulse",
          '<a href="/dashboard/analytics" data-link>View analytics →</a>',
        )}
        <div class="jquery-chart" aria-label="Registration and attendance activity">
          <div style="height:22%"><span>01</span></div>
          <div style="height:38%"><span>05</span></div>
          <div style="height:33%"><span>10</span></div>
          <div style="height:61%"><span>15</span></div>
          <div style="height:50%"><span>20</span></div>
          <div style="height:78%"><span>25</span></div>
          <div style="height:92%"><span>30</span></div>
        </div>
        <div class="legend">
          <span><i class="blue"></i> Registrations</span
          ><span><i class="green"></i> Attendance</span>
        </div>
      </section>
      <section class="panel attention">
        ${panelTitle("WORK QUEUE", "Needs attention")}<a
          class="queue-row"
          href="/dashboard/proof-review"
          data-link
          ><div class="queue-icon">▤</div>
          <div><strong>Proofs to review</strong><small>manual evidence decisions</small></div>
          <b>${data.pendingProofs ?? 0}</b></a
        ><a class="queue-row" href="/dashboard/attendance" data-link
          ><div class="queue-icon">⌗</div>
          <div><strong>Live scanner</strong><small>check-ins recorded today</small></div>
          <b>${data.todayCheckins ?? 0}</b></a
        >
      </section>
    </div>
  </div>`;
}

async function renderEvents() {
  const rows = (await api("/admin/events?limit=50")).data || [];
  return html`<div class="page-content">
    ${pageTitle(
      "EVENT OPERATIONS",
      "Events",
      "Create, publish and steward the full event lifecycle.",
      html`<button class="primary" id="open-event-modal">+ Create event</button>`,
    )}
    <div class="toolbar">
      <div class="search">
        <span>⌕</span><input id="table-search" placeholder="Search events" />
      </div>
      <select id="status-filter">
        <option value="">All statuses</option>
        <option>DRAFT</option>
        <option>PUBLISHED</option>
        <option>COMPLETED</option>
      </select>
    </div>
    <section class="panel table-panel">
      <table>
        <thead>
          <tr>
            <th>EVENT</th>
            <th>DATE</th>
            <th>MODE</th>
            <th>CAPACITY</th>
            <th>STATUS</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody id="events-table">
          ${rows
            .map(
              (row) =>
                html`<tr
                  data-search="${escapeHtml(`${row.title} ${row.status}`.toLowerCase())}"
                  data-status="${escapeHtml(row.status)}"
                >
                  <td>
                    <a href="/dashboard/events/${encodeURIComponent(row.id)}" data-link
                      ><strong>${escapeHtml(row.title)}</strong></a
                    ><small class="block-muted"
                      >${escapeHtml(row.organizer?.name || row.slug)}</small
                    >
                  </td>
                  <td>${formatDate(row.startAt)}</td>
                  <td>${escapeHtml(row.mode)}</td>
                  <td>${row.confirmedCount ?? 0} / ${row.capacity}</td>
                  <td>${status(row.status)}</td>
                  <td>
                    ${row.status === "DRAFT"
                      ? html`<button
                          class="secondary publish-event"
                          data-id="${escapeHtml(row.id)}"
                        >
                          Publish
                        </button>`
                      : html`<span class="muted">Live</span>`}
                  </td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      ${rows.length ? "" : html`<div class="empty-state"><h3>No events found</h3></div>`}
    </section>
    <div class="modal-backdrop" id="event-modal" hidden>
      <div class="modal">
        <div class="modal-head">
          <h2>Create event</h2>
          <button id="close-event-modal">×</button>
        </div>
        <form id="event-form">
          <label>Title<input required name="title" /></label
          ><label>Short description<input required name="shortDescription" /></label
          ><label>Description<textarea required name="description"></textarea></label>
          <div class="form-grid">
            <label>Starts<input required type="datetime-local" name="startAt" /></label
            ><label>Ends<input required type="datetime-local" name="endAt" /></label
            ><label
              >Registration starts<input
                required
                type="datetime-local"
                name="registrationStartAt" /></label
            ><label
              >Registration ends<input
                required
                type="datetime-local"
                name="registrationEndAt" /></label
            ><label
              >Capacity<input required type="number" min="1" name="capacity" value="100" /></label
            ><label
              >Mode<select name="mode">
                <option>OFFLINE</option>
                <option>ONLINE</option>
                <option>HYBRID</option>
              </select></label
            >
          </div>
          <p class="error-text" id="event-error"></p>
          <button class="primary wide">Create draft</button>
        </form>
      </div>
    </div>
  </div>`;
}

async function renderEventDetail(id) {
  const event = (await api(`/admin/events/${encodeURIComponent(id)}`)).data;
  if (!event) return errorState("Event not found.");
  return html`<div class="page-content">
    <a href="/dashboard/events" data-link class="back-public">← Back to events</a>${pageTitle(
      "EVENT CONTROL",
      event.title,
      `${event.mode} · ${formatDate(event.startAt, true)}`,
    )}
    <div class="metrics">
      ${metric("Status", event.status, "Lifecycle")}${metric(
        "Capacity",
        event.capacity,
        "Maximum seats",
      )}${metric("Confirmed", event.confirmedCount ?? 0, "Participants")}
    </div>
    <section class="panel">
      ${panelTitle("EVENT RECORD", "Operational details")}
      <div class="settings-grid">
        <div class="setting-row">
          <div>
            <strong>Public slug</strong>
            <p>${escapeHtml(event.slug)}</p>
          </div>
        </div>
        <div class="setting-row">
          <div>
            <strong>Organizer</strong>
            <p>${escapeHtml(event.organizer?.name || "Not assigned")}</p>
          </div>
        </div>
        <div class="setting-row">
          <div>
            <strong>Registration window</strong>
            <p>${formatDate(event.registrationStartAt)} — ${formatDate(event.registrationEndAt)}</p>
          </div>
        </div>
      </div>
    </section>
  </div>`;
}

async function renderRegistrations() {
  const rows = (await api("/admin/registrations?limit=50")).data || [];
  return html`<div class="page-content">
    ${pageTitle(
      "PARTICIPATION PIPELINE",
      "Registrations",
      "Inspect participant allocation and approval state.",
    )}
    <div class="toolbar">
      <div class="search">
        <span>⌕</span><input id="table-search" placeholder="Search participant or number" />
      </div>
    </div>
    <section class="panel table-panel">
      <table>
        <thead>
          <tr>
            <th>REGISTRATION</th>
            <th>PARTICIPANT</th>
            <th>EVENT</th>
            <th>REGISTERED</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) =>
                html`<tr
                  data-search="${escapeHtml(
                    `${row.registrationNumber} ${row.user?.fullName} ${row.user?.email}`.toLowerCase(),
                  )}"
                >
                  <td class="mono">${escapeHtml(row.registrationNumber)}</td>
                  <td>
                    <strong>${escapeHtml(row.user?.fullName)}</strong
                    ><small class="block-muted">${escapeHtml(row.user?.email)}</small>
                  </td>
                  <td>${escapeHtml(row.event?.title)}</td>
                  <td>${formatDate(row.registeredAt)}</td>
                  <td>${status(row.status)}</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </section>
  </div>`;
}

function renderAttendance() {
  return html`<div class="page-content">
    ${pageTitle(
      "LIVE OPERATIONS",
      "Attendance scanner",
      "Validate signed ticket tokens and record an auditable attendance timeline.",
    )}
    <div class="scanner-grid">
      <section class="panel">
        <div class="mode-tabs">
          <button class="active attendance-mode" data-mode="check-in">Check in</button
          ><button class="attendance-mode" data-mode="check-out">Check out</button>
        </div>
        <form id="attendance-form" data-mode="check-in">
          <label
            >Ticket token<input
              required
              name="token"
              placeholder="Paste or scan the opaque ticket token"
          /></label>
          <p class="error-text" id="attendance-error"></p>
          <button class="primary wide">Record check-in</button>
        </form>
      </section>
      <section class="panel scan-result" id="attendance-result">
        <div class="empty-state">
          <b>⌗</b>
          <h3>Ready for the next participant</h3>
          <p>Scan a ticket to see the participant record and attendance result here.</p>
        </div>
      </section>
    </div>
  </div>`;
}

async function renderProofs() {
  const rows = (await api("/admin/proofs?limit=50")).data || [];
  return html`<div class="page-content">
    ${pageTitle(
      "EVIDENCE REVIEW",
      "Proof review",
      "Use attendance, roster and manual context alongside uploaded evidence.",
    )}
    <section class="panel table-panel">
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
          ${rows
            .map(
              (row) =>
                html`<tr>
                  <td>
                    <strong>${escapeHtml(row.originalFileName)}</strong
                    ><small class="block-muted"
                      >${escapeHtml(row.mimeType)} · ${Math.round(row.fileSize / 1024)} KB</small
                    >
                  </td>
                  <td>
                    ${escapeHtml(row.user?.fullName)}<small class="block-muted"
                      >${escapeHtml(row.event?.title)}</small
                    >
                  </td>
                  <td class="mono checksum">${escapeHtml(row.checksum?.slice(0, 16))}…</td>
                  <td>${status(row.verificationStatus)}</td>
                  <td>
                    <div class="row-actions">
                      <button
                        class="approve review-proof"
                        data-id="${escapeHtml(row.id)}"
                        data-decision="verify"
                      >
                        ✓ Verify</button
                      ><button
                        class="reject review-proof"
                        data-id="${escapeHtml(row.id)}"
                        data-decision="flag"
                      >
                        × Flag
                      </button>
                    </div>
                  </td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      ${rows.length
        ? ""
        : html`<div class="empty-state">
            <b>✓</b>
            <h3>The proof queue is clear</h3>
            <p>New uploaded evidence will appear here.</p>
          </div>`}
    </section>
  </div>`;
}

async function renderCertificates() {
  const events = (await api("/admin/events?limit=100")).data || [];
  return html`<div class="page-content">
    ${pageTitle(
      "CREDENTIALS",
      "Certificates",
      "Generate signed, publicly verifiable certificates for eligible attendance.",
    )}
    <section class="panel certificate-generator">
      <div class="generator-icon">✓</div>
      <div>
        <p class="kicker">EVENT COMPLETION</p>
        <h2>Generate eligible certificates</h2>
        <p class="muted">
          Only participants with finalized PRESENT attendance are included. Generation is
          idempotent.
        </p>
        <select id="certificate-event">
          <option value="">Select a completed event</option>
          ${events
            .map(
              (event) =>
                html`<option value="${escapeHtml(event.id)}">
                  ${escapeHtml(event.title)} · ${escapeHtml(event.status)}
                </option>`,
            )
            .join("")}</select
        ><button class="primary" id="generate-certificates" disabled>Generate certificates</button>
        <p id="certificate-result"></p>
      </div>
    </section>
  </div>`;
}

async function renderUsers() {
  const rows = (await api("/admin/users?limit=50")).data || [];
  return html`<div class="page-content">
    ${pageTitle(
      "IDENTITY & ACCESS",
      "Users",
      "Manage active accounts and inspect database-driven roles.",
    )}
    <section class="panel table-panel">
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
          ${rows
            .map((user) => {
              const roles = (user.roles || []).map((role) => role.role?.name || role);
              return html`<tr>
                <td>
                  <div class="person">
                    <div class="mini-avatar">
                      ${escapeHtml(user.fullName.slice(0, 2).toUpperCase())}
                    </div>
                    <span
                      ><strong>${escapeHtml(user.fullName)}</strong
                      ><small>${escapeHtml(user.email)}</small></span
                    >
                  </div>
                </td>
                <td>${escapeHtml(user.department || "—")}</td>
                <td>
                  <div class="role-pills">
                    ${roles.map((role) => html`<span>${escapeHtml(role)}</span>`).join("")}
                  </div>
                </td>
                <td>${formatDate(user.createdAt || new Date())}</td>
                <td>${status(user.isActive === false ? "INACTIVE" : "ACTIVE")}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </section>
  </div>`;
}

async function renderAnalytics() {
  const data = (await api("/admin/analytics/overview")).data;
  const values = [42, 70, 52, 94, 86, 118];
  return html`<div class="page-content">
    ${pageTitle(
      "REPORTING & INSIGHT",
      "Analytics",
      "Operational signals across events, attendance and evidence.",
    )}
    <div class="metrics">
      ${metric("Registrations", data.registrations ?? 0, "All time")}${metric(
        "Attendance rate",
        "—",
        "Derived per event",
      )}${metric("Proof queue", data.pendingProofs ?? 0, "Needs human review")}
    </div>
    <div class="dashboard-grid">
      <section class="panel chart-panel">
        ${panelTitle("MONTHLY TREND", "Registration volume")}
        <div class="jquery-chart bars">
          ${values
            .map(
              (value, index) =>
                html`<div style="height:${value / 1.2}%">
                  <span>${["Jan", "Feb", "Mar", "Apr", "May", "Jun"][index]}</span>
                </div>`,
            )
            .join("")}
        </div>
      </section>
      <section class="panel">
        ${panelTitle("PARTICIPATION SIGNAL", "What to watch")}
        <div class="signal">
          <span class="signal-dot green"></span>
          <div>
            <strong>Evidence-first verification</strong>
            <p>QR attendance is the strongest signal for verified participation.</p>
          </div>
        </div>
        <div class="signal">
          <span class="signal-dot orange"></span>
          <div>
            <strong>Manual proof review</strong>
            <p>Automated results are risk signals; reviewers retain final control.</p>
          </div>
        </div>
        <div class="signal">
          <span class="signal-dot blue"></span>
          <div>
            <strong>Capacity safety</strong>
            <p>Registration allocation is transactionally serialized in PostgreSQL.</p>
          </div>
        </div>
      </section>
    </div>
  </div>`;
}

function renderReports() {
  const reports = [
    ["Event report", "Lifecycle, dates, capacity and organizers"],
    ["Registration report", "Participant status and attendance evidence"],
    ["Attendance report", "Check-in, check-out and duration"],
    ["Proof report", "Checksums and manual decisions"],
    ["Certificate report", "Issued and revoked credentials"],
  ];
  return html`<div class="page-content">
    ${pageTitle(
      "EXPORT CENTER",
      "Reports",
      "Download operational data for institutional reporting.",
    )}
    <div class="report-grid">
      ${reports
        .map(
          ([title, description]) =>
            html`<div class="report-card">
              <div class="report-icon">▧</div>
              <h3>${title}</h3>
              <p>${description}</p>
              <div>
                <button class="secondary download-report">CSV</button
                ><button class="secondary disabled" disabled>PDF</button>
              </div>
            </div>`,
        )
        .join("")}
    </div>
  </div>`;
}

async function renderAudit() {
  const rows = (await api("/admin/audit-logs?limit=50")).data || [];
  return html`<div class="page-content">
    ${pageTitle(
      "IMMUTABLE HISTORY",
      "Audit logs",
      "Every sensitive operation is attributed, timestamped and retained.",
    )}
    <section class="panel table-panel">
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
          ${rows
            .map(
              (row) =>
                html`<tr>
                  <td><span class="action-pill">◴ ${escapeHtml(row.action)}</span></td>
                  <td>
                    ${escapeHtml(row.actor?.fullName || "System")}<small class="block-muted"
                      >${escapeHtml(row.actor?.email || "")}</small
                    >
                  </td>
                  <td class="mono">
                    ${escapeHtml(row.resourceType)} ${escapeHtml(row.resourceId?.slice(0, 8))}
                  </td>
                  <td>${formatDate(row.createdAt, true)}</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      ${rows.length
        ? ""
        : html`<div class="empty-state"><h3>No audit entries to display</h3></div>`}
    </section>
  </div>`;
}

function renderSettings() {
  return html`<div class="page-content">
    ${pageTitle(
      "PLATFORM CONFIGURATION",
      "Settings",
      "Environment-backed controls and safe workflow defaults.",
    )}
    <div class="settings-grid">
      <section class="panel">
        ${panelTitle("ATTENDANCE", "Verification policy")}
        <div class="setting-row">
          <div>
            <strong>Minimum attendance percentage</strong>
            <p>Events default to 75% for PRESENT status.</p>
          </div>
          <input value="75" readonly />
        </div>
        <div class="setting-row">
          <div>
            <strong>Location validation</strong>
            <p>Calculated on the backend when event coordinates are configured.</p>
          </div>
          ${status("AVAILABLE")}
        </div>
      </section>
      <section class="panel">
        ${panelTitle("DATABASE", "PostgreSQL storage")}
        <div class="setting-row">
          <div>
            <strong>Relational data</strong>
            <p>Users, events, registrations and audit records use PostgreSQL through Prisma.</p>
          </div>
          ${status("CONFIGURED")}
        </div>
        <div class="setting-row">
          <div>
            <strong>Private files</strong>
            <p>Proofs and certificates remain private by default.</p>
          </div>
          ${status("PRIVATE")}
        </div>
      </section>
    </div>
  </div>`;
}

async function routeContent(path) {
  if (path === "/dashboard") return renderOverview();
  if (path === "/dashboard/events") return renderEvents();
  if (/^\/dashboard\/events\/[^/]+$/.test(path))
    return renderEventDetail(decodeURIComponent(path.split("/").pop()));
  if (path === "/dashboard/registrations") return renderRegistrations();
  if (path === "/dashboard/attendance") return renderAttendance();
  if (path === "/dashboard/proof-review") return renderProofs();
  if (path === "/dashboard/certificates") return renderCertificates();
  if (path === "/dashboard/users") return renderUsers();
  if (path === "/dashboard/analytics") return renderAnalytics();
  if (path === "/dashboard/reports") return renderReports();
  if (path === "/dashboard/audit-logs") return renderAudit();
  if (path === "/dashboard/settings") return renderSettings();
  navigate("/dashboard", true);
  return "";
}

async function renderApp() {
  const sequence = ++renderSequence;
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    if (path !== "/login") history.replaceState({}, "", "/login");
    renderLogin();
    return;
  }
  if (path === "/login") {
    navigate("/dashboard", true);
    return;
  }
  $("#app").html(loading());
  try {
    const profile = await getProfile();
    if (sequence !== renderSequence) return;
    $("#app").html(shell(profile, loading("Loading view…")));
    const content = await routeContent(path);
    if (sequence === renderSequence) $("#admin-page").html(content);
  } catch (error) {
    if (error?.status === 401 || error instanceof Error) {
      localStorage.removeItem(TOKEN_KEY);
      navigate("/login", true);
      return;
    }
    $("#app").html(errorState(apiError(error)));
  }
}

$(document).on("click", "a[data-link]", function handleLink(event) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || this.target === "_blank") return;
  const url = new URL(this.href, location.origin);
  if (url.origin !== location.origin) return;
  event.preventDefault();
  navigate(`${url.pathname}${url.search}`);
});

$(document).on("submit", "#admin-login-form", async function login(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(this));
  const button = $(this).find("button").prop("disabled", true).text("Signing in…");
  $("#login-error").text("");
  try {
    const token = (await api("/auth/login", { method: "POST", data: values }, false)).data
      .accessToken;
    localStorage.setItem(TOKEN_KEY, token);
    navigate("/dashboard", true);
  } catch (xhr) {
    $("#login-error").text(apiError(xhr, "Unable to sign in."));
    button.prop("disabled", false).text("Sign in to console");
  }
});

$(document).on("click", "#admin-sign-out", async () => {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    /* Always clear the local session. */
  }
  localStorage.removeItem(TOKEN_KEY);
  navigate("/login", true);
});

$(document).on("click", "#open-menu", () => $("#admin-side").addClass("open"));
$(document).on("click", "#close-menu", () => $("#admin-side").removeClass("open"));
$(document).on("click", "#retry-page", renderApp);
$(document).on("click", "#open-event-modal", () => $("#event-modal").prop("hidden", false));
$(document).on("click", "#close-event-modal", () => $("#event-modal").prop("hidden", true));
$(document).on("mousedown", "#event-modal", function closeBackdrop(event) {
  if (event.target === this) $(this).prop("hidden", true);
});

$(document).on("input", "#table-search", function filterTable() {
  const query = String(this.value).trim().toLowerCase();
  $("tbody tr").each(function filterRow() {
    $(this).toggle(
      String($(this).data("search") || $(this).text())
        .toLowerCase()
        .includes(query),
    );
  });
});

$(document).on("change", "#status-filter", function filterStatus() {
  const value = this.value;
  $("#events-table tr").each(function filterRow() {
    $(this).toggle(!value || $(this).data("status") === value);
  });
});

$(document).on("submit", "#event-form", async function createEvent(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(this));
  data.capacity = Number(data.capacity);
  ["startAt", "endAt", "registrationStartAt", "registrationEndAt"].forEach((key) => {
    data[key] = new Date(data[key]).toISOString();
  });
  const button = $(this).find("button").prop("disabled", true).text("Creating…");
  try {
    await api("/admin/events", { method: "POST", data });
    $("#event-modal").prop("hidden", true);
    renderApp();
  } catch (xhr) {
    $("#event-error").text(apiError(xhr, "Unable to create event."));
    button.prop("disabled", false).text("Create draft");
  }
});

$(document).on("click", ".publish-event", async function publishEvent() {
  const button = $(this).prop("disabled", true).text("Publishing…");
  try {
    await api(`/admin/events/${button.data("id")}/publish`, { method: "POST" });
    button.replaceWith(status("PUBLISHED"));
  } catch (xhr) {
    button.prop("disabled", false).text("Publish");
    window.alert(apiError(xhr, "Unable to publish event."));
  }
});

$(document).on("click", ".attendance-mode", function switchMode() {
  const mode = $(this).data("mode");
  $(".attendance-mode").removeClass("active");
  $(this).addClass("active");
  $("#attendance-form")
    .data("mode", mode)
    .find("button")
    .text(mode === "check-in" ? "Record check-in" : "Record check-out");
});

$(document).on("submit", "#attendance-form", async function recordAttendance(event) {
  event.preventDefault();
  const mode = $(this).data("mode");
  const token = String(new FormData(this).get("token") || "");
  const button = $(this).find("button").prop("disabled", true).text("Validating…");
  try {
    const result = (await api(`/admin/attendance/${mode}`, { method: "POST", data: { token } }))
      .data;
    $("#attendance-result").html(
      html`<div class="success-icon">✓</div>
        <p class="kicker">${escapeHtml(mode.toUpperCase())} RECORDED</p>
        <h2>${escapeHtml(result.participant?.fullName)}</h2>
        <p class="muted">${escapeHtml(result.participant?.email)}</p>
        <div class="result-detail">
          <span>Attendance status</span>${status(result.attendance?.status)}
        </div>
        <div class="result-detail">
          <span>Registration</span><strong>Verified secure ticket</strong>
        </div>`,
    );
    $("#attendance-error").text("");
  } catch (xhr) {
    $("#attendance-error").text(apiError(xhr, "Ticket validation failed."));
  } finally {
    button
      .prop("disabled", false)
      .text(mode === "check-in" ? "Record check-in" : "Record check-out");
  }
});

$(document).on("click", ".review-proof", async function reviewProof() {
  const button = $(this).prop("disabled", true);
  try {
    await api(`/admin/proofs/${button.data("id")}/${button.data("decision")}`, {
      method: "POST",
      data: { metadata: { reviewer: "manual" } },
    });
    renderApp();
  } catch (xhr) {
    button.prop("disabled", false);
    window.alert(apiError(xhr));
  }
});

$(document).on("change", "#certificate-event", function selectEvent() {
  $("#generate-certificates").prop("disabled", !this.value);
});
$(document).on("click", "#generate-certificates", async function generateCertificates() {
  const eventId = $("#certificate-event").val();
  const button = $(this).prop("disabled", true).text("Generating…");
  try {
    const result = (await api(`/admin/events/${eventId}/certificates/generate`, { method: "POST" }))
      .data;
    $("#certificate-result").addClass("success-text").text(`${result.length} certificates ready.`);
  } catch (xhr) {
    $("#certificate-result").addClass("error-text").text(apiError(xhr));
  } finally {
    button.prop("disabled", false).text("Generate certificates");
  }
});

$(document).on("click", ".download-report", async function downloadReport() {
  const button = $(this).prop("disabled", true).text("Preparing…");
  try {
    const csv = await rawRequest("/admin/reports/registrations", { dataType: "text" });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `eventhub-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (xhr) {
    window.alert(apiError(xhr, "Unable to download report."));
  } finally {
    button.prop("disabled", false).text("CSV");
  }
});

window.addEventListener("popstate", renderApp);
renderApp();
