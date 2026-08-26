import $ from "jquery";
import QRCode from "qrcode";
import config from "./config.json";
import "./styles.css";
import "./ticket.css";

const API_URL = window.EVENTHUB_API_URL || config.apiBaseUrl;
const TOKEN_KEY = "eventhub_access";
const html = String.raw;
let renderSequence = 0;
let refreshRequest = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value, includeTime = false) {
  if (!value) return "Date to be announced";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date to be announced";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function apiError(xhr, fallback = "Something went wrong. Please try again.") {
  return xhr?.responseJSON?.message || xhr?.responseJSON?.error || fallback;
}

function rawRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const method = options.method || "GET";
  const request = {
    url: `${API_URL}${path}`,
    method,
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
  window.history[replace ? "replaceState" : "pushState"]({}, "", path);
  renderApp();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function shell(content) {
  const signedIn = Boolean(localStorage.getItem(TOKEN_KEY));
  return html` <header class="site-header">
      <div class="container nav">
        <a href="/" data-link class="brand"
          ><span class="brand-mark">E</span><span>Event<span>Hub</span></span></a
        >
        <button class="mobile-menu" id="menu-toggle" aria-label="Toggle menu">☰</button>
        <nav class="nav-links" id="site-nav">
          <a href="/events" data-link>Explore events</a>
          <a href="/verify-certificate" data-link>Verify certificate</a>
          ${signedIn
            ? html`<a href="/dashboard" data-link>My workspace</a>
                <button type="button" class="nav-signout" id="sign-out">Sign out ↗</button>`
            : html`<a href="/login" data-link class="button button-small">Sign in →</a>`}
        </nav>
      </div>
    </header>
    <main id="page">${content}</main>
    <footer class="footer">
      <div class="container footer-grid">
        <div>
          <div class="brand"><span class="brand-mark">E</span><span>EventHub</span></div>
          <p>One trusted place for campus events, attendance, proof and certificates.</p>
        </div>
        <div>
          <strong>Discover</strong><a href="/events" data-link>All events</a
          ><a href="/verify-certificate" data-link>Certificate verification</a>
        </div>
        <div>
          <strong>Account</strong><a href="/login" data-link>Sign in</a
          ><a href="/register" data-link>Create account</a>
        </div>
      </div>
    </footer>`;
}

function loading(message = "Loading…") {
  return html`<div class="container page">
    <div class="empty">
      <span>◌</span>
      <p>${escapeHtml(message)}</p>
    </div>
  </div>`;
}

function empty(message) {
  return html`<div class="empty">
    <span>✦</span>
    <p>${escapeHtml(message)}</p>
  </div>`;
}

function errorState(message = "We couldn't load this right now. Please try again.") {
  return html`<div class="empty error">
    <span>!</span>
    <p>${escapeHtml(message)}</p>
  </div>`;
}

function eventCard(event) {
  const image =
    event.bannerUrl ||
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=900&q=80";
  return html`<a href="/events/${encodeURIComponent(event.slug)}" data-link class="event-card">
    <div class="event-image" style="background-image:url('${escapeHtml(image)}')">
      <span>${escapeHtml(event.mode)}</span>
    </div>
    <div class="event-card-body">
      <small>${escapeHtml(event.category?.name || "Campus event")}</small>
      <h3>${escapeHtml(event.title)}</h3>
      <p>${escapeHtml(event.shortDescription)}</p>
      <div class="event-meta">
        <span>▣ ${formatDate(event.startAt)}</span
        ><span>⌖ ${escapeHtml(event.venueName || "Online")}</span>
      </div>
      <div class="event-card-foot">
        <span>${event.availableSeats ?? event.capacity ?? "—"} seats available</span
        ><b>View event →</b>
      </div>
    </div>
  </a>`;
}

async function getEvents(query = "") {
  const payload = await api(
    `/events?limit=20&sort=upcoming${query ? `&search=${encodeURIComponent(query)}` : ""}`,
  );
  return payload.data || [];
}

async function renderHome(sequence) {
  const token = localStorage.getItem(TOKEN_KEY);
  let events = [];
  let profile = null;
  let registrations = [];
  let certificates = [];
  const tasks = [getEvents()];
  if (token) {
    tasks.push(
      api("/auth/me")
        .then((x) => {
          profile = x.data;
        })
        .catch(() => {}),
      api("/registrations/me?limit=5")
        .then((x) => {
          registrations = x.data || [];
        })
        .catch(() => {}),
      api("/certificates/me")
        .then((x) => {
          certificates = x.data || [];
        })
        .catch(() => {}),
    );
  }
  try {
    events = await tasks[0];
    await Promise.all(tasks.slice(1));
  } catch (xhr) {
    if (sequence !== renderSequence) return;
    $("#app").html(
      shell(
        html`<div class="container page">
          ${errorState(apiError(xhr, "Unable to load events from the server."))}
        </div>`,
      ),
    );
    return;
  }
  if (sequence !== renderSequence) return;
  const initials =
    profile?.fullName
      ?.split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";
  const next = registrations.find((registration) => registration.event?.startAt);
  const present = registrations.filter(
    (registration) => registration.attendance?.status === "PRESENT",
  ).length;
  $("#app").html(
    shell(
      html` <section class="hero">
          <div class="container hero-grid">
            <div>
              <p class="eyebrow">THE CAMPUS PARTICIPATION PLATFORM</p>
              <h1>Show up for what <em>matters.</em></h1>
              <p class="hero-copy">
                Discover meaningful events, secure your seat, verify attendance and receive every
                certificate in one trusted workspace.
              </p>
              <div class="hero-actions">
                <a href="/events" data-link class="button">Explore upcoming events →</a>
                ${token
                  ? html`<button class="button button-ghost" id="hero-sign-out">
                      Sign out ↗
                    </button>`
                  : html`<a href="/login" data-link class="button button-ghost">Sign in →</a>`}
                <a href="/register" data-link class="button button-ghost">Create your profile</a>
              </div>
              <div class="trust-row">
                <span>✓</span><span>Attendance evidence is verified at the source</span>
              </div>
            </div>
            <div class="hero-card">
              <div class="hero-card-top">
                <span class="live-dot"></span><span>YOUR PARTICIPATION PASSPORT</span><b>▦</b>
              </div>
              <div class="passport-line">
                <div class="avatar">${escapeHtml(initials)}</div>
                <div>
                  <strong>${escapeHtml(profile?.fullName || "Your passport")}</strong
                  ><small
                    >${escapeHtml(
                      profile
                        ? [profile.department, profile.year ? `Year ${profile.year}` : ""]
                            .filter(Boolean)
                            .join(" · ")
                        : "Sign in to view your records",
                    )}</small
                  >
                </div>
              </div>
              <div class="passport-stats">
                <span
                  ><strong>${token ? registrations.length : "—"}</strong
                  ><small>registrations</small></span
                ><span
                  ><strong>${token ? certificates.length : "—"}</strong
                  ><small>certificates</small></span
                ><span
                  ><strong>${token ? present : "—"}</strong><small>verified events</small></span
                >
              </div>
              <div class="passport-event">
                <b>▣</b>
                <div>
                  <small>${token ? "NEXT UP" : "GET STARTED"}</small
                  ><strong
                    >${escapeHtml(
                      next?.event?.title ||
                        (token ? "No upcoming registrations" : "Sign in to view your events"),
                    )}</strong
                  >
                </div>
                ${next ? "<span class='check'>✓</span>" : ""}
              </div>
            </div>
          </div>
        </section>
        <section class="section container">
          <div class="section-heading">
            <div>
              <p class="eyebrow">FIND YOUR NEXT EXPERIENCE</p>
              <h2>What's happening</h2>
            </div>
            <a href="/events" data-link class="text-link">View all events →</a>
          </div>
          ${events.length
            ? html`<div class="event-grid">${events.slice(0, 6).map(eventCard).join("")}</div>`
            : empty("No upcoming events are published yet.")}
        </section>
        <section class="dark-band">
          <div class="container three-points">
            <div>
              <span class="point-number">01</span>
              <h3>Find your room</h3>
              <p>Search events by interest, department, date or mode.</p>
            </div>
            <div>
              <span class="point-number">02</span>
              <h3>Show up with proof</h3>
              <p>Your QR ticket and attendance timeline keep participation clear.</p>
            </div>
            <div>
              <span class="point-number">03</span>
              <h3>Keep the record</h3>
              <p>Attendance records, proof decisions and certificates stay in your workspace.</p>
            </div>
          </div>
        </section>`,
    ),
  );
}

async function renderEvents(sequence) {
  $("#app").html(shell(loading("Finding events…")));
  const query = new URLSearchParams(location.search).get("search") || "";
  let events;
  try {
    events = await getEvents(query);
  } catch (xhr) {
    if (sequence !== renderSequence) return;
    $("#app").html(
      shell(
        html`<div class="container page">
          ${errorState(apiError(xhr, "Unable to load events from the server."))}
        </div>`,
      ),
    );
    return;
  }
  if (sequence !== renderSequence) return;
  $("#app").html(
    shell(
      html`<div class="container page">
        <div class="page-intro">
          <p class="eyebrow">DISCOVER</p>
          <h1>Find your next event</h1>
          <p>Browse verified campus experiences and reserve your place.</p>
        </div>
        <form class="search-bar" id="event-search">
          <span>⌕</span
          ><input
            name="search"
            value="${escapeHtml(query)}"
            placeholder="Search by title, topic or city"
          /><button class="button">Search</button>
        </form>
        <div class="results-line"><strong>${events.length}</strong> events found</div>
        ${events.length
          ? html`<div class="event-grid">${events.map(eventCard).join("")}</div>`
          : empty("No events match your search.")}
      </div>`,
    ),
  );
}

async function renderEventDetails(slug, sequence) {
  $("#app").html(shell(loading("Loading event…")));
  let event;
  try {
    event = (await api(`/events/${encodeURIComponent(slug)}`)).data;
  } catch (xhr) {
    if (sequence !== renderSequence) return;
    $("#app").html(
      shell(
        html`<div class="container page">
          ${errorState(apiError(xhr, "Unable to load this event."))}
        </div>`,
      ),
    );
    return;
  }
  if (sequence !== renderSequence) return;
  if (!event) {
    $("#app").html(
      shell(html`<div class="container page">${errorState("Event not found.")}</div>`),
    );
    return;
  }
  const registered = new Date(event.registrationEndAt || event.startAt) >= new Date();
  $("#app").html(
    shell(
      html`<div class="event-detail">
        <section class="event-detail-hero">
          <div class="container">
            <a href="/events" data-link class="text-link">← All events</a>
            <p class="eyebrow">${escapeHtml(event.category?.name || event.mode)}</p>
            <h1>${escapeHtml(event.title)}</h1>
            <p>${escapeHtml(event.shortDescription)}</p>
          </div>
        </section>
        <div class="container detail-grid">
          <article class="detail-copy">
            <h2>About this event</h2>
            <p>${escapeHtml(event.description)}</p>
            <h3>Hosted by</h3>
            <p>${escapeHtml(event.organizer?.name || "EventHub organizer")}</p>
          </article>
          <aside class="registration-card">
            <p class="eyebrow">EVENT DETAILS</p>
            <div class="detail-row">
              <b>▣</b
              ><span><small>Date</small><strong>${formatDate(event.startAt, true)}</strong></span>
            </div>
            <div class="detail-row">
              <b>⌖</b
              ><span
                ><small>Venue</small
                ><strong>${escapeHtml(event.venueName || "Online")}</strong></span
              >
            </div>
            <div class="detail-row">
              <b>◉</b
              ><span
                ><small>Seats</small
                ><strong>${event.availableSeats ?? event.capacity ?? "—"} available</strong></span
              >
            </div>
            <button
              class="button full"
              id="register-event"
              data-event-id="${escapeHtml(event.id)}"
              ${registered ? "" : "disabled"}
            >
              ${registered ? "Register for this event" : "Registration closed"}
            </button>
            <p class="form-message" id="register-message"></p>
          </aside>
        </div>
      </div>`,
    ),
  );
}

function renderAuth(mode) {
  const login = mode === "login";
  $("#app").html(
    shell(
      html`<div class="auth-page">
        <div class="auth-panel">
          <a href="/" data-link class="brand"
            ><span class="brand-mark">E</span><span>EventHub</span></a
          >
          <p class="eyebrow">${login ? "WELCOME BACK" : "JOIN THE COMMUNITY"}</p>
          <h1>${login ? "Your next experience is waiting." : "Make your participation count."}</h1>
          <p>
            ${login
              ? "Sign in to manage tickets, attendance records and certificates."
              : "Create one secure profile for every event, attendance record and certificate."}
          </p>
          <form id="auth-form">
            ${login
              ? ""
              : html`<label>Full name<input required name="fullName" autocomplete="name" /></label
                  ><label>Department<input name="department" /></label
                  ><label>Enrollment number<input name="enrollmentNumber" /></label>`}
            <label>Email<input required type="email" name="email" autocomplete="email" /></label>
            <label
              >Password<input
                required
                minlength="8"
                type="password"
                name="password"
                autocomplete="${login ? "current-password" : "new-password"}"
            /></label>
            ${login
              ? ""
              : html`<label
                  >Confirm password<input
                    required
                    minlength="8"
                    type="password"
                    name="confirmPassword"
                    autocomplete="new-password"
                /></label>`}
            <p class="form-error" id="auth-error"></p>
            <button class="button full">${login ? "Sign in" : "Create account"}</button>
          </form>
          <p class="switch-auth">
            ${login
              ? html`New here? <a href="/register" data-link>Create an account</a>`
              : html`Already have an account? <a href="/login" data-link>Sign in</a>`}
          </p>
        </div>
        <div class="auth-art">
          <span class="eyebrow">EVENTHUB / 2026</span>
          <blockquote>“The best record of an event is the change it makes in you.”</blockquote>
          <div class="art-stamp">✓ Verified participation, built in</div>
        </div>
      </div>`,
    ),
  );
  $("#auth-form").data("mode", mode);
}

function renderVerify() {
  $("#app").html(
    shell(
      html`<div class="container page narrow">
        <div class="center-intro">
          <span class="icon-circle">✓</span>
          <p class="eyebrow">PUBLIC VERIFICATION</p>
          <h1>Verify a certificate</h1>
          <p>Confirm an EventHub certificate using its certificate number.</p>
        </div>
        <form class="verify-form" id="verify-form">
          <label
            >Certificate number<input
              required
              name="number"
              placeholder="CERT-EVT-2026-000001" /></label
          ><button class="button full">Verify certificate</button>
        </form>
        <div id="verification-output"></div>
      </div>`,
    ),
  );
}

async function loadWorkspaceData() {
  const token = localStorage.getItem(TOKEN_KEY);
  const [profile, registrations, certificates, notifications] = await Promise.all([
    api("/auth/me").then((x) => x.data),
    api("/registrations/me?limit=50").then((x) => x.data || []),
    api("/certificates/me")
      .then((x) => x.data || [])
      .catch(() => []),
    api("/notifications?limit=50")
      .then((x) => x.data || [])
      .catch(() => []),
  ]);
  return { profile, registrations, certificates, notifications };
}

function workspaceRows(section, data) {
  if (section === "certificates") {
    return data.certificates.length
      ? data.certificates
          .map(
            (item) =>
              html`<div class="certificate-row">
                <div class="certificate-seal">✓</div>
                <div>
                  <strong>${escapeHtml(item.event?.title)}</strong
                  ><span>${escapeHtml(item.certificateNumber)}</span
                  ><small>Issued ${formatDate(item.issuedAt)}</small>
                </div>
                <button
                  class="button button-small open-certificate"
                  data-url="${escapeHtml(item.certificateUrl)}"
                >
                  Open
                </button>
              </div>`,
          )
          .join("")
      : empty("Certificates appear after verified attendance.");
  }
  if (section === "tickets") {
    const selected = data.registrations.find((item) => item.ticket) || data.registrations[0];
    return selected
      ? html`<div class="ticket-view">
          <div class="qr-box" id="ticket-qr">▦</div>
          <div>
            <strong>${escapeHtml(selected.event?.title)}</strong>
            <p>
              ${formatDate(selected.event?.startAt)} ·
              ${escapeHtml(selected.event?.venueName || "Online")}
            </p>
            <span class="status ${escapeHtml(selected.status.toLowerCase())}"
              >${escapeHtml(selected.status)}</span
            >${selected.status === "CONFIRMED"
              ? html`<button
                  class="button button-small ticket-issue"
                  data-registration-id="${escapeHtml(selected.id)}"
                >
                  Show QR ticket
                </button>`
              : ""}<small class="ticket-token" id="ticket-note"
              >Signed ticket tokens should never be shared.</small
            >
          </div>
        </div>`
      : empty("Confirmed registrations will appear here with their QR ticket.");
  }
  const rows = section === "notifications" ? data.notifications : data.registrations;
  return rows.length
    ? rows
        .map(
          (row) =>
            html`<div class="list-row large">
              <div class="list-icon">▣</div>
              <div>
                <strong
                  >${escapeHtml(
                    row.event?.title || row.notification?.title || "Notification",
                  )}</strong
                ><small
                  >${escapeHtml(
                    row.event?.startAt
                      ? `${formatDate(row.event.startAt)} · ${row.event.venueName || "Online"}`
                      : row.notification?.message || "",
                  )}</small
                >
              </div>
              <span
                class="status ${escapeHtml(
                  String(row.status || (row.readAt ? "read" : "unread")).toLowerCase(),
                )}"
                >${escapeHtml(row.status || (row.readAt ? "Read" : "Unread"))}</span
              >
            </div>`,
        )
        .join("")
    : empty("Nothing here yet.");
}

async function renderDashboard(section, sequence) {
  if (!localStorage.getItem(TOKEN_KEY)) {
    navigate("/login", true);
    return;
  }
  $("#app").html(loading("Loading your workspace…"));
  let data;
  try {
    data = await loadWorkspaceData();
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    navigate("/login", true);
    return;
  }
  if (sequence !== renderSequence) return;
  const active = section || "overview";
  const links = [
    ["overview", "Overview", "/dashboard"],
    ["events", "My events", "/dashboard/events"],
    ["tickets", "Tickets & QR", "/dashboard/tickets"],
    ["certificates", "Certificates", "/dashboard/certificates"],
    ["notifications", "Notifications", "/dashboard/notifications"],
  ];
  const content =
    active === "overview"
      ? html`<div class="stat-grid">
            <div class="stat-card">
              <small>Registrations</small><strong>${data.registrations.length}</strong
              ><span>Across all events</span>
            </div>
            <div class="stat-card">
              <small>Certificates</small><strong>${data.certificates.length}</strong
              ><span>Your achievements</span>
            </div>
            <div class="stat-card accent">
              <small>Verification status</small><strong>Secure</strong
              ><span>Evidence-first records</span>
            </div>
          </div>
          <section class="panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">UP NEXT</p>
                <h2>Registered events</h2>
              </div>
            </div>
            ${workspaceRows("events", data)}
          </section>`
      : html`<section class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">YOUR RECORDS</p>
              <h2>${escapeHtml(links.find((item) => item[0] === active)?.[1] || "Workspace")}</h2>
            </div>
          </div>
          ${workspaceRows(active, data)}
        </section>`;
  $("#app").html(
    html`<div class="dashboard-shell">
      <aside class="dashboard-side" id="dashboard-side">
        <div class="dash-brand">
          <a href="/" data-link><span class="brand-mark">E</span> EventHub</a
          ><button id="close-dashboard-menu">×</button>
        </div>
        <div class="user-chip">
          <div class="avatar">${escapeHtml(data.profile.fullName.slice(0, 2).toUpperCase())}</div>
          <div>
            <strong>${escapeHtml(data.profile.fullName)}</strong
            ><small>${escapeHtml(data.profile.roles?.[0] || "Student")}</small>
          </div>
        </div>
        <nav>
          ${links
            .map(
              ([id, label, url]) =>
                html`<a href="${url}" data-link class="${active === id ? "active" : ""}"
                  ><span>•</span>${label}</a
                >`,
            )
            .join("")}
        </nav>
        <button class="dash-logout" id="sign-out">↗ Sign out</button>
      </aside>
      <section class="dashboard-main">
        <div class="dash-top">
          <button class="mobile-menu" id="open-dashboard-menu">☰</button>
          <div>
            <p class="eyebrow">MY WORKSPACE</p>
            <h1>${escapeHtml(links.find((item) => item[0] === active)?.[1] || "Overview")}</h1>
          </div>
          <a href="/events" data-link class="button button-small">Explore events →</a>
        </div>
        ${content}
      </section>
    </div>`,
  );
}

async function signOut() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    /* Local logout still succeeds. */
  }
  localStorage.removeItem(TOKEN_KEY);
  navigate("/", true);
}

