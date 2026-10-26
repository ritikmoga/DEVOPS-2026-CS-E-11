import $ from "jquery";
import config from "./config.json";
import "./styles.css";
import "./a11y.css";

const API_URL = window.EVENTHUB_API_URL || config.apiBaseUrl;
const PUBLIC_APP_URL = window.EVENTHUB_PUBLIC_URL || config.publicAppUrl;
const TOKEN_KEY = "eventhub_admin_access";
const html = String.raw;
let refreshRequest = null;
let renderSequence = 0;
let loginNotice = "";
let toastTimer = null;

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

class AccessError extends Error {}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(name = "") {
  return (
    String(name)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase() || "AD"
  );
}

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning, admin.";
  if (hour < 17) return "Good afternoon, admin.";
  return "Good evening, admin.";
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

function showToast(message, type = "success") {
  const toast = $("#toast");
  clearTimeout(toastTimer);
  if (!toast.length) {
    window.alert(message);
    return;
  }
  toast.text(message).attr("class", `toast ${type}`).prop("hidden", false);
  toastTimer = setTimeout(() => toast.prop("hidden", true), 4000);
}

function loading(message = "Loading admin workspace…") {
  return html`<div class="loading" role="status">
    <span class="spinner" aria-hidden="true"></span>${escapeHtml(message)}
  </div>`;
}