async function renderApp() {
  const sequence = ++renderSequence;
  const path = location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return renderHome(sequence);
  if (path === "/events") return renderEvents(sequence);
  if (path.startsWith("/events/"))
    return renderEventDetails(decodeURIComponent(path.slice(8)), sequence);
  if (path === "/login" || path === "/register") return renderAuth(path.slice(1));
  if (path === "/verify-certificate") return renderVerify();
  if (path === "/dashboard") return renderDashboard("overview", sequence);
  if (path.startsWith("/dashboard/")) return renderDashboard(path.slice(11), sequence);
  navigate("/", true);
}

$(document).on("click", "a[data-link]", function handleLink(event) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || this.target === "_blank") return;
  const url = new URL(this.href, location.origin);
  if (url.origin !== location.origin) return;
  event.preventDefault();
  navigate(`${url.pathname}${url.search}`);
});

$(document).on("click", "#menu-toggle", () => $("#site-nav").toggleClass("open"));
$(document).on("click", "#sign-out, #hero-sign-out", signOut);
$(document).on("click", "#open-dashboard-menu", () => $("#dashboard-side").addClass("open"));
$(document).on("click", "#close-dashboard-menu", () => $("#dashboard-side").removeClass("open"));

$(document).on("submit", "#event-search", function handleSearch(event) {
  event.preventDefault();
  const query = String(new FormData(this).get("search") || "").trim();
  navigate(query ? `/events?search=${encodeURIComponent(query)}` : "/events");
});