function errorState(message) {
  return html`<div class="page-content">
    <section class="panel empty-state" role="alert">
      <b aria-hidden="true">!</b>
      <h3>Unable to load this view</h3>
      <p>${escapeHtml(message)}</p>
      <button class="secondary" id="retry-page" type="button">Try again</button>
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

// Bar chart built from real totals. Heights are relative to the largest value.
function barChart(items, label) {
  const values = items.map(([, value]) => Number(value) || 0);
  const max = Math.max(1, ...values);
  return html`<div class="jquery-chart bars" role="img" aria-label="${escapeHtml(label)}">
    ${items
      .map(([name, value]) => {
        const amount = Number(value) || 0;
        const pct = Math.max(4, Math.round((amount / max) * 100));
        return html`<div style="height:${pct}%" title="${escapeHtml(name)}: ${amount}">
          <span>${escapeHtml(name)} · ${amount}</span>
        </div>`;
      })
      .join("")}
  </div>`;
}

async function fetchApiHealth() {
  try {
    const response = await fetch("/health", { cache: "no-store" });
    return response.ok ? "Operational" : "Degraded";
  } catch {
    return "Unreachable";
  }
}

function renderLogin() {
  const notice = loginNotice;
  loginNotice = "";
  $("#app").html(
    html`<div class="login-page">
      <div class="login-box">
        <div class="admin-logo">
          <span class="logo-mark" aria-hidden="true">E</span>
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
          <p class="error-text" id="login-error" role="alert">${escapeHtml(notice)}</p>
          <button class="primary wide" type="submit">Sign in to console</button>
        </form>
        <a class="back-public" href="${escapeHtml(PUBLIC_APP_URL)}">← Back to public site</a>
      </div>
      <div class="login-aside">
        <p class="kicker">CONTROL WITH CONFIDENCE</p>
        <h2>Every decision has a trace.</h2>
        <p>Attendance, proof decisions and certificates are connected to an audit trail.</p>
      </div>
    </div>`,
  );
}

function shell(profile, content) {
  const path = location.pathname.replace(/\/+$/, "") || "/dashboard";
  const roles = (profile.roles || []).join(" · ");
  return html`<div class="admin-shell">
    <aside class="admin-side" id="admin-side">
      <div class="admin-logo">
        <span class="logo-mark" aria-hidden="true">E</span>
        <div><strong>EventHub</strong><small>OPERATIONS CONSOLE</small></div>
        <button id="close-menu" type="button" aria-label="Close menu">×</button>
      </div>
      <div class="admin-user">
        <div class="admin-avatar" aria-hidden="true">${escapeHtml(initials(profile.fullName))}</div>
        <div>
          <strong>${escapeHtml(profile.fullName || "Administrator")}</strong
          ><small>${escapeHtml(roles)}</small>
        </div>
      </div>
      <nav aria-label="Admin">
        ${navItems
          .map(([url, label, icon]) => {
            const active = url === "/dashboard" ? path === url : path.startsWith(url);
            const badge = label === "Proof review" ? html`<i id="proof-badge" hidden></i>` : "";
            return html`<a
              href="${url}"
              data-link
              class="nav-item${active ? " active" : ""}"
              ${active ? 'aria-current="page"' : ""}
              ><b aria-hidden="true">${icon}</b><span>${label}</span>${badge}</a
            >`;
          })
          .join("")}
      </nav>
      <button class="logout" id="admin-sign-out" type="button">↗ Sign out</button>
    </aside>
    <section class="admin-content">
      <header class="admin-top">
        <button class="mobile-toggle" id="open-menu" type="button" aria-label="Open menu">
          ☰
        </button>
        <div class="crumb">EVENTHUB <span aria-hidden="true">/</span> OPERATIONS</div>
        <div class="top-actions">
          <a class="public-site-link" href="${escapeHtml(PUBLIC_APP_URL)}">Public site</a
          ><span class="online"><i aria-hidden="true"></i> Console</span>
        </div>
      </header>
      <main id="admin-page">${content}</main>
      <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
    </section>
  </div>`;
}

async function refreshProofBadge() {
  try {
    const data = (await api("/admin/analytics/overview")).data;
    const count = Number(data?.pendingProofs) || 0;
    $("#proof-badge")
      .text(count)
      .prop("hidden", count === 0);
  } catch {
    $("#proof-badge").prop("hidden", true);
  }
}

async function getProfile() {
  const profile = (await api("/auth/me")).data;
  if (!profile?.roles?.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role))) {
    throw new AccessError("This account does not have admin access.");
  }
  return profile;
}

async function renderOverview() {
  const [data, apiState] = await Promise.all([
    api("/admin/analytics/overview").then((x) => x.data),
    fetchApiHealth(),
  ]);
  return html`<div class="page-content">
    ${pageTitle(
      "OPERATIONS / TODAY",
      greeting(),
      "Here is what needs your attention across the platform.",
    )}
    <div class="metrics">
      ${metric("Total events", data.totalEvents ?? 0, "All lifecycle states")}
      ${metric("Upcoming", data.upcomingEvents ?? 0, "Published events")}
      ${metric("Registrations", data.registrations ?? 0, "All participants")}
      ${metric("Pending proofs", data.pendingProofs ?? 0, "Includes flagged")}
      ${metric("Today's check-ins", data.todayCheckins ?? 0, "Live attendance")}
      ${metric(
        "API status",
        apiState,
        "Reported by the server health check",
        apiState === "Operational",
      )}
    </div>
    <div class="dashboard-grid">
      <section class="panel chart-panel">
        ${panelTitle(
          "CURRENT TOTALS",
          "Platform at a glance",
          '<a href="/dashboard/analytics" data-link>View analytics →</a>',
        )}
        ${barChart(
          [
            ["Upcoming", data.upcomingEvents],
            ["Registrations", data.registrations],
            ["Check-ins today", data.todayCheckins],
            ["Pending proofs", data.pendingProofs],
          ],
          "Current totals across events, registrations, check-ins and proofs",
        )}
      </section>
      <section class="panel attention">
        ${panelTitle("WORK QUEUE", "Needs attention")}<a
          class="queue-row"
          href="/dashboard/proof-review"
          data-link
          ><div class="queue-icon" aria-hidden="true">▤</div>
          <div><strong>Proofs to review</strong><small>manual evidence decisions</small></div>
          <b>${data.pendingProofs ?? 0}</b></a
        ><a class="queue-row" href="/dashboard/attendance" data-link
          ><div class="queue-icon" aria-hidden="true">⌗</div>
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
      html`<button class="primary" id="open-event-modal" type="button">+ Create event</button>`,
    )}
    <div class="toolbar">
      <div class="search">
        <label class="sr-only" for="table-search">Search events</label>
        <span aria-hidden="true">⌕</span><input id="table-search" placeholder="Search events" />
      </div>
      <label class="sr-only" for="status-filter">Filter by status</label>
      <select id="status-filter">
        <option value="">All statuses</option>
        <option value="DRAFT">DRAFT</option>
        <option value="PUBLISHED">PUBLISHED</option>
        <option value="COMPLETED">COMPLETED</option>
      </select>
    </div>
    <section class="panel table-panel">
      <table>
        <thead>
          <tr>
            <th scope="col">EVENT</th>
            <th scope="col">DATE</th>
            <th scope="col">MODE</th>
            <th scope="col">CAPACITY</th>
            <th scope="col">STATUS</th>
            <th scope="col">ACTION</th>
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
                  <td>${escapeHtml(row.confirmedCount ?? 0)} / ${escapeHtml(row.capacity)}</td>
                  <td>${status(row.status)}</td>
                  <td>
                    ${row.status === "DRAFT"
                      ? html`<button
                          class="secondary publish-event"
                          type="button"
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
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="event-modal-title">
        <div class="modal-head">
          <h2 id="event-modal-title">Create event</h2>
          <button id="close-event-modal" type="button" aria-label="Close">×</button>
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
          <p class="error-text" id="event-error" role="alert"></p>
          <button class="primary wide" type="submit">Create draft</button>
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
      ${metric("Status", event.status, "Lifecycle")}
      ${metric("Capacity", event.capacity, "Maximum seats")}
      ${metric("Confirmed", event.confirmedCount ?? 0, "Participants")}
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
        <label class="sr-only" for="table-search">Search registrations</label>
        <span aria-hidden="true">⌕</span
        ><input id="table-search" placeholder="Search participant or number" />
      </div>
    </div>
    <section class="panel table-panel">
      <table>
        <thead>
          <tr>
            <th scope="col">REGISTRATION</th>
            <th scope="col">PARTICIPANT</th>
            <th scope="col">EVENT</th>
            <th scope="col">REGISTERED</th>
            <th scope="col">STATUS</th>
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
        <div class="mode-tabs" role="group" aria-label="Attendance mode">
          <button
            class="active attendance-mode"
            type="button"
            data-mode="check-in"
            aria-pressed="true"
          >
            Check in</button
          ><button class="attendance-mode" type="button" data-mode="check-out" aria-pressed="false">
            Check out
          </button>
        </div>
        <form id="attendance-form" data-mode="check-in">
          <label
            >Ticket token<input
              required
              name="token"
              autocomplete="off"
              placeholder="Paste or scan the opaque ticket token"
          /></label>
          <p class="error-text" id="attendance-error" role="alert"></p>
          <button class="primary wide" type="submit">Record check-in</button>
        </form>
      </section>
      <section class="panel scan-result" id="attendance-result" role="status">
        <div class="empty-state">
          <b aria-hidden="true">⌗</b>
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
            <th scope="col">FILE</th>
            <th scope="col">PARTICIPANT</th>
            <th scope="col">CHECKSUM</th>
            <th scope="col">STATUS</th>
            <th scope="col">DECISION</th>
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
                      >${escapeHtml(row.mimeType)} · ${Math.round((row.fileSize || 0) / 1024)}
                      KB</small
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
                        type="button"
                        data-id="${escapeHtml(row.id)}"
                        data-decision="verify"
                      >
                        ✓ Verify</button
                      ><button
                        class="reject review-proof"
                        type="button"
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
            <b aria-hidden="true">✓</b>
            <h3>The proof queue is clear</h3>
            <p>New uploaded evidence will appear here.</p>
          </div>`}
    </section>
  </div>`;
}

async function renderCertificates() {
  const events = (await api("/admin/events?limit=100")).data || [];
  const completed = events.filter((event) => event.status === "COMPLETED");
  return html`<div class="page-content">
    ${pageTitle(
      "CREDENTIALS",
      "Certificates",
      "Generate signed, publicly verifiable certificates for eligible attendance.",
    )}
    <section class="panel certificate-generator">
      <div class="generator-icon" aria-hidden="true">✓</div>
      <div>
        <p class="kicker">EVENT COMPLETION</p>
        <h2>Generate eligible certificates</h2>
        <p class="muted">
          Only participants with finalized PRESENT attendance are included. Generation is
          idempotent.
        </p>
        ${completed.length
          ? html`<label class="sr-only" for="certificate-event">Completed event</label>
              <select id="certificate-event">
                <option value="">Select a completed event</option>
                ${completed
                  .map(
                    (event) =>
                      html`<option value="${escapeHtml(event.id)}">
                        ${escapeHtml(event.title)}
                      </option>`,
                  )
                  .join("")}
              </select>
              <button class="primary" id="generate-certificates" type="button" disabled>
                Generate certificates
              </button>`
          : html`<p class="muted">
              No completed events yet. Certificates can be generated once an event is completed.
            </p>`}
        <p id="certificate-result" role="status"></p>
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
            <th scope="col">USER</th>
            <th scope="col">DEPARTMENT</th>
            <th scope="col">ROLES</th>
            <th scope="col">CREATED</th>
            <th scope="col">STATUS</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((user) => {
              const roles = (user.roles || []).map((role) => role.role?.name || role);
              return html`<tr>
                <td>
                  <div class="person">
                    <div class="mini-avatar" aria-hidden="true">
                      ${escapeHtml(initials(user.fullName))}
                    </div>
                    <span
                      ><strong>${escapeHtml(user.fullName || "Unnamed user")}</strong
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
  return html`<div class="page-content">
    ${pageTitle(
      "REPORTING & INSIGHT",
      "Analytics",
      "Current operational totals. Historical trends will appear once the server provides time-series data.",
    )}
    <div class="metrics">
      ${metric("Registrations", data.registrations ?? 0, "All time")}
      ${metric("Proof queue", data.pendingProofs ?? 0, "Needs human review")}
      ${metric("Today's check-ins", data.todayCheckins ?? 0, "Live attendance")}
    </div>
    <div class="dashboard-grid">
      <section class="panel chart-panel">
        ${panelTitle("CURRENT TOTALS", "Operational totals")}
        ${barChart(
          [
            ["Events", data.totalEvents],
            ["Upcoming", data.upcomingEvents],
            ["Registrations", data.registrations],
            ["Check-ins today", data.todayCheckins],
            ["Pending proofs", data.pendingProofs],
          ],
          "Current operational totals",
        )}
      </section>
      <section class="panel">
        ${panelTitle("PARTICIPATION SIGNAL", "What to watch")}
        <div class="signal">
          <span class="signal-dot green" aria-hidden="true"></span>
          <div>
            <strong>Evidence-first verification</strong>
            <p>QR attendance is the strongest signal for verified participation.</p>
          </div>
        </div>
        <div class="signal">
          <span class="signal-dot orange" aria-hidden="true"></span>
          <div>
            <strong>Manual proof review</strong>
            <p>Automated results are risk signals; reviewers retain final control.</p>
          </div>
        </div>
      </section>
    </div>
  </div>`;
}

function renderReports() {
  const reports = [
    ["Registration report", "Participant status and attendance evidence", "registrations"],
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
              <div class="report-icon" aria-hidden="true">▧</div>
              <h3>${escapeHtml(title)}</h3>
              <p>${escapeHtml(description)}</p>
              <div>
                <button class="secondary download-report" type="button">CSV</button>
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
            <th scope="col">ACTION</th>
            <th scope="col">ACTOR</th>
            <th scope="col">RESOURCE</th>
            <th scope="col">TIME</th>
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
      "Read-only summary of how the platform is configured on the server.",
    )}
    <div class="settings-grid">
      <section class="panel">
        ${panelTitle("ATTENDANCE", "Verification policy")}
        <div class="setting-row">
          <div>
            <strong>Minimum attendance percentage</strong>
            <p>Server default: 75% for PRESENT status. Changed through server configuration.</p>
          </div>
        </div>
        <div class="setting-row">
          <div>
            <strong>Location validation</strong>
            <p>Applied on the server when event coordinates are configured.</p>
          </div>
        </div>
      </section>
      <section class="panel">
        ${panelTitle("DATABASE", "Storage")}
        <div class="setting-row">
          <div>
            <strong>Document data</strong>
            <p>
              Users, events, registrations and audit records are stored in MongoDB through Prisma.
            </p>
          </div>
        </div>
        <div class="setting-row">
          <div>
            <strong>Private files</strong>
            <p>Proofs and certificates are stored privately by default.</p>
          </div>
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

  let profile;
  try {
    profile = await getProfile();
  } catch (error) {
    if (sequence !== renderSequence) return;
    if (error instanceof AccessError) loginNotice = error.message;
    if (error instanceof AccessError || error?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      navigate("/login", true);
      return;
    }
    $("#app").html(errorState(apiError(error, "Unable to load your profile.")));
    return;
  }
  if (sequence !== renderSequence) return;

  $("#app").html(shell(profile, loading("Loading view…")));

  let content;
  try {
    content = await routeContent(path);
  } catch (error) {
    if (sequence !== renderSequence) return;
    if (error?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      navigate("/login", true);
      return;
    }
    content = errorState(apiError(error));
  }

  if (sequence !== renderSequence) return;
  $("#admin-page").html(content);
  refreshProofBadge();
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
$(document).on("click", "#retry-page", () => renderApp());

// Event modal: open, close with button, backdrop or Escape, and focus management.
function openEventModal() {
  $("#event-modal").prop("hidden", false);
  $("#event-modal input[name='title']").trigger("focus");
}
function closeEventModal() {
  $("#event-modal").prop("hidden", true);
  $("#open-event-modal").trigger("focus");
}
$(document).on("click", "#open-event-modal", openEventModal);
$(document).on("click", "#close-event-modal", closeEventModal);
$(document).on("mousedown", "#event-modal", function closeBackdrop(event) {
  if (event.target === this) closeEventModal();
});
$(document).on("keydown", (event) => {
  if (event.key === "Escape" && !$("#event-modal").prop("hidden")) closeEventModal();
});

// Search and status filters apply together to any table.
function applyTableFilters() {
  const query = String($("#table-search").val() || "")
    .trim()
    .toLowerCase();
  const statusValue = String($("#status-filter").val() || "");
  $("tbody tr").each(function filterRow() {
    const row = $(this);
    const text = String(row.data("search") || row.text()).toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesStatus = !statusValue || row.data("status") === statusValue;
    row.toggle(matchesQuery && matchesStatus);
  });
}
$(document).on("input change", "#table-search, #status-filter", applyTableFilters);

// Validates and converts the event form before it is sent.
function buildEventPayload(values) {
  const capacity = Number(values.capacity);
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error("Capacity must be a whole number of at least 1.");
  }
  const payload = { ...values, capacity };
  const dateKeys = ["startAt", "endAt", "registrationStartAt", "registrationEndAt"];
  for (const key of dateKeys) {
    const date = new Date(values[key]);
    if (Number.isNaN(date.getTime())) throw new Error("Please enter valid dates and times.");
    payload[key] = date.toISOString();
  }
  if (new Date(payload.endAt) <= new Date(payload.startAt)) {
    throw new Error("The event end time must be after its start time.");
  }
  if (new Date(payload.registrationEndAt) < new Date(payload.registrationStartAt)) {
    throw new Error("Registration must end after it starts.");
  }
  return payload;
}

$(document).on("submit", "#event-form", async function createEvent(event) {
  event.preventDefault();
  const form = this;
  const button = $(form).find("button").prop("disabled", true).text("Creating…");
  $("#event-error").text("");
  try {
    const payload = buildEventPayload(Object.fromEntries(new FormData(form)));
    await api("/admin/events", { method: "POST", data: payload });
    await renderApp();
    showToast("Event draft created.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : apiError(error, "Unable to create event.");
    $("#event-error").text(message);
    button.prop("disabled", false).text("Create draft");
  }
});

$(document).on("click", ".publish-event", async function publishEvent() {
  const button = $(this).prop("disabled", true).text("Publishing…");
  try {
    await api(`/admin/events/${encodeURIComponent(button.data("id"))}/publish`, { method: "POST" });
    button.replaceWith(status("PUBLISHED"));
    showToast("Event published.");
  } catch (xhr) {
    button.prop("disabled", false).text("Publish");
    showToast(apiError(xhr, "Unable to publish event."), "error");
  }
});

$(document).on("click", ".attendance-mode", function switchMode() {
  const mode = $(this).data("mode");
  $(".attendance-mode").removeClass("active").attr("aria-pressed", "false");
  $(this).addClass("active").attr("aria-pressed", "true");
  $("#attendance-form")
    .data("mode", mode)
    .find("button")
    .text(mode === "check-in" ? "Record check-in" : "Record check-out");
});

$(document).on("submit", "#attendance-form", async function recordAttendance(event) {
  event.preventDefault();
  const mode = $(this).data("mode");
  const token = String(new FormData(this).get("token") || "").trim();
  const button = $(this).find("button").prop("disabled", true).text("Validating…");
  try {
    const result = (await api(`/admin/attendance/${mode}`, { method: "POST", data: { token } }))
      .data;
    $("#attendance-result").html(
      html`<div class="success-icon" aria-hidden="true">✓</div>
        <p class="kicker">${escapeHtml(mode.toUpperCase())} RECORDED</p>
        <h2>${escapeHtml(result.participant?.fullName)}</h2>
        <p class="muted">${escapeHtml(result.participant?.email)}</p>
        <div class="result-detail">
          <span>Attendance status</span>${status(result.attendance?.status)}
        </div>`,
    );
    $("#attendance-error").text("");
    $("#attendance-form input[name='token']").val("").trigger("focus");
  } catch (xhr) {
    $("#attendance-error").text(apiError(xhr, "Ticket validation failed."));
  } finally {
    button
      .prop("disabled", false)
      .text(mode === "check-in" ? "Record check-in" : "Record check-out");
  }
});

$(document).on("click", ".review-proof", async function reviewProof() {
  const button = $(this);
  const decision = button.data("decision");
  const id = button.data("id");
  button.closest("tr").find("button").prop("disabled", true);
  try {
    await api(`/admin/proofs/${encodeURIComponent(id)}/${decision}`, {
      method: "POST",
      data: { metadata: { reviewer: "manual" } },
    });
    await renderApp();
    showToast(decision === "verify" ? "Proof verified." : "Proof flagged for follow-up.");
  } catch (xhr) {
    button.closest("tr").find("button").prop("disabled", false);
    showToast(apiError(xhr, "Unable to record decision."), "error");
  }
});

$(document).on("change", "#certificate-event", function selectEvent() {
  $("#generate-certificates").prop("disabled", !this.value);
});

$(document).on("click", "#generate-certificates", async function generateCertificates() {
  const eventId = $("#certificate-event").val();
  const button = $(this).prop("disabled", true).text("Generating…");
  $("#certificate-result").removeClass("success-text error-text").text("");
  try {
    const result = (
      await api(`/admin/events/${encodeURIComponent(eventId)}/certificates/generate`, {
        method: "POST",
      })
    ).data;
    const count = Array.isArray(result) ? result.length : 0;
    $("#certificate-result").addClass("success-text").text(`${count} certificates ready.`);
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
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `eventhub-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Registration report downloaded.");
  } catch (xhr) {
    showToast(apiError(xhr, "Unable to download report."), "error");
  } finally {
    button.prop("disabled", false).text("CSV");
  }
});

// Only a real authentication failure signs the admin out. Other failures are shown in the page.
window.addEventListener("popstate", () => renderApp());
renderApp();