$(document).on("submit", "#auth-form", async function handleAuth(event) {
  event.preventDefault();
  const mode = $(this).data("mode");
  const values = Object.fromEntries(new FormData(this));
  $("#auth-error").text("");
  $(this).find("button").prop("disabled", true).text("Working…");
  try {
    const payload = await api(`/auth/${mode}`, { method: "POST", data: values }, false);
    if (mode === "login") {
      localStorage.setItem(TOKEN_KEY, payload.data.accessToken);
      navigate("/dashboard");
    } else {
      navigate("/login?registered=1");
    }
  } catch (xhr) {
    $("#auth-error").text(apiError(xhr, "Unable to continue."));
    $(this)
      .find("button")
      .prop("disabled", false)
      .text(mode === "login" ? "Sign in" : "Create account");
  }
});

$(document).on("click", "#register-event", async function registerEvent() {
  if (!localStorage.getItem(TOKEN_KEY)) {
    navigate("/login");
    return;
  }
  const button = $(this).prop("disabled", true).text("Registering…");
  try {
    await api(`/events/${button.data("event-id")}/register`, {
      method: "POST",
      data: { answers: {} },
    });
    $("#register-message").addClass("success-text").text("Registration submitted successfully.");
    button.text("Registered");
  } catch (xhr) {
    button.prop("disabled", false).text("Register for this event");
    $("#register-message").addClass("form-error").text(apiError(xhr, "Registration failed."));
  }
});

$(document).on("submit", "#verify-form", async function verifyCertificate(event) {
  event.preventDefault();
  const number = String(new FormData(this).get("number") || "").trim();
  const output = $("#verification-output").html(loading("Checking certificate…"));
  try {
    const result = (await api(`/certificates/verify/${encodeURIComponent(number)}`)).data;
    output.html(
      result.valid
        ? html`<div class="verification-result valid">
            <b>✓</b>
            <div>
              <strong>Valid certificate</strong>
              <p>
                ${escapeHtml(result.certificate.participant)} participated in
                ${escapeHtml(result.certificate.event)}.
              </p>
              <small>Issued ${formatDate(result.certificate.issuedAt)}</small>
            </div>
          </div>`
        : html`<div class="verification-result invalid">
            <b>×</b>
            <div>
              <strong>Certificate not found</strong>
              <p>Check the number and try again.</p>
            </div>
          </div>`,
    );
  } catch (xhr) {
    output.html(
      html`<div class="verification-result invalid">
        <b>×</b>
        <div>
          <strong>Verification failed</strong>
          <p>${escapeHtml(apiError(xhr))}</p>
        </div>
      </div>`,
    );
  }
});

$(document).on("click", ".ticket-issue", async function issueTicket() {
  const note = $("#ticket-note").text("Issuing secure ticket…");
  try {
    const token = (
      await api(`/registrations/${$(this).data("registration-id")}/ticket`, { method: "POST" })
    ).data.ticketToken;
    const canvas = document.createElement("canvas");
    await QRCode.toCanvas(canvas, token, { width: 190, margin: 1 });
    $("#ticket-qr").empty().append(canvas);
    note.text("Ticket token is shown as a signed QR payload. Do not share it.");
  } catch (xhr) {
    note.addClass("form-error").text(apiError(xhr, "Unable to issue ticket."));
  }
});

$(document).on("click", ".open-certificate", async function openCertificate() {
  const popup = window.open("about:blank", "_blank");
  if (!popup) return;
  const target = new URL($(this).data("url"), location.origin);
  if (!target.pathname.startsWith("/api/v1/files")) {
    popup.location.href = target.toString();
    return;
  }
  try {
    const response = await fetch(target, {
      credentials: "include",
      headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` },
    });
    if (!response.ok) throw new Error("Unable to open certificate");
    const blob = await response.blob();
    popup.location.href = URL.createObjectURL(blob);
  } catch {
    popup.close();
  }
});

window.addEventListener("popstate", renderApp);
renderApp();
