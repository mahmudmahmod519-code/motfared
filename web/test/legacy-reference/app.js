// Opened inside the new dashboard's frame: hide the sidebar, keep everything else.
if (/[?&]embed=1/.test(location.search)) document.documentElement.classList.add("embedded");
const STATUS_LABELS = {
  new: "جديد",
  no_answer: "لم يرد",
  very_interested: "مهتم جداً",
  interested: "مهتم",
  not_interested: "غير مهتم",
  booked: "تم الحجز",
  examined: "تم الكشف",
  no_show: "محضرش",
  follow_up: "متابعة لاحقة",
  unreachable: "مقفول - مبيردش",
};
const STATUS_COLORS = {
  new: "var(--text-muted)",
  no_answer: "var(--text-muted)",
  very_interested: "var(--good)",
  interested: "var(--blue)",
  not_interested: "var(--critical)",
  booked: "var(--aqua)",
  examined: "var(--violet)",
  no_show: "var(--critical)",
  follow_up: "var(--warning)",
  unreachable: "var(--text-muted)",
};

let token = localStorage.getItem("admin_token");
let userName = localStorage.getItem("admin_name");
let userRole = localStorage.getItem("admin_role");

const DASHBOARD_ROLES = ["super_admin", "admin", "team_lead"];
// Groups live in the database as 1, 2 and 3; everyone calls them A, B and C. Only the
// label changes here — the number is still what gets sent back to the server. Mirrors the
// same mapping in server.js.
const GROUP_LABELS = { 1: "A", 2: "B", 3: "C" };
const GROUP_CHOICES = Object.values(GROUP_LABELS).join(" أو ");

function groupLabel(id) {
  return GROUP_LABELS[id] || "—";
}

const ROLE_LABELS = {
  super_admin: "سوبر أدمن",
  admin: "أدمن",
  team_lead: "رئيس فريق",
  sales: "سيلز",
};

// Only a super admin manages accounts; an admin runs the business data; a team lead
// reads their own group. The server enforces all of this too - this only hides
// controls that would fail anyway.
const isSuperAdmin = () => userRole === "super_admin";
const canManageData = () => userRole === "super_admin" || userRole === "admin";
// Day-to-day sales operations: leads, bookings, follow-ups, and rep/doctor links. A team
// lead is included because they are the one running the floor; the server still confines
// every one of these requests to their own group.
const canEditOperations = () =>
  userRole === "super_admin" || userRole === "admin" || userRole === "team_lead";
// Team leads know first when their own rep is out sick, so reassigning a reminder call
// is open to them too - unlike the rest of canManageData(), which stays admin+.
const canReassignBookings = canEditOperations;

function showError(msg) { document.getElementById("login-error").textContent = msg; }

/* ------------------------------------------------------------------------
   One HTTP helper for every request the page makes.

   Attaches the session token, and turns the four failure shapes into one
   behaviour each: 401 ends the session and shows the login screen with a
   reason; 429 says "slow down"; any other non-2xx surfaces the server's own
   Arabic `error`; and a network failure says the server is unreachable.

   Failures throw an ApiError after reporting themselves (as a toast, unless
   `silent`), so a caller that only wants the happy path can write
   `const { reps } = await api("/admin/reps")` and simply stop when it fails -
   the unhandledrejection hook below swallows the already-reported error.
   Callers that show the message inline pass `silent: true` and read
   `e.message` in their own catch.
   ------------------------------------------------------------------------ */
class ApiError extends Error {
  constructor(status, data, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data || {};
    this.reported = false;
  }
}

const NETWORK_ERROR = "مفيش اتصال بالسيرفر";
const RATE_LIMIT_ERROR = "طلبات كتير في وقت قصير، استنى دقيقة";

/**
 * @param path   URL path
 * @param opts   { method, body (JSON-encoded), form (FormData), headers, silent, raw, noAuth }
 *               raw: resolve with the Response (for blobs) instead of parsed JSON.
 */
async function api(path, opts = {}) {
  const { method = "GET", body, form, headers = {}, silent = false, raw = false, noAuth = false } = opts;
  const h = { ...headers };
  if (!noAuth && token) h.Authorization = `Bearer ${token}`;
  const init = { method, headers: h };
  if (form) init.body = form;
  else if (body !== undefined) {
    h["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, init);
  } catch {
    const err = new ApiError(0, {}, NETWORK_ERROR);
    if (!silent) report(err);
    throw err;
  }

  if (res.status === 401 && !noAuth) {
    logout("انتهت الجلسة — سجّل دخول تاني");
    const err = new ApiError(401, {}, "انتهت الجلسة");
    err.reported = true;
    throw err;
  }

  if (res.ok) {
    if (raw) return res;
    if (res.status === 204) return {};
    return res.json().catch(() => ({}));
  }

  const data = await res.json().catch(() => ({}));
  const message = res.status === 429 ? RATE_LIMIT_ERROR : data.error || `حصل خطأ (${res.status})`;
  const err = new ApiError(res.status, data, message);
  if (!silent) report(err);
  throw err;
}

function report(err) {
  if (err.reported) return;
  err.reported = true;
  toast(err.message, "bad");
}

// An ApiError has already told the user what happened, so a caller that let it
// propagate needs no second report - and no console noise either.
window.addEventListener("unhandledrejection", (e) => {
  if (e.reason instanceof ApiError) e.preventDefault();
});

async function doLogin() {
  showError("");
  const phone = document.getElementById("login-phone").value.trim();
  const password = document.getElementById("login-password").value;
  if (!phone || !password) return showError("من فضلك ادخل رقم التليفون وكلمة السر");

  try {
    const data = await api("/login", { method: "POST", body: { phone, password }, silent: true, noAuth: true });
    if (!DASHBOARD_ROLES.includes(data.user.role)) {
      return showError("الحساب ده مالوش صلاحية دخول لوحة التحكم");
    }

    token = data.token;
    userName = data.user.name;
    userRole = data.user.role;
    localStorage.setItem("admin_token", token);
    localStorage.setItem("admin_name", userName);
    localStorage.setItem("admin_role", userRole);
    enterDashboard();
  } catch (e) {
    showError(e instanceof ApiError && e.status ? e.message === `حصل خطأ (${e.status})` ? "بيانات غير صحيحة" : e.message : NETWORK_ERROR);
  }
}

/**
 * The sign-out button. Tells the server first so the token itself stops working -
 * forgetting it in this browser alone left it valid for the rest of its seven days -
 * then clears the page. Best effort: the server being unreachable must not trap
 * someone in a session they are trying to leave.
 */
async function signOut() {
  try {
    await api("/logout", { method: "POST", silent: true });
  } catch {
    // Either it is revoked or the network is gone; the page is cleared either way.
  }
  logout();
}

/** Ends the session. `reason`, when given, is shown on the login screen. */
function logout(reason) {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_name");
  localStorage.removeItem("admin_role");
  token = null;
  userRole = null;
  // The doorbell belongs to the session that opened it.
  if (noWorkStream) noWorkStream.abort();
  closeAllModals();
  document.getElementById("dashboard-view").classList.add("hidden");
  document.getElementById("login-view").classList.remove("hidden");
  showError(reason || "");
}

// Lead names/phones originate from uploaded Excel files, i.e. untrusted external
// input. Anything interpolated into innerHTML must go through this first.
function esc(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Production is served from Railway's own domain. Anything on a loopback or private
// address is somebody working on the code, and is where a template bug should be loud.
const IS_DEV =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  location.hostname === "[::1]" ||
  location.hostname === "" ||
  /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);

/**
 * Finds the cell a row builder means to write into, by class instead of by position.
 *
 * `tr.children[n]` looks safe and is not: add one `<td>` anywhere above it and every
 * later index silently shifts one column left, so the code keeps running and writes
 * into the wrong column. That is exactly what happened to the worksheet's status badge,
 * which spent its life being appended to - or overwriting - وقت الموعد while الحالة
 * stayed blank. A missing target is a bug in the row template, never a data condition,
 * so on a dev host it throws; in production it is logged and the cell is skipped, which
 * leaves the column empty rather than corrupting its neighbour.
 */
function rowCell(tr, className) {
  const cell = tr.querySelector(`td.${className}`);
  if (!cell) {
    const message = `row template has no <td class="${className}"> - check the column list`;
    if (IS_DEV) throw new Error(message);
    console.error(message, tr);
    return null;
  }
  return cell;
}

/* ------------------------------------------------------------------------
   Dialogs and toasts.

   The browser's own alert/confirm/prompt are gone from this app. They block
   the whole page, cannot be styled, cannot show more than one field, and
   force free text where the answer is really one of three choices - the
   group prompt used to accept "أ" or "b " or anything else a person typed.
   These replace them with real UI: a form with typed fields for input, and
   a non-blocking toast for anything that is only being reported.
   ------------------------------------------------------------------------ */

/**
 * Non-blocking notification. `kind` is "good", "bad", or neutral when omitted.
 *
 * `action` ({ label, run, ms }) adds a button - the inline undo after a change that
 * was one mis-click away, shown for `ms` (default 8s) instead of the usual 4s.
 */
/* ---------------------------------------------------------------- "مفيش شغل" notices */

// A rep pressing "مفيش شغل" is something the owner wants to hear about as it happens, on
// whatever this dashboard is open on - a laptop or a phone's browser. Each press is raised
// as a toast and, once the person allowed it, as a system notification, which is what
// reaches a phone lying on the desk. No push service: the tab has to be open somewhere.
//
// It used to arrive minutes late, or only after a refresh (owner, 2026-09-21), for three
// reasons, each fixed here:
//   - the page asked once a minute, and NOT AT ALL while its tab was hidden - and a
//     dashboard tab is hidden most of the day. It now holds a stream the server rings on
//     every press (bytes on a connection wake a background tab; a timer barely does), and
//     the timer underneath is a fallback that runs hidden or not;
//   - coming back to the tab did nothing until the next tick. It asks at once now;
//   - a refresh forgot where it had got to, and the first look after one is silent by
//     design - so whatever was pressed while the tab was away was never shown. The
//     watermark is kept in the browser now, and a reload picks up from it.
const NO_WORK_POLL_MS = 20 * 1000;
const NO_WORK_SINCE_KEY = "no_work_since";
/** A watermark older than this is a new day's first look, not a backlog to replay. */
const NO_WORK_SINCE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
let noWorkSince = loadNoWorkSince();
let noWorkTimer = null;
let noWorkPolling = false;
let noWorkPollAgain = false;
let noWorkStream = null;
const noWorkSeen = new Set();

function loadNoWorkSince() {
  try {
    const saved = localStorage.getItem(NO_WORK_SINCE_KEY);
    if (!saved || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(saved)) return null;
    const age = Date.now() - Date.parse(saved.replace(" ", "T") + "Z");
    return age >= 0 && age < NO_WORK_SINCE_MAX_AGE_MS ? saved : null;
  } catch {
    return null;
  }
}

/** Through the service worker where there is one: a phone's browser raises notifications no other way. */
async function raiseNoWorkNotification(text, tag) {
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) return void (await reg.showNotification("مفيش شغل", { body: text, tag, dir: "rtl", lang: "ar" }));
    new Notification("مفيش شغل", { body: text, tag });
  } catch {
    // The toast stands.
  }
}

function noWorkNotificationsOn() {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

function renderNotifyButton() {
  const btn = document.getElementById("notify-btn");
  if (!btn) return;
  if (typeof Notification === "undefined") {
    btn.hidden = true;
    return;
  }
  btn.hidden = false;
  btn.textContent = noWorkNotificationsOn() ? "🔔 الإشعارات شغالة" : Notification.permission === "denied" ? "🔕 الإشعارات مقفولة من المتصفح" : "🔔 فعّل الإشعارات";
  btn.disabled = Notification.permission === "denied";
}

async function pollNoWork() {
  if (!token) return;
  // One look at a time: the stream, the timer and a tab coming back can all ask in the
  // same second, and two looks from one watermark would raise every press twice.
  if (noWorkPolling) {
    noWorkPollAgain = true;
    return;
  }
  noWorkPolling = true;
  try {
    let data;
    try {
      data = await api(`/admin/no-work/recent${noWorkSince ? `?since=${encodeURIComponent(noWorkSince)}` : ""}`, { silent: true });
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      return;
    }
    // The first look ever only sets the watermark: an hour-old press is not news.
    const first = noWorkSince === null;
    noWorkSince = data.now;
    try {
      localStorage.setItem(NO_WORK_SINCE_KEY, data.now);
    } catch {
      // Private mode: the watermark lives as long as the page does.
    }
    if (first) return;
    for (const p of [...data.presses].reverse()) {
      if (noWorkSeen.has(p.id)) continue;
      noWorkSeen.add(p.id);
      const text = `${p.repName} داس «مفيش شغل» (${p.countToday} من ${data.required}) — ${timeOnly(p.at)}`;
      toast(text, "warning sticky");
      if (noWorkNotificationsOn()) raiseNoWorkNotification(text, `no-work-${p.id}`);
    }
  } finally {
    noWorkPolling = false;
    if (noWorkPollAgain) {
      noWorkPollAgain = false;
      pollNoWork();
    }
  }
}

/**
 * Holds the server's doorbell open and looks the moment it rings. Read with fetch, not
 * EventSource, because EventSource cannot send the Authorization header and a token in a
 * URL ends up in logs. Any end - a deploy, a dropped network, a logout - is followed by
 * another try a few seconds on; the timer covers the gap.
 */
async function holdNoWorkStream() {
  if (noWorkStream || !token) return;
  const mine = (noWorkStream = new AbortController());
  try {
    const res = await fetch("/admin/no-work/stream", { headers: { Authorization: `Bearer ${token}` }, signal: mine.signal });
    if (!res.ok || !res.body) throw new Error("no stream");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (decoder.decode(value, { stream: true }).includes("data:")) pollNoWork();
    }
  } catch {
    // Falls through to the retry.
  } finally {
    if (noWorkStream === mine) noWorkStream = null;
    if (token) setTimeout(holdNoWorkStream, 5000);
  }
}

function startNoWorkWatch() {
  renderNotifyButton();
  if (noWorkTimer) clearInterval(noWorkTimer);
  pollNoWork();
  noWorkTimer = setInterval(pollNoWork, NO_WORK_POLL_MS);
  holdNoWorkStream();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
}

// Back on the tab, or back online: look now rather than at the next tick.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) pollNoWork();
});
window.addEventListener("online", () => {
  pollNoWork();
  holdNoWorkStream();
});

function toast(message, kind = "", action = null) {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    stack.setAttribute("role", "status");
    stack.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
  }

  const el = document.createElement("div");
  el.className = `toast ${kind}`.trim();
  const text = document.createElement("div");
  text.className = "toast-text";
  text.textContent = message;
  el.appendChild(text);

  const remove = () => el.remove();
  if (action) {
    const btn = document.createElement("button");
    btn.className = "undo-btn";
    btn.textContent = action.label;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await action.run();
      } finally {
        remove();
      }
    });
    el.appendChild(btn);
  }

  const close = document.createElement("button");
  close.textContent = "✕";
  close.setAttribute("aria-label", "إغلاق");
  close.title = "إغلاق";
  el.appendChild(close);
  stack.appendChild(el);

  // An error stays until dismissed: it usually needs acting on, and a message
  // that vanishes before it is read is worse than no message.
  close.addEventListener("click", remove);
  if (action) setTimeout(remove, action.ms || 8000);
  // A notice somebody is meant to come back to - a rep pressing "مفيش شغل" - waits for
  // its ✕ like an error does: four seconds is gone before the tab is even looked at.
  else if (kind !== "bad" && kind !== "warning sticky") setTimeout(remove, 4000);
  return el;
}

/* ------------------------------------------------------------------------
   One modal shell for every dialog on the page.

   Static modals (lead, password, activity, monthly) and generated ones
   (openDialog, pickReps) all pass through here, so Escape, backdrop click,
   the focus trap, and focus restore behave the same everywhere.
   ------------------------------------------------------------------------ */
const openModals = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * @param backdrop   the .modal-backdrop element (its first child is the .modal panel)
 * @param onDismiss  called when the user backs out via Escape or the backdrop
 * @param initialFocus  element to focus; defaults to the first field, else the last
 *                      button (the cancel side) so a stray Enter never confirms.
 * @param onEnter    optional handler for Enter pressed inside a single-line field
 * @returns close()  removes the trap and restores focus; the caller hides/removes the element
 */
function openModalShell(backdrop, { onDismiss, initialFocus, onEnter } = {}) {
  const panel = backdrop.querySelector(".modal") || backdrop.firstElementChild;
  if (panel) {
    if (!panel.getAttribute("role")) panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
  }
  const previous = document.activeElement;

  const focusables = () => [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);

  const onKey = (e) => {
    // Only the topmost dialog reacts.
    if (openModals[openModals.length - 1]?.backdrop !== backdrop) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onDismiss?.();
      return;
    }
    if (e.key === "Tab") {
      const items = focusables();
      if (!items.length) return e.preventDefault();
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (e.key === "Enter" && onEnter) {
      const t = e.target;
      // A button acts on Enter by itself; a textarea needs the newline.
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT")) {
        e.preventDefault();
        onEnter();
      }
    }
  };
  const onBackdropClick = (e) => {
    if (e.target === backdrop) onDismiss?.();
  };

  document.addEventListener("keydown", onKey);
  backdrop.addEventListener("click", onBackdropClick);
  const entry = { backdrop, onKey, onBackdropClick, previous, onDismiss };
  openModals.push(entry);

  const target = initialFocus || focusables()[0] || panel;
  if (target === panel) panel.tabIndex = -1;
  target.focus();

  return () => {
    document.removeEventListener("keydown", onKey);
    backdrop.removeEventListener("click", onBackdropClick);
    const i = openModals.indexOf(entry);
    if (i >= 0) openModals.splice(i, 1);
    if (previous && typeof previous.focus === "function" && document.contains(previous)) previous.focus();
  };
}

/** Closes every open dialog - on logout, so nothing is left floating over the login screen. */
function closeAllModals() {
  [...openModals].reverse().forEach((m) => m.onDismiss?.());
}

// Static modals: one open/close pair, keyed by the element id.
const staticModalClosers = new Map();

function showStaticModal(id, { onDismiss, initialFocus, onEnter } = {}) {
  const backdrop = document.getElementById(id);
  if (staticModalClosers.has(id)) return;
  backdrop.classList.remove("hidden");
  const close = openModalShell(backdrop, {
    onDismiss: onDismiss || (() => hideStaticModal(id)),
    initialFocus,
    onEnter,
  });
  staticModalClosers.set(id, close);
}

function hideStaticModal(id) {
  const close = staticModalClosers.get(id);
  staticModalClosers.delete(id);
  document.getElementById(id).classList.add("hidden");
  if (close) close();
}

let dialogFieldSeq = 0;

/**
 * A modal form. Resolves to an object of field values, or null if dismissed.
 *
 * With no fields it is a confirmation box; with fields it is a form. Either way
 * the caller awaits one promise and gets null for "the user backed out", so the
 * call sites read the same as the confirm()/prompt() they replace.
 *
 * @param fields [{ name, label, type, options, value, placeholder, required, hint }]
 *        type "select" takes options: [{ value, label }]. Everything else maps to
 *        an <input type>, plus "textarea".
 */
function openDialog({ title, sub, fields = [], confirmLabel = "تأكيد", cancelLabel = "إلغاء", danger = false, validate = null }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    const modal = document.createElement("div");
    modal.className = "modal";
    backdrop.appendChild(modal);

    const heading = document.createElement("h2");
    heading.textContent = title;
    modal.appendChild(heading);
    if (sub) {
      const subEl = document.createElement("div");
      subEl.className = "sub";
      subEl.textContent = sub;
      modal.appendChild(subEl);
    }

    const inputs = new Map();
    for (const field of fields) {
      const wrap = document.createElement("div");
      wrap.className = "field";
      const fieldId = `dlg-field-${++dialogFieldSeq}`;
      const label = document.createElement("label");
      label.textContent = field.label;
      label.htmlFor = fieldId;
      wrap.appendChild(label);

      let input;
      if (field.type === "select") {
        input = document.createElement("select");
        for (const opt of field.options || []) {
          const o = document.createElement("option");
          o.value = opt.value;
          o.textContent = opt.label;
          input.appendChild(o);
        }
      } else if (field.type === "textarea") {
        input = document.createElement("textarea");
        input.rows = field.rows || 3;
      } else {
        input = document.createElement("input");
        input.type = field.type || "text";
      }
      input.id = fieldId;
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.autocomplete) input.autocomplete = field.autocomplete;
      if (field.value != null) input.value = String(field.value);
      inputs.set(field.name, { input, field });
      wrap.appendChild(input);

      if (field.hint) {
        const hint = document.createElement("div");
        hint.style.cssText = "font-size:12px; color:var(--text-muted); margin-top:4px";
        hint.textContent = field.hint;
        wrap.appendChild(hint);
      }
      modal.appendChild(wrap);
    }

    const error = document.createElement("p");
    error.className = "error";
    modal.appendChild(error);

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const confirmBtn = document.createElement("button");
    confirmBtn.className = danger ? "danger" : "primary";
    confirmBtn.textContent = confirmLabel;
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = cancelLabel;
    actions.append(confirmBtn, cancelBtn);
    modal.appendChild(actions);

    let closeShell = null;
    const close = (result) => {
      if (closeShell) closeShell();
      closeShell = null;
      backdrop.remove();
      resolve(result);
    };
    const submit = () => {
      const values = {};
      for (const [name, { input, field }] of inputs) {
        const value = input.type === "password" ? input.value : input.value.trim();
        if (field.required && !value) {
          error.textContent = `${field.label} مطلوب`;
          input.focus();
          return;
        }
        values[name] = value;
      }
      // A caller-side check (password length, matching fields) can refuse the submit
      // by returning a message, which is shown without closing the form.
      if (typeof validate === "function") {
        const problem = validate(values);
        if (problem) {
          error.textContent = problem;
          return;
        }
      }
      close(values);
    };

    confirmBtn.addEventListener("click", submit);
    cancelBtn.addEventListener("click", () => close(null));

    heading.id = `dlg-title-${++dialogFieldSeq}`;
    modal.setAttribute("aria-labelledby", heading.id);
    document.body.appendChild(backdrop);
    const first = inputs.values().next().value;
    // A plain confirmation lands on Cancel, so Enter pressed out of habit backs out
    // rather than deleting something. A form lands on its first field.
    closeShell = openModalShell(backdrop, {
      onDismiss: () => close(null),
      initialFocus: first ? first.input : cancelBtn,
      onEnter: first ? submit : null,
    });
  });
}

/** Yes/no confirmation. Resolves true only when the user actually confirms. */
async function confirmDialog(title, { sub, confirmLabel = "تأكيد", danger = true } = {}) {
  return (await openDialog({ title, sub, confirmLabel, danger })) !== null;
}

/** Single-value input, the shape prompt() used to cover. Resolves to the string, or null. */
async function promptDialog(title, { sub, label = "", value = "", type = "text", options, placeholder, hint, confirmLabel = "حفظ", required = true } = {}) {
  const result = await openDialog({
    title,
    sub,
    confirmLabel,
    fields: [{ name: "value", label: label || title, type: options ? "select" : type, options, value, placeholder, hint, required }],
  });
  return result ? result.value : null;
}

function fmtDuration(totalSeconds) {
  if (!totalSeconds) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}س ${m}د ${s}ث` : m > 0 ? `${m}د ${s}ث` : `${s}ث`;
}

/** Today as YYYY-MM-DD in local time - the shape every date input and query uses. */
/** Tomorrow's Cairo day, the shape todayLocal gives. */
function tomorrowLocal() {
  const [y, m, d] = todayLocal().split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

function todayLocal() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function tile(value, label, pct, color) {
  const div = document.createElement("div");
  div.className = "tile";
  div.innerHTML = `
    <div class="bar" style="background:${esc(color || 'var(--gridline)')}"></div>
    <div class="value">${esc(value)}</div>
    <div class="label">${esc(label)}</div>
    ${pct != null ? `<div class="pct">${esc(pct)}%</div>` : ""}
  `;
  return div;
}

/* ------------------------------------------------------------------------
   Load sequencing and view invalidation.

   Every loader takes a ticket before its request and checks it after: a
   response that arrives after a newer request for the same table was made is
   dropped, so two quick filter changes can never leave the older data on
   screen. Views that are not on screen are marked dirty instead of being
   re-rendered, and reload when they are opened.
   ------------------------------------------------------------------------ */
const loadTickets = {};

/** Returns isStale(): true once a newer load of `key` has started. */
function beginLoad(key) {
  const mine = (loadTickets[key] = (loadTickets[key] || 0) + 1);
  return () => loadTickets[key] !== mine;
}

const dirtyViews = new Set();

/** Reloads the named views if they are on screen, or marks them to reload when opened. */
function invalidate(...views) {
  for (const view of views) {
    if (view === currentView && document.getElementById("content") && !document.getElementById("content").classList.contains("hidden")) {
      const loader = VIEW_LOADERS[view];
      if (loader) loader();
    } else {
      dirtyViews.add(view);
    }
  }
}

let doctorsLoaded = false;
// Caches the in-flight request itself, not just a boolean: `if (!doctorsLoaded) load()` is
// only safe when nothing else can run between the check and the call, and here several
// call sites race to be the first to load. Two calls landing before either's fetch
// resolves used to both see doctorsLoaded === false and both append their own full copy
// of the list, doubling every doctor in the filter dropdown.
let doctorsLoadPromise = null;

async function loadDoctors() {
  if (doctorsLoadPromise) return doctorsLoadPromise;
  doctorsLoadPromise = (async () => {
    const { doctors } = await api("/admin/doctors");
    allDoctors = doctors;
    const select = document.getElementById("doctor-filter");
    const previousValue = select.value;
    select.innerHTML = '<option value="">كل الدكاترة</option>';
    doctors.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${d.name} (${d.leadCount})`;
      select.appendChild(opt);
    });
    if (doctors.some((d) => String(d.id) === previousValue)) select.value = previousValue;
    doctorsLoaded = true;
    fillUploadDoctorSelect();
  })();
  try {
    return await doctorsLoadPromise;
  } finally {
    doctorsLoadPromise = null;
  }
}

/** Forces the doctor list to refetch, for after an add or edit that must show up immediately. */
async function reloadDoctors() {
  doctorsLoaded = false;
  await loadDoctors();
}

async function loadCampaignsFor(doctorId, selectId) {
  const campaignSelect = document.getElementById("campaign-filter");
  const previous = campaignSelect.value;
  campaignSelect.innerHTML = '<option value="">كل الكامبينات</option>';
  const { campaigns } = await api(`/admin/campaigns?doctorId=${doctorId}`);
  campaigns.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.leadCount})`;
    campaignSelect.appendChild(opt);
  });
  const wanted = selectId != null ? String(selectId) : previous;
  if (campaigns.some((c) => String(c.id) === wanted)) campaignSelect.value = wanted;
}

async function onDoctorChange() {
  const doctorId = document.getElementById("doctor-filter").value;
  const campaignSelect = document.getElementById("campaign-filter");

  if (!doctorId) {
    // Hiding the dropdown does not clear it - without resetting the value, the old
    // campaign stays selected and every query below keeps filtering by it, so
    // "all doctors" would still show one campaign's numbers.
    campaignSelect.innerHTML = '<option value="">كل الكامبينات</option>';
    campaignSelect.value = "";
    campaignSelect.classList.add("hidden");
  } else {
    await loadCampaignsFor(doctorId);
    campaignSelect.classList.remove("hidden");
  }
  renderDoctorProfile(doctorId ? Number(doctorId) : null);
  updateUploadPanelVisibility();
  loadDashboard();
}

/**
 * The clinic profile - address, contact numbers, hours, socials, prices - pulled from the
 * onboarding documents in data/. It lives on the overview view, gated on a doctor actually
 * being selected: with "كل الدكاترة" there is no single profile to show.
 */
function renderDoctorProfile(doctorId) {
  const section = document.getElementById("doctor-profile-section");
  const card = document.getElementById("doctor-profile-card");
  const doctor = doctorId ? allDoctors.find((d) => d.id === doctorId) : null;

  if (!doctor) {
    section.classList.add("hidden");
    card.innerHTML = "";
    return;
  }

  const rows = [
    ["📍 العنوان", doctor.address],
    ["📞 تليفون العيادة", doctor.phone],
    ["💬 واتساب العيادة", doctor.whatsapp],
    ["🕒 مواعيد العمل", doctor.hours],
    ["🗺️ Google Maps", doctor.mapsUrl, true],
    ["Facebook", doctor.facebook, /^https?:/.test(doctor.facebook || "")],
    ["Instagram", doctor.instagram, /^https?:/.test(doctor.instagram || "")],
  ].filter(([, value]) => value);

  section.classList.remove("hidden");
  card.innerHTML = `
    <div class="action-card">
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:10px 20px; padding:14px 16px">
        ${rows
          .map(
            ([label, value, isLink]) => `
          <div style="min-width:0">
            <div style="color:var(--text-secondary); font-size:12px; margin-bottom:2px">${esc(label)}</div>
            <div style="overflow-wrap:anywhere">${isLink ? `<a href="${esc(value)}" target="_blank" rel="noopener">${esc(value)}</a>` : esc(value)}</div>
          </div>`,
          )
          .join("")}
      </div>
      ${
        doctor.notes
          ? `<div style="padding:0 16px 16px; white-space:pre-line; color:var(--text-secondary); font-size:13px; border-top:1px solid var(--surface-2); margin-top:4px; padding-top:12px">${esc(doctor.notes)}</div>`
          : ""
      }
    </div>
  `;
}

/**
 * "This doctor's dashboard" is not a separate page - every view in the app already
 * accepts the same doctor-filter select and scopes itself by it (overview, leads,
 * bookings, the worksheet). Setting it and jumping to overview is the whole feature.
 */
async function openDoctorDashboard(doctorId) {
  const select = document.getElementById("doctor-filter");
  if (!doctorsLoaded) await loadDoctors();
  select.value = String(doctorId);
  await onDoctorChange();
  // The one navigation that is meant to carry the doctor along.
  keepScopeOnNextRoute = true;
  goto("overview");
}

function onCampaignChange() {
  updateUploadPanelVisibility();
  loadDashboard();
}

/** The three groups as dropdown options, so a group is picked rather than typed. */
const groupOptions = () => Object.entries(GROUP_LABELS).map(([value, label]) => ({ value, label }));

async function addDoctor() {
  const values = await openDialog({
    title: "دكتور جديد",
    confirmLabel: "إضافة",
    fields: [
      { name: "name", label: "اسم الدكتور", required: true },
      { name: "groupId", label: "المجموعة", type: "select", options: groupOptions() },
    ],
  });
  if (!values) return;
  await api("/admin/doctors", { method: "POST", body: values });
  toast(`اتضاف ${values.name}`, "good");
  // The new doctor has to reach every list built from allDoctors: the scope filter and
  // the upload picker (both inside reloadDoctors), the doctors table, and the link
  // dropdowns on the distribution page.
  await reloadDoctors();
  invalidate("doctors", "distribution", "overview");
}

/** Reps linked to this doctor who would lose that link if it left their group. */
function repsStrandedByMove(doctor, newGroupId) {
  if (String(doctor.groupId ?? "") === String(newGroupId)) return [];
  return allReps.filter(
    (r) =>
      r.groupId != null &&
      String(r.groupId) !== String(newGroupId) &&
      (r.primaryDoctorId === doctor.id || r.secondaryDoctorId === doctor.id || r.tertiaryDoctorId === doctor.id),
  );
}

/** Moves a doctor to a different group - a correction, not a routine edit. */
async function editDoctorGroup(doctor) {
  const groupId = await promptDialog("تغيير المجموعة", {
    sub: `${doctor.name}\nالليدز بتوصل لسيلز المجموعة بس. لو نقلت الدكتور، أي سيلز من المجموعة القديمة مربوط بيه هيتشال ربطه.`,
    label: "المجموعة",
    options: groupOptions(),
    value: String(doctor.groupId ?? ""),
    confirmLabel: "التالي",
  });
  if (groupId === null) return;
  if (String(doctor.groupId ?? "") === String(groupId)) return toast("الدكتور في المجموعة دي أصلاً");

  // The side effect is stated before anything is written, not announced afterwards.
  const stranded = repsStrandedByMove(doctor, groupId);
  const ok = await confirmDialog(`نقل ${doctor.name} لمجموعة ${GROUP_LABELS[groupId] || groupId}`, {
    sub: stranded.length
      ? `هيتشال ربط ${stranded.length} سيلز بالدكتور ده لأنهم في المجموعة القديمة:\n${stranded.map((r) => r.name).join("، ")}\nوهيحتاجوا ربط من جديد من صفحة التوزيع لو لازم.`
      : "مفيش سيلز من المجموعة القديمة مربوط بالدكتور ده، فمفيش ربط هيتشال.",
    confirmLabel: "انقل",
    danger: stranded.length > 0,
  });
  if (!ok) return;

  const data = await api(`/admin/doctors/${doctor.id}`, { method: "PATCH", body: { groupId } });
  toast(
    `${doctor.name} بقى في مجموعة ${GROUP_LABELS[groupId] || groupId}` +
      (data.strandedRepCount ? ` — اتشال ربط ${data.strandedRepCount} سيلز` : ""),
    "good",
  );
  await reloadDoctors();
  invalidate("doctors", "distribution", "overview");
}

/**
 * Creates a campaign under whichever doctor picker the button sits next to: the upload
 * view has its own doctor select and the scope filter is hidden there.
 */
async function addCampaign() {
  const fromUpload = currentView === "upload";
  const doctorId = document.getElementById(fromUpload ? "upload-doctor" : "doctor-filter").value;
  if (!doctorId) return toast("اختار دكتور الأول", "bad");
  const name = await promptDialog("كامبين جديد", { label: "اسم الكامبين", confirmLabel: "إضافة" });
  if (!name) return;
  const data = await api("/admin/campaigns", { method: "POST", body: { doctorId, name } });
  toast(`اتضاف كامبين ${name}`, "good");

  // Refresh both pickers that list this doctor's campaigns, and select the new one
  // where the campaign was created from.
  if (fromUpload) await onUploadDoctorChange(data.id);
  const filterDoctor = document.getElementById("doctor-filter").value;
  if (filterDoctor === String(doctorId)) await loadCampaignsFor(doctorId, fromUpload ? undefined : data.id);
  if (!fromUpload) {
    updateUploadPanelVisibility();
    loadDashboard();
  }
}

function updateUploadPanelVisibility() {
  const campaignId = document.getElementById("upload-campaign").value;
  const panel = document.getElementById("upload-panel");
  document.getElementById("upload-summary").innerHTML = "";
  document.getElementById("upload-columns").innerHTML = "";
  document.getElementById("upload-history").innerHTML = "";
  // A preview belongs to the campaign it was read against - switching away from it
  // leaves the old batchToken/rawToken to expire unconfirmed rather than risk confirming
  // it against whatever campaign is selected now.
  pendingUploadBatch = null;
  pendingRawUpload = null;
  if (!canManageData()) {
    panel.classList.add("hidden");
    return;
  }
  if (campaignId) {
    panel.classList.remove("hidden");
    loadUploadHistory(campaignId);
  } else {
    panel.classList.add("hidden");
  }
}

/** Toggles between the file input and the Google Sheets link input - only one is sent. */
function updateUploadSourceVisibility() {
  const isLink = document.getElementById("upload-source-link").checked;
  document.getElementById("upload-file").classList.toggle("hidden", isLink);
  document.getElementById("upload-sheet-link").classList.toggle("hidden", !isLink);
}

async function loadUploadHistory(campaignId) {
  const isStale = beginLoad("upload-history");
  const { uploads } = await api(`/admin/campaigns/${campaignId}/uploads`);
  if (isStale()) return;
  const el = document.getElementById("upload-history");
  if (!uploads.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <div style="margin-top:12px; font-size:12px; color:var(--text-secondary)">سجل الرفعات السابقة:</div>
    <div class="rejected-list" id="upload-history-list"></div>
  `;
  const list = document.getElementById("upload-history-list");
  uploads.forEach((u) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:8px";
    const label = document.createElement("span");
    label.textContent = `${new Date(u.created_at).toLocaleString("ar-EG")} — ${u.filename || "ملف"} — ${u.valid_count} اتقبلوا / ${u.duplicate_count} مكرر / ${u.invalid_count} غير صحيح (بواسطة ${u.uploaded_by_name || "—"})`;
    row.appendChild(label);
    if (u.remainingLeadCount > 0 && canManageData()) {
      const delBtn = document.createElement("button");
      delBtn.textContent = `حذف ${u.remainingLeadCount} ليد`;
      delBtn.title = u.contactedCount ? `${u.contactedCount} منهم اتكلم معاهم بالفعل وهيتسيبوا` : "";
      delBtn.addEventListener("click", () => deleteUploadBatch(campaignId, u));
      row.appendChild(delBtn);
    }
    list.appendChild(row);
  });
}

/** Undoes an upload - the "رفعت الملف الغلط" button. Leaves anyone already contacted alone. */
async function deleteUploadBatch(campaignId, u) {
  const warning =
    u.contactedCount > 0
      ? `${u.contactedCount} من الـ ${u.remainingLeadCount} ليد دول اتكلم معاهم بالفعل وهيتسيبوا زي ما هما. الباقي (${u.remainingLeadCount - u.contactedCount}) هيتمسحوا. متأكد؟`
      : `تمسح ${u.remainingLeadCount} ليد من الرفعة دي؟ الحركة دي مينفعش ترجع فيها.`;
  if (!(await confirmDialog("حذف ليدز الرفعة", { sub: warning, confirmLabel: "امسح" }))) return;

  const data = await api(`/admin/campaigns/${campaignId}/uploads/${u.id}`, { method: "DELETE" });
  toast(`اتمسح ${data.deletedCount} ليد` + (data.skippedCount ? `، ${data.skippedCount} اتسيبوا لأنهم اتكلم معاهم` : ""), "good");
  loadUploadHistory(campaignId);
  afterLeadsChanged();
}

// The upload button only ever previews - nothing lands as a real lead until confirmUpload()
// is called on the batchToken it returns. Cleared whenever the file/doctor/campaign
// changes, so a stale preview can never be confirmed against a different selection.
let pendingUploadBatch = null; // { campaignId, token }

function renderUploadPreview(campaignId, data) {
  const summaryEl = document.getElementById("upload-summary");
  summaryEl.innerHTML = `
    <div class="row">
      <div class="stat"><span class="dot" style="background:var(--good)"></span> ${esc(data.validCount)} اتقبلوا</div>
      <div class="stat"><span class="dot" style="background:var(--warning)"></span> ${esc(data.duplicateCount)} مكرر</div>
      <div class="stat"><span class="dot" style="background:var(--critical)"></span> ${esc(data.invalidCount)} غير صحيح</div>
      <div class="stat">من إجمالي ${esc(data.totalRows)} صف</div>
    </div>
    <div style="font-size:12px; color:var(--text-secondary); margin-top:8px">
      مفيش توزيع تلقائي — العملاء المقبولين هيقعدوا في مخزن الدكتور، وأي موظف مربوط بيه (أساسي أو احتياطي) يقدر ياخدهم من شاشة استلام الليدز.
    </div>
    ${
      data.noLinkedReps
        ? `<div class="badge" style="background:var(--warning-soft); color:var(--warning); white-space:normal; display:block; margin-top:10px; padding:10px 12px; font-size:13px">⚠ ${esc(
            data.warning || "الدكتور ده مفيش سيلز مربوط بيه — الليدز هتقعد في المخزن ومحدش هيسحبها لحد ما تربط سيلز من صفحة التوزيع.",
          )}</div>`
        : ""
    }
    ${
      (data.rejected || []).length
        ? `<div class="rejected-list">${data.rejected
            .map((r) => `<div>${esc(r.name || "—")} — ${esc(r.phone || "—")} — ${esc(r.reason)}</div>`)
            .join("")}</div>`
        : ""
    }
    <div class="row" style="margin-top:12px" id="upload-confirm-row">
      <button class="primary" id="upload-confirm-btn">✓ تأكيد ورفع ${esc(data.validCount)} عميل</button>
      <button id="upload-discard-btn">إلغاء المعاينة دي</button>
      ${data.noLinkedReps ? `<button class="link-btn" data-goto="distribution">اربط سيلز الأول ←</button>` : ""}
    </div>
  `;
  pendingUploadBatch = { campaignId, token: data.batchToken, noLinkedReps: Boolean(data.noLinkedReps), warning: data.warning };
  document.getElementById("upload-confirm-btn").addEventListener("click", () => confirmUpload());
  document.getElementById("upload-discard-btn").addEventListener("click", () => discardUpload());
}

// Set once the raw parse comes back, cleared once the admin's column mapping has been
// submitted (or the upload is abandoned). Separate from pendingUploadBatch, which only
// exists after that mapping step has already run.
let pendingRawUpload = null; // { campaignId, rawToken }

async function doUpload() {
  const campaignId = document.getElementById("upload-campaign").value;
  const isLink = document.getElementById("upload-source-link").checked;
  const fileInput = document.getElementById("upload-file");
  const linkInput = document.getElementById("upload-sheet-link");
  const summaryEl = document.getElementById("upload-summary");
  document.getElementById("upload-columns").innerHTML = "";
  if (!campaignId) {
    summaryEl.innerHTML = '<span style="color:var(--critical)">اختار الكامبين الأول</span>';
    return;
  }
  if (isLink ? !linkInput.value.trim() : !fileInput.files[0]) {
    summaryEl.innerHTML = `<span style="color:var(--critical)">${isLink ? "حط لينك الشيت الأول" : "اختار ملف الأول"}</span>`;
    return;
  }
  // A fresh upload replaces whatever preview was pending - the old batchToken/rawToken is
  // simply never confirmed and expires on its own.
  pendingUploadBatch = null;
  pendingRawUpload = null;

  const btn = document.getElementById("upload-btn");
  btn.disabled = true;
  btn.textContent = "جاري القراءة...";
  summaryEl.innerHTML = "";

  try {
    let data;
    if (isLink) {
      data = await api(`/admin/campaigns/${campaignId}/upload`, {
        method: "POST",
        body: { sheetUrl: linkInput.value.trim() },
        silent: true,
      });
    } else {
      const formData = new FormData();
      formData.append("file", fileInput.files[0]);
      data = await api(`/admin/campaigns/${campaignId}/upload`, { method: "POST", form: formData, silent: true });
    }
    renderColumnMapping(campaignId, data);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (!e.reported) summaryEl.innerHTML = `<span style="color:var(--critical)">${esc(e.message)}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "رفع ومعاينة";
  }
}

/**
 * Shows the sheet's own columns (with a few real values under each) and lets the admin
 * say which one is the name, the phone, and - optionally - the WhatsApp number. Nothing
 * is cleaned or distributed until that mapping is submitted below.
 */
async function renderColumnMapping(campaignId, data) {
  const columnsEl = document.getElementById("upload-columns");
  const options = (withEmpty) =>
    (withEmpty ? `<option value="">بدون</option>` : `<option value="">— اختار —</option>`) +
    data.headers.map((h) => `<option value="${esc(h)}">${esc(h)}</option>`).join("");

  const previewRows = (data.sampleRows || [])
    .map((r) => `<tr>${r.map((v) => `<td style="padding:4px 8px; border:1px solid var(--gridline)">${esc(v)}</td>`).join("")}</tr>`)
    .join("");

  // The service applies to the whole batch, not a column, but it's chosen here rather
  // than left for the eventual booking - a lead worked for weeks before it books should
  // still read as "for whitening" from day one.
  let services = [];
  try {
    ({ services } = await api("/admin/services"));
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }
  const serviceOptions =
    `<option value="">بدون خدمة محددة</option>` +
    services.filter((s) => s.active).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("");

  columnsEl.innerHTML = `
    ${data.sheetWarning ? `<div style="color:var(--warning); margin-bottom:10px">⚠ ${esc(data.sheetWarning)}</div>` : ""}
    <div style="font-size:13px; margin-bottom:8px">لقينا ${esc(data.totalRows)} صف و${esc(data.headers.length)} عمود. اختار مين العمود بتاع كل حاجة:</div>
    <div style="overflow-x:auto; margin-bottom:12px">
      <table style="font-size:12px; border-collapse:collapse; white-space:nowrap">
        <thead><tr>${data.headers.map((h) => `<th style="padding:4px 8px; border:1px solid var(--gridline); text-align:right">${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${previewRows}</tbody>
      </table>
    </div>
    <div style="font-size:12px; color:var(--text-secondary); margin-bottom:10px">
      لكل حقل عمود أساسي وعمود احتياطي اختياري — لو قيمة العمود الأساسي فاضية أو غلط في صف معين، هياخد من الاحتياطي بدلها.
    </div>
    <div class="row" style="gap:16px; flex-wrap:wrap">
      <div>
        <label for="map-service" style="display:block; font-size:12px; margin-bottom:4px">الخدمة (اختياري)</label>
        <select id="map-service">${serviceOptions}</select>
      </div>
      <div>
        <label for="map-name" style="display:block; font-size:12px; margin-bottom:4px">الاسم (اختياري)</label>
        <select id="map-name">${options(true)}</select>
      </div>
      <div>
        <label for="map-name-backup" style="display:block; font-size:12px; margin-bottom:4px">الاسم (احتياطي)</label>
        <select id="map-name-backup">${options(true)}</select>
      </div>
      <div>
        <label for="map-phone" style="display:block; font-size:12px; margin-bottom:4px">رقم الهاتف *</label>
        <select id="map-phone">${options(false)}</select>
      </div>
      <div>
        <label for="map-phone-backup" style="display:block; font-size:12px; margin-bottom:4px">رقم الهاتف (احتياطي)</label>
        <select id="map-phone-backup">${options(true)}</select>
      </div>
      <div>
        <label for="map-whatsapp" style="display:block; font-size:12px; margin-bottom:4px">رقم الواتساب (اختياري)</label>
        <select id="map-whatsapp">${options(true)}</select>
      </div>
      <div>
        <label for="map-whatsapp-backup" style="display:block; font-size:12px; margin-bottom:4px">رقم الواتساب (احتياطي)</label>
        <select id="map-whatsapp-backup">${options(true)}</select>
      </div>
    </div>
    <div id="map-auto-note" style="font-size:12px; color:var(--text-secondary); margin-top:8px"></div>
    <div class="row" style="margin-top:12px">
      <button class="primary" id="upload-columns-confirm-btn">تأكيد الأعمدة ومعاينة</button>
      <button id="upload-columns-cancel-btn">إلغاء</button>
    </div>
  `;
  pendingRawUpload = { campaignId, rawToken: data.rawToken };
  preselectColumns(campaignId, data.headers);
  document.getElementById("upload-columns-confirm-btn").addEventListener("click", () => confirmColumnMapping());
  document.getElementById("upload-columns-cancel-btn").addEventListener("click", () => {
    pendingRawUpload = null;
    columnsEl.innerHTML = "";
  });
}

/* The twelve sheets that repeat every week have the same headers every time, so the
   mapping is remembered per campaign; a sheet never seen before gets a best guess from
   the header names. Either way the admin can still change every select. */
const MAP_FIELDS = ["name", "nameBackup", "phone", "phoneBackup", "whatsapp", "whatsappBackup"];
const MAP_SELECT_IDS = {
  name: "map-name",
  nameBackup: "map-name-backup",
  phone: "map-phone",
  phoneBackup: "map-phone-backup",
  whatsapp: "map-whatsapp",
  whatsappBackup: "map-whatsapp-backup",
};
const HEADER_HINTS = {
  name: [/^(full[ _-]?)?name$/i, /الاسم/, /^اسم/, /^name/i, /client|customer|patient/i, /العميل|المريض/],
  phone: [/^phone/i, /mobile/i, /^tel/i, /رقم/, /موبايل/, /تليفون|تلفون|هاتف/, /number/i],
  whatsapp: [/whats/i, /واتس/],
};

function mappingStorageKey(campaignId) {
  return `ltd.upload.map.${campaignId}`;
}

function readSavedMapping(campaignId) {
  try {
    return JSON.parse(localStorage.getItem(mappingStorageKey(campaignId)) || "null");
  } catch {
    return null;
  }
}

function saveMapping(campaignId, mapping) {
  try {
    localStorage.setItem(mappingStorageKey(campaignId), JSON.stringify(mapping));
  } catch {
    // Storage full or blocked: the mapping just is not remembered this time.
  }
}

function guessColumns(headers) {
  const norm = (h) => String(h || "").trim().toLowerCase();
  const pick = (kind, taken) =>
    headers.find((h) => !taken.has(h) && HEADER_HINTS[kind].some((re) => re.test(norm(h)))) || "";
  const taken = new Set();
  const guess = {};
  // WhatsApp first: "رقم الواتساب" would otherwise be swallowed by the phone rule.
  guess.whatsapp = pick("whatsapp", taken);
  if (guess.whatsapp) taken.add(guess.whatsapp);
  guess.name = pick("name", taken);
  if (guess.name) taken.add(guess.name);
  guess.phone = pick("phone", taken);
  if (guess.phone) taken.add(guess.phone);
  guess.phoneBackup = pick("phone", taken);
  return guess;
}

function preselectColumns(campaignId, headers) {
  const note = document.getElementById("map-auto-note");
  const setSel = (id, value) => {
    const sel = document.getElementById(id);
    if (!sel) return false;
    if (value != null && [...sel.options].some((o) => o.value === String(value))) {
      sel.value = String(value);
      return true;
    }
    return false;
  };

  const saved = readSavedMapping(campaignId);
  if (saved && headers.includes(saved.phone) && (!saved.name || headers.includes(saved.name))) {
    MAP_FIELDS.forEach((f) => setSel(MAP_SELECT_IDS[f], saved[f] || ""));
    setSel("map-service", saved.serviceId || "");
    note.textContent = "اتحطت نفس الأعمدة اللي اتستخدمت آخر مرة للكامبين ده — راجعها وعدّل لو الشيت اتغير.";
    return;
  }

  const guess = guessColumns(headers);
  const hits = MAP_FIELDS.filter((f) => guess[f] && setSel(MAP_SELECT_IDS[f], guess[f]));
  note.textContent = hits.length
    ? "اتعرفنا على الأعمدة من أسماء الرؤوس — راجعها قبل ما تأكد."
    : "مقدرناش نخمّن الأعمدة من الرؤوس — اختارها بنفسك.";
}

async function confirmColumnMapping() {
  if (!pendingRawUpload) return;
  const { campaignId, rawToken } = pendingRawUpload;
  const serviceId = document.getElementById("map-service").value;
  const nameColumn = document.getElementById("map-name").value;
  const nameBackupColumn = document.getElementById("map-name-backup").value;
  const phoneColumn = document.getElementById("map-phone").value;
  const phoneBackupColumn = document.getElementById("map-phone-backup").value;
  const whatsappColumn = document.getElementById("map-whatsapp").value;
  const whatsappBackupColumn = document.getElementById("map-whatsapp-backup").value;
  // Only the number is required: a sheet with no name column still loads, and every
  // nameless row lands as "بدون اسم" for the rep to fill in from the call screen.
  if (!phoneColumn) {
    toast("اختار عمود رقم الهاتف الأول", "bad");
    return;
  }

  const confirmBtn = document.getElementById("upload-columns-confirm-btn");
  const cancelBtn = document.getElementById("upload-columns-cancel-btn");
  confirmBtn.disabled = true;
  cancelBtn.disabled = true;
  confirmBtn.textContent = "جاري التنضيف...";

  try {
    const mapping = {
      serviceId: serviceId || null,
      name: nameColumn || null,
      nameBackup: nameBackupColumn || null,
      phone: phoneColumn,
      phoneBackup: phoneBackupColumn || null,
      whatsapp: whatsappColumn || null,
      whatsappBackup: whatsappBackupColumn || null,
    };
    const data = await api(`/admin/campaigns/${campaignId}/upload/${rawToken}/columns`, { method: "POST", body: mapping });
    saveMapping(campaignId, mapping);
    pendingRawUpload = null;
    document.getElementById("upload-columns").innerHTML = "";
    renderUploadPreview(campaignId, data);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  } finally {
    confirmBtn.disabled = false;
    cancelBtn.disabled = false;
    confirmBtn.textContent = "تأكيد الأعمدة ومعاينة";
  }
}

async function confirmUpload(force = false) {
  if (!pendingUploadBatch) return;
  // Named batchToken, not token: this app has a global `token` for the login session,
  // and destructuring a same-named field here silently shadowed it - the confirm request
  // was sending the *preview's* id as the Bearer credential instead of the real session,
  // which the server correctly rejected as a malformed token every single time.
  const { campaignId, token: batchToken, noLinkedReps, warning } = pendingUploadBatch;

  // A doctor with nobody linked: the server refuses the plain confirm, so ask first and
  // re-post with force only after an explicit "upload anyway".
  if (noLinkedReps && !force) {
    const ok = await confirmDialog("الدكتور ده مفيش سيلز مربوط بيه", {
      sub:
        (warning || "الليدز هتقعد في المخزن ومحدش هيسحبها لحد ما تربط سيلز بالدكتور.") +
        "\nتقدر ترفع برضه دلوقتي وتربط السيلز بعدين من صفحة التوزيع.",
      confirmLabel: "ارفع برضه",
      danger: false,
    });
    if (!ok) return;
    return confirmUpload(true);
  }

  const confirmBtn = document.getElementById("upload-confirm-btn");
  const discardBtn = document.getElementById("upload-discard-btn");
  confirmBtn.disabled = true;
  discardBtn.disabled = true;
  confirmBtn.textContent = "جاري التسجيل...";

  try {
    const data = await api(`/admin/campaigns/${campaignId}/upload/${batchToken}/confirm`, {
      method: "POST",
      body: force ? { force: true } : {},
      silent: true,
    });
    pendingUploadBatch = null;
    document.getElementById("upload-confirm-row").outerHTML =
      `<div style="color:var(--good); margin-top:12px">✓ اتسجل ${esc(data.validCount)} عميل فعليًا` +
      (data.staleDuplicateCount ? ` (${esc(data.staleDuplicateCount)} كانوا اتضافوا لحد تاني وقت المعاينة، اتجاهلوا)` : "") +
      `</div>`;
    document.getElementById("upload-file").value = "";
    document.getElementById("upload-sheet-link").value = "";
    loadUploadHistory(campaignId);
    afterLeadsChanged();
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    // The server can also flag the unlinked doctor at confirm time (preview came from
    // an older session, or the links changed in between) - offer the same "anyway".
    if (e.status === 400 && e.data && e.data.noLinkedReps && !force) {
      pendingUploadBatch.noLinkedReps = true;
      pendingUploadBatch.warning = e.data.warning || e.data.error;
      confirmBtn.textContent = "✓ تأكيد ورفع";
      return confirmUpload(false);
    }
    if (!e.reported) toast(e.message || "مقدرناش نأكد الرفع - جرب ترفع الملف تاني", "bad");
  } finally {
    confirmBtn.disabled = false;
    discardBtn.disabled = false;
    if (pendingUploadBatch) confirmBtn.textContent = "✓ تأكيد ورفع";
  }
}

async function discardUpload() {
  if (!pendingUploadBatch) return;
  // Same shadowing hazard as confirmUpload: the field is named batchToken here so it
  // never overwrites the outer login `token`.
  const { campaignId, token: batchToken } = pendingUploadBatch;
  try {
    await api(`/admin/campaigns/${campaignId}/upload/${batchToken}`, { method: "DELETE", silent: true });
  } catch (e) {
    // The in-memory preview expires on its own even if this call fails to reach the server.
  }
  pendingUploadBatch = null;
  document.getElementById("upload-summary").innerHTML = "";
  document.getElementById("upload-file").value = "";
  document.getElementById("upload-sheet-link").value = "";
}

let currentScopeQS = "";

/** Reads the shared from/to date inputs into a params object, shared by every scoped table. */
function appendScopeDateParams(params) {
  const fromDate = document.getElementById("scope-from-date").value;
  const toDate = document.getElementById("scope-to-date").value;
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  document.getElementById("scope-date-clear").classList.toggle("hidden", !fromDate && !toDate);
}

function clearScopeDateFilter() {
  document.getElementById("scope-from-date").value = "";
  document.getElementById("scope-to-date").value = "";
  loadDashboard();
}

/** Recomputes the scope query string from the filter bar. */
function readScope() {
  const doctorId = document.getElementById("doctor-filter").value;
  const campaignId = document.getElementById("campaign-filter").value;
  const repId = document.getElementById("rep-filter").value;
  const params = new URLSearchParams();
  if (campaignId) params.set("campaignId", campaignId);
  else if (doctorId) params.set("doctorId", doctorId);
  // Narrows every lead-bearing table to one rep. Stacks with the doctor filter rather
  // than replacing it, so "this rep's leads for this doctor" is one query.
  if (repId) params.set("repId", repId);
  appendScopeDateParams(params);
  currentScopeQS = params.toString() ? `?${params}` : "";
  return currentScopeQS;
}

/**
 * The scope filter for a given view: the query string when that view honours it,
 * and nothing at all when the filter bar is hidden there - a hidden filter must never
 * silently narrow what a page shows.
 */
function scopeFor(viewId) {
  const item = NAV.find((n) => n.id === viewId);
  return item && item.scoped ? currentScopeQS : "";
}

/**
 * The core numbers: overview tiles, the rep performance table, the leads table.
 * Three requests, and the only thing most small edits need to refresh.
 */
async function loadCore() {
  const isStale = beginLoad("core");
  const qs = readScope();
  const [overview, repsData, leadsData] = await Promise.all([
    api(`/admin/overview${qs}`),
    api(`/admin/reps${qs}`),
    api(`/admin/leads${qs}`),
  ]);
  if (isStale()) return;

  document.getElementById("loading").classList.add("hidden");
  document.getElementById("content").classList.remove("hidden");
  renderDashboard(overview, repsData.reps);
  renderLeadsTable(leadsData.leads);
}

/**
 * Full refresh: the core numbers, the roster, the overview's cards, and whichever view
 * is open. Every other view is marked to reload when it is next opened, rather than
 * being re-rendered behind the scenes.
 */
async function loadDashboard() {
  const refreshBtn = document.getElementById("refresh-btn");
  const originalLabel = refreshBtn.textContent;
  refreshBtn.disabled = true;
  refreshBtn.textContent = "جاري التحديث...";

  const firstLoad = document.getElementById("content").classList.contains("hidden");
  try {
    if (!doctorsLoaded) await loadDoctors();
    await loadCore();
    Object.keys(VIEW_LOADERS).forEach((v) => dirtyViews.add(v));
    // The roster feeds dropdowns on several views, so it is always fresh after a refresh.
    await Promise.allSettled([loadAssignments(), loadOverviewActions()]);
    dirtyViews.delete("distribution");
    dirtyViews.delete("leads");
    dirtyViews.delete("reps");
    await runViewLoader(currentView);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (firstLoad) showLoadError(e.message);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = originalLabel;
  }
}

/** First-load failure: the loading line becomes an error with a retry, not a forever-spinner. */
function showLoadError(message) {
  const loading = document.getElementById("loading");
  loading.classList.remove("hidden");
  loading.innerHTML = "";
  const text = document.createElement("div");
  text.className = "load-error";
  text.textContent = message === NETWORK_ERROR ? "مقدرناش نوصل للسيرفر عشان نحمّل البيانات." : `مقدرناش نحمّل البيانات: ${message}`;
  const retry = document.createElement("button");
  retry.className = "primary";
  retry.textContent = "حاول تاني";
  retry.addEventListener("click", () => {
    loading.textContent = "جاري تحميل البيانات...";
    loadDashboard();
  });
  loading.append(text, retry);
}

/** After anything that creates, moves, closes, or deletes leads. */
function afterLeadsChanged() {
  loadCore();
  invalidate("worksheet", "overdue", "workload", "bookings");
  if (currentView === "overview") loadOverviewActions();
  else dirtyViews.add("overview");
}

/** After anything that changes who exists or which group they are in. */
function afterRosterChanged() {
  loadAssignments();
  invalidate("accounts", "workload", "attendance", "doctors");
  loadCore();
}

// Kept so the edit modal can look a lead back up by id without a second request.
let currentLeads = [];

/**
 * How many rows a table puts into the DOM at once.
 *
 * Rendering six thousand rows costs about three seconds and a quarter of a million DOM
 * nodes, which on an older laptop reads as the page having frozen. The full data is
 * never withheld - the Excel export is generated server-side and always covers every
 * row - so paging costs nothing except a click.
 */
const PAGE_SIZE = 100;

const pageState = {};

/**
 * Draws a page of rows and the controls beneath them.
 *
 * @param key      identifies which table's page number to remember
 * @param rows     every row, not just the visible page
 * @param mount    the tbody to fill
 * @param drawRow  renders one row
 */
function renderPaged(key, rows, mount, drawRow, onRendered) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // A filter change can leave the remembered page past the end of a shorter list.
  const page = Math.min(pageState[key] || 1, pages);
  pageState[key] = page;

  const start = (page - 1) * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);

  mount.innerHTML = "";
  visible.forEach((row, i) => drawRow(row, start + i));
  // Runs before the pager is drawn and on every page change, which is what lets bulk
  // selection decorate exactly the rows now on screen.
  if (onRendered) onRendered(visible);

  const table = mount.closest("table");
  const container = table?.closest(".table-wrap")?.parentElement || table?.parentElement;
  container?.querySelector(".pager")?.remove();
  if (!container || rows.length <= PAGE_SIZE) return;

  const pager = document.createElement("div");
  pager.className = "pager";

  const label = document.createElement("span");
  label.textContent = `${start + 1}–${start + visible.length} من ${rows.length}`;

  const spacer = document.createElement("span");
  spacer.className = "spacer";

  const prev = document.createElement("button");
  prev.textContent = "→ السابق";
  prev.disabled = page === 1;
  prev.addEventListener("click", () => {
    pageState[key] = page - 1;
    renderPaged(key, rows, mount, drawRow, onRendered);
  });

  const position = document.createElement("span");
  position.textContent = `صفحة ${page} من ${pages}`;

  const next = document.createElement("button");
  next.textContent = "التالي ←";
  next.disabled = page === pages;
  next.addEventListener("click", () => {
    pageState[key] = page + 1;
    renderPaged(key, rows, mount, drawRow, onRendered);
    container.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  pager.append(label, spacer, prev, position, next);
  container.appendChild(pager);
}

/* ---------------------------------------------------------------- Bulk actions */

/** Selection state per table, kept across re-renders so a refresh does not lose it. */
const bulkState = new Map();

/**
 * Adds a checkbox column and a bulk-action bar to a table.
 *
 * Decorates rows *after* they are drawn rather than each of the eight renderers being
 * rewritten to know about selection: they all already emit plain <tr> elements in data
 * order, so one pass pairing tbody.rows with the record array does the whole job and
 * leaves those renderers untouched.
 *
 * @param visible  the records actually on screen now (one page, for a paged table)
 * @param actions  [{ label, danger, show, run(ids) }] - run gets the selected ids.
 *                 An action with `render(ids)` supplies its own element instead of a
 *                 plain button, for the one bar that needs a picker beside its button;
 *                 the bar is rebuilt on every selection change, so `ids` is never stale.
 * @param allRows  every record in range, used only to drop selections for rows that no
 *                 longer exist; defaults to `visible` for unpaged tables.
 * @param countLabel  how the bar names the selection; defaults to the house wording.
 */
function bulkAttach(
  key,
  tbodyId,
  visible,
  actions,
  { idOf = (r) => r.id, allRows = visible, countLabel = (n) => `${n} متحدد` } = {},
) {
  const tbody = document.getElementById(tbodyId);
  const table = tbody && tbody.closest("table");
  if (!table) return;

  let state = bulkState.get(key);
  if (!state) {
    state = { selected: new Set() };
    bulkState.set(key, state);
  }

  // A row that has gone (deleted, or filtered out) must not stay selected invisibly and
  // then be swept up by the next bulk action.
  const stillThere = new Set(allRows.map(idOf));
  for (const id of [...state.selected]) if (!stillThere.has(id)) state.selected.delete(id);

  const headRow = table.tHead && table.tHead.rows[0];
  let headBox = headRow && headRow.querySelector(".sel-cell input");
  if (headRow && !headBox) {
    const th = document.createElement("th");
    th.className = "sel-cell";
    headBox = document.createElement("input");
    headBox.type = "checkbox";
    headBox.title = "اختار كل اللي في الصفحة";
    th.appendChild(headBox);
    headRow.insertBefore(th, headRow.firstChild);
  }

  const boxes = [];
  [...tbody.rows].forEach((tr, i) => {
    const row = visible[i];
    if (!row) return;
    const id = idOf(row);
    const td = document.createElement("td");
    td.className = "sel-cell";
    const box = document.createElement("input");
    box.type = "checkbox";
    // A row with nothing to act on - an examination that came from the clinics' sheet
    // carries no booking and no lead - is shown but cannot join a bulk action.
    if (id == null) {
      box.disabled = true;
      box.title = "الصف ده من شيت العيادات - مفيش عليه إجراء جماعي";
    }
    box.addEventListener("change", () => {
      if (box.checked) state.selected.add(id);
      else state.selected.delete(id);
      refresh();
    });
    td.appendChild(box);
    tr.insertBefore(td, tr.firstChild);
    boxes.push({ box, id, tr });
  });

  const wrap = table.closest(".table-wrap") || table;
  const container = wrap.parentElement;

  function drawBar() {
    container.querySelector(`.bulk-bar[data-key="${key}"]`)?.remove();
    if (state.selected.size === 0) return;

    const bar = document.createElement("div");
    bar.className = "bulk-bar";
    bar.dataset.key = key;

    const count = document.createElement("span");
    count.className = "count";
    count.textContent = countLabel(state.selected.size);
    bar.appendChild(count);

    for (const action of actions) {
      if (action.show && !action.show()) continue;
      if (action.render) {
        bar.appendChild(action.render([...state.selected]));
        continue;
      }
      const btn = document.createElement("button");
      btn.textContent = action.label;
      if (action.danger) btn.className = "danger";
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await action.run([...state.selected]);
        } finally {
          btn.disabled = false;
        }
      });
      bar.appendChild(btn);
    }

    const spacer = document.createElement("span");
    spacer.className = "spacer";
    const clear = document.createElement("button");
    clear.textContent = "إلغاء التحديد";
    clear.addEventListener("click", () => {
      state.selected.clear();
      refresh();
    });
    bar.append(spacer, clear);
    container.insertBefore(bar, wrap);
  }

  function refresh() {
    for (const { box, id, tr } of boxes) {
      box.checked = state.selected.has(id);
      tr.classList.toggle("selected", box.checked);
    }
    if (headBox) headBox.checked = boxes.length > 0 && boxes.every((b) => state.selected.has(b.id));
    drawBar();
  }

  if (headBox) {
    // Assigned rather than added, so re-rendering does not stack a second handler.
    headBox.onclick = () => {
      for (const { id } of boxes) {
        if (headBox.checked) state.selected.add(id);
        else state.selected.delete(id);
      }
      refresh();
    };
  }

  refresh();
}

/** Clears a table's selection - after an action that acted on it. */
function bulkClear(key) {
  bulkState.get(key)?.selected.clear();
}

/** A glyph button whose accessible name is the label, not the emoji. */
function iconButton(glyph, label) {
  const btn = document.createElement("button");
  btn.textContent = glyph;
  btn.title = label;
  btn.setAttribute("aria-label", label);
  return btn;
}

/** The search box, lower-cased; digits in it are matched against the phone columns. */
function leadsQuery() {
  const el = document.getElementById("leads-search");
  return el ? el.value.trim().toLowerCase() : "";
}

/**
 * The digit strings a query stands for when matched against a stored number: the digits
 * as typed, and - for a number pasted with its country code, "+20 10 …" - the local form
 * the number is stored in. Empty when the query has no digits at all.
 */
function phoneNeedles(q) {
  const digits = q.replace(/\D/g, "");
  if (!digits) return [];
  const needles = [digits];
  if (digits.startsWith("20") && digits.length >= 4) needles.push("0" + digits.slice(2));
  return needles;
}

function phoneHas(phone, needles) {
  const stored = String(phone || "");
  return needles.some((n) => stored.includes(n));
}

function leadMatches(lead, q) {
  if (!q) return true;
  if (String(lead.name || "").toLowerCase().includes(q)) return true;
  if (String(lead.altName || "").toLowerCase().includes(q)) return true;
  if (String(lead.caseName || "").toLowerCase().includes(q)) return true;
  const needles = phoneNeedles(q);
  return (
    needles.length > 0 &&
    (phoneHas(lead.phone, needles) || phoneHas(lead.whatsappPhone, needles) || phoneHas(lead.altPhone, needles))
  );
}

/** A second line under a cell, for the second contact or the notes - quiet, and only when there is one. */
function subLine(text) {
  return text ? `<div style="font-size:11px; color:var(--text-muted); white-space:normal; max-width:260px">${esc(text)}</div>` : "";
}

function renderLeadsTable(allLeads) {
  currentLeads = allLeads;
  // Filtered in the browser: the list is already here, and a client who rang back needs
  // finding by phone in the time it takes to say hello.
  const q = leadsQuery();
  // "من فين جه العميل": a lead that registered itself through a doctor's link sits on this
  // table looking exactly like the hundreds around it, which is how the owner registered one
  // and could not find it again.
  const source = document.getElementById("leads-source")?.value || "";
  const bySource = source ? allLeads.filter((lead) => lead.source === source) : allLeads;
  const leads = q ? bySource.filter((lead) => leadMatches(lead, q)) : bySource;
  const tbody = document.getElementById("leads-tbody");
  if (source && !leads.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">مفيش عملاء جم من لينك دكتور في النطاق المختار</td></tr>';
    document.querySelector('.bulk-bar[data-key="leads"]')?.remove();
    return;
  }
  if (q && !leads.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">مفيش عميل بالاسم أو الرقم ده في النطاق المختار</td></tr>';
    document.querySelector('.bulk-bar[data-key="leads"]')?.remove();
    return;
  }
  renderPaged("leads", leads, tbody, (lead) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(lead.name)}${
        lead.source === "link"
          ? ' <span class="badge" style="background:rgba(29,111,224,.15); color:#4d9bff" title="سجّل نفسه من لينك الدكتور">🔗 من اللينك</span>'
          : lead.source === "import"
            ? ' <span class="badge" style="background:rgba(180,120,20,.16); color:#e0a53a" title="حجز اتضاف من قايمة برة السيستم">📥 مستورد</span>'
            : ""
      }${subLine(lead.caseName ? "اسم الحالة: " + lead.caseName : "")}${subLine(lead.notes ? "📝 " + lead.notes : "")}</td>
      <td>${esc(lead.phone)}${subLine(lead.altPhone ? `${lead.altName || "رقم تاني"}: ${lead.altPhone}` : "")}</td>
      <td>${lead.whatsappPhone ? esc(lead.whatsappPhone) : '<span style="color:var(--text-muted)">نفس الرقم</span>'}${
        lead.whatsappCount ? ' <span class="badge" style="background:var(--good-soft); color:var(--good)">✓ ' + esc(lead.whatsappCount) + '</span>' : ''
      }</td>
      <td>${esc(STATUS_LABELS[lead.status] || lead.status)}</td>
      <td>${esc(lead.rep_name || "—")}</td>
      <td>${esc(lead.doctor_name || "—")}</td>
      <td>${esc(lead.campaign_name || "—")}</td>
      <td style="white-space:nowrap"></td>
    `;
    const actions = tr.lastElementChild;

    const activityBtn = iconButton("🕘", "سجل النشاط");
    activityBtn.addEventListener("click", () => openActivityModal(lead.id));
    actions.appendChild(activityBtn);

    if (canEditOperations()) {
      const editBtn = iconButton("✎", "تعديل");
      editBtn.addEventListener("click", () => openLeadModal(lead));
      actions.appendChild(editBtn);

      const delBtn = iconButton("🗑", "مسح");
      delBtn.addEventListener("click", () => deleteLead(lead));
      actions.appendChild(delBtn);
    }

    tbody.appendChild(tr);
  },
  (visible) => bulkAttach("leads", "leads-tbody", visible, leadBulkActions(), { allRows: leads }));
}

/** What a selection of leads can be acted on with. Shared by the leads and overdue tables. */
function leadBulkActions() {
  if (!canEditOperations()) return [];
  return [
    {
      label: "نقل لسيلز",
      run: async (ids) => {
        const reps = repsForBulk();
        if (!reps.length) return toast("مفيش سيلز متاحين", "bad");
        const userId = await promptDialog("نقل العملاء", {
          sub: `${ids.length} عميل`,
          label: "السيلز",
          options: reps.map((r) => ({ value: String(r.id), label: r.name })),
          confirmLabel: "نقل",
        });
        if (!userId) return;
        await runBulk("/admin/leads/bulk-assign", { ids, userId: Number(userId) }, (d) =>
          `اتنقل ${d.movedCount} عميل لـ ${d.repName}` + (d.skippedCount ? `، ${d.skippedCount} اتسيبوا (مجموعة تانية)` : ""),
        );
      },
    },
    {
      label: "قفل الليد",
      run: async (ids) => {
        const ok = await confirmDialog("قفل العملاء المتحددين", {
          sub: `${ids.length} عميل هيتقفلوا على "مقفول - مبيردش" ويخرجوا من شغل السيلز. اللي عليه حجز قايم هيتسيب. الليد بيفضل في السجل ويقدر السيلز يرجّعه لو العميل كلمه.`,
          confirmLabel: "اقفل",
        });
        if (!ok) return;
        await runBulk("/admin/leads/bulk-close", { ids }, (d) =>
          `اتقفل ${d.closedCount} عميل` + (d.skippedBooked ? `، ${d.skippedBooked} عليهم حجز قايم اتسابوا` : "") + (d.skippedCount ? `، ${d.skippedCount} اتسيبوا` : ""),
        );
      },
    },
    {
      label: "حذف",
      danger: true,
      run: async (ids) => {
        const ok = await confirmDialog("حذف العملاء المتحددين", {
          sub: `${ids.length} عميل. اللي اتكلم معاه حد هيتسيب في الخطوة دي وهتتسأل عليه بعدها. الحركة دي مينفعش ترجع فيها.`,
          confirmLabel: "امسح",
        });
        if (!ok) return;
        const first = await api("/admin/leads/bulk-delete", { method: "POST", body: { ids } });
        let message = `اتمسح ${first.deletedCount} عميل`;
        // The worked ones come back named; an admin gets asked once more, plainly.
        const worked = first.skippedWorked || [];
        if (worked.length && canManageData()) {
          const again = await confirmDialog(`${worked.length} عميل عليهم شغل`, {
            sub: "دول عليهم مكالمات أو حجوزات. لو مسحتهم هيتمسح تاريخهم كله معاهم ومش هيبانوا في أي تقرير. مفيش رجوع.",
            confirmLabel: "امسحهم بتاريخهم",
          });
          if (again) {
            const second = await api("/admin/leads/bulk-delete", { method: "POST", body: { ids: worked, withHistory: true } });
            message += ` و${second.deletedCount} بتاريخهم`;
          } else {
            message += `، ${worked.length} اتسيبوا`;
          }
        } else if (first.skippedCount) {
          message += `، ${first.skippedCount} اتسيبوا`;
        }
        toast(message, "good");
        bulkClear("leads");
        bulkClear("overdue");
        bulkClear("worksheet");
        afterLeadsChanged();
      },
    },
  ];
}

/** Reps a bulk move may target: the filtered doctor's group when one is chosen, else all. */
function repsForBulk() {
  const doctorId = Number(document.getElementById("doctor-filter").value);
  const doctor = doctorId ? allDoctors.find((d) => d.id === doctorId) : null;
  return doctor ? allReps.filter((r) => r.groupId === doctor.groupId) : allReps;
}

/** Posts a bulk action, reports what happened, and refreshes the lead tables. */
async function runBulk(url, body, describe) {
  const data = await api(url, { method: "POST", body });
  toast(describe(data), "good");
  bulkClear("leads");
  bulkClear("overdue");
  bulkClear("worksheet");
  afterLeadsChanged();
}

/**
 * Downloads an export. The server's own messages cover the two refusals an export can
 * hit - too many requests (429) and more than 20,000 rows (400, "ضيّق الفلتر") - and
 * api() shows them as-is.
 */
async function downloadExport(path, filename, btn, busyLabel) {
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = busyLabel;
  try {
    const res = await api(path, { raw: true });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

function exportLeads() {
  const src = document.getElementById("leads-source")?.value || "";
  const qs = src ? `${currentScopeQS}${currentScopeQS ? "&" : "?"}source=${src}` : currentScopeQS;
  return downloadExport(`/admin/leads/export${qs}`, "leads.xlsx", document.getElementById("export-btn"), "جاري التصدير...");
}

function renderDashboard(overview, reps) {
  // The all-time totals and the status split used to open this page; the owner dropped
  // them (2026-09-15) - cumulative numbers say nothing about the day - for the day view
  // renderDayOverview draws.
  const repsNote = document.getElementById("reps-note");
  if (repsNote) {
    const doctorId = document.getElementById("doctor-filter").value;
    repsNote.classList.toggle("hidden", !doctorId);
    repsNote.textContent = doctorId
      ? "مع فلتر الدكتور بيظهر بس السيلز اللي عندهم ليدز للدكتور ده - الباقي موجودين، بس مالهمش ليدز هنا."
      : "";
  }
  const noSync = '<span style="color:var(--text-muted)" title="التليفون لسه مابعتش تقرير النهاردة">لسه ما اتزامنش</span>';
  // The phone reports every call on the work line, in both directions. "Calls the rep
  // made" is the outbound share: answered_count and no_answer_count both fold incoming
  // calls in (an answered incoming call, a missed one), which is how a rep with 25 clients
  // and a two-a-day cap read as 56 unanswered calls before lunch. The direction counts
  // the same report carries pull them back apart; an older phone that never sent them
  // reports zero for the incoming side and the old figures fall through unchanged.
  const outboundAnswered = (t) => Math.max(0, t.answered_count - (t.incoming_count || 0));
  const outboundUnanswered = (t) => Math.max(0, t.no_answer_count - (t.missed_count || 0));
  // Answered incoming calls only: a missed one is in the call log, not in a total (owner, 2026-09-21).
  const inboundToday = (t) => t.incoming_count || 0;
  const outboundTalk = (t) => Math.max(0, t.talk_seconds - (t.incoming_talk_seconds || 0));

  const tbody = document.getElementById("reps-tbody");
  tbody.innerHTML = "";
  reps.forEach((rep) => {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.tabIndex = 0;
    tr.setAttribute("role", "button");
    tr.title = "تفاصيل الشهر";
    tr.addEventListener("click", () => showMonthly(rep.id));
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showMonthly(rep.id);
      }
    });
    // The synced call log first (the same rows the call-log page shows); the phone's own
    // summary only when no rows have synced yet.
    const today = rep.todayStats;
    const calls = rep.todayCalls;
    const answered = calls ? calls.outboundAnswered : today ? outboundAnswered(today) : null;
    const rings = calls ? calls.outboundRings : today ? outboundUnanswered(today) : null;
    const inbound = calls ? calls.inbound : today ? inboundToday(today) : null;
    const talk = calls ? calls.outboundTalk : today ? outboundTalk(today) : null;
    const inTalk = calls ? calls.inboundTalk : today ? today.incoming_talk_seconds : 0;
    tr.innerHTML = `
      <td>${esc(rep.name)}</td>
      <td>${esc(rep.phone)}</td>
      <td>${esc(rep.leadCount)}</td>
      <td>${esc(rep.callCount)}</td>
      <td>${esc(rep.outcomeCount ?? "—")}</td>
      <td>${answered == null ? noSync : esc(answered)}</td>
      <td>${rings == null ? noSync : esc(rings)}</td>
      <td>${inbound == null ? noSync : esc(inbound)}</td>
      <td>${talk == null ? noSync : esc(fmtDuration(talk)) + (inTalk ? ` <span style="color:var(--text-muted)">(وارد ${esc(fmtDuration(inTalk))})</span>` : "")}</td>
    `;
    tbody.appendChild(tr);
  });

  // renderTopReps was dropped with its card (2026-09-15).
}

// Hide what this role cannot use. The server rejects these actions regardless -
// this just avoids showing buttons that would only ever return an error.
function applyRoleVisibility() {
  const show = (id, visible) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("hidden", !visible);
  };

  // A team lead runs the sales floor day to day, so they edit the operational views -
  // leads, bookings, follow-ups, and how their own group's work is split. Every one of
  // those requests is still scoped to their group by the server, which is what actually
  // enforces the boundary; this only decides which controls are worth showing.
  show("add-lead-btn", canEditOperations());
  show("delete-todays-leads-btn", canEditOperations());
  show("suggest-links-btn", canEditOperations());
  show("add-doctor-btn2", canManageData());
  show("onboard-doctor-btn", canManageData());
  show("weekly-off-btn", canManageData());
  show("targets-all-btn", canEditOperations());
  show("staff-section", isSuperAdmin());
  show("export-btn", true);

  const welcome = document.getElementById("welcome-text");
  if (welcome && userRole) {
    welcome.textContent = `${userName} — ${ROLE_LABELS[userRole] || userRole}`;
  }

  buildNav();
  applyRoute();
  startNoWorkWatch();
  setupGlobalSearch();
  setupTableFilters();
}

/* ---------------------------------------------------------------- search everywhere */

let globalSearchReady = false;
let globalSearchTimer = null;

/**
 * One box in the top bar that finds any lead on the system - by name, case name or number -
 * whoever holds it, whatever page or date filter is open, and opens its story (owner,
 * 2026-09-24: "السيرش يجيب أي ليد مع أي حد ومش لازم يكون في نفس الصفحة").
 */
function setupGlobalSearch() {
  if (globalSearchReady) return;
  const input = document.getElementById("global-q");
  const box = document.getElementById("global-results");
  if (!input || !box) return;
  globalSearchReady = true;
  const hide = () => {
    box.classList.add("hidden");
    box.innerHTML = "";
  };
  input.addEventListener("input", () => {
    clearTimeout(globalSearchTimer);
    const q = input.value.trim();
    if (q.length < 2) return hide();
    globalSearchTimer = setTimeout(() => runGlobalSearch(q), 300);
  });
  input.addEventListener("focus", () => {
    if (input.value.trim().length >= 2 && box.children.length) box.classList.remove("hidden");
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      hide();
    } else if (e.key === "Enter") {
      const first = box.querySelector("button");
      if (first) first.click();
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#global-search")) hide();
  });
}

async function runGlobalSearch(q) {
  const input = document.getElementById("global-q");
  const box = document.getElementById("global-results");
  let data;
  try {
    data = await api(`/admin/leads/search?q=${encodeURIComponent(q)}`, { silent: true });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    return;
  }
  // Typed on since: this answer is for a question no longer asked.
  if (input.value.trim() !== q) return;
  box.innerHTML = "";
  box.classList.remove("hidden");
  if (!data.leads.length) {
    const none = document.createElement("div");
    none.className = "none";
    none.textContent = "مفيش ليد بالاسم أو الرقم ده على السيستم كله";
    box.appendChild(none);
    return;
  }
  for (const l of data.leads) {
    const b = document.createElement("button");
    b.type = "button";
    const name = document.createElement("div");
    name.textContent = l.name + (l.caseNames ? ` — الحالة: ${l.caseNames}` : "") + (l.altName ? ` (${l.altName})` : "");
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = [
      l.phone,
      l.statusLabel,
      l.repName ? `مع ${l.repName}` : "من غير موظف",
      l.doctorName,
      l.lastVisitAt ? `كشف ${l.lastVisitAt}` : null,
      l.createdAt ? `دخل ${String(l.createdAt).slice(0, 10)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    b.append(name, sub);
    b.addEventListener("click", () => {
      box.classList.add("hidden");
      openActivityModal(l.id);
    });
    box.appendChild(b);
  }
}

/**
 * Arabic as people type it: spaces and the tatweel dropped, the alef's hamza forms and the
 * two ya forms and ة/ه made one letter. "عبد الله" finds "عبدالله" (owner, 2026-09-25).
 * The same list the server folds names with.
 */
const ARABIC_FOLD = [
  [" ", ""], ["\t", ""], ["ـ", ""],
  ["أ", "ا"], ["إ", "ا"], ["آ", "ا"], ["ٱ", "ا"], ["ء", ""],
  ["ى", "ي"], ["ی", "ي"], ["ئ", "ي"], ["ؤ", "و"], ["ة", "ه"],
  ["\u064b", ""], ["\u064c", ""], ["\u064d", ""], ["\u064e", ""], ["\u064f", ""],
  ["\u0650", ""], ["\u0651", ""], ["\u0652", ""], ["\u0670", ""],
];
function foldArabic(text) {
  let out = String(text || "").toLowerCase();
  for (const [from, to] of ARABIC_FOLD) out = out.split(from).join(to);
  return out;
}

/**
 * Whether a row answers what was typed: the words folded (so a hamza or a space does not
 * matter), and a run of four digits or more read as part of a number.
 */
function rowMatchesQuery(text, q, digits) {
  if (!q && !digits) return true;
  const folded = foldArabic(text);
  if (q && folded.includes(q)) return true;
  return Boolean(digits && digits.length >= 4 && String(text).replace(/\D/g, "").includes(digits));
}

/** What the user typed in one of these boxes, ready for rowMatchesQuery. */
function readQuery(inputId) {
  const raw = (document.getElementById(inputId)?.value || "").trim();
  return {
    raw,
    q: foldArabic(raw),
    digits: raw.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "").replace(/^0+/, ""),
  };
}

/**
 * A box above a table that hides the rows not matching what is typed - name, case name or
 * number - and keeps doing so as the table re-renders under it. Wired by the
 * data-filter-tbody attribute on the input, so a table gets one by markup alone.
 *
 * An input marked data-server-search runs its own search instead (the bookings page): the
 * whole system, not the rows that happen to be on screen.
 */
function setupTableFilters() {
  for (const input of document.querySelectorAll("input[data-filter-tbody]")) {
    if (input.dataset.serverSearch || input.dataset.listFilter) continue;
    if (input.dataset.filterReady) continue;
    input.dataset.filterReady = "1";
    const tbody = document.getElementById(input.dataset.filterTbody);
    if (!tbody) continue;
    const apply = () => {
      const raw = input.value.trim();
      const q = foldArabic(raw);
      const digits = raw.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "").replace(/^0+/, "");
      for (const tr of tbody.querySelectorAll("tr")) {
        if (!q) {
          tr.classList.remove("hidden");
          continue;
        }
        const text = foldArabic(tr.textContent);
        const hit = text.includes(q) || (digits.length >= 4 && tr.textContent.replace(/\D/g, "").includes(digits));
        tr.classList.toggle("hidden", !hit);
      }
    };
    input.addEventListener("input", apply);
    new MutationObserver(() => {
      if (input.value.trim()) apply();
    }).observe(tbody, { childList: true });
  }
}

/* ---------------------------------------------------------------- تقرير الدكتور */

let doctorReportReady = false;

/** The page: pick a doctor and a period, read the report, print it. */
async function loadDoctorReport() {
  const select = document.getElementById("report-doctor");
  if (!select) return;
  if (!allDoctors.length) {
    try {
      allDoctors = (await api("/admin/doctors", { silent: true })).doctors || [];
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
    }
  }
  const keep = select.value;
  select.innerHTML = '<option value="">اختار الدكتور</option>';
  for (const d of allDoctors.filter((d) => d.active !== false)) {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.name;
    select.appendChild(opt);
  }
  if (keep) select.value = keep;
  const from = document.getElementById("report-from");
  const to = document.getElementById("report-to");
  if (!from.value) from.value = todayLocal().slice(0, 7) + "-01";
  if (!to.value) to.value = todayLocal();
  if (!doctorReportReady) {
    doctorReportReady = true;
    document.getElementById("report-run").addEventListener("click", () => runDoctorReport());
    document.getElementById("report-print").addEventListener("click", () => printDoctorReport());
    select.addEventListener("change", () => {
      if (select.value) runDoctorReport();
    });
  }
}

/**
 * Prints the report with the doctor's name as the file name: the browser names a
 * "print to PDF" file after document.title, so it is swapped for the length of the
 * dialog and put back after (owner, 2026-09-24).
 */
function printDoctorReport() {
  const name = (lastDoctorReport && lastDoctorReport.doctor && lastDoctorReport.doctor.name) || "";
  const period = lastDoctorReport ? `${lastDoctorReport.period.from} لـ ${lastDoctorReport.period.to}` : "";
  const was = document.title;
  if (name) document.title = `تقرير ${name} - ${period}`.replace(/[\\/:*?"<>|]/g, "-");
  const restore = () => {
    document.title = was;
    removeEventListener("afterprint", restore);
  };
  addEventListener("afterprint", restore);
  window.print();
  // Safari and some Android browsers never fire afterprint; the title comes back anyway.
  setTimeout(restore, 4000);
}

/** The report on screen, kept so printing can name the file after its doctor. */
let lastDoctorReport = null;

async function runDoctorReport() {
  const doctorId = document.getElementById("report-doctor").value;
  const from = document.getElementById("report-from").value;
  const to = document.getElementById("report-to").value;
  const status = document.getElementById("report-status");
  const paper = document.getElementById("report-paper");
  const printBtn = document.getElementById("report-print");
  if (!doctorId) {
    status.classList.remove("hidden");
    status.textContent = "اختار الدكتور الأول";
    return;
  }
  const isStale = beginLoad("doctor-report");
  status.classList.remove("hidden");
  status.textContent = "جاري تجهيز التقرير... (ملخص الملاحظات ممكن ياخد ثواني)";
  paper.classList.add("hidden");
  printBtn.classList.add("hidden");
  let r;
  try {
    r = await api(`/admin/doctors/${doctorId}/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { silent: true });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (isStale()) return;
    status.textContent = e.message;
    return;
  }
  if (isStale()) return;
  status.classList.add("hidden");
  lastDoctorReport = r;
  renderDoctorReport(paper, r);
  paper.classList.remove("hidden");
  printBtn.classList.remove("hidden");
}

const AI_STATUS_AR = {
  ok: null,
  no_key: "ملخص الـ AI مش شغال: مفيش مفتاح (ANTHROPIC_API_KEY أو GEMINI_API_KEY) على السيرفر.",
  no_credit: "ملخص الـ AI مش شغال: المفتاح صح بس الحساب مفيهوش رصيد / الحصة خلصت.",
  bad_key: "ملخص الـ AI مش شغال: المفتاح مرفوض.",
  error: "ملخص الـ AI مش شغال دلوقتي: الخدمة ردّت بخطأ.",
  too_few: "ملاحظات أقل من 3 في المدة دي - مفيش حاجة تتلخص بالـ AI.",
  skipped: null,
};

/** Builds the page. Everything is DOM, so a name in the data can never become markup. */
function renderDoctorReport(paper, r) {
  paper.innerHTML = "";
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const n = (v) => (v == null ? "—" : String(v));
  const pctTxt = (p) => (p == null ? "" : ` (${p}%)`);

  const brand = el("div", null, "brand");
  brand.append(el("b", "Lead to Doctor"), el("span", `تقرير الدكتور · اتعمل ${r.generatedAt}`, "muted"));
  paper.appendChild(brand);
  paper.appendChild(el("h2", r.doctor.name));
  const meta = [r.doctor.city, r.doctor.address, r.doctor.phone ? `ت: ${r.doctor.phone}` : null, r.doctor.hours ? `المواعيد: ${r.doctor.hours}` : null].filter(Boolean).join(" · ");
  if (meta) paper.appendChild(el("div", meta, "muted"));
  paper.appendChild(el("div", `المدة: من ${r.period.from} لـ ${r.period.to}`, "muted"));
  if (r.doctor.services.length) paper.appendChild(el("div", `الخدمات: ${r.doctor.services.join(" · ")}`));

  // --- the headline numbers
  paper.appendChild(el("h3", "الأرقام الأساسية"));
  const tiles = el("div", null, "rtiles");
  const tile = (v, l) => {
    const t = el("div", null, "rtile");
    t.append(el("div", n(v), "v"), el("div", l, "l"));
    tiles.appendChild(t);
  };
  tile(r.leads.total, "ليدز دخلت في المدة");
  tile(r.leads.interested, "مهتم + مهتم جداً");
  tile(r.leads.notInterested, "غير مهتم");
  tile(r.bookings.made, "حجوزات اتعملت" + (r.bookings.madeCancelled ? ` (اتلغى ${r.bookings.madeCancelled})` : ""));
  // The accounts' count: every examination in the period, the sheet's rows included - the
  // bookings alone undercounted a clinic whose cases mostly came from the sheet.
  tile(r.cases.examined, "كشوفات تمت" + (r.bookings.visits.examined !== r.cases.examined ? ` (منها ${r.bookings.visits.examined} حجز من السيستم)` : ""));
  tile(r.bookings.visits.noShow, "محضرش");
  tile(r.cases.started, "بدأوا الخطة العلاجية" + (r.funnel.startedPct != null ? ` (${r.funnel.startedPct}% من الكشوفات)` : ""));
  tile(r.leads.allTime, "إجمالي ليدز الدكتور من الأول");
  paper.appendChild(tiles);

  // --- the leads by status
  paper.appendChild(el("h3", "الليدز اللي دخلت في المدة، بحالتهم دلوقتي"));
  const st = el("table");
  const sh = el("tr");
  ["الحالة", "العدد", "النسبة"].forEach((h) => sh.appendChild(el("th", h)));
  st.appendChild(sh);
  for (const s of r.leads.byStatus.filter((s) => s.n > 0)) {
    const tr = el("tr");
    tr.append(el("td", s.label), el("td", n(s.n)), el("td", s.pct == null ? "—" : `${s.pct}%`));
    st.appendChild(tr);
  }
  if (!r.leads.total) {
    const tr = el("tr");
    const td = el("td", "مفيش ليدز دخلت في المدة دي");
    td.colSpan = 3;
    tr.appendChild(td);
    st.appendChild(tr);
  }
  paper.appendChild(st);

  // --- visits
  paper.appendChild(el("h3", "الحجوزات والكشوفات في المدة"));
  const v = r.bookings.visits;
  const vl = el("ul");
  vl.append(
    el("li", `حجوزات اتعملت في المدة: ${n(r.bookings.made)}${r.bookings.madeCancelled ? ` — اتلغى منها ${r.bookings.madeCancelled}` : ""}`),
    el("li", `مواعيد كشف في المدة: ${n(v.total)} — تم الكشف ${n(v.examined)} · محضرش ${n(v.noShow)} · لسه متسجلتش ${n(v.unrecorded)} · اتلغت ${n(v.cancelled)}`),
    el("li", `حالات في الحسابات كشفت في المدة: ${n(r.cases.examined)} — بدأ منهم الخطة ${n(r.cases.startedOfThese)}`),
    el("li", `بدأوا الخطة العلاجية في المدة (بتاريخ البداية): ${n(r.cases.started)}`),
  );
  paper.appendChild(vl);

  // --- services
  paper.appendChild(el("h3", "الخدمات وعدد الحالات"));
  if (r.services.length) {
    const t = el("table");
    const h = el("tr");
    ["الخدمة", "ليدز طلبوها", "حجوزات", "كشوفات تمت"].forEach((x) => h.appendChild(el("th", x)));
    t.appendChild(h);
    for (const s of r.services) {
      const tr = el("tr");
      tr.append(el("td", s.name), el("td", n(s.leads)), el("td", n(s.booked)), el("td", n(s.examined)));
      t.appendChild(tr);
    }
    paper.appendChild(t);
  } else {
    paper.appendChild(el("div", "مفيش خدمات متسجلة على ليدز المدة دي", "muted"));
  }

  // --- notes
  paper.appendChild(el("h3", `ملخص ملاحظات متابعة ما بعد الكشف (${r.notes.total} ملاحظة)`));
  if (r.ai && r.ai.status === "ok") {
    paper.appendChild(el("div", r.ai.summary, "ai"));
    paper.appendChild(el("div", `اتلخص بالـ AI (${r.ai.provider === "gemini" ? "Gemini" : "Claude"})`, "muted"));
  } else if (r.ai && AI_STATUS_AR[r.ai.status]) {
    paper.appendChild(el("div", AI_STATUS_AR[r.ai.status], "muted no-print"));
  }
  if (r.notes.themes.length) {
    const t = el("table");
    const h = el("tr");
    ["اللي بيتكرر في الملاحظات", "عدد المرات", "مثال"].forEach((x) => h.appendChild(el("th", x)));
    t.appendChild(h);
    for (const th of r.notes.themes) {
      const tr = el("tr");
      tr.append(el("td", th.label), el("td", `${th.count} (${Math.round((th.count / r.notes.total) * 100)}%)`), el("td", th.examples[0] || ""));
      t.appendChild(tr);
    }
    paper.appendChild(t);
  }
  if (r.notes.topWords.length) {
    paper.appendChild(el("div", "أكتر الكلمات تكراراً: " + r.notes.topWords.map((w) => `${w.word} (${w.n})`).join(" · "), "muted"));
  }
  if (r.notes.samples.length) {
    paper.appendChild(el("div", "أمثلة من الملاحظات:", "muted"));
    for (const s of r.notes.samples) paper.appendChild(el("div", s, "note"));
  }
  if (!r.notes.total) paper.appendChild(el("div", "مفيش ملاحظات متسجلة في مكالمات متابعة ما بعد الكشف في المدة دي", "muted"));
}

/** "سجّلها فلانة من الموبايل" / "من الداشبورد": who flipped the plan, and from where. */
function planReportedLine(name, role) {
  if (!name) return "";
  return `سجّلها ${name} من ${role === "sales" ? "الموبايل" : "الداشبورد"}`;
}

/* ---------------------------------------------------------------- الخطة العلاجية */

let planStartTimer = null;
let planStartReady = false;

/** The page: a search, and on each row one switch. */
async function loadPlanStart() {
  const input = document.getElementById("plan-start-q");
  if (!input) return;
  if (!planStartReady) {
    planStartReady = true;
    input.addEventListener("input", () => {
      clearTimeout(planStartTimer);
      planStartTimer = setTimeout(() => searchPlanStart(), 300);
    });
  }
  await searchPlanStart();
}

async function searchPlanStart() {
  const input = document.getElementById("plan-start-q");
  const tbody = document.getElementById("plan-start-tbody");
  const empty = document.getElementById("plan-start-empty");
  const wrap = document.getElementById("plan-start-wrap");
  const q = input.value.trim();
  const isStale = beginLoad("plan-start");
  if (q.length < 2) {
    tbody.innerHTML = "";
    wrap.classList.add("hidden");
    empty.classList.remove("hidden");
    empty.textContent = "اكتب حرفين على الأقل من اسم الحالة أو الليد، أو الرقم";
    return;
  }
  let data;
  try {
    data = await api(`/admin/plan-cases?q=${encodeURIComponent(q)}`, { silent: true });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (isStale()) return;
    empty.classList.remove("hidden");
    empty.textContent = e.message;
    return;
  }
  if (isStale()) return;
  renderPlanStart(data.cases || []);
}

function renderPlanStart(cases) {
  const tbody = document.getElementById("plan-start-tbody");
  const empty = document.getElementById("plan-start-empty");
  const wrap = document.getElementById("plan-start-wrap");
  tbody.innerHTML = "";
  if (!cases.length) {
    wrap.classList.add("hidden");
    empty.classList.remove("hidden");
    empty.textContent = "مفيش حالة كشفت بالاسم أو الرقم ده";
    return;
  }
  empty.classList.add("hidden");
  wrap.classList.remove("hidden");
  for (const c of cases) tbody.appendChild(planStartRow(c));
}

function planStartRow(c) {
  const tr = document.createElement("tr");
  tr.dataset.caseId = c.caseId;
  const td = (text) => {
    const cell = document.createElement("td");
    cell.textContent = text == null || text === "" ? "—" : String(text);
    return cell;
  };
  const caseCell = td(c.caseName || "من غير اسم");
  // No lead to edit: the name lives on the accounts row, so the pen edits that.
  if (!c.leadId) caseCell.insertAdjacentHTML("beforeend", caseEditHtml(c.caseId));
  tr.appendChild(caseCell);
  const lead = td(c.leadName || "—");
  if (c.leadId) {
    lead.textContent = "";
    const link = document.createElement("button");
    link.className = "link-btn";
    link.textContent = c.leadName || "افتح الليد";
    link.addEventListener("click", () => openActivityModal(c.leadId));
    lead.appendChild(link);
    lead.insertAdjacentHTML("beforeend", leadEditHtml(c.leadId));
  }
  tr.appendChild(lead);
  tr.appendChild(td((c.phones && c.phones.length ? c.phones : [c.phone]).filter(Boolean).join(" / ")));
  tr.appendChild(td(c.clinicName));
  tr.appendChild(td(c.visitDay));
  tr.appendChild(td(c.ownerName || c.employeeName));

  const planCell = document.createElement("td");
  const btn = document.createElement("button");
  btn.className = c.planStarted ? "primary" : "";
  btn.textContent = c.planStarted ? `بدأت ✓${c.planStartedOn ? " " + c.planStartedOn : ""}` : "مركّبش";
  btn.title = c.planStarted ? "اضغط ترجّعها مركّبش (وبونصها بيتشال)" : "اضغط لما الحالة تبدأ الخطة";
  btn.addEventListener("click", async () => {
    const started = !c.planStarted;
    const name = c.caseName || "الحالة";
    if (!confirm(started ? `${name} بدأت الخطة العلاجية؟ هتتحسب من النهارده وبونصها بيتحسب.` : `ترجّع ${name} «مركّبش»؟ البونص بتاعها هيتشال وهترجع تتتابع.`)) return;
    btn.disabled = true;
    try {
      const { case: updated } = await api(`/admin/plan-cases/${c.caseId}/started`, { method: "POST", body: { started } });
      toast(started ? "اتسجلت بداية الخطة ✓" : "اترجعت مركّبش");
      tr.replaceWith(planStartRow(updated));
      dirtyViews.add("overview");
      dirtyViews.add("finance");
    } catch (e) {
      btn.disabled = false;
      if (!(e instanceof ApiError)) throw e;
    }
  });
  planCell.appendChild(btn);
  if (c.state === "closed" && !c.planStarted) {
    const sub = document.createElement("div");
    sub.style.cssText = "font-size:11px; color:var(--text-muted); margin-top:3px";
    sub.textContent = `المتابعة اتقفلت: ${c.closedReasonLabel || "—"}`;
    planCell.appendChild(sub);
  }
  tr.appendChild(planCell);
  tr.appendChild(td(c.planStarted ? planReportedLine(c.planReportedByName, c.planReportedByRole) || "من الحسابات" : ""));
  return tr;
}

const REMINDER_LABELS = {
  reminder_confirmed: "أكّد الحضور",
  reminder_no_answer: "مردّش",
  reminder_cancelled: "ألغى",
  reminder_rescheduled: "أجّل",
};

const NEXT_ACTION_LABELS = {
  call: "اتصل",
  wait_tomorrow: "كمّل بكرة",
  whatsapp: "ابعتله واتساب",
  close: "اقفل الليد",
};

// Reps available to take over a reminder call, cached from the assignments load so the
// dropdown does not refetch the roster for every row in the table.
let allReps = [];

/**
 * Fills the rep filter from the roster already loaded for the assignment table.
 *
 * Rebuilt from scratch each time and the previous choice restored, for the same reason
 * loadDoctors() does: appending to a select that was never cleared is what produced the
 * duplicated doctor list.
 */
function fillRepFilter() {
  const select = document.getElementById("rep-filter");
  if (!select) return;
  const previous = select.value;
  select.innerHTML = '<option value="">كل السيلز</option>';
  for (const rep of allReps) {
    const opt = document.createElement("option");
    opt.value = rep.id;
    opt.textContent = rep.name;
    select.appendChild(opt);
  }
  if (allReps.some((r) => String(r.id) === previous)) select.value = previous;
}

/** Splits the stored 'YYYY-MM-DD HH:MM' without letting Date reinterpret the timezone. */
function splitDateTime(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(value || ""));
  if (!m) return { date: value || "—", time: "—", weekday: "—" };
  const days = ["الأحد", "الإتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];
  const weekday = days[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()] || "—";
  const h = +m[4];
  const suffix = h < 12 ? "ص" : "م";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${h12}:${m[5]} ${suffix}`, weekday };
}

/* ------------------------------------------------------------------------
   Cairo time for the stamps that are really UTC.

   Most times the dashboard prints are already Cairo wall clock - `scheduled_for` is
   literally the time a rep typed - which is why splitDateTime() above deliberately
   does not touch the timezone. A reminder's `remind_at` is the opposite: a real UTC
   instant, so a follow-up at 01:00 Cairo is stored on the *previous* UTC date.
   Printing one of those raw is how this project has already shipped a follow-up shown
   on the wrong day twice, so anything UTC is converted here first and only then handed
   to splitDateTime() for formatting.
   ------------------------------------------------------------------------ */
const CAIRO_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Cairo",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hour12: false,
});

/** A stored 'YYYY-MM-DD HH:MM:SS' UTC stamp as a Date, or null if it is not one. */
function utcStampToDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(value || ""));
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
}

/** A Date as Cairo wall time in the 'YYYY-MM-DD HH:MM:SS' shape splitDateTime() reads. */
function cairoWallStamp(date) {
  const parts = {};
  for (const p of CAIRO_PARTS.formatToParts(date)) parts[p.type] = p.value;
  // hour12:false still answers "24" for midnight in some engines, which would read as
  // an hour that does not exist and sort after 23:00.
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}:${parts.second}`;
}

/** splitDateTime() for a UTC stamp: same three fields, read in Cairo. */
function splitUtcInCairo(value) {
  const at = utcStampToDate(value);
  return at ? splitDateTime(cairoWallStamp(at)) : splitDateTime(value);
}

/** Today in Cairo - the day an admin means by "النهاردة", wherever their laptop is. */
function cairoToday() {
  return cairoWallStamp(new Date()).slice(0, 10);
}

/** `days` after a 'YYYY-MM-DD' day, as 'YYYY-MM-DD'. */
function addDaysISO(day, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ""));
  if (!m) return day;
  const at = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/** The four range inputs, so setting one and clearing them all read the same way. */
const BOOKING_RANGE_FIELDS = [
  ["from", "bookings-from"],
  ["to", "bookings-to"],
  ["bookedFrom", "bookings-booked-from"],
  ["bookedTo", "bookings-booked-to"],
];

async function loadBookings() {
  const needsAttendance = document.getElementById("bookings-needs-attendance").checked;
  const search = (document.getElementById("bookings-q").value || "").trim();
  const params = new URLSearchParams();
  // A name searches everything; the date range is for browsing, not for finding a person.
  if (search.length >= 2) params.set("q", search);
  if (needsAttendance && search.length < 2) params.set("needsAttendance", "1");
  // There used to be a second, unlabelled "one exact day" picker above these, which said
  // the same thing "معاد الحجز" says with from and to set to the same day - and which
  // silently disabled this range whenever it held a value, so an admin filling in معاد
  // الحجز watched it grey out and do nothing. One day is now just a range of one day.
  // When it was booked is a different question and always applies.
  for (const [param, id] of BOOKING_RANGE_FIELDS) {
    const value = document.getElementById(id).value;
    const isAppointmentRange = param === "from" || param === "to";
    if (search.length >= 2) continue;
    if (value && !(isAppointmentRange && needsAttendance)) params.set(param, value);
  }
  document.getElementById("bookings-from").disabled = needsAttendance;
  document.getElementById("bookings-to").disabled = needsAttendance;
  // The scope filter is hidden on this view, so it is not applied here: a doctor or rep
  // picked on another page must not silently narrow the bookings list.

  const isStale = beginLoad("bookings");
  const { bookings } = await api(`/admin/bookings?${params}`);
  if (isStale()) return;

  // Owed a reminder call: none yet, or the last one reached nobody (مردّش).
  const pending = bookings.filter((b) => b.status === "scheduled" && (!b.reminderCallAt || b.reminderOutcome === "reminder_no_answer")).length;
  const late = bookings.filter((b) => b.reminderLate).length;
  const lateResults = needsAttendance ? bookings.filter(resultOverdue).length : 0;
  document.getElementById("bookings-note").textContent = search.length >= 2
    ? bookings.length
      ? `${bookings.length} حجز فيهم «${search}» — من كل التواريخ، الفلاتر فوق واقفة.`
      : `مفيش حجز فيه «${search}» على السيستم كله.`
    : needsAttendance
    ? bookings.length
      ? `${bookings.length} حجز فات ميعاده ولسه محتاج تسجيل نتيجة.` +
        (lateResults ? ` ${lateResults} منهم فات عليهم أكتر من ${BOOKING_RESULT_GRACE_DAYS} أيام - اتصل بالعيادة.` : "")
      : "مفيش حجوزات محتاجة تسجيل نتيجة."
    : bookings.length
      ? `${bookings.length} حجز — ${pending} لسه محتاج مكالمة تذكير${late ? ` (${late} اتأخر عن ميعاد التذكير)` : ""}.`
      : "مفيش حجوزات في المدة دي.";

  const tbody = document.getElementById("bookings-tbody");
  tbody.innerHTML = "";
  bookings.forEach((b) => {
    const when = splitDateTime(b.scheduledFor);
    const contacted = splitDateTime(b.contactedAt);
    const reminder = reminderCellHtml(b);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(b.leadName)}${leadEditHtml(b.leadId)}${subLine(b.caseName && b.caseName !== b.leadName ? "الحالة: " + b.caseName : "")}${subLine(b.leadNotes ? "📝 " + b.leadNotes : "")}</td>
      <td>${esc(b.leadPhone)}${subLine(b.altPhone ? `${b.altName || "رقم تاني"}: ${b.altPhone}` : "")}</td>
      <td>${esc(b.doctorName || "—")}</td>
      <td>${esc(b.serviceName || "—")}</td>
      <td>${esc(when.weekday)}</td>
      <td>${esc(when.time)}</td>
      <td>${esc(contacted.date)}</td>
      <td>${esc(b.bookedAt ? splitDateTime(cairoWallStamp(utcStampToDate(b.bookedAt)) || b.bookedAt).date : "—")}</td>
      <td>${esc(b.bookedByName || "—")}</td>
      <td></td>
      <td>${reminder}</td>
      <td></td>
      <td></td>
      <td></td>
    `;
    const cells = tr.querySelectorAll("td");
    // The case's name is correctable wherever it shows (owner, 2026-09-13).
    if (canEditOperations()) {
      const pen = document.createElement("button");
      pen.className = "link-btn";
      pen.style.cssText = "font-size:11px; margin-inline-start:6px";
      pen.title = "عدّل اسم الحالة";
      pen.textContent = "✎ اسم الحالة";
      pen.addEventListener("click", async (e) => {
        e.stopPropagation();
        const next = prompt("اسم الحالة (المريض):", b.caseName || b.leadName || "");
        if (next === null || !next.trim()) return;
        try {
          await api(`/admin/bookings/${b.id}`, { method: "PATCH", body: { caseName: next.trim() } });
          invalidate("bookings");
          loadBookings();
        } catch (err) {
          if (!(err instanceof ApiError)) throw err;
        }
      });
      cells[0].appendChild(pen);
    }
    cells[8].appendChild(reassignSelect(b));
    cells[10].appendChild(attendanceSelect(b, bookings));
    // Past the grace with no clinic answer: the row is the alarm.
    if (needsAttendance && resultOverdue(b)) {
      tr.className = "warn-row";
      const late = document.createElement("span");
      late.className = "badge";
      late.style.cssText = "background:var(--critical-soft); color:var(--critical); margin-inline-start:6px";
      late.textContent = `فات عليه ${daysSinceVisit(b)} يوم`;
      cells[4].appendChild(late);
    }

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "نسخ";
    copyBtn.title = "نسخ بيانات الحجز";
    copyBtn.addEventListener("click", () => copyBookingSummary(b, copyBtn));
    cells[11].appendChild(copyBtn);

    if (b.status === "cancelled") {
      cells[12].innerHTML = '<span class="badge" style="background:var(--critical-soft); color:var(--critical)">ملغي</span>';
    } else if (b.status === "scheduled" && canReassignBookings()) {
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "إلغاء";
      cancelBtn.title = "إلغاء الحجز";
      cancelBtn.addEventListener("click", () => cancelBooking(b, cancelBtn));
      cells[12].appendChild(cancelBtn);

      const moveBtn = document.createElement("button");
      moveBtn.textContent = "غيّر الميعاد";
      moveBtn.title = "الميعاد اتغيّر من العيادة";
      moveBtn.style.marginInlineStart = "6px";
      moveBtn.addEventListener("click", () => rescheduleBooking(b));
      cells[12].appendChild(moveBtn);
    } else if ((b.status === "examined" || b.status === "no_show") && canReassignBookings()) {
      // The visit was entered on the wrong day - today instead of the day she came. The
      // case in the accounts and the clinic's page follow the corrected day.
      const dayBtn = document.createElement("button");
      dayBtn.textContent = "صحّح تاريخ الكشف";
      dayBtn.title = "اليوم اللي الحالة جت فيه فعلاً";
      dayBtn.addEventListener("click", () => rescheduleBooking(b, { recorded: true }));
      cells[12].appendChild(dayBtn);
    }

    tbody.appendChild(tr);
  });

  bulkAttach("bookings", "bookings-tbody", bookings, [
    {
      label: "سجّل: حضروا وكشفوا",
      show: canReassignBookings,
      run: async (ids) => recordBookingAttendance(bookings, ids, true, { confirm: true }),
    },
    {
      label: "سجّل: محضروش",
      show: canReassignBookings,
      run: async (ids) => recordBookingAttendance(bookings, ids, false, { confirm: true }),
    },
    {
      label: "إلغاء الحجوزات",
      danger: true,
      show: canReassignBookings,
      run: async (ids) => {
        const live = bookings.filter((b) => ids.includes(b.id) && b.status === "scheduled");
        if (!live.length) return toast("مفيش حجز متحدد لسه قابل للإلغاء", "bad");
        const ok = await confirmDialog("إلغاء الحجوزات المتحددة", {
          sub: `${live.length} حجز. العملاء هيرجعوا لمتابعة لاحقة.`,
          confirmLabel: "الغي",
        });
        if (!ok) return;
        const results = await Promise.allSettled(
          live.map((b) => api(`/admin/bookings/${b.id}/cancel`, { method: "POST", silent: true })),
        );
        const done = results.filter((r) => r.status === "fulfilled").length;
        toast(`اتلغى ${done} حجز` + (done < live.length ? `، ${live.length - done} فشلوا` : ""), done ? "good" : "bad");
        bulkClear("bookings");
        afterBookingsChanged();
      },
    },
  ]);
}

/** After a booking is cancelled or its clinic outcome recorded: the bookings table plus
 * the lead tables, because the lead's status changed with it. */
function afterBookingsChanged() {
  loadBookings();
  afterLeadsChanged();
}

/** Cancels a booking and hands the lead back to follow-up, so it does not sit forever
 * reading as "booked" for an appointment that is not going to happen. */
/** The clinic moved the appointment; the reminder call starts over for the new slot. */
async function rescheduleBooking(booking, { recorded = false } = {}) {
  const current = String(booking.scheduledFor || "").replace(" ", "T").slice(0, 16);
  const value = await promptDialog(recorded ? `تاريخ كشف ${booking.leadName}` : `ميعاد جديد لـ ${booking.leadName}`, {
    sub: recorded
      ? "اليوم اللي الحالة جت فيه فعلاً - الحالة في الحسابات ولينك الدكتور هيمشوا عليه."
      : "مكالمة التذكير هتترجع \"لسه\" عشان تتعمل للميعاد الجديد.",
    label: "الميعاد",
    type: "datetime-local",
    value: current,
    confirmLabel: "احفظ",
  });
  if (!value) return;
  await api(`/admin/bookings/${booking.id}`, { method: "PATCH", body: { scheduledFor: value.replace("T", " ") } });
  toast(recorded ? `اتصحّح تاريخ كشف ${booking.leadName}` : `اتغيّر ميعاد ${booking.leadName}`, "good");
  if (recorded) dirtyViews.add("finance");
  afterBookingsChanged();
}

async function cancelBooking(booking, btn) {
  if (!(await confirmDialog("إلغاء الحجز", { sub: `تلغي حجز ${booking.leadName}؟`, confirmLabel: "الغي الحجز" }))) return;
  btn.disabled = true;
  try {
    await api(`/admin/bookings/${booking.id}/cancel`, { method: "POST" });
  } catch (e) {
    btn.disabled = false;
    throw e;
  }
  toast(`اتلغى حجز ${booking.leadName}`, "good");
  afterBookingsChanged();
}

/**
 * What the clinic's report said about one booking: did the client actually turn up and
 * get examined, or not. The system cannot see this on its own - it is always someone
 * reading a doctor's report and recording it by hand, which is why this is a select
 * rather than something computed.
 */
const ATTENDANCE_LABELS = { "": "لسه محتاج تسجيل", examined: "حضر وكشف", no_show: "محضرش" };

function attendanceSelect(booking, allBookings) {
  const sel = document.createElement("select");
  sel.setAttribute("aria-label", `حضور ${booking.leadName}`);
  const current = booking.status === "examined" || booking.status === "no_show" ? booking.status : "";
  Object.entries(ATTENDANCE_LABELS).forEach(([value, label]) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value === "" && current ? "لسه (رجّع للمحتاج تسجيل)" : label;
    if (value === current) opt.selected = true;
    sel.appendChild(opt);
  });

  const locked = booking.status === "cancelled" || !canReassignBookings();
  sel.disabled = locked;
  if (!locked) {
    // A <select> commits on one mis-pick, so instead of a dialog every time there is an
    // 8-second undo that puts the previous value back.
    sel.addEventListener("change", async () => {
      const previous = current;
      const next = sel.value;
      sel.disabled = true;
      // Correcting a result already recorded is the whole point of a dropdown that shows
      // the current one - including "لسه", which only ever means "undo what was recorded".
      // Without this the select refused every correction with a message telling the admin
      // to "send force", which is an API parameter and not something a person can do.
      const correcting = Boolean(current);
      const ok = await recordBookingAttendance(allBookings || [booking], [booking.id], attendedValue(next), {
        force: correcting,
        undo: () =>
          recordBookingAttendance(allBookings || [booking], [booking.id], attendedValue(previous), {
            quiet: true,
            force: true,
          }),
      });
      if (!ok) {
        sel.value = previous;
        sel.disabled = false;
      }
    });
  }
  return sel;
}

/** "" -> null (reset to needs-recording), examined -> true, no_show -> false. */
function attendedValue(status) {
  return status === "" ? null : status === "examined";
}

const ATTENDED_LABEL = (attended) => (attended === null ? "لسه محتاج تسجيل" : attended ? "حضر وكشف" : "محضرش");

/**
 * Records attendance for the selected bookings, live or from the single-row select.
 *
 * @param attended  true / false, or null to put the booking back to "needs recording"
 * @param opts.confirm  ask first, stating the count (bulk actions)
 * @param opts.undo     a function that reverts; offered on the success toast for 8s
 * @param opts.quiet    no toast (used by the undo itself)
 */
async function recordBookingAttendance(allBookings, ids, attended, { confirm = false, undo = null, quiet = false, force = false } = {}) {
  const live = allBookings.filter((b) => ids.includes(b.id) && b.status !== "cancelled");
  if (!live.length) {
    toast("مفيش حجز متحدد قابل لتسجيل الحضور", "bad");
    return false;
  }
  if (confirm) {
    const ok = await confirmDialog(`تسجيل "${ATTENDED_LABEL(attended)}" لـ ${live.length} حجز`, {
      sub: "النتيجة دي بتدخل في حساب البونص. اللي هيتسجل غلط تقدر ترجّعه من الجدول.",
      confirmLabel: "سجّل",
      danger: false,
    });
    if (!ok) return false;
  }
  let data;
  try {
    data = await api("/admin/bookings/attendance", {
      method: "POST",
      // A row whose result is already recorded is a correction, and the server holds those
      // behind `force` so a clinic report pasted in twice cannot flip leads back and forth.
      // The per-row dropdown is exactly where a correction is made, so it says so - the
      // bulk action deliberately does not, and skips what is already recorded.
      body: { bookingIds: live.map((b) => b.id), attended, ...(force ? { force: true } : {}) },
    });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    return false;
  }
  if (!quiet) {
    toast(
      `اتسجل ${data.updated ?? live.length} حجز: ${ATTENDED_LABEL(attended)}`,
      "good",
      undo ? { label: "رجّع", run: undo } : null,
    );
  }
  bulkClear("bookings");
  afterBookingsChanged();
  return true;
}

/**
 * Reassigning moves only who makes the reminder call. The lead itself stays with the rep
 * it was distributed to, because that is what the monthly share is measured against.
 */
function reassignSelect(booking) {
  const sel = document.createElement("select");
  const done = Boolean(booking.reminderCallAt) || booking.status === "cancelled" || booking.status === "examined" || booking.status === "no_show";

  // When the booking has no resolvable group (its doctor was never linked), every rep
  // is offered rather than none - matching the server's own unlinked-doctor fallback.
  const bookingGroup = repGroupOf(booking);
  const listed = allReps.filter((r) => bookingGroup == null || r.groupId === bookingGroup);
  // A booking whose reminder is owned by someone who is not a rep here - one imported
  // "for the doctor only", waiting to be handed out. With no option marked, the browser
  // showed the first rep as if the booking were theirs, which is the one thing it was not.
  if (booking.reminderOwnerId && listed.length && !listed.some((r) => r.id === booking.reminderOwnerId)) {
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "— مش متوزع —";
    none.disabled = true;
    none.selected = true;
    sel.appendChild(none);
  }
  listed
    .forEach((rep) => {
      const opt = document.createElement("option");
      opt.value = rep.id;
      opt.textContent = rep.name;
      if (rep.id === booking.reminderOwnerId) opt.selected = true;
      sel.appendChild(opt);
    });

  if (!sel.options.length) {
    const opt = document.createElement("option");
    opt.textContent = booking.reminderOwnerName || "—";
    sel.appendChild(opt);
  }

  // Once the call has been made there is nothing left to hand over, and the server
  // refuses it anyway - disabling here just says so before the round trip.
  //
  // It has to say *why*, though. A greyed box with no explanation reads as broken, not as
  // finished: "مش عارف اغير دي". The label stays on the disabled one too - it is still a
  // control, and dropping the label left a screen reader announcing nothing at all.
  sel.setAttribute("aria-label", `مسؤول تذكير ${booking.leadName}`);
  if (!canReassignBookings() || done) {
    sel.disabled = true;
    sel.title = done
      ? "مكالمة التذكير اتعملت خلاص - مفيش تذكير متبقي يتحوّل لحد تاني"
      : "مالكش صلاحية تحويل الحجوزات";
    return sel;
  }

  sel.addEventListener("change", async () => {
    const previous = booking.reminderOwnerId;
    sel.disabled = true;
    try {
      await api(`/admin/bookings/${booking.id}/reassign`, { method: "POST", body: { userId: Number(sel.value) } });
    } catch (e) {
      sel.value = String(previous ?? "");
      sel.disabled = false;
      return;
    }
    booking.reminderOwnerId = Number(sel.value);
    sel.disabled = false;
    toast(`اتحوّل تذكير ${booking.leadName} لـ ${sel.options[sel.selectedIndex].textContent}`, "good");
  });
  return sel;
}

/** A booking's group comes from its doctor; reps outside it can never receive its leads. */
function repGroupOf(booking) {
  const doctor = allDoctors.find((d) => d.id === booking.doctorId);
  return doctor ? doctor.groupId : null;
}

async function copyBookingSummary(booking, btn) {
  const { text } = await api(`/admin/bookings/${booking.id}/summary`);
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = "اتنسخ ✓";
    setTimeout(() => (btn.textContent = original), 1500);
  } catch {
    // Clipboard access can be refused (insecure origin, or the user declined). Showing
    // the text still lets them copy it by hand rather than the button doing nothing.
    await openDialog({ title: "انسخ البيانات", fields: [{ name: "text", label: "", type: "textarea", value: text, rows: 8 }], confirmLabel: "تمام", cancelLabel: "إغلاق" });
  }
}

/* ---------------------------------------------------------------- التذكيرات

   The four tabs the rep sees in the app - متابعة لاحقة، الحجوزات، محدش كلمها،
   مردّش امبارح - for any rep, on one screen, with multi-select and a bulk hand-over.

   It runs on GET /admin/followups, which runs the rep's own SQL with a list of reps
   instead of one, so a row that shows on a phone shows here under the same rule.

   Two dates rules this screen exists to respect:

   * `at` is a UTC stamp for scheduled and the two lead kinds, and Cairo wall time for
     bookings (`scheduled_for`, typed by a person). Converting a booking would move every
     appointment three hours. Each column says which of splitUtcInCairo/splitDateTime it
     uses, and neither is applied to the other kind.
   * The server ignores from/to for محدش كلمها and مردّش امبارح: they are states, not
     appointments. The date range is therefore *hidden* on those two tabs rather than left
     visible doing nothing - a visible filter that silently does nothing is exactly what
     once made a screen report "no work in this period" while four leads sat waiting.
   ------------------------------------------------------------------------ */

const FOLLOWUP_TABS = [
  // `idOf` is the id /admin/followups/transfer wants for that kind: the reminder, the
  // booking, or the lead itself.
  { kind: "scheduled", label: "متابعة لاحقة", dated: true, idOf: (it) => it.reminderId },
  { kind: "bookings", label: "الحجوزات", dated: true, idOf: (it) => it.bookingId },
  { kind: "untouched", label: "محدش كلمها", dated: false, idOf: (it) => it.leadId },
  // Back as its own tab (owner, 2026-09-29: "لما أدوس على 2 مردّش امبارح يظهرلي الاتنين"):
  // the leads taken on the last working day that were rung and still owe today's call -
  // the same rows the overview's backlog counts under that name.
  { kind: "second_day", label: "مردّش امبارح", dated: false, idOf: (it) => it.leadId },
  // Replaced "مردّش امبارح" (owner, 2026-09-15): the midnight pool return emptied that
  // list every night. The visits that happened, with the bookings tab's own filters.
  // Acts on the CASE: a sheet row has no booking, and what an admin hands over from this
  // tab is the after-visit chase (owner, 2026-09-26: "أحدد الليدز للموظفين").
  { kind: "examined", label: "تم الكشف", dated: true, idOf: (it) => (it.plan ? it.plan.caseId : null) },
];

const followupTab = (kind) => FOLLOWUP_TABS.find((t) => t.kind === kind) || FOLLOWUP_TABS[0];

/** The tab on screen, the four lists as last fetched, and the rep the bar is aimed at. */
let followupKind = "scheduled";
const followupItems = { scheduled: [], bookings: [], untouched: [], second_day: [], examined: [] };
let followupTargetRep = "";

/** A promised call whose minute has passed - the client is already waiting. */
function followupOverdue(item) {
  const at = utcStampToDate(item.at);
  return Boolean(at) && at.getTime() < Date.now();
}

/** A UTC stamp, read in Cairo. Used for remind_at and claimed_at, never for a booking. */
function paintCairoWhen(td, stamp, markOverdue, item) {
  const when = splitUtcInCairo(stamp);
  td.textContent = `${when.weekday} ${when.date} — ${when.time}`;
  if (!markOverdue || !followupOverdue(item)) return;
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.style.cssText = "background:var(--warning-soft); color:var(--warning); margin-inline-start:8px";
  badge.textContent = "فات ميعاده";
  td.appendChild(badge);
}

/** Cairo wall time already - a booking slot is printed exactly as the rep typed it. */
function paintWallWhen(td, stamp) {
  const when = splitDateTime(stamp);
  td.textContent = `${when.weekday} ${when.date} — ${when.time}`;
}

/** Whether the confirmation call is already logged - i.e. whether a transfer would skip. */
/**
 * The reminder cell, the same story the app's card tells (owner, 2026-09-15): when the
 * call is due - a day before the visit, at its time - whether it is late, what it ended
 * in, and whether the message went out. مردّش is not a call made.
 */
function reminderCellHtml(b) {
  const due = b.reminderDueAt ? splitDateTime(b.reminderDueAt) : null;
  const dueText = due ? `${due.date} ${due.time}` : "";
  const message = b.reminderMessageAt ? ' <span title="رسالة التذكير اتبعتت">📨</span>' : "";
  if (b.status === "cancelled") return "ملغي" + message;
  if (b.reminderCallAt && b.reminderOutcome !== "reminder_no_answer") {
    return esc(REMINDER_LABELS[b.reminderOutcome] || b.reminderOutcome || "اتعملت") + message;
  }
  // مردّش is tried twice (owner, 2026-09-21): the cell says which try this was.
  const head = b.reminderCallAt ? (b.noAnswerCount >= 2 ? "مردّش مرتين" : "مردّش - فاضل محاولة تانية") : "لسه";
  if (b.status !== "scheduled") return esc(head) + message;
  const clock = b.reminderLate
    ? `<div style="font-size:11px; color:var(--critical)">⚠ اتأخر - كان ${esc(dueText)}</div>`
    : due
      ? `<div style="font-size:11px; color:var(--text-muted)">التذكير: ${esc(dueText)}</div>`
      : "";
  return `<span style="color:${b.reminderLate ? "var(--critical)" : "var(--warning)"}; font-weight:600">${esc(head)}</span>${message}${clock}`;
}

function paintReminderCall(td, item) {
  td.innerHTML = reminderCellHtml({
    status: "scheduled",
    reminderCallAt: item.reminderCallAt,
    reminderOutcome: item.reminderOutcome,
    reminderMessageAt: item.reminderMessageAt,
    reminderDueAt: item.reminderDueAt,
    reminderLate: item.reminderLate,
  });
  if (item.reminderCallAt && item.reminderOutcome !== "reminder_no_answer") {
    td.innerHTML += `<div style="font-size:11px; color:var(--text-muted)">اتعملت ${esc(splitUtcInCairo(item.reminderCallAt).time)}</div>`;
  }
}

const FOLLOWUP_LEAD_COLUMNS = [
  {
    key: "lead",
    label: "العميل",
    cell: (td, it) => {
      td.innerHTML = esc(it.leadName) + (it.leadId ? leadEditHtml(it.leadId) : it.plan && it.plan.caseId ? caseEditHtml(it.plan.caseId) : "");
    },
  },
  { key: "phone", label: "التليفون", text: (it) => (it.altPhone ? `${it.leadPhone} / ${it.altPhone}` : it.leadPhone) },
  { key: "doctor", label: "الدكتور", text: (it) => it.doctorName || "—" },
  { key: "service", label: "الخدمة", text: (it) => it.serviceName || "—" },
  { key: "notes", label: "ملاحظات", text: (it) => it.notes || "—" },
];
const FOLLOWUP_STATUS_COLUMN = {
  key: "status",
  label: "حالة الليد",
  text: (it) => STATUS_LABELS[it.status] || it.status || "—",
};
const FOLLOWUP_NEXT_COLUMN = {
  key: "next",
  label: "المطلوب دلوقتي",
  text: (it) => (it.nextAction ? it.nextAction.label : "—"),
};
const FOLLOWUP_OWNER_COLUMN = { key: "owner", label: "الموظف المسؤول", text: (it) => it.repName || "—" };

/** Each tab gets the columns that mean something for it - not one lowest common set. */
const FOLLOWUP_COLUMNS = {
  scheduled: [
    ...FOLLOWUP_LEAD_COLUMNS,
    { key: "when", label: "ميعاد المتابعة", cell: (td, it) => paintCairoWhen(td, it.at, true, it) },
    // The system's own next-day calls (مجاش / حاجز ومأكّدش) beside the reps' promises.
    { key: "why", label: "السبب", text: (it) => it.reminderReasonLabel || "وعد الموظف" },
    // The name the last booking was under, for the call that says whose visit was missed.
    { key: "case", label: "الحجز باسم", text: (it) => it.caseName || "—" },
    FOLLOWUP_STATUS_COLUMN,
    FOLLOWUP_OWNER_COLUMN,
  ],
  bookings: [
    ...FOLLOWUP_LEAD_COLUMNS,
    { key: "when", label: "ميعاد الحجز", cell: (td, it) => paintWallWhen(td, it.at) },
    { key: "call", label: "مكالمة التذكير", cell: (td, it) => paintReminderCall(td, it) },
    FOLLOWUP_OWNER_COLUMN,
  ],
  untouched: [
    ...FOLLOWUP_LEAD_COLUMNS,
    { key: "when", label: "استلمه من", cell: (td, it) => paintCairoWhen(td, it.at, false, it) },
    FOLLOWUP_STATUS_COLUMN,
    FOLLOWUP_NEXT_COLUMN,
    FOLLOWUP_OWNER_COLUMN,
  ],
  second_day: [
    ...FOLLOWUP_LEAD_COLUMNS,
    { key: "when", label: "استلمه من", cell: (td, it) => paintCairoWhen(td, it.at, false, it) },
    FOLLOWUP_STATUS_COLUMN,
    FOLLOWUP_NEXT_COLUMN,
    FOLLOWUP_OWNER_COLUMN,
  ],
  examined: [
    ...FOLLOWUP_LEAD_COLUMNS,
    { key: "case", label: "اسم الحالة", text: (it) => (it.caseName || "—") + (it.fromSheet ? " · من الحسابات" : "") },
    // A sheet row has no hour, only a day: it must not read as a 12:00 appointment.
    { key: "when", label: "ميعاد الكشف", cell: (td, it) => { if (it.fromSheet) td.textContent = String(it.at).slice(0, 10); else paintWallWhen(td, it.at); } },
    { key: "plan", label: "الخطة العلاجية", cell: (td, it) => paintPlan(td, it.plan) },
    { key: "call", label: "مكالمة التذكير", cell: (td, it) => { if (it.fromSheet) td.textContent = "—"; else paintReminderCall(td, it); } },
    FOLLOWUP_OWNER_COLUMN,
  ],
};

/**
 * The accounts' word on the plan, on the examined row: started (when, and who said so from
 * the phone), closed (why), or still being chased. The same fact the accounts and "كشف
 * ولسه مبدأش" show, put where the owner looked for it (2026-09-24).
 */
function paintPlan(td, plan) {
  td.innerHTML = "";
  if (!plan) {
    td.textContent = "—";
    td.title = "الزيارة دي لسه مالهاش حالة في الحسابات - بتتعمل أول ما الحسابات تتفتح";
    return;
  }
  const line = document.createElement("div");
  const sub = document.createElement("div");
  sub.style.cssText = "font-size:11px; color:var(--text-muted)";
  if (plan.started) {
    line.textContent = `بدأت ✓${plan.startedOn ? " " + plan.startedOn : ""}`;
    line.style.color = "var(--good)";
    line.style.fontWeight = "600";
    sub.textContent = planReportedLine(plan.reportedByName, plan.reportedByRole) || "اتسجلت من الحسابات";
  } else if (plan.closedReason) {
    line.textContent = "مش هتبدأ";
    line.style.color = "var(--text-secondary)";
    sub.textContent = plan.closedReasonLabel || plan.closedReason;
  } else {
    line.textContent = "لسه";
    line.style.color = "var(--warning)";
    sub.textContent = plan.nextOn ? `المتابعة الجاية ${plan.nextOn}` : "بتتابع من الموبايل";
  }
  td.append(line, sub);
}

/** What each tab's transfer actually moves, said before the admin confirms it. */
const FOLLOWUP_TRANSFER_NOTE = {
  scheduled: (to) =>
    `المتابعة والليد نفسه هيتنقلوا لـ ${to}. الليد لازم يمشي مع المتابعة، ` +
    `لأن اللي مش ماسك الليد مش هيقدر يسجّل نتيجة المكالمة. ` +
    `وأي متابعات تانية على نفس العميل هتتنقل كمان.`,
  bookings: (to) =>
    `مكالمة التذكير بس هي اللي هتتنقل لـ ${to}. الليد هيفضل مع صاحبه زي ما هو — ` +
    `التوزيع الشهري بيتقاس عليه، فمانقلوش عشان غياب يوم. ` +
    `أي حجز اتعملت مكالمة التذكير بتاعته خلاص هيتساب.`,
  examined: (to) =>
    `متابعة ما بعد الكشف للحالات دي هتروح لـ ${to}: هتظهر على موبايلها في «تم الكشف ← لسه مبدأش» وفي إشعار الصبح. ` +
    `الليد والحجز مش بيتحركوا، والحالة فضلت محسوبة لصاحبتها في الحسابات.`,
  untouched: (to) =>
    `الليد نفسه هيتنقل لـ ${to}. ` +
    `مهم: بعد التحويل الليدز دي هتختفي من "محدش كلمها" و"مردّش امبارح" لمدة يوم، ` +
    `لأن ساعة المتابعة بتبدأ من الأول عند السيلز الجديد. ده مش ضياع بيانات.`,
  second_day: (to) => FOLLOWUP_TRANSFER_NOTE.untouched(to),
};

const FOLLOWUP_EMPTY = {
  scheduled: ["مفيش متابعات في المدة دي", "محدش من السيلز واعد عميل بمكالمة في التواريخ المختارة. غيّر المدة أو السيلز عشان تشوف أيام تانية."],
  bookings: ["مفيش حجوزات في المدة دي", "مفيش مواعيد محجوزة في التواريخ المختارة. غيّر المدة أو السيلز."],
  untouched: ["مفيش ليدز متسايبة", "كل اللي السيلز استلمه قبل النهاردة اتكلم معاه. مفيش حاجة مستنية هنا."],
  second_day: ["مفيش حد مردّش امبارح", "كل اللي اتاخد امبارح رد أو اتقفل. مفيش حاجة مستنية هنا."],
  examined: ["مفيش حجوزات اتكشفت في المدة دي", "لما العيادة تعلّم على حجز إنه اتكشف هيظهر هنا. غيّر المدة أو السيلز."],
};

/**
 * The dated tabs' range, defaulting to today and tomorrow.
 *
 * That pair is what an admin opens this for: the calls owed now, plus the ones promised
 * for tomorrow that will need covering if somebody goes out.
 */
let followupRangeFilled = false;
function followupRange() {
  const fromEl = document.getElementById("reminders-from");
  const toEl = document.getElementById("reminders-to");
  if (!fromEl || !toEl) return { from: "", to: "" };
  // Today and tomorrow the first time the page opens - that is the day's work. Only the
  // first time: an admin who empties the boxes means "every day", and refilling them
  // behind his back made the range look stuck on today (owner, 2026-09-26).
  if (!followupRangeFilled) {
    followupRangeFilled = true;
    if (!fromEl.value && !toEl.value) {
      fromEl.value = cairoToday();
      toEl.value = addDaysISO(fromEl.value, 1);
    }
  }
  return { from: fromEl.value, to: toEl.value };
}

/**
 * The rep filter, rebuilt from the roster with the previous choice restored - the same
 * reason loadDoctors() and fillRepFilter() rebuild instead of appending, which is what
 * once doubled every name in the doctor dropdown.
 */
function fillFollowupRepFilter() {
  const select = document.getElementById("reminders-rep");
  if (!select) return;
  const previous = select.value;
  select.innerHTML = '<option value="">كل السيلز</option>';
  for (const rep of allReps) {
    const opt = document.createElement("option");
    opt.value = rep.id;
    opt.textContent = rep.name;
    select.appendChild(opt);
  }
  if (allReps.some((r) => String(r.id) === previous)) select.value = previous;
}

/** The four tab buttons, each carrying its own count. The current one is the primary. */
function renderFollowupTabs() {
  const host = document.getElementById("reminders-tabs");
  if (!host) return;
  host.innerHTML = "";
  for (const tab of FOLLOWUP_TABS) {
    const btn = document.createElement("button");
    const count = (followupItems[tab.kind] || []).length;
    btn.textContent = `${tab.label} (${count})`;
    btn.setAttribute("aria-pressed", String(tab.kind === followupKind));
    if (tab.kind === followupKind) btn.className = "primary";
    btn.addEventListener("click", () => selectFollowupKind(tab.kind));
    host.appendChild(btn);
  }
}

/** The date range belongs only to the two dated tabs. */
function syncFollowupControls() {
  const range = document.getElementById("reminders-range");
  if (range) range.classList.toggle("hidden", !followupTab(followupKind).dated);
}

/**
 * Switches tab. The selection is dropped rather than carried across: the four kinds are
 * numbered independently, so a reminder id 7 left selected would arrive at the transfer
 * as lead id 7 - a different row entirely.
 */
function selectFollowupKind(kind) {
  if (kind === followupKind) return;
  followupKind = kind;
  followupFocus = null;
  bulkClear("followups");
  syncFollowupControls();
  renderFollowupTabs();
  renderFollowupBoard();
}

/**
 * A focus on the follow-ups board: only the rows one number on the overview counted
 * (owner, 2026-09-29: "بدوس عليها بيفتح الجدول" - the tab, not the rows). Each is the
 * same rule the backlog uses, read off the row the server sends.
 */
const FOLLOWUP_FOCUS = {
  overdue: { label: "متابعات فات وقتها", test: (it) => followupOverdue(it) },
  reminder: {
    label: "مكالمات تذكير مستنية",
    test: (it) => !it.visitPassed && (!it.reminderCallAt || it.reminderOutcome === "reminder_no_answer") && !!it.reminderDueAt && it.reminderDueAt <= cairoWallStamp(new Date()).slice(0, 16),
  },
  message: {
    label: "رسايل تأكيد للي أكّدوا النهاردة",
    test: (it) => it.reminderOutcome === "reminder_confirmed" && !it.reminderMessageAt && String(it.at || "").slice(0, 10) === cairoToday(),
  },
  attendance: { label: "زيارات عدّى ميعادها ومحتاجة تسجيل", test: (it) => !!it.resultOverdue },
};
let followupFocus = null;
let pendingFollowupFocus = null;

/** Set by a card on the overview: the rep the follow-ups page should open on. */
let pendingFollowupRep = null;
/** Set with it when the number counts every day, not today's: the date boxes are emptied. */
let pendingFollowupAllDays = false;

/** Opens المتابعات on one tab for one rep - what a number on the overview points at. */
function openFollowupBoard(kind, repId, { allDays = false, focus = null } = {}) {
  if (FOLLOWUP_TABS.some((t) => t.kind === kind)) followupKind = kind;
  pendingFollowupRep = repId != null ? String(repId) : "";
  pendingFollowupAllDays = allDays;
  pendingFollowupFocus = focus && FOLLOWUP_FOCUS[focus] ? focus : null;
  bulkClear("followups");
  // Already on the page: goto is a no-op there, so the load that reads the pending rep and
  // range is asked for outright.
  const already = currentView === "reminders";
  goto("reminders");
  if (already) loadFollowupBoard();
}

/** Opens الحجوزات on "بس اللي محتاج تسجيل نتيجة", narrowed to one rep. */
function openBookingsNeedingResult(repId) {
  const rep = document.getElementById("rep-filter");
  if (rep) rep.value = repId != null ? String(repId) : "";
  const box = document.getElementById("bookings-needs-attendance");
  if (box) box.checked = true;
  readScope();
  keepScopeOnNextRoute = true;
  goto("bookings");
}

/** Drops the decorations that belong to a table that is not being shown. */
function clearFollowupDecorations() {
  const container = document.getElementById("reminders-wrap").parentElement;
  container.querySelector('.bulk-bar[data-key="followups"]')?.remove();
  container.querySelector(".pager")?.remove();
}

/** One line in place of the rows: the loading line, or a failure with a way back. */
function showFollowupMessage(message, onRetry) {
  const tbody = document.getElementById("reminders-tbody");
  if (!tbody) return;
  document.getElementById("reminders-empty").classList.add("hidden");
  document.getElementById("reminders-wrap").classList.remove("hidden");
  renderFollowupHead();
  clearFollowupDecorations();
  tbody.innerHTML = "";
  const td = document.createElement("td");
  td.className = "empty-row";
  td.colSpan = FOLLOWUP_COLUMNS[followupKind].length + 1;
  td.textContent = message;
  if (onRetry) {
    const retry = document.createElement("button");
    retry.className = "link-btn";
    retry.textContent = "حاول تاني";
    retry.addEventListener("click", onRetry);
    td.append(document.createElement("br"), retry);
  }
  const tr = document.createElement("tr");
  tr.appendChild(td);
  tbody.appendChild(tr);
}

/**
 * Loads all four tabs at once.
 *
 * Four small requests rather than one, so each tab header can show the count of the list
 * it will actually draw. Deriving the headers from /admin/followups/counts instead would
 * be one request and a lie: that endpoint counts one day, this screen shows a range.
 */
async function loadFollowupBoard() {
  // A focus lives for the load that was asked for it; the next load (a filter the admin
  // changed, a refresh) shows the whole tab again.
  followupFocus = pendingFollowupFocus;
  pendingFollowupFocus = null;
  fillFollowupRepFilter();
  if (pendingFollowupRep != null) {
    const select = document.getElementById("reminders-rep");
    if (select) select.value = pendingFollowupRep;
    pendingFollowupRep = null;
  }
  if (pendingFollowupAllDays) {
    // An overdue follow-up is from an earlier day: today's range would hide the very rows
    // the number counted.
    pendingFollowupAllDays = false;
    followupRangeFilled = true;
    const fromEl = document.getElementById("reminders-from");
    const toEl = document.getElementById("reminders-to");
    if (fromEl) fromEl.value = "";
    if (toEl) toEl.value = "";
  }
  renderFollowupTabs();
  syncFollowupControls();
  const { from, to } = followupRange();
  const repSelect = document.getElementById("reminders-rep");
  const repId = repSelect ? repSelect.value : "";

  // The same ticket every other loader takes: an answer that lands after the admin has
  // already moved the date or the rep must not paint itself over the newer one.
  const isStale = beginLoad("followups-board");
  document.getElementById("reminders-note").textContent = "";
  showFollowupMessage("جاري التحميل...");

  let answers;
  try {
    // Reported inline instead of as a toast: the table is the thing that failed, so the
    // message and the retry belong where the rows would have been.
    answers = await Promise.all(
      FOLLOWUP_TABS.map((tab) => {
        const params = new URLSearchParams();
        params.set("kind", tab.kind);
        params.set("limit", "500");
        // from/to are sent only for the kinds that use them: the server ignores them on
        // the other two, and sending them would suggest they did something.
        if (tab.dated && from) params.set("from", from);
        if (tab.dated && to) params.set("to", to);
        if (repId) params.set("repId", repId);
        return api(`/admin/followups?${params}`, { silent: true });
      }),
    );
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (isStale()) return;
    e.reported = true;
    showFollowupMessage(
      e.status === 404 ? "شاشة التذكيرات مش متاحة من السيرفر الحالي." : e.message,
      () => loadFollowupBoard(),
    );
    return;
  }
  if (isStale()) return;

  FOLLOWUP_TABS.forEach((tab, i) => {
    followupItems[tab.kind] = answers[i].items || [];
  });
  renderFollowupTabs();
  renderFollowupBoard();
}

/** The head row for the tab on screen. bulkAttach adds its own checkbox column to it. */
function renderFollowupHead() {
  const head = document.getElementById("reminders-head");
  if (!head) return;
  head.innerHTML = FOLLOWUP_COLUMNS[followupKind]
    .map((col) => `<th class="h-${esc(col.key)}">${esc(col.label)}</th>`)
    .join("");
}

function drawFollowupRow(item) {
  const columns = FOLLOWUP_COLUMNS[followupKind];
  const tr = document.createElement("tr");
  if (followupKind === "scheduled" && followupOverdue(item)) {
    // Same warning treatment the pool table gives a doctor nobody is linked to.
    tr.className = "warn-row";
  }
  tr.innerHTML = columns
    .map((col) => `<td class="c-${esc(col.key)}">${col.text ? esc(col.text(item)) : ""}</td>`)
    .join("");
  // Cells with their own painter are found by class, never by index: adding a column
  // above one of them would otherwise silently move what gets written where.
  for (const col of columns) {
    if (!col.cell) continue;
    const td = rowCell(tr, `c-${col.key}`);
    if (td) col.cell(td, item);
  }
  return tr;
}

/** What this tab is, in a sentence, including the part the admin cannot see. */
function followupNote(tab, items) {
  const n = items.length;
  if (tab.kind === "scheduled") {
    const late = items.filter(followupOverdue).length;
    return (
      `${n} متابعة في المدة المختارة${late ? ` — ${late} فات ميعادها والعميل مستني` : ""}. ` +
      "تحويل المتابعة بينقل الليد نفسه معاها."
    );
  }
  if (tab.kind === "bookings") {
    const done = items.filter((it) => it.reminderCallAt).length;
    return (
      `${n} حجز في المدة المختارة${done ? ` — ${done} اتعملت مكالمة التذكير بتاعته خلاص` : ""}. ` +
      "التحويل هنا بينقل مكالمة التذكير بس، الليد بيفضل مع صاحبه."
    );
  }
  if (tab.kind === "untouched") {
    return (
      `${n} ليد استلمهم السيلز قبل النهاردة ولسه محدش كلّمهم. ` +
      "دي حالة مش ميعاد — عشان كده مفيش فلتر تاريخ هنا. التحويل بينقل الليد نفسه."
    );
  }
  if (tab.kind === "examined") {
    // A record, not a to-do: the visits the clinic or the rep marked تم الكشف. Without
    // this branch the tab borrowed the "مردّش امبارح" sentence and read as nonsense
    // (owner, 2026-09-24: "الرقم دا مش منطقي ... مش حاسس انها بتعمل وظيفتها").
    const sheet = (followupItems.examined || []).filter((it) => it.fromSheet).length;
    return (
      `${n} كشف في المدة المختارة${sheet ? ` (${sheet} منهم من شيت العيادات القديم، من غير ليد في السيستم)` : ""}. ` +
      "ده سجل مش شغل مستني: اللي كشف ولسه مبدأش بتتابعه من صفحة الشغل (كشف ولسه مبدأش)، واللي عدّى ميعاده ومتسجلش من عمود عدّى ميعادها."
    );
  }
  return (
    `${n} ليد اتاخدوا امبارح والعميل مردّش. ` +
    "دي حالة مش ميعاد — عشان كده مفيش فلتر تاريخ هنا. التحويل بينقل الليد نفسه."
  );
}

function renderFollowupBoard() {
  const tab = followupTab(followupKind);
  const focus = followupFocus ? FOLLOWUP_FOCUS[followupFocus] : null;
  const whole = followupItems[followupKind] || [];
  const all = focus ? whole.filter(focus.test) : whole;
  // The search runs over every row the screen holds, not the page on screen: a name on
  // page three was invisible and the pager looked broken (owner, 2026-09-26).
  const { raw, q, digits } = readQuery("reminders-q");
  const items = raw
    ? all.filter((it) =>
        rowMatchesQuery(
          [it.leadName, it.caseName, it.leadPhone, it.altPhone, it.doctorName, it.serviceName, it.repName, it.notes].filter(Boolean).join(" "),
          q,
          digits,
        ),
      )
    : all;
  const tbody = document.getElementById("reminders-tbody");
  const wrap = document.getElementById("reminders-wrap");
  const empty = document.getElementById("reminders-empty");
  const note = document.getElementById("reminders-note");
  if (!tbody) return;

  renderFollowupHead();
  note.textContent = raw
    ? `${items.length} من ${all.length} في القايمة فيهم «${raw}».`
    : followupNote(tab, items);
  if (focus && !raw) {
    // Say what is being shown, and give the whole tab back on one press.
    note.textContent = `بيعرض ${all.length} ${focus.label} بس، من ${whole.length} في التاب ده. `;
    const showAll = document.createElement("button");
    showAll.className = "link-btn";
    showAll.textContent = "اعرض الكل";
    showAll.addEventListener("click", () => {
      followupFocus = null;
      renderFollowupBoard();
    });
    note.appendChild(showAll);
  }

  // Nothing waiting on this tab is an answer worth saying, not a blank grid.
  if (!items.length) {
    tbody.innerHTML = "";
    clearFollowupDecorations();
    wrap.classList.add("hidden");
    empty.classList.remove("hidden");
    empty.innerHTML = "";
    const head = document.createElement("strong");
    head.textContent = raw ? `مفيش حاجة في القايمة دي فيها «${raw}»` : FOLLOWUP_EMPTY[tab.kind][0];
    const sub = document.createElement("div");
    sub.textContent = raw ? `القايمة فيها ${all.length} صف — امسح البحث عشان تشوفهم.` : FOLLOWUP_EMPTY[tab.kind][1];
    empty.append(head, sub);
    return;
  }

  empty.classList.add("hidden");
  wrap.classList.remove("hidden");

  renderPaged(
    `followups-${tab.kind}`,
    items,
    tbody,
    (item) => tbody.appendChild(drawFollowupRow(item)),
    (visible) =>
      bulkAttach("followups", "reminders-tbody", visible, followupBulkActions(), {
        idOf: tab.idOf,
        allRows: items,
        countLabel: (count) => `المحدد: ${count}`,
      }),
  );
}

/**
 * The bar's one action: pick a rep, press حوّل.
 *
 * A picker rather than a button that opens a picker, because the owner asked to see who
 * he is handing to while he is still choosing rows - and one row selected goes through
 * exactly the same control as forty.
 */
function followupBulkActions() {
  if (!canEditOperations()) return [];
  return [{ render: (ids) => followupTransferControls(ids) }];
}

function followupTransferControls(ids) {
  const frag = document.createDocumentFragment();

  const sel = document.createElement("select");
  sel.setAttribute("aria-label", "السيلز اللي هيستلم");
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "اختار سيلز";
  sel.appendChild(placeholder);
  for (const rep of allReps) {
    const opt = document.createElement("option");
    opt.value = String(rep.id);
    opt.textContent = `${rep.name} — ${groupLabel(rep.groupId)}`;
    sel.appendChild(opt);
  }
  // The bar is rebuilt on every tick of a checkbox, so the choice is kept outside it.
  if (allReps.some((r) => String(r.id) === followupTargetRep)) sel.value = followupTargetRep;
  else followupTargetRep = "";

  const btn = document.createElement("button");
  btn.className = "primary";
  btn.textContent = "حوّل";
  btn.disabled = !followupTargetRep;

  sel.addEventListener("change", () => {
    followupTargetRep = sel.value;
    btn.disabled = !sel.value;
  });
  btn.addEventListener("click", async () => {
    const rep = allReps.find((r) => String(r.id) === followupTargetRep);
    if (!rep) return;
    btn.disabled = true;
    try {
      await transferFollowups(followupKind, ids, rep);
    } finally {
      btn.disabled = false;
    }
  });

  frag.append(sel, btn);
  return frag;
}

/** Hands the selected rows of one kind to one rep, after saying what that means. */
async function transferFollowups(kind, ids, rep) {
  const tab = followupTab(kind);
  const ok = await confirmDialog(`تحويل ${ids.length} من "${tab.label}" لـ ${rep.name}`, {
    sub: FOLLOWUP_TRANSFER_NOTE[kind](rep.name),
    confirmLabel: "حوّل",
    danger: false,
  });
  if (!ok) return;

  let data;
  try {
    if (kind === "examined") {
      // The after-visit chase lives on the accounts' case, so it moves through the plan
      // follow-up's own hand-over - the same one "كشف ولسه مبدأش" uses.
      const r = await api("/admin/plan-followups/transfer", { method: "POST", body: { caseIds: ids, toUserId: rep.id } });
      data = { movedCount: r.moved || 0, skipped: Array.from({ length: r.skipped || 0 }, () => ({ message: "كانت معاها أصلاً، أو مش «لسه مبدأش»" })), to: { name: r.toName || rep.name } };
    } else {
      data = await api("/admin/followups/transfer", { method: "POST", body: { kind, ids, userId: rep.id } });
    }
  } catch (e) {
    // api() has already shown the server's own Arabic refusal - too many ids, an inactive
    // target, or a team lead reaching outside their group. Nothing moved.
    if (!(e instanceof ApiError)) throw e;
    return;
  }

  reportFollowupTransfer(kind, data, rep.name);
  bulkClear("followups");
  if (kind === "bookings") {
    // Only the reminder call changed hands; no lead moved, so no lead count is stale.
    invalidate("bookings", "overview");
  } else if (kind === "examined") {
    // The chase moved; the plan page counts it per rep.
    invalidate("workload", "overview");
  } else {
    // A lead changed hands, so every view that counts leads per rep is now out of date.
    invalidate("leads", "reps", "worksheet", "overdue", "workload", "bookings", "overview");
  }
  loadFollowupBoard();
}

/**
 * Says what actually happened.
 *
 * A partial result gets two toasts, not one: the good one names what moved, and the
 * failure one lists what did not with the server's own reason and stays on screen until
 * it is dismissed. A single cheerful "تم" over a half-done batch is how an admin ends up
 * believing a rep is covered when three of his rows never left.
 */
function reportFollowupTransfer(kind, data, fallbackName) {
  const to = (data.to && data.to.name) || fallbackName;
  const moved = data.movedCount || 0;
  const skipped = data.skipped || [];

  if (moved) {
    let line = `اتحوّل ${moved} لـ ${to}`;
    if (kind === "scheduled" && data.movedReminderCount > moved) {
      line += ` — و${data.movedReminderCount} متابعة إجمالاً، لأن فيه عملاء عليهم أكتر من وعد`;
    }
    if (kind === "untouched" || kind === "second_day") {
      line += " — الليدز دي هتغيب عن التبويبتين ليوم لحد ما ساعة المتابعة تبدأ من جديد";
    }
    toast(line, "good");
  }

  if (skipped.length) {
    const byMessage = new Map();
    for (const item of skipped) byMessage.set(item.message, (byMessage.get(item.message) || 0) + 1);
    const detail = [...byMessage].map(([message, count]) => `• ${message} (${count})`).join("\n");
    toast(`${skipped.length} ماتحوّلوش:\n${detail}`, "bad");
  } else if (!moved) {
    toast("مفيش حاجة اتحوّلت", "bad");
  }
}

const WORKSHEET_STATUS_TONE = {
  "حجز موعد": ["var(--good-soft)", "var(--good)"],
  "تم الكشف": ["var(--good-soft)", "var(--good)"],
  "مهتم — محتاج متابعة": ["var(--brand-soft)", "var(--brand-ink)"],
  "يحتاج مكالمة أخرى": ["var(--warning-soft)", "var(--warning)"],
  "محتاج اتصال": ["var(--warning-soft)", "var(--warning)"],
  "مردّش — واتساب": ["var(--warning-soft)", "var(--warning)"],
  "لا يرد": ["var(--critical-soft)", "var(--critical)"],
  "لا يحتاج": ["var(--surface-3)", "var(--text-secondary)"],
};

/** The worksheet rows last fetched, kept so the search box can re-filter without another request. */
let currentWorksheetRows = [];

function worksheetQuery() {
  const el = document.getElementById("worksheet-search");
  return el ? el.value.trim().toLowerCase() : "";
}

/**
 * Whether a worksheet row matches the search box. Every text column takes part - the
 * name, the phones, the source, the service, the notes, the status, who called - so
 * "تقويم" finds the service and "مردش" finds the note as readily as a name does. Digits
 * in the query are matched against the phone columns, so a number pasted with spaces or
 * a leading +20 still finds its row.
 */
function worksheetMatches(r, q) {
  if (!q) return true;
  const needles = phoneNeedles(q);
  if (needles.length && [r.phone, r.whatsappPhone].some((p) => phoneHas(p, needles))) return true;
  const haystack = [
    r.name, r.caseName, r.source, r.service, r.notes, r.bookingNotes, r.status, r.interest, r.calledBy,
    r.appointmentDate, r.lastContact, ...(r.attempts || []),
  ]
    .map((v) => String(v || "").toLowerCase())
    .join(" | ");
  return haystack.includes(q);
}

/**
 * The worksheet view. Every value is computed server-side, so this only lays it out -
 * there is no input on the page except the search box, which filters the list already
 * here rather than asking the server again.
 */
async function loadWorksheet() {
  const isStale = beginLoad("worksheet");
  const { rows } = await api(`/admin/worksheet${scopeFor("worksheet")}`);
  if (isStale()) return;
  currentWorksheetRows = rows;
  renderWorksheet(rows);
}

/**
 * Lays out the rows that match the search box, paged. The search runs over the whole
 * list, not the page on screen: the list is fetched in full, so "all pages" is simply
 * the array, and a manager looking for one client should not have to page to find them.
 */
function renderWorksheet(allRows) {
  const q = worksheetQuery();
  const rows = q ? allRows.filter((r) => worksheetMatches(r, q)) : allRows;

  const booked = rows.filter((r) => r.booked === "نعم").length;
  const uncalled = rows.filter((r) => r.called === "لا").length;
  document.getElementById("worksheet-note").textContent = q
    ? `${rows.length} من ${allRows.length} عميل بيطابقوا البحث — ${booked} حجزوا، ${uncalled} لسه محدش اتصل بيهم.`
    : `${rows.length} عميل — ${booked} حجزوا، ${uncalled} لسه محدش اتصل بيهم.`;

  const tbody = document.getElementById("worksheet-tbody");
  if (q && !rows.length) {
    tbody.innerHTML = '<tr><td colspan="24" class="empty-row">مفيش عميل بيطابق البحث ده في النطاق المختار</td></tr>';
    document.querySelector('.bulk-bar[data-key="worksheet"]')?.remove();
    tbody.closest(".table-wrap")?.parentElement?.querySelector(".pager")?.remove();
    return;
  }
  renderPaged("worksheet", rows, tbody, (r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(r.name)}${leadEditHtml(r.leadId)}</td>
      <td>${esc(r.whatsappPhone)}</td>
      <td>${esc(r.phone)}</td>
      <td>${esc(r.source || "—")}</td>
      <td>${esc(r.service || "—")}</td>
      <td>${esc(r.called)}</td>
      <td>${esc(r.answered || "—")}</td>
      <td>${esc(r.attempts[0] || "")}</td>
      <td>${esc(r.attempts[1] || "")}</td>
      <td>${esc(r.attempts[2] || "")}</td>
      <td>${esc(r.attempts[3] || "")}</td>
      <td>${esc(r.whatsappContacted || "")}</td>
      <td>${esc(r.lastContact || "—")}</td>
      <td>${esc(r.lastCallDirection || "—")}</td>
      <td>${esc(r.lastCallDuration || "—")}</td>
      <td>${esc(r.interest || "—")}</td>
      <td>${esc(r.booked || "—")}</td>
      <td>${esc(r.appointmentDate || "—")}</td>
      <td>${esc(r.appointmentTime || "—")}</td>
      <td>${esc(r.caseName || "—")}</td>
      <td>${esc(r.bookingNotes || "—")}</td>
      <td style="white-space:normal; min-width:160px">${esc(r.notes || "—")}</td>
      <td class="ws-status"></td>
      <td>${esc(r.calledBy || "—")}</td>
    `;

    // The status is the column a manager scans for, so it carries the only colour in
    // the row rather than being one more identical cell. Selected by class, not by
    // index: the index used to be wrong by two columns and nothing said so.
    const cell = rowCell(tr, "ws-status");
    const tone = WORKSHEET_STATUS_TONE[r.status];
    if (cell && tone && r.status) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.style.background = tone[0];
      badge.style.color = tone[1];
      badge.textContent = r.status;
      cell.appendChild(badge);
    } else if (cell) {
      cell.textContent = r.status || "—";
    }

    tbody.appendChild(tr);
  },
  (visible) =>
    bulkAttach("worksheet", "worksheet-tbody", visible, [
      {
        label: "نسخ أرقام التليفونات",
        run: async (ids) => {
          const picked = rows.filter((r) => ids.includes(r.leadId));
          await copyText(picked.map((r) => r.phone).join("\n"));
          toast(`اتنسخ ${picked.length} رقم`, "good");
        },
      },
      // The same move and delete the leads table offers - these are the same leads.
      ...leadBulkActions(),
    ], { idOf: (r) => r.leadId, allRows: rows }));
}

/** Copies text, falling back to a dialog when the clipboard is unavailable. */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    await openDialog({
      title: "انسخ البيانات",
      fields: [{ name: "text", label: "", type: "textarea", value: text, rows: 8 }],
      confirmLabel: "تمام",
      cancelLabel: "إغلاق",
    });
  }
}

function exportWorksheet() {
  return downloadExport(
    `/admin/worksheet/export${scopeFor("worksheet")}`,
    "متابعة-العملاء.xlsx",
    document.getElementById("worksheet-export-btn"),
    "جاري التحضير...",
  );
}

async function loadOverdue() {
  const isStale = beginLoad("overdue");
  // Unscoped view: the filter bar is hidden here, so the scope is not applied.
  const { leads, windowDays } = await api(`/admin/overdue-leads${scopeFor("overdue")}`);
  if (isStale()) return;

  document.getElementById("overdue-note").textContent = leads.length
    ? `${leads.length} عميل عدّى عليهم ${windowDays} يوم من غير ما يتقفلوا.`
    : `مفيش عملاء متأخرين — كله بيتقفل في خلال ${windowDays} يوم.`;

  const tbody = document.getElementById("overdue-tbody");
  tbody.innerHTML = "";
  leads.forEach((lead) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(lead.name)}${leadEditHtml(lead.id)}${subLine(lead.notes ? "📝 " + lead.notes : "")}</td>
      <td>${esc(lead.phone)}${subLine(lead.altPhone ? `${lead.altName || "رقم تاني"}: ${lead.altPhone}` : "")}</td>
      <td>${esc(lead.repName || "—")}</td>
      <td>${esc(lead.doctorName || "—")}</td>
      <td>${esc(splitDateTime(lead.created_at).date)}</td>
      <td>${esc(lead.attemptsTotal)}</td>
      <td>${esc(lead.nextAction ? NEXT_ACTION_LABELS[lead.nextAction.action] : "—")}</td>
    `;
    tbody.appendChild(tr);
  });

  // These are leads too, so they take the same actions the main leads table offers.
  bulkAttach("overdue", "overdue-tbody", leads, leadBulkActions());
}

async function loadTemplates() {
  const isStale = beginLoad("templates");
  const { templates, placeholders } = await api("/admin/templates");
  if (isStale()) return;

  const list = document.getElementById("templates-list");
  list.innerHTML = "";
  templates.forEach((tpl) => {
    const wrap = document.createElement("div");
    wrap.style.cssText = "margin-bottom:16px; padding:12px; background:var(--surface-2); border-radius:12px";

    const label = document.createElement("label");
    label.textContent = tpl.label;
    label.style.cssText = "display:block; font-weight:600; margin-bottom:8px";

    const area = document.createElement("textarea");
    area.id = `tpl-${tpl.key}`;
    label.htmlFor = area.id;
    area.value = tpl.body;
    area.rows = Math.min(10, tpl.body.split("\n").length + 1);
    area.style.cssText = "width:100%; font-family:inherit; font-size:13px; padding:8px; border-radius:8px";
    area.disabled = !canManageData();

    wrap.appendChild(label);
    wrap.appendChild(area);

    // The names this message can use, each one a button that drops it where the cursor is.
    // Without them the editor could only rearrange the lines already there: a line deleted
    // a year ago was unrecoverable, and a name nobody had typed before was undiscoverable.
    if (canManageData() && (placeholders || []).length) {
      const hint = document.createElement("div");
      hint.textContent = "دوس على أي متغير عشان يتحط مكان المؤشر:";
      hint.style.cssText = "font-size:12px; color:var(--text-secondary); margin-top:10px; margin-bottom:6px";
      wrap.appendChild(hint);

      const chips = document.createElement("div");
      chips.style.cssText = "display:flex; flex-wrap:wrap; gap:6px";
      placeholders.forEach((ph) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.textContent = ph.key;
        chip.title = ph.help;
        chip.style.cssText =
          "font-size:12px; padding:4px 9px; border-radius:999px; background:var(--surface); " +
          "border:1px solid var(--border); cursor:pointer; font-family:inherit";
        chip.addEventListener("click", () => {
          // At the cursor, not at the end: an admin fixing the order of two lines should
          // not have to cut and paste the name back to where they were typing.
          const token = `{{${ph.key}}}`;
          const start = area.selectionStart ?? area.value.length;
          const end = area.selectionEnd ?? start;
          area.value = area.value.slice(0, start) + token + area.value.slice(end);
          area.focus();
          area.setSelectionRange(start + token.length, start + token.length);
        });
        chips.appendChild(chip);
      });
      wrap.appendChild(chips);
    }

    if (canManageData()) {
      const btn = document.createElement("button");
      btn.className = "primary";
      btn.textContent = "حفظ";
      btn.style.marginTop = "8px";
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await api(`/admin/templates/${tpl.key}`, { method: "PUT", body: { body: area.value } });
          btn.textContent = "اتحفظ ✓";
        } catch (e) {
          if (!(e instanceof ApiError)) throw e;
          btn.textContent = "فشل";
        }
        setTimeout(() => {
          btn.textContent = "حفظ";
          btn.disabled = false;
        }, 1500);
      });
      wrap.appendChild(btn);

      // Back to the wording this template shipped with. The migrations never overwrite a
      // reworded template - deliberately, an admin knows things they do not - so without
      // this there was no way back from an edit made months ago.
      if (tpl.shippedBody && tpl.shippedBody !== tpl.body) {
        const reset = document.createElement("button");
        reset.textContent = "رجّع النص الأصلي";
        reset.style.cssText = "margin-top:8px; margin-inline-start:8px";
        reset.title = "بيحط النص زي ما اتسلّم في الخانة - لسه محتاج تدوس حفظ";
        reset.addEventListener("click", () => {
          // Into the box, not straight to the server: the admin reads it and saves, so a
          // mis-tap costs nothing.
          area.value = tpl.shippedBody;
          area.focus();
        });
        wrap.appendChild(reset);
      }
    }
    list.appendChild(wrap);
  });
}

async function loadServices() {
  const isStale = beginLoad("services");
  const { services } = await api("/admin/services");
  if (isStale()) return;

  const list = document.getElementById("services-list");
  list.innerHTML = "";
  services.forEach((svc) => {
    const row = document.createElement("div");
    row.className = svc.active ? "svc-row" : "svc-row off";

    const name = document.createElement("div");
    name.className = "svc-name";
    const label = document.createElement("span");
    label.textContent = svc.name;
    label.title = svc.name;
    name.appendChild(label);
    row.appendChild(name);

    const state = document.createElement("span");
    state.className = "badge svc-state";
    state.textContent = svc.active ? "شغّالة" : "موقوفة";
    row.appendChild(state);

    if (canManageData()) {
      const actions = document.createElement("div");
      actions.className = "svc-actions";
      row.appendChild(actions);

      const renameBtn = document.createElement("button");
      renameBtn.textContent = "تعديل الاسم";
      renameBtn.addEventListener("click", () => renameService(svc));
      actions.appendChild(renameBtn);

      const btn = document.createElement("button");
      btn.textContent = svc.active ? "إيقاف" : "تفعيل";
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await api(`/admin/services/${svc.id}`, { method: "PATCH", body: { active: !svc.active } });
          toast(svc.active ? `اتوقفت خدمة ${svc.name}` : `اتفعّلت خدمة ${svc.name}`, "good");
        } finally {
          btn.disabled = false;
        }
        loadServices();
      });
      actions.appendChild(btn);
    }
    list.appendChild(row);
  });
}

/** Renames a service in place - the name was locked after creation until this existed. */
async function renameService(svc) {
  const name = await promptDialog("تعديل اسم الخدمة", { label: "الاسم", value: svc.name });
  if (!name || !name.trim() || name.trim() === svc.name) return;

  await api(`/admin/services/${svc.id}`, { method: "PATCH", body: { name: name.trim() } });
  toast("اتعدّل اسم الخدمة", "good");
  loadServices();
}

let editingLeadId = null;

/** Populates the doctor select in the lead modal from the already-loaded doctor list. */
function fillLeadDoctorSelect(selectedDoctorId) {
  const sel = document.getElementById("lead-doctor");
  sel.innerHTML = '<option value="">— اختار دكتور —</option>';
  allDoctors.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.name;
    if (d.id === selectedDoctorId) opt.selected = true;
    sel.appendChild(opt);
  });
}

/** Populates the campaign select for whichever doctor is chosen in the modal. */
async function fillLeadCampaignSelect(doctorId, selectedCampaignId) {
  const sel = document.getElementById("lead-campaign");
  sel.innerHTML = "";
  if (!doctorId) {
    sel.innerHTML = '<option value="">اختار دكتور الأول</option>';
    return;
  }
  let campaigns;
  try {
    ({ campaigns } = await api(`/admin/campaigns?doctorId=${doctorId}`));
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    // Without the list the form must not quietly save a lead with no campaign.
    sel.innerHTML = '<option value="">مقدرناش نجيب الكامبينات — حاول تاني</option>';
    return;
  }
  sel.innerHTML = "";
  if (!campaigns.length) sel.innerHTML = '<option value="">مفيش كامبينات للدكتور ده</option>';
  campaigns.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id === selectedCampaignId) opt.selected = true;
    sel.appendChild(opt);
  });
}

/** Populates the rep select, scoped to the doctor's group once one is chosen. */
function fillLeadRepSelect(doctorId, selectedRepId) {
  const sel = document.getElementById("lead-rep");
  sel.innerHTML = "";
  const doctor = allDoctors.find((d) => d.id === Number(doctorId));
  const reps = doctor ? allReps.filter((r) => r.groupId === doctor.groupId) : allReps;
  if (reps.length === 0) sel.innerHTML = '<option value="">مفيش موظفين في المجموعة دي</option>';
  reps.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.name;
    if (r.id === selectedRepId) opt.selected = true;
    sel.appendChild(opt);
  });
}

/** Opens the create/edit lead modal. Omit `lead` to create a new one. */
/**
 * The pen beside a lead's name, wherever the name is drawn (owner, 2026-09-30: "في كل
 * الأماكن، أي حتة حرفياً في الداشبورد"). One delegated click below opens the same editor the
 * leads page uses - name, numbers, second contact, notes, rep. Nothing for a role that
 * cannot edit.
 */
function leadEditHtml(leadId) {
  if (!leadId || !canEditOperations()) return "";
  return `<button type="button" class="link-btn lead-edit" data-lead-id="${Number(leadId)}" title="تعديل بيانات الليد" aria-label="تعديل بيانات الليد" style="font-size:12px; margin-inline-start:6px">✎</button>`;
}
document.addEventListener("click", (e) => {
  const pen = e.target.closest && e.target.closest(".lead-edit");
  if (!pen) return;
  e.preventDefault();
  e.stopPropagation();
  editLeadById(Number(pen.dataset.leadId));
});

/**
 * The same pen for a case that has no lead behind it - an accounts row (the owner's xlsx,
 * or one typed in الحسابات). It opens the accounts editor, so the name, number, day,
 * clinic and employee are all fixable from wherever the case is listed. Accounts are
 * admin-only, so the pen is too.
 */
function caseEditHtml(caseId) {
  if (!caseId || !(userRole === "super_admin" || userRole === "admin")) return "";
  return `<button type="button" class="link-btn case-edit" data-case-id="${Number(caseId)}" title="تعديل بيانات الحالة (من الحسابات)" aria-label="تعديل بيانات الحالة" style="font-size:12px; margin-inline-start:6px">✎</button>`;
}
document.addEventListener("click", (e) => {
  const pen = e.target.closest && e.target.closest(".case-edit");
  if (!pen) return;
  e.preventDefault();
  e.stopPropagation();
  editFinCaseById(Number(pen.dataset.caseId));
});

async function editFinCaseById(caseId) {
  // The dialog's clinic and employee lists come with the month's account.
  if (!financeData.employees.length || !financeData.clinics.length) await fetchFinanceMonth();
  const { case: c } = await api(`/admin/finance/cases/${caseId}`);
  await openFinanceCaseDialog(c);
}

/** Opens the editor on a lead known only by id: the story endpoint carries every field it needs. */
async function editLeadById(leadId) {
  let lead;
  try {
    ({ lead } = await api(`/admin/leads/${leadId}/activity`, { silent: true }));
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    toast(err.message || "مقدرناش نجيب الليد", "bad");
    return;
  }
  if (!document.getElementById("activity-modal").classList.contains("hidden")) closeActivityModal();
  openLeadModal({
    id: leadId,
    name: lead.name,
    phone: lead.phone,
    whatsappPhone: lead.whatsappPhone,
    altName: lead.altName,
    altPhone: lead.altPhone,
    notes: lead.notes,
    assignedUserId: lead.assignedUserId,
  });
}

async function openLeadModal(lead) {
  editingLeadId = lead ? lead.id : null;
  document.getElementById("lead-modal-title").textContent = lead ? "تعديل عميل" : "عميل جديد";
  document.getElementById("lead-name").value = lead ? lead.name : "";
  document.getElementById("lead-phone").value = lead ? lead.phone : "";
  document.getElementById("lead-whatsapp").value = lead ? lead.whatsappPhone || "" : "";
  document.getElementById("lead-alt-name").value = lead ? lead.altName || "" : "";
  document.getElementById("lead-alt-phone").value = lead ? lead.altPhone || "" : "";
  document.getElementById("lead-notes").value = lead ? lead.notes || "" : "";
  document.getElementById("lead-error").textContent = "";

  // The doctor a lead belongs to is fixed by its campaign and does not change on edit -
  // editing only ever corrects the name, phone, or which rep holds it.
  const campaignField = document.getElementById("lead-campaign-field");
  const doctorField = document.getElementById("lead-doctor").closest(".field");
  if (lead) {
    doctorField.classList.add("hidden");
    campaignField.classList.add("hidden");
  } else {
    doctorField.classList.remove("hidden");
    campaignField.classList.remove("hidden");
    fillLeadDoctorSelect(null);
    await fillLeadCampaignSelect(null, null);
  }
  fillLeadRepSelect(null, lead ? lead.assignedUserId : null);

  showStaticModal("lead-modal", {
    onDismiss: closeLeadModal,
    initialFocus: document.getElementById("lead-name"),
    onEnter: saveLead,
  });
}

function closeLeadModal() {
  hideStaticModal("lead-modal");
  editingLeadId = null;
}

async function saveLead() {
  const name = document.getElementById("lead-name").value.trim();
  const phone = document.getElementById("lead-phone").value.trim();
  const whatsappPhone = document.getElementById("lead-whatsapp").value.trim();
  const altName = document.getElementById("lead-alt-name").value.trim();
  const altPhone = document.getElementById("lead-alt-phone").value.trim();
  const notes = document.getElementById("lead-notes").value.trim();
  const repId = document.getElementById("lead-rep").value;
  const errorEl = document.getElementById("lead-error");
  errorEl.textContent = "";

  if (!name) return (errorEl.textContent = "اكتب اسم العميل");
  if (!phone) return (errorEl.textContent = "اكتب رقم التليفون");
  if (!repId) return (errorEl.textContent = "اختار الموظف");

  const btn = document.getElementById("lead-save-btn");
  btn.disabled = true;
  try {
    if (editingLeadId) {
      await api(`/admin/leads/${editingLeadId}`, {
        method: "PATCH",
        body: { name, phone, whatsappPhone, altName, altPhone, notes, assignedUserId: Number(repId) },
        silent: true,
      });
    } else {
      const campaignId = document.getElementById("lead-campaign").value;
      if (!campaignId) return (errorEl.textContent = "اختار الكامبين");
      await api("/admin/leads", {
        method: "POST",
        body: {
          name,
          phone,
          whatsappPhone,
          altName,
          altPhone,
          notes,
          campaignId: Number(campaignId),
          assignedUserId: Number(repId),
        },
        silent: true,
      });
    }
    const wasEdit = Boolean(editingLeadId);
    closeLeadModal();
    toast(wasEdit ? `اتعدّل ${name}` : `اتضاف ${name}`, "good");
    // The pen lives on every page that draws a lead, so every one of them is stale now.
    ["leads", "worksheet", "bookings", "reminders", "overdue", "calls", "overview", "plan-start", "workload"].forEach((v) => dirtyViews.add(v));
    if (currentView !== "leads") runViewLoader(currentView);
    afterLeadsChanged();
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (!e.reported) errorEl.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
}

async function deleteLead(lead) {
  if (!(await confirmDialog("حذف العميل", { sub: `تمسح "${lead.name}"؟ الحركة دي مينفعش ترجع فيها.`, confirmLabel: "امسح" }))) return;
  try {
    await api(`/admin/leads/${lead.id}`, { method: "DELETE", silent: true });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    // A worked lead: the server says what would go with it, and asks for a second yes.
    if (!e.data || !e.data.needsConfirmation) {
      toast(e.message, "bad");
      return;
    }
    const ok = await confirmDialog(`"${lead.name}" عليه شغل`, {
      sub:
        `عليه ${e.data.callCount} مكالمة و${e.data.bookingCount} حجز. لو مسحته هيتمسح تاريخه ده كله معاه: ` +
        "المكالمات والحجوزات والمتابعات، ومش هيبان في أي تقرير. مفيش رجوع.",
      confirmLabel: "امسحه بتاريخه",
    });
    if (!ok) return;
    await api(`/admin/leads/${lead.id}?withHistory=1`, { method: "DELETE" });
  }
  toast(`اتمسح ${lead.name}`, "good");
  afterLeadsChanged();
}

/** Cleans up leads uploaded today that nobody has called or booked yet - for a test or
 * trial upload made while trying the dashboard out. */
async function deleteTodaysLeads() {
  if (!(await confirmDialog("حذف ليدز النهاردة", { sub: "تمسح كل ليدز النهاردة اللي لسه محدش اتصل بيهم؟ اللي اتكلم معاه حد هيتسيب. الحركة دي مينفعش ترجع فيها.", confirmLabel: "امسح" }))) return;
  const data = await api("/admin/leads/today", { method: "DELETE" });
  toast(`اتمسح ${data.deletedCount} ليد` + (data.skippedCount ? `، ${data.skippedCount} اتسيبوا لأنهم اتكلم معاهم` : ""), "good");
  afterLeadsChanged();
}

const ACTIVITY_ICONS = {
  call: "📞",
  reminder_call: "🔔",
  status_update: "✎",
  booking: "📅",
  whatsapp: "💬",
  follow_up_reminder: "⏰",
  written_contact: "✍️",
  inbound_call: "📲",
  plan_followup: "🦷",
};

async function openActivityModal(leadId) {
  const content = document.getElementById("activity-content");
  let lead, events, phoneCalls, counts;
  try {
    ({ lead, events, phoneCalls, counts } = await api(`/admin/leads/${leadId}/activity`, { silent: true }));
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (e.reported) return;
    content.innerHTML = `<p class="error">${esc(e.message || "مقدرناش نجيب النشاط")}</p>`;
    showStaticModal("activity-modal", { onDismiss: closeActivityModal });
    return;
  }

  const header = document.createElement("div");
  header.innerHTML = `
    <h2 style="margin:0 0 4px; font-size:18px">${esc(lead.name)}</h2>
    <div style="color:var(--text-secondary); font-size:13px">
      ${esc(lead.phone)}${lead.whatsappPhone ? " — واتساب " + esc(lead.whatsappPhone) : ""} — ${esc(lead.repName || "—")}
    </div>
    <div style="color:var(--text-secondary); font-size:13px">
      الدكتور: ${esc(lead.doctorName || "—")} — الخدمة: ${esc(lead.serviceName || "—")}
    </div>
    ${lead.altPhone || lead.altName ? `<div style="color:var(--text-secondary); font-size:13px">رقم تاني: ${esc(lead.altName || "")} ${esc(lead.altPhone || "")}</div>` : ""}
    ${lead.notes ? `<div style="font-size:13px; margin-top:6px; padding:8px 10px; background:var(--surface-2); border-radius:8px; white-space:pre-wrap">📝 ${esc(lead.notes)}</div>` : ""}
    ${
      // The lead moved on a message instead of a call: which channel, and the reason the
      // rep typed to be allowed to. Both were recorded and nothing read them back.
      lead.clientContactVia
        ? `<div style="font-size:13px; margin-top:6px; padding:8px 10px; background:var(--surface-2); border-radius:8px; white-space:pre-wrap">💬 ${esc(lead.clientContactViaLabel || lead.clientContactVia)}${lead.clientContactAt ? " — " + esc(lead.clientContactAt) : ""}${lead.clientContactNote ? "\n" + esc(lead.clientContactNote) : ""}</div>`
        : ""
    }
    <div style="margin-bottom:10px"></div>
  `;

  // Where this client shows up elsewhere. The search answers "who is this"; these answer
  // "and وريني بقى" without typing the number again (owner, 2026-09-25).
  const jumps = document.createElement("div");
  jumps.style.cssText = "display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px";
  const jump = (label, run) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", run);
    jumps.appendChild(b);
  };
  const searchOn = (page, inputId, value) => {
    closeActivityModal();
    goto(page);
    // The page builds itself on the hash change; the box is filled once it is there.
    setTimeout(() => {
      const box = document.getElementById(inputId);
      if (!box) return;
      box.value = value;
      box.dispatchEvent(new Event("input", { bubbles: true }));
      box.dispatchEvent(new Event("change", { bubbles: true }));
      box.scrollIntoView({ block: "center" });
    }, 250);
  };
  // Every field of the lead is editable from here, whatever table it was opened from
  // (owner, 2026-09-30).
  if (canEditOperations()) jump("✎ عدّل بيانات الليد", () => editLeadById(leadId));
  jump("حجوزاته ←", () => searchOn("bookings", "bookings-q", lead.phone || lead.name));
  jump("مكالماته ←", () => searchOn("calls", "calls-q", lead.phone || lead.name));
  if (lead.assignedUserId) jump(`شهر ${lead.repName || "الموظف"} ←`, () => { closeActivityModal(); showMonthly(lead.assignedUserId); });
  jump("نسخ الرقم", async () => {
    try {
      await navigator.clipboard.writeText(lead.phone || "");
      toast("الرقم اتنسخ", "good");
    } catch {
      toast("مقدرناش ننسخ الرقم", "bad");
    }
  });
  if (lead.phone) {
    const wa = document.createElement("a");
    wa.href = `https://wa.me/2${String(lead.phone).replace(/\D/g, "").replace(/^0+/, "")}`;
    wa.target = "_blank";
    wa.rel = "noopener";
    wa.className = "btn";
    wa.textContent = "واتساب ←";
    jumps.appendChild(wa);
  }

  const list = document.createElement("div");
  if (events.length === 0) {
    list.innerHTML = '<p style="color:var(--text-secondary)">مفيش نشاط متسجل لسه</p>';
  } else {
    events.forEach((ev) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex; gap:10px; padding:8px 0; border-bottom:1px solid var(--surface-2)";
      row.innerHTML = `
        <div>${esc(ACTIVITY_ICONS[ev.type] || "•")}</div>
        <div style="flex:1">
          <div>${esc(ev.label)}</div>
          <div style="color:var(--text-secondary); font-size:12px">
            ${esc(ev.time)}${ev.repName ? " — " + esc(ev.repName) : ""}
          </div>
        </div>
      `;
      list.appendChild(row);
    });
  }

  // The phone calls themselves, under the timeline above them.
  //
  // This is the table the call-evidence guard reads, and it was on no screen: when a rep
  // said "I called and it says I didn't", nobody could settle it. A row that matched the
  // lead and a row that only matches one of its numbers are both shown, marked, because
  // "the call is there but attached to nothing" is the answer in half these arguments.
  const calls = document.createElement("div");
  calls.style.cssText = "margin-top:18px";
  calls.innerHTML = `<h3 style="margin:0 0 6px; font-size:14px">مكالمات التليفون المسجلة</h3>`;
  // The two numbers, named, on the one screen where an argument about them gets settled.
  // The rep's card shows the dials; every figure here shows the outcomes; a rep who rang
  // twice and wrote up once makes them differ, always in that direction.
  if (counts) {
    calls.innerHTML +=
      `<p style="color:var(--text-secondary); font-size:13px; margin:0 0 8px">` +
      `رنّ عليه <strong>${esc(counts.dials)}</strong> مرة — ` +
      `وسجّل نتيجة <strong>${esc(counts.outcomes)}</strong> مرة. ` +
      `التطبيق بيوري الرقم الأول، والداشبورد بيوري التاني.</p>`;
  }
  if (!phoneCalls || phoneCalls.length === 0) {
    calls.innerHTML += '<p style="color:var(--text-secondary); font-size:13px">مفيش مكالمات متزامنة من تليفون المندوب على الرقم ده</p>';
  } else {
    for (const call of phoneCalls) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex; gap:10px; padding:8px 0; border-bottom:1px solid var(--surface-2)";
      row.innerHTML = `
        <div>📱</div>
        <div style="flex:1">
          <div>${esc(call.directionLabel || call.direction)} — ${esc(fmtDuration(call.durationSeconds))}${
            call.matched ? "" : ' <span style="color:var(--text-secondary)">(مش متربطة بالليد)</span>'
          }</div>
          <div style="color:var(--text-secondary); font-size:12px">
            ${esc(new Date(call.occurredAt).toLocaleString("ar-EG"))} — ${esc(call.phoneNumber)}${call.repName ? " — " + esc(call.repName) : ""}
          </div>
        </div>
      `;
      calls.appendChild(row);
    }
  }

  content.innerHTML = "";
  content.appendChild(header);
  content.appendChild(jumps);
  content.appendChild(list);
  content.appendChild(calls);
  showStaticModal("activity-modal", { onDismiss: closeActivityModal, initialFocus: document.getElementById("activity-close-btn") });
}

function closeActivityModal() {
  hideStaticModal("activity-modal");
}

async function addService() {
  const input = document.getElementById("new-service-name");
  const name = input.value.trim();
  if (!name) return;

  await api("/admin/services", { method: "POST", body: { name } });
  input.value = "";
  toast(`اتضافت خدمة ${name}`, "good");
  loadServices();
}

async function loadAccounts() {
  const isStale = beginLoad("accounts");
  const { reps } = await api("/admin/reps");
  if (isStale()) return;

  const tbody = document.getElementById("accounts-tbody");
  tbody.innerHTML = "";
  reps.forEach((rep) => {
    const tr = document.createElement("tr");
    const seen = rep.lastSeenAt ? splitUtcInCairo(rep.lastSeenAt) : null;
    tr.innerHTML = `
      <td>${esc(rep.name)}</td>
      <td>${esc(rep.phone)}</td>
      <td>${groupLabel(rep.groupId)}</td>
      <td>${rep.appVersion ? esc(`نسخة ${rep.appVersion}`) : '<span style="color:var(--text-muted)" title="التطبيق لسه مابلّغش عن نسخته - محتاج النسخة اللي بتبعتها">—</span>'}</td>
      <td>${seen ? esc(`${seen.date} ${seen.time}`) : "—"}</td>
      <td></td>
    `;
    const actionCell = tr.lastElementChild;
    const btn = document.createElement("button");
    btn.textContent = "غيّر الباسورد";
    btn.addEventListener("click", () => resetRepPassword({ ...rep, role: "sales" }));
    actionCell.appendChild(btn);
    tbody.appendChild(tr);
  });

  bulkAttach("accounts", "accounts-tbody", reps, [
    {
      label: "نقل لمجموعة",
      // PATCH /admin/users is super-admin only, so the button follows that, not canManageData.
      show: isSuperAdmin,
      run: async (ids) => {
        const groupId = await promptDialog("نقل لمجموعة", {
          sub: `${ids.length} سيلز`,
          label: "المجموعة",
          options: groupOptions(),
          confirmLabel: "نقل",
        });
        if (!groupId) return;
        await bulkUserPatch(ids, { groupId }, "accounts", (n) => `اتنقل ${n} سيلز لمجموعة ${GROUP_LABELS[groupId]}`);
      },
    },
  ]);
}

/**
 * Applies one PATCH to each selected account.
 *
 * Sent one at a time rather than as a single bulk endpoint: account edits are rare,
 * few at a time, and every per-user rule the server already enforces (last admin,
 * self-demotion, group validity) then applies unchanged instead of being reimplemented.
 */
async function bulkUserPatch(ids, body, key, describe) {
  const results = await Promise.allSettled(
    ids.map((id) => api(`/admin/users/${id}`, { method: "PATCH", body, silent: true })),
  );
  const ok = results.filter((r) => r.status === "fulfilled");
  const done = ok.length;
  const clearedCount = ok.filter((r) => r.value && r.value.clearedDoctorLinks).length;
  const firstError = results.find((r) => r.status === "rejected")?.reason?.message;
  toast(
    describe(done) +
      (done < ids.length ? `، ${ids.length - done} فشلوا${firstError ? ` (${firstError})` : ""}` : "") +
      (clearedCount ? `. اتشال ربط الدكتور القديم لـ ${clearedCount} منهم عشان بقى في مجموعة تانية` : ""),
    done ? "good" : "bad",
  );
  bulkClear(key);
  afterRosterChanged();
}

let allDoctors = [];

/**
 * The manual-distribution roster: who is carrying what today.
 *
 * Distribution itself is claim-only now - leads sit in a shared pool per doctor and reps
 * pull their own batches. This page exists for the day someone is absent: their open
 * leads have to reach a human (or go back to the pool) before the day is over.
 */
/* ---------------------------------------------------------------- Workload tabs

   The page holds three tables that answer three different questions - what each rep
   still owes, what is waiting in each doctor's pool, and who is holding how much - and
   an admin opens it for one of them. Tabs, not a scroll: the one they came for is on
   screen the moment the page opens. The open tab is part of the hash (#/workload/pool),
   so an overview card lands on the right table and a refresh keeps it.
   ------------------------------------------------------------------------ */
const WORKLOAD_TABS = [
  { id: "followups", label: "الشغل المستني" },
  { id: "plan", label: "كشف ولسه مبدأش" },
  { id: "pool", label: "مخزون الدكاترة" },
  { id: "manual", label: "حمل الشغل والتوزيع اليدوي" },
];
let workloadTab = WORKLOAD_TABS[0].id;
const workloadTabCounts = {};

function renderWorkloadTabs() {
  const host = document.getElementById("workload-tabs");
  if (!host) return;
  host.innerHTML = "";
  for (const tab of WORKLOAD_TABS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(tab.id === workloadTab));
    const n = workloadTabCounts[tab.id];
    btn.textContent = n == null ? tab.label : `${tab.label} (${n})`;
    btn.addEventListener("click", () => selectWorkloadTab(tab.id));
    host.appendChild(btn);
  }
  document.querySelectorAll("#view-workload [data-workload-tab]").forEach((section) => {
    section.classList.toggle("hidden", section.dataset.workloadTab !== workloadTab);
  });
}

/** Switches tab, and writes it into the hash without re-running the route. */
function selectWorkloadTab(id, { updateHash = true } = {}) {
  if (!WORKLOAD_TABS.some((t) => t.id === id)) return;
  workloadTab = id;
  renderWorkloadTabs();
  if (updateHash && currentView === "workload") history.replaceState(null, "", `#/workload/${id}`);
}

/** A number in the tab's label, so the admin can see which table has something in it before opening it. */
function setWorkloadTabCount(id, n) {
  workloadTabCounts[id] = n;
  renderWorkloadTabs();
}

async function loadWorkload() {
  renderWorkloadTabs();
  loadPool();
  loadFollowups();
  loadPlanFollowups();
  const isStale = beginLoad("workload");
  const { reps } = await api("/admin/workload");
  if (isStale()) return;

  const tbody = document.getElementById("workload-tbody");
  tbody.innerHTML = "";
  reps.forEach((rep) => {
    const tr = document.createElement("tr");
    // A stopped account still holding open leads is listed on purpose: this page is
    // where those leads get handed on, and hiding the row hid the leads.
    if (rep.active === 0) tr.className = "inactive-row";
    tr.innerHTML = `
      <td>${esc(rep.name)}${rep.active === 0 ? ' <span class="badge" style="background:var(--surface-3); color:var(--text-secondary)">موقوف - لسه ماسك ليدز</span>' : ""}</td>
      <td>${groupLabel(rep.groupId)}</td>
      <td>${esc(rep.primaryDoctorName || "—")}</td>
      <td><strong>${esc(rep.activeCount)}</strong></td>
      <td>${esc(rep.todayCount)}</td>
      <td>${esc(rep.totalCount)}</td>
      <td></td>`;

    if (canEditOperations() && rep.activeCount > 0) {
      const distributeBtn = document.createElement("button");
      distributeBtn.textContent = "وزّع ليدزه";
      distributeBtn.addEventListener("click", () => redistributeWorkload(rep, reps));
      tr.lastElementChild.appendChild(distributeBtn);

      const returnBtn = document.createElement("button");
      returnBtn.textContent = "رجّعها للمخزون";
      returnBtn.style.marginInlineStart = "6px";
      returnBtn.addEventListener("click", () => returnWorkloadToPool(rep));
      tr.lastElementChild.appendChild(returnBtn);
    }
    tbody.appendChild(tr);
  });

  if (!reps.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">مفيش سيلز</td></tr>';
  }
  setWorkloadTabCount("manual", reps.reduce((sum, rep) => sum + (Number(rep.activeCount) || 0), 0));
}

/* ---------------------------------------------------------------- After the visit */

/**
 * "كشف ولسه مبدأش الخطة": the clients who were examined and have not started, who rings
 * them and when, and - the figure it exists for - how many started after being rung.
 *
 * The rows are cases from the accounts (GET /admin/plan-followups), so "بدأت ✓" pressed on
 * the accounts page and "بدأ الخطة" pressed on a rep's phone are the same fact, and a case
 * brought in from the old sheet is chased like one that came from a booking.
 */
let planTargetRep = "";
let planSearchTimer = null;

function planQuery() {
  const params = new URLSearchParams();
  params.set("state", document.getElementById("plan-state").value || "pending");
  const rep = document.getElementById("plan-rep").value;
  if (rep) params.set("userId", rep);
  const origin = document.getElementById("plan-origin").value;
  if (origin) params.set("origin", origin);
  const doctor = document.getElementById("plan-doctor").value;
  if (doctor) params.set("doctorId", doctor);
  if (document.getElementById("plan-due").checked) params.set("due", "1");
  const q = document.getElementById("plan-search").value.trim();
  if (q) params.set("q", q);
  return params.toString();
}

/** The two pickers, filled once the reps and doctors are in - and kept on what was chosen. */
function fillPlanFilters() {
  const fill = (id, first, options) => {
    const sel = document.getElementById(id);
    const keep = sel.value;
    sel.innerHTML = "";
    for (const o of [first, ...options]) {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      sel.appendChild(opt);
    }
    if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
  };
  fill("plan-rep", { value: "", label: "كل الموظفين" }, [
    { value: "none", label: "من غير موظف" },
    ...allReps.filter((r) => r.active !== 0).map((r) => ({ value: String(r.id), label: r.name })),
  ]);
  fill("plan-doctor", { value: "", label: "كل العيادات" }, allDoctors.map((d) => ({ value: String(d.id), label: d.name })));
}

async function loadPlanFollowups() {
  fillPlanFilters();
  const isStale = beginLoad("plan-followups");
  let data;
  try {
    data = await api(`/admin/plan-followups?${planQuery()}`, { silent: true });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    document.getElementById("plan-tbody").innerHTML = '<tr><td colspan="8" class="empty-row">القايمة مش متاحة دلوقتي</td></tr>';
    return;
  }
  if (isStale()) return;

  const sm = data.summary;
  const rules = data.rules;
  document.getElementById("plan-note").textContent =
    `اللي كشف ولسه مبدأش بيظهر للموظف من يوم الكشف، والمكالمة ملهاش ميعاد - تحصل في أي وقت. "المتابعة الجاية" اقتراح بيرتّب القايمة: ` +
    `اليوم اللي الموظف يحدده مع "هيبدأ" أو "متابعة لاحقاً"، أو بعد ${rules.everyDays} أيام (واللي مردّش بعد ${rules.noAnswerAfterDays} يوم)، لحد ${rules.maxTries} محاولات. ` +
    `الحالة بتخرج من هنا لما تبدأ الخطة - من الموبايل أو من الحسابات - أو العميل يقول مش هيكمل، أو المحاولات تخلص. ` +
    `نفس الشخص لو ليه أكتر من زيارة بيتابع في واحدة بس. النقل بينقل المتابعة بس؛ الحالة وبونصها بيفضلوا للي حجزها.`;
  const tiles = document.getElementById("plan-tiles");
  tiles.innerHTML = "";
  tiles.append(
    tile(sm.examined, "كشفوا", null),
    tile(sm.started, "بدأوا الخطة", sm.examined ? Math.round((sm.started / sm.examined) * 100) : null, "var(--brand)"),
    tile(sm.startedAfterFollowup, "بدأوا بعد متابعة", sm.started ? Math.round((sm.startedAfterFollowup / sm.started) * 100) : null, "var(--brand)"),
    tile(sm.pending, "لسه مبدأش", null, "var(--warning)"),
    tile(sm.due, "ميعاد متابعتهم جه", null, sm.due ? "var(--critical)" : null),
    tile(sm.unowned, "من غير موظف", null, sm.unowned ? "var(--critical)" : null),
    tile(sm.closed, "اتقفلت", null),
  );
  setWorkloadTabCount("plan", sm.due);

  const cases = data.cases || [];
  const tbody = document.getElementById("plan-tbody");
  tbody.innerHTML = "";
  for (const c of cases) {
    const tr = document.createElement("tr");
    const history = (c.history || [])
      .map((h) => `${formatDateTime(h.at)} - ${h.byName || "—"}: ${h.outcomeLabel}${h.note ? " (" + h.note + ")" : ""}`)
      .join("\n");
    const next =
      c.state === "started"
        ? `<span class="badge" style="background:var(--brand); color:#fff">بدأ ✓ ${esc(c.planStartedOn || "")}</span>${c.planReportedByName ? subLine(planReportedLine(c.planReportedByName, c.planReportedByRole)) : ""}`
        : c.state === "closed"
          ? `<span class="badge" style="background:var(--surface-3)">${esc(c.closedReasonLabel || "اتقفلت")}</span>`
          : `${esc(c.nextOn)}${c.due ? ' <span class="badge" style="background:var(--critical); color:#fff">جه ميعادها</span>' : ""}`;
    tr.innerHTML = `
      <td>${esc(c.caseName || "—")}${
        // A case with no booking never was a lead in the system - it is an accounts row
        // (the xlsx, or typed in الحسابات): the owner hands those out his own way, so the
        // row says which it is (owner, 2026-09-26) and its pen edits the accounts row.
        c.bookingId
          ? ""
          : ' <span class="badge" style="background:var(--surface-3); color:var(--text-secondary)" title="جت من الحسابات - مفيش حجز ولا ليد وراها">من الحسابات</span>' + caseEditHtml(c.caseId)
      }<div dir="ltr" style="font-size:11px; color:var(--text-muted); text-align:start">${esc((c.phones && c.phones.length ? c.phones : [c.phone || ""]).join(" / "))}</div></td>
      <td>${esc(c.clinicName || "—")}</td>
      <td>${esc(c.visitDay)}${c.daysSinceVisit != null ? subLine("من " + c.daysSinceVisit + " يوم") : ""}</td>
      <td>${
        // A sheet case nobody has been handed yet: its employee is only who the money
        // counts for, and it sits on no phone until the dashboard gives it to someone.
        !c.bookingId && !c.assignedUserId
          ? '<span class="badge" style="background:var(--warning); color:#000">لسه متوزعتش</span>'
          : c.ownerName
            ? esc(c.ownerName)
            : '<span class="badge" style="background:var(--critical); color:#fff">من غير موظف</span>'
      }${
        c.employeeName && c.employeeName !== c.ownerName ? subLine("الحالة محسوبة لـ " + c.employeeName) : ""
      }</td>
      <td>${esc(c.tries)} من ${esc(c.maxTries)}</td>
      <td title="${esc(history)}">${c.lastOutcomeLabel ? esc(c.lastOutcomeLabel) + subLine(formatDateTime(c.lastAt)) + subLine(c.lastNote) : "—"}</td>
      <td>${next}</td>
      <td style="white-space:nowrap"></td>`;
    const actions = tr.lastElementChild;
    if (c.leadId) {
      const story = document.createElement("button");
      story.type = "button";
      story.textContent = "القصة";
      story.title = "كل اللي حصل مع العميل ده";
      story.addEventListener("click", () => openActivityModal(c.leadId));
      actions.appendChild(story);
      actions.insertAdjacentHTML("beforeend", leadEditHtml(c.leadId));
    }
    if (c.state === "closed" && canEditOperations()) {
      const reopen = document.createElement("button");
      reopen.type = "button";
      reopen.textContent = "افتحها تاني";
      reopen.style.marginInlineStart = "4px";
      reopen.addEventListener("click", async () => {
        const ok = await confirmDialog(`تفتح متابعة "${c.caseName || c.phone || "الحالة"}" تاني؟`, {
          sub: "هترجع لقايمة اللي بيتابعها بميعاد النهارده، والمحاولات تبدأ من الأول.",
          confirmLabel: "افتحها",
          danger: false,
        });
        if (!ok) return;
        await api(`/admin/plan-followups/${c.caseId}/reopen`, { method: "POST" });
        toast("اتفتحت تاني ✓", "good");
        loadPlanFollowups();
      });
      actions.appendChild(reopen);
    }
    tbody.appendChild(tr);
  }
  if (!cases.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">مفيش حالات مطابقة</td></tr>';
    return;
  }

  const pendingOnly = (ids) => cases.filter((c) => ids.includes(c.caseId) && c.state === "pending").map((c) => c.caseId);
  if (canEditOperations()) {
    bulkAttach(
      "plan-followups",
      "plan-tbody",
      cases,
      [
        { render: (ids) => planTransferPicker(pendingOnly(ids)) },
        {
          label: "اقفل المتابعة",
          danger: true,
          run: async (ids) => {
            const open = pendingOnly(ids);
            if (!open.length) return toast("اللي اخترته مفيهوش حالات لسه بتتابع", "bad");
            const ok = await confirmDialog(`تقفل متابعة ${open.length} حالة؟`, {
              sub: "مش هتظهر للموظف تاني. الحالة نفسها في الحسابات زي ما هي، وتقدر تفتحها تاني من هنا.",
              confirmLabel: "اقفل",
            });
            if (!ok) return;
            const out = await api("/admin/plan-followups/close", { method: "POST", body: { caseIds: open } });
            toast(`اتقفلت ${out.closed} حالة`, "good");
            bulkClear("plan-followups");
            loadPlanFollowups();
          },
        },
      ],
      { idOf: (c) => c.caseId },
    );
  }
}

/** The rep picker beside "انقل", kept outside the bar because the bar is rebuilt on every tick. */
function planTransferPicker(ids) {
  const frag = document.createDocumentFragment();
  const sel = document.createElement("select");
  sel.setAttribute("aria-label", "انقل المتابعة لمين");
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "انقل المتابعة لـ…";
  sel.appendChild(placeholder);
  for (const rep of allReps.filter((r) => r.active !== 0)) {
    const opt = document.createElement("option");
    opt.value = String(rep.id);
    opt.textContent = `${rep.name} — ${groupLabel(rep.groupId)}`;
    sel.appendChild(opt);
  }
  if ([...sel.options].some((o) => o.value === planTargetRep)) sel.value = planTargetRep;
  else planTargetRep = "";

  const btn = document.createElement("button");
  btn.className = "primary";
  btn.textContent = "انقل";
  btn.disabled = !planTargetRep || !ids.length;
  sel.addEventListener("change", () => {
    planTargetRep = sel.value;
    btn.disabled = !sel.value || !ids.length;
  });
  btn.addEventListener("click", async () => {
    const rep = allReps.find((r) => String(r.id) === planTargetRep);
    if (!rep) return;
    const ok = await confirmDialog(`تنقل متابعة ${ids.length} حالة لـ ${rep.name}؟`, {
      sub: 'هتظهر عنده في "لسه مبدأش" على الموبايل. الحالة وبونصها بيفضلوا للي حجزها.',
      confirmLabel: "انقل",
      danger: false,
    });
    if (!ok) return;
    btn.disabled = true;
    try {
      const out = await api("/admin/plan-followups/transfer", { method: "POST", body: { caseIds: ids, toUserId: rep.id } });
      toast(`اتنقلت ${out.moved} حالة لـ ${out.toName}` + (out.skipped ? `، و${out.skipped} متنقلتش` : ""), "good");
      bulkClear("plan-followups");
      loadPlanFollowups();
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
    } finally {
      btn.disabled = false;
    }
  });
  frag.append(sel, btn);
  return frag;
}

/* ---------------------------------------------------------------- Follow-ups */

/**
 * "الشغل المستني": what each rep still owes, split the same four ways the app splits it.
 *
 * The dashboard used to show a team lead four overdue leads for a rep while the rep's own
 * phone showed an empty screen, and nothing said which kind of work was waiting. These are
 * the app's own four tabs, counted per rep for one day, from the same server-side rules -
 * so the number here and the list on the phone can never disagree.
 *
 * scheduled/bookings are counted on the chosen day; untouched/secondDay are states as of it.
 */
const FOLLOWUP_KEYS = ["scheduled", "bookings", "untouched", "attendance", "examined"];

/** The section's own day, defaulting to today the first time the view is opened. */
function followupsDate() {
  const input = document.getElementById("followups-date");
  if (!input) return todayLocal();
  if (!input.value) input.value = todayLocal();
  return input.value;
}

function followupTotal(rep) {
  // Visits gone past with no result are owed work too (2026-09-22); the server's total
  // predates them, so they are added here.
  if (rep.total != null) return (Number(rep.total) || 0) + (Number(rep.attendance) || 0);
  return FOLLOWUP_KEYS.filter((k) => k !== "examined").reduce((sum, key) => sum + (Number(rep[key]) || 0), 0);
}

async function loadFollowups() {
  const date = followupsDate();
  const isStale = beginLoad("followups");
  let data;
  try {
    data = await api(`/admin/followups/counts?date=${encodeURIComponent(date)}`);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (isStale()) return;
    // api() has already reported it the way it reports every other failure; this only
    // keeps the section from sitting on numbers that are no longer the answer.
    showFollowupsMessage(
      e.status === 404 ? "عدّاد الشغل المستني مش متاح من السيرفر الحالي." : e.message,
    );
    return;
  }
  if (isStale()) return;
  renderFollowupsTable(data, date);
}

/** Puts one line in place of the rows, keeping the table's own empty-row treatment. */
function showFollowupsMessage(message) {
  const tbody = document.getElementById("followups-tbody");
  if (!tbody) return;
  document.getElementById("followups-empty").classList.add("hidden");
  document.getElementById("followups-wrap").classList.remove("hidden");
  tbody.innerHTML = `<tr><td colspan="7" class="empty-row">${esc(message)}</td></tr>`;
}

function renderFollowupsTable(data, date) {
  const tbody = document.getElementById("followups-tbody");
  if (!tbody) return;
  const wrap = document.getElementById("followups-wrap");
  const empty = document.getElementById("followups-empty");
  const reps = data.reps || [];
  const totals = data.totals || {};
  const grand = totals.total != null ? (Number(totals.total) || 0) + (Number(totals.attendance) || 0) : reps.reduce((s, r) => s + followupTotal(r), 0);
  setWorkloadTabCount("followups", grand);

  // Nothing waiting is an answer worth stating, not an empty grid to interpret.
  if (!reps.length || grand === 0) {
    tbody.innerHTML = "";
    wrap.classList.add("hidden");
    empty.classList.remove("hidden");
    empty.innerHTML = "";
    const head = document.createElement("strong");
    head.textContent = date === todayLocal() ? "مفيش شغل مستني النهاردة ✅" : "مفيش شغل مستني في اليوم ده ✅";
    const sub = document.createElement("div");
    sub.textContent = "مفيش متابعات ولا حجوزات ولا ليدز مستنية عند أي سيلز في اليوم ده.";
    empty.append(head, sub);
    return;
  }

  empty.classList.add("hidden");
  wrap.classList.remove("hidden");
  tbody.innerHTML = "";

  // The rep with uncalled leads is the one to chase, so they sort to the top.
  [...reps]
    .sort(
      (a, b) =>
        (Number(b.untouched) || 0) - (Number(a.untouched) || 0) ||
        followupTotal(b) - followupTotal(a) ||
        String(a.name || "").localeCompare(String(b.name || ""), "ar"),
    )
    .forEach((rep) => {
      const untouched = Number(rep.untouched) || 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(rep.name)}</td>
        <td>${groupLabel(rep.groupId)}</td>
        <td>${esc(Number(rep.scheduled) || 0)}</td>
        <td>${esc(Number(rep.bookings) || 0)}</td>
        <td></td>
        <td></td>
        <td>${esc(Number(rep.examined) || 0)}</td>
        <td><strong>${esc(followupTotal(rep))}</strong></td>`;
      // Same warning treatment the pool table gives a doctor with nobody linked to him.
      const untouchedCell = tr.children[4];
      if (untouched > 0) {
        untouchedCell.innerHTML = `<span class="badge" style="background:var(--warning-soft); color:var(--warning)">${esc(untouched)}</span>`;
      } else {
        untouchedCell.textContent = "0";
      }
      // Visits gone past with no تم الكشف / مجاش: they hold the rep's "مفيش شغل".
      const attendance = Number(rep.attendance) || 0;
      const attendanceCell = tr.children[5];
      if (attendance > 0) {
        attendanceCell.innerHTML = `<span class="badge" style="background:var(--warning-soft); color:var(--warning)">${esc(attendance)}</span>`;
      } else {
        attendanceCell.textContent = "0";
      }
      tbody.appendChild(tr);
    });

  const totalRow = document.createElement("tr");
  totalRow.innerHTML = `
    <td><strong>الإجمالي</strong></td>
    <td>—</td>
    <td><strong>${esc(Number(totals.scheduled) || 0)}</strong></td>
    <td><strong>${esc(Number(totals.bookings) || 0)}</strong></td>
    <td><strong>${esc(Number(totals.untouched) || 0)}</strong></td>
    <td><strong>${esc(Number(totals.attendance) || 0)}</strong></td>
    <td><strong>${esc(Number(totals.examined) || 0)}</strong></td>
    <td><strong>${esc(grand)}</strong></td>`;
  tbody.appendChild(totalRow);
}

/** The overview card: who has work waiting today, the ones with uncalled leads first. */
function renderFollowupsCard(data) {
  const list = document.getElementById("ov-followups");
  if (!list) return;
  if (!data) {
    renderActionList("ov-followups", "ov-followups-n", [], "عدّاد الشغل المستني مش متاح");
    return;
  }
  const reps = (data.reps || []).filter((r) => followupTotal(r) > 0);
  const rows = [...reps]
    .sort(
      (a, b) => (Number(b.untouched) || 0) - (Number(a.untouched) || 0) || followupTotal(b) - followupTotal(a),
    )
    .map((r) => {
      const untouched = Number(r.untouched) || 0;
      return {
        title: r.name,
        meta: `${followupTotal(r)} مستني${untouched ? ` — ${untouched} محدش كلمها ⚠` : ""}`,
      };
    });
  const alert = reps.some((r) => (Number(r.untouched) || 0) > 0);
  renderActionList("ov-followups", "ov-followups-n", rows, "مفيش شغل مستني النهاردة ✅", { alert });
  const totals = data.totals || {};
  const grand = totals.total != null ? Number(totals.total) || 0 : reps.reduce((s, r) => s + followupTotal(r), 0);
  document.getElementById("ov-followups-n").textContent = grand;
}

/* ---------------------------------------------------------------- Pool */

let poolCache = null; // last /admin/pool response, shared by the overview card and the table

/** Days since a stored 'YYYY-MM-DD HH:MM:SS' stamp, as a short Arabic phrase. */
function waitingSince(stamp) {
  if (!stamp) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(stamp));
  if (!m) return String(stamp);
  const then = new Date(+m[1], +m[2] - 1, +m[3]);
  const days = Math.max(0, Math.round((Date.now() - then.getTime()) / 86400000));
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (days === 0) return `النهاردة (${date})`;
  if (days === 1) return `إمبارح (${date})`;
  return `${days} يوم (${date})`;
}

/**
 * The per-doctor pool: what is waiting to be claimed, for how long, and whether anyone
 * is linked to claim it. Fed by GET /admin/pool; when that endpoint is missing the
 * table says so instead of staying blank.
 */
async function loadPool() {
  const isStale = beginLoad("pool");
  const tbody = document.getElementById("pool-tbody");
  const note = document.getElementById("pool-note");
  let doctors;
  try {
    ({ doctors } = await api("/admin/pool", { silent: true }));
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (isStale() || e.reported) return;
    poolCache = null;
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">${esc(
      e.status === 404 ? "بيانات المخزون مش متاحة من السيرفر الحالي." : e.message,
    )}</td></tr>`;
    renderPoolCard(null);
    return;
  }
  if (isStale()) return;
  poolCache = doctors || [];
  renderPoolTable(poolCache);
  renderPoolCard(poolCache);
  setWorkloadTabCount("pool", poolCache.reduce((s, d) => s + (d.unowned || 0), 0));
  if (note) {
    const total = poolCache.reduce((s, d) => s + (d.unowned || 0), 0);
    const stuck = poolCache.filter((d) => d.unowned > 0 && !(d.linkedReps || []).length).length;
    note.textContent =
      `${total} ليد في المخزون عند ${poolCache.filter((d) => d.unowned > 0).length} دكتور.` +
      (stuck ? ` ${stuck} دكتور عنده ليدز ومفيش سيلز مربوط بيه — محدش هيسحبها.` : "");
  }
}

function linkedRepNames(d) {
  const reps = d.linkedReps || [];
  return reps.map((r) => (typeof r === "string" ? r : r.name || r)).filter(Boolean);
}

function renderPoolTable(doctors) {
  const tbody = document.getElementById("pool-tbody");
  tbody.innerHTML = "";
  if (!doctors.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">مفيش دكاترة</td></tr>';
    return;
  }
  [...doctors]
    .sort((a, b) => (b.unowned || 0) - (a.unowned || 0))
    .forEach((d) => {
      const names = linkedRepNames(d);
      const stuck = d.unowned > 0 && names.length === 0;
      const tr = document.createElement("tr");
      if (stuck) tr.className = "warn-row";
      tr.innerHTML = `
        <td>${esc(d.name)}</td>
        <td>${groupLabel(d.groupId)}</td>
        <td><strong>${esc(d.unowned || 0)}</strong></td>
        <td>${d.unowned > 0 ? esc(waitingSince(d.oldestCreatedAt)) : "—"}</td>
        <td></td>
        <td></td>`;
      const repsCell = tr.children[4];
      if (names.length) repsCell.textContent = names.join("، ");
      else repsCell.innerHTML = '<span class="badge" style="background:var(--warning-soft); color:var(--warning)">مفيش</span>';
      if (stuck) {
        const link = document.createElement("button");
        link.className = "link-btn";
        link.textContent = "اربط سيلز ←";
        link.dataset.goto = "distribution";
        tr.lastElementChild.appendChild(link);
      }
      tbody.appendChild(tr);
    });
}

/** The overview card: doctors with anything waiting, the stuck ones first. */
function renderPoolCard(doctors) {
  const list = document.getElementById("ov-pool");
  if (!list) return;
  if (!doctors) {
    renderActionList("ov-pool", "ov-pool-n", [], "بيانات المخزون مش متاحة");
    return;
  }
  const rows = doctors
    .filter((d) => d.unowned > 0)
    .map((d) => {
      const names = linkedRepNames(d);
      return {
        title: d.name,
        meta: `${d.unowned} ليد — ${names.length ? `${names.length} سيلز` : "مفيش سيلز مربوط ⚠"}`,
        stuck: names.length === 0,
        n: d.unowned,
      };
    })
    .sort((a, b) => Number(b.stuck) - Number(a.stuck) || b.n - a.n);
  const stuck = rows.some((r) => r.stuck);
  renderActionList("ov-pool", "ov-pool-n", rows, "المخزون فاضي — كل الليدز اتسحبت ✓", { alert: stuck });
  document.getElementById("ov-pool-n").textContent = rows.reduce((s, r) => s + r.n, 0);
  // Stuck doctors link straight to the assignments page.
  [...list.querySelectorAll(".row")].forEach((row, i) => {
    if (rows[i] && rows[i].stuck) {
      row.style.cursor = "pointer";
      row.dataset.goto = "distribution";
      row.title = "اربط سيلز من صفحة التوزيع";
    }
  });
}

/**
 * Hands one rep's day to chosen colleagues, split evenly.
 *
 * Targets are offered as one checkbox per colleague rather than a multi-select, because
 * the choice is usually "everyone except the one who is out" and a list of checkboxes
 * makes that a glance instead of a ctrl-click.
 */
async function redistributeWorkload(rep, allWorkloadReps) {
  const colleagues = allWorkloadReps.filter((r) => r.id !== rep.id && r.groupId === rep.groupId);
  if (!colleagues.length) {
    // Leads never cross groups, so with nobody else in it the only way out is the pool -
    // which is offered here instead of a dead end.
    const ok = await confirmDialog("مفيش حد تاني في نفس المجموعة", {
      sub: "الليدز ماتقدرش تعدي لمجموعة تانية. تقدر ترجّعها للمخزون دلوقتي، وأول ما تربط سيلز تاني بنفس الدكتور من صفحة التوزيع هيسحبها.",
      confirmLabel: "رجّعها للمخزون",
      danger: false,
    });
    if (ok) await returnWorkloadToPool(rep);
    return;
  }

  const by = rep.activeByKind || {};
  const chosen = await pickReps({
    title: `توزيع ليدز ${rep.name}`,
    sub: `${rep.activeCount} ليد شغالة. اختار إيه اللي يتنقل، ومين ياخد، وكام واحدة.`,
    reps: colleagues,
    countField: { max: rep.activeCount },
    kinds: [
      { key: "new", label: "جديد (محدش كلمها)", count: by.new || 0 },
      { key: "no_answer", label: "لم يرد", count: by.no_answer || 0 },
      { key: "interested", label: "مهتم / مهتم جداً", count: by.interested || 0 },
      { key: "follow_up", label: "متابعة لاحقة", count: by.follow_up || 0 },
      { key: "booked", label: "محجوز (مع مكالمة التذكير)", count: by.booked || 0 },
    ],
  });
  if (!chosen || !chosen.ids.length) return;

  const data = await api("/admin/workload/redistribute", {
    method: "POST",
    body: { fromUserId: rep.id, toUserIds: chosen.ids, count: chosen.count, kinds: chosen.kinds },
  });

  const breakdown = (data.perRep || []).map((r) => `${r.name}: ${r.count}`).join("، ");
  const left = data.remainingCount ? ` (فاضل معاه ${data.remainingCount})` : "";
  toast(`اتوزع ${data.movedCount} ليد من ${data.fromName}${left} — ${breakdown}`, "good");
  loadWorkload();
  afterLeadsChanged();
}

/**
 * Sends a rep's open leads back to their doctor's shared pool instead of naming a
 * colleague to take them - for when nobody specific should get the work right now, or
 * the admin would rather let it flow back through normal claiming.
 */
async function returnWorkloadToPool(rep) {
  // Only the two kinds the pool hands out again can go back; the rest is named here so
  // the admin sees why the number is smaller than the rep's whole book.
  const by = rep.activeByKind || {};
  const returnable = (by.new || 0) + (by.no_answer || 0);
  const others = (by.interested || 0) + (by.follow_up || 0) + (by.booked || 0);
  if (!returnable) {
    return toast(`مفيش عند ${rep.name} ليدز جديدة أو «لم يرد» ترجع للمخزون${others ? ` - معاه ${others} مهتمة/متابعة/محجوزة، انقلها بالاسم من «وزّع ليدزه»` : ""}`, "bad");
  }
  const chosen = await pickReps({
    title: `ترجيع ليدز ${rep.name} للمخزون`,
    sub: `اللي يرجع للمخزون بيتسحب تاني من أي سيلز مربوط بالدكتور.${others ? ` المهتمة والمتابعة والمحجوزة (${others}) بتفضل معاه - انقلها بالاسم من «وزّع ليدزه».` : ""}`,
    reps: [],
    countField: { max: returnable },
    kinds: [
      { key: "new", label: "جديد (محدش كلمها)", count: by.new || 0 },
      { key: "no_answer", label: "لم يرد", count: by.no_answer || 0 },
    ],
    confirmLabel: "رجّعها",
  });
  if (!chosen) return;

  const data = await api("/admin/workload/return-to-pool", { method: "POST", body: { fromUserId: rep.id, kinds: chosen.kinds, count: chosen.count } });

  // The server keeps what it must (e.g. a lead with a live booking) and says so.
  toast(
    `رجع ${data.returnedCount} ليد من ${data.fromName || rep.name} للمخزون` +
      // keptCount is the interested/booked leads that stay with the rep - the word here
      // used to be "واتساب", a leftover that read as a WhatsApp count.
      (data.keptCount ? `، فاضل معاه ${data.keptCount} مهتمة أو محجوزة` : "") +
      (data.note ? `.\n${data.note}` : ""),
    "good",
  );
  loadWorkload();
  afterLeadsChanged();
}

/**
 * A checkbox list of reps in a dialog, optionally with a "how many leads" box.
 *
 * Resolves to `{ ids, count }`, or null if dismissed. `count` is undefined when the
 * caller did not ask for one, which the server reads as "all of them".
 */
function pickReps({ title, sub, reps, countField, kinds = null, confirmLabel = "وزّع" }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    const modal = document.createElement("div");
    modal.className = "modal";
    backdrop.appendChild(modal);

    const heading = document.createElement("h2");
    heading.textContent = title;
    const subEl = document.createElement("div");
    subEl.className = "sub";
    subEl.textContent = sub || "";
    modal.append(heading, subEl);

    const checkRow = (text, checked = true) => {
      const row = document.createElement("label");
      row.style.cssText = "display:flex; align-items:center; gap:9px; padding:7px 0; cursor:pointer";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.id = `dlg-field-${++dialogFieldSeq}`;
      row.htmlFor = box.id;
      box.checked = checked;
      box.style.cssText = "width:15px; height:15px; accent-color:var(--brand)";
      const span = document.createElement("span");
      span.textContent = text;
      row.append(box, span);
      return { row, box };
    };

    // What moves: any part of the book, not only all of it - "the follow-ups only" or
    // "the new ones only" - each with how many that is. Everything ticked by default.
    let kindBoxes = [];
    let countLabel = null;
    let countInput = null;
    const selectedMax = () => (kinds ? kindBoxes.filter((k) => k.box.checked).reduce((n, k) => n + k.count, 0) : countField ? countField.max : 0);
    const syncCount = () => {
      if (!countInput) return;
      const max = selectedMax();
      countLabel.textContent = `كام ليد تنقل؟ (الأقصى ${max})`;
      countInput.max = String(max);
      countInput.value = String(max);
    };
    if (kinds) {
      const head = document.createElement("div");
      head.style.cssText = "font-weight:600; margin:6px 0 2px";
      head.textContent = "إيه اللي يتنقل؟";
      modal.appendChild(head);
      kindBoxes = kinds.map((k) => {
        const { row, box } = checkRow(`${k.label} — ${k.count}`, k.count > 0);
        box.disabled = k.count === 0;
        box.addEventListener("change", syncCount);
        modal.appendChild(row);
        return { box, key: k.key, count: k.count };
      });
      if (reps.length) {
        const who = document.createElement("div");
        who.style.cssText = "font-weight:600; margin:12px 0 2px";
        who.textContent = "مين ياخدها؟";
        modal.appendChild(who);
      }
    }

    const boxes = reps.map((rep) => {
      const { row, box } = checkRow(`${rep.name} — معاه ${rep.activeCount} شغالة`);
      modal.appendChild(row);
      return { box, id: rep.id };
    });

    // Defaults to everything, so the common case - a full-day absence - is still one
    // click, and a partial hand-over is one number away.
    if (countField) {
      const wrap = document.createElement("div");
      wrap.className = "field";
      wrap.style.marginTop = "14px";
      countLabel = document.createElement("label");
      countInput = document.createElement("input");
      countInput.type = "number";
      countInput.id = `dlg-field-${++dialogFieldSeq}`;
      countLabel.htmlFor = countInput.id;
      countInput.min = "1";
      wrap.append(countLabel, countInput);
      modal.appendChild(wrap);
      syncCount();
    }

    const error = document.createElement("p");
    error.className = "error";
    modal.appendChild(error);

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const ok = document.createElement("button");
    ok.className = "primary";
    ok.textContent = confirmLabel;
    const cancel = document.createElement("button");
    cancel.textContent = "إلغاء";
    actions.append(ok, cancel);
    modal.appendChild(actions);

    let closeShell = null;
    const close = (result) => {
      if (closeShell) closeShell();
      closeShell = null;
      backdrop.remove();
      resolve(result);
    };
    const submit = () => {
      const chosenKinds = kinds ? kindBoxes.filter((k) => k.box.checked).map((k) => k.key) : undefined;
      if (kinds && !chosenKinds.length) {
        error.textContent = "اختار نوع واحد على الأقل من الليدز";
        return;
      }
      const ids = boxes.filter((b) => b.box.checked).map((b) => b.id);
      if (reps.length && !ids.length) {
        error.textContent = "اختار حد واحد على الأقل";
        return;
      }
      let count;
      if (countInput) {
        const max = selectedMax();
        count = Number(countInput.value);
        if (!Number.isInteger(count) || count < 1 || count > max) {
          error.textContent = `العدد لازم يكون بين 1 و ${max}`;
          return;
        }
      }
      close({ ids, count, kinds: chosenKinds });
    };
    ok.addEventListener("click", submit);
    cancel.addEventListener("click", () => close(null));

    heading.id = `dlg-title-${++dialogFieldSeq}`;
    modal.setAttribute("aria-labelledby", heading.id);
    document.body.appendChild(backdrop);
    closeShell = openModalShell(backdrop, {
      onDismiss: () => close(null),
      initialFocus: boxes[0] ? boxes[0].box : cancel,
      onEnter: submit,
    });
  });
}

/**
 * Shows what the system would change the backup links to, and applies it on approval.
 *
 * Nothing is written until the admin says so: this rearranges who works alongside whom,
 * which is a people decision the maths can inform but should not make on its own.
 */
async function suggestLinks() {
  const groupId = await pickGroupForSuggestion();
  if (groupId === null) return;

  const data = await api(`/admin/links/suggest?groupId=${groupId}`);

  const changed = data.changes.filter((c) => c.changed);
  if (!changed.length) {
    return toast("الربط الحالي كويس — مفيش اقتراح يتغير", "good");
  }

  const lines = changed.map(
    (c) =>
      `${c.repName} (أساسي: ${c.primaryDoctorName || "—"})\n` +
      `   احتياطي ١: ${c.secondaryDoctorName || "—"}\n` +
      `   احتياطي ٢: ${c.tertiaryDoctorName || "—"}`,
  );
  const volumes = data.doctors
    .filter((d) => d.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .map((d) => `${d.name}: ${d.volume} ليد / ${d.reps} سيلز`);

  const ok = await confirmDialog(`اقتراح الربط لمجموعة ${data.groupLabel}`, {
    sub:
      `أحجام الدكاترة (آخر ٤ أسابيع):\n${volumes.join("\n")}\n\n` +
      `${changed.length} سيلز هيتغير ربطهم الاحتياطي:\n\n${lines.join("\n\n")}\n\n` +
      "الدكتور الأساسي لكل واحد مش هيتغير.",
    confirmLabel: "طبّق",
    danger: false,
  });
  if (!ok) return;

  const applied = await api("/admin/links/apply", { method: "POST", body: { groupId } });
  toast(`اتغير ربط ${applied.changedCount} سيلز`, "good");
  loadAssignments();
  invalidate("doctors", "workload", "overview");
}

/** A team lead has exactly one group, so they are never asked which. */
async function pickGroupForSuggestion() {
  if (userRole === "team_lead") return "";
  return promptDialog("اقتراح الربط", {
    sub: "الاقتراح بيتحسب لكل مجموعة لوحدها، من أحجام دكاترتها الحقيقية.",
    label: "المجموعة",
    options: groupOptions(),
    confirmLabel: "احسب",
  });
}

/* ---------------------------------------------------------------- Attendance */

const ATTENDANCE_KIND_LABELS = { absent: "غايب", leave: "إجازة", permission: "إذن" };

/**
 * A UTC 'YYYY-MM-DD HH:MM:SS' stamp as a Cairo time of day. Attendance only ever shows a
 * time, and it used to print the raw stamp - three hours early, so a rep whose first call
 * was at 10:05 read as having started at 7:05.
 */
function timeOnly(stamp) {
  const at = utcStampToDate(stamp);
  return at ? splitDateTime(cairoWallStamp(at)).time : "—";
}

async function loadAttendance() {
  const dateInput = document.getElementById("attendance-date");
  if (!dateInput.value) dateInput.value = todayLocal();
  const monthInput = document.getElementById("attendance-month");
  if (!monthInput.value) monthInput.value = dateInput.value.slice(0, 7);

  // The three tables are independent; a failure in one must not hide the others.
  loadAttendanceSummary();
  loadTargets();
  loadBadges(dateInput.value);

  const isStale = beginLoad("attendance");
  const { reps, weeklyOff, noWorkRequired } = await api(`/admin/attendance?date=${dateInput.value}`);
  if (isStale()) return;

  const tbody = document.getElementById("attendance-tbody");
  tbody.innerHTML = "";
  reps.forEach((rep) => {
    const tr = document.createElement("tr");
    // A rep recorded away who was seen working is the contradiction this table exists
    // to show; it gets the row treatment rather than waiting to be noticed.
    if (rep.present && rep.record && rep.record.kind !== "permission") tr.className = "warn-row";
    tr.innerHTML = `
      <td>${esc(rep.name)}</td>
      <td>${groupLabel(rep.groupId)}</td>
      <td></td>
      <td>${esc(timeOnly(rep.firstAt))}</td>
      <td>${esc(timeOnly(rep.lastAt))}</td>
      <td>${esc(rep.events)}</td>
      <td>${rep.activeWorkSeconds ? esc(fmtDuration(rep.activeWorkSeconds)) : "—"}</td>
      <td></td>
      <td>${rep.record ? esc(recordLabel(rep.record)) : "—"}</td>
      <td></td>`;
    // The "مفيش شغل" presses: how many of the required, and at what times. The server
    // only accepts a press while there is nothing to pull and every tab is empty, so five
    // of them is the rep's proof the day was empty - and no lateness verdict any more.
    const presses = rep.noWorkPresses || [];
    const pressCell = tr.children[7];
    if (presses.length) {
      const done = presses.length >= (noWorkRequired || 5);
      pressCell.innerHTML = `<span class="badge" style="background:${done ? "var(--good-soft)" : "var(--warning-soft)"}; color:${done ? "var(--good)" : "var(--warning)"}">${esc(presses.length)} / ${esc(noWorkRequired || 5)}</span>`;
      pressCell.title = presses.map((p) => timeOnly(p)).join(" · ");
    } else {
      pressCell.textContent = "—";
    }

    // Observed activity and the recorded reason are shown side by side rather than one
    // overriding the other: a rep marked absent who logged twenty calls is worth seeing.
    const statusCell = tr.children[2];
    const pill = (text, bg, fg) => `<span class="badge" style="background:${bg}; color:${fg}">${esc(text)}</span>`;
    if (rep.present) {
      statusCell.innerHTML = pill("اشتغل", "var(--good-soft)", "var(--good)");
    } else if (rep.record && rep.record.kind !== "permission") {
      // Recorded away: the empty day is explained, not a finding.
      statusCell.innerHTML = pill(ATTENDANCE_KIND_LABELS[rep.record.kind], "var(--warning-soft)", "var(--warning)");
    } else if (weeklyOff) {
      statusCell.innerHTML = pill("إجازة أسبوعية", "var(--text-secondary-soft)", "var(--text-secondary)");
    } else if (dateInput.value > cairoToday()) {
      statusCell.innerHTML = pill("لسه مجاش", "var(--text-secondary-soft)", "var(--text-secondary)");
    } else if (dateInput.value === cairoToday()) {
      // Red at nine in the morning would call everybody absent; the day is still on.
      statusCell.innerHTML = pill("لسه مفيش نشاط", "var(--text-secondary-soft)", "var(--text-secondary)");
    } else {
      statusCell.innerHTML = pill("مفيش نشاط", "var(--critical-soft)", "var(--critical)");
    }

    if (canEditOperations()) {
      const cell = tr.lastElementChild;
      const btn = document.createElement("button");
      btn.textContent = rep.record ? "عدّل" : "سجّل";
      btn.addEventListener("click", () => recordAttendance(rep, dateInput.value));
      cell.appendChild(btn);
      if (rep.record) {
        const del = iconButton("🗑", "امسح التسجيل");
        del.style.marginInlineStart = "6px";
        del.addEventListener("click", () => deleteAttendance(rep, dateInput.value));
        cell.appendChild(del);
      }
    }
    tbody.appendChild(tr);
  });
}

// There is no third badge. A day the rep cannot be judged on - away, on leave, nothing
// to claim, or excused by hand - simply carries none, with the why beside it; "ملغي"
// used to be shown as a badge in its own right and read as a verdict.
const BADGE_LABELS = {
  good: { text: "ممتاز", bg: "var(--good-soft)", fg: "var(--good)" },
  bad: { text: "شد شوية", bg: "var(--critical-soft)", fg: "var(--critical)" },
  exempt: { text: "من غير بادج", bg: "var(--surface-2)", fg: "var(--text-secondary)" },
  pending: { text: "لسه في وقته", bg: "var(--text-secondary-soft)", fg: "var(--text-secondary)" },
};

// Why a day was exempted. `override` is the manual one recorded from this page.
const EXEMPT_SOURCE_LABELS = {
  weekly_off: "إجازة أسبوعية",
  config: "معطّل من الإعدادات",
  supply: "مفيش ليدز كانت متاحة",
  permission: "إذن أو إجازة",
  // A recorded absence/leave, or a day the system never saw the rep at all.
  attendance: "غياب أو إجازة",
  override: "استثناء يدوي",
};

/** The badge pill with, for an exempt day, a short label of why. */
function badgeText(b) {
  const style = BADGE_LABELS[b.status] || BADGE_LABELS.pending;
  const why = b.status === "exempt" && EXEMPT_SOURCE_LABELS[b.source] ? ` — ${EXEMPT_SOURCE_LABELS[b.source]}` : "";
  return { style, text: style.text + why };
}

async function loadBadges(dateOverride) {
  const dateInput = document.getElementById("badges-date");
  if (dateOverride) dateInput.value = dateOverride;
  if (!dateInput.value) dateInput.value = todayLocal();

  const isStale = beginLoad("badges");
  const { reps } = await api(`/admin/badges?date=${dateInput.value}`);
  if (isStale()) return;

  const tbody = document.getElementById("badges-tbody");
  tbody.innerHTML = "";
  reps.forEach((rep) => {
    const b = rep.badge;
    const { style, text } = badgeText(b);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="#" class="rep-history-link" title="التقرير اليومي يوم بيوم">${esc(rep.name)}</a></td>
      <td>${groupLabel(rep.groupId)}</td>
      <td><span class="badge" style="background:${style.bg}; color:${style.fg}">${esc(text)}</span></td>
      <td>${esc(targetLabel(b))}</td>
      <td>${esc(progressLabel(b))}</td>
      <td style="max-width:260px; white-space:normal">${esc(b.reason || "")}</td>
      <td></td>`;
    tr.querySelector(".rep-history-link").addEventListener("click", (e) => {
      e.preventDefault();
      showMonthly(rep.id);
    });

    if (canEditOperations()) {
      const cell = tr.lastElementChild;
      const edit = document.createElement("button");
      edit.textContent = b.source === "override" ? "عدّل" : "عدّل البادج";
      edit.addEventListener("click", () => editBadge(rep, dateInput.value, b));
      cell.appendChild(edit);
      if (b.source === "override") {
        const clear = document.createElement("button");
        clear.textContent = "رجّع الحساب التلقائي";
        clear.style.marginInlineStart = "6px";
        clear.addEventListener("click", () => clearBadgeOverride(rep, dateInput.value));
        cell.appendChild(clear);
      }
    }
    tbody.appendChild(tr);
  });
}

/** "٨٠ مكالمة · ٦٠ د" - the standing target as the table shows it. */
function targetLabel(b) {
  const parts = [];
  if (b.callsTarget != null) parts.push(`${b.callsTarget} مكالمة`);
  if (b.minutesTarget != null) parts.push(`${b.minutesTarget} د`);
  return parts.length ? parts.join(" · ") : "—";
}

/** What the phone reported against each part of the target. */
function progressLabel(b) {
  if (b.callsTarget == null && b.minutesTarget == null) return "—";
  const parts = [];
  if (b.callsTarget != null) parts.push(`${b.calls ?? 0}/${b.callsTarget} مكالمة`);
  if (b.minutesTarget != null) parts.push(`${b.minutes ?? 0}/${b.minutesTarget} د`);
  return parts.join(" · ");
}

/**
 * The admin's word on a day: hand out either badge, or take the day out of the count,
 * with a reason the rep can read. Replaces the older exempt-only override.
 */
async function editBadge(rep, date, current) {
  const values = await openDialog({
    title: `بادج ${rep.name} — ${date}`,
    sub: "اللي تختاره هنا هو اللي يتحسب، مهما كانت الأرقام. السبب بيظهر في الجدول.",
    confirmLabel: "حفظ",
    fields: [
      {
        name: "status",
        label: "البادج",
        type: "select",
        value: current.source === "override" ? current.status : "exempt",
        options: [
          { value: "good", label: "ممتاز" },
          { value: "bad", label: "شد شوية" },
          { value: "exempt", label: "من غير بادج - اليوم مش محسوب" },
        ],
      },
      { name: "reason", label: "السبب", required: true, value: current.source === "override" ? current.reason || "" : "" },
    ],
  });
  if (!values) return;
  await api(`/admin/badges/${rep.id}/override`, { method: "POST", body: { date, reason: values.reason, status: values.status } });
  toast("اتحفظ البادج", "good");
  loadBadges(date);
  // The month tally counts overrides too; it stayed on the old numbers until a reload.
  loadAttendanceSummary();
  dirtyViews.add("overview");
}

async function clearBadgeOverride(rep, date) {
  if (!(await confirmDialog(`ترجّع بادج ${rep.name} ليوم ${date} للحساب التلقائي؟`))) return;
  await api(`/admin/badges/${rep.id}/override?date=${date}`, { method: "DELETE" });
  toast("رجع الحساب التلقائي", "good");
  loadBadges(date);
  loadAttendanceSummary();
  dirtyViews.add("overview");
}

/* ---------------------------------------------------------------- Targets */

async function loadTargets() {
  const isStale = beginLoad("targets");
  const { reps } = await api("/admin/targets");
  if (isStale()) return;
  const tbody = document.getElementById("targets-tbody");
  tbody.innerHTML = "";
  reps.forEach((rep) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(rep.name)}</td>
      <td>${groupLabel(rep.groupId)}</td>
      <td></td>
      <td></td>
      <td>${esc(rep.todayCalls)} مكالمة · ${esc(rep.todayMinutes)} د</td>
      <td></td>`;
    const calls = numberInput(rep.callsTarget, "مثلاً 80");
    const minutes = numberInput(rep.minutesTarget, "مثلاً 60");
    tr.children[2].appendChild(calls);
    tr.children[3].appendChild(minutes);
    if (canEditOperations()) {
      const save = document.createElement("button");
      save.textContent = "حفظ";
      save.addEventListener("click", async () => {
        save.disabled = true;
        try {
          await api(`/admin/targets/${rep.id}`, {
            method: "PUT",
            body: { callsTarget: calls.value === "" ? null : Number(calls.value), minutesTarget: minutes.value === "" ? null : Number(minutes.value) },
          });
          toast(`اتحفظ هدف ${rep.name}`, "good");
          dirtyViews.add("overview");
          loadBadges();
        } finally {
          save.disabled = false;
        }
      });
      tr.lastElementChild.appendChild(save);
    } else {
      calls.disabled = true;
      minutes.disabled = true;
    }
    tbody.appendChild(tr);
  });
  if (!reps.length) tbody.innerHTML = '<tr><td colspan="6" class="empty-row">مفيش سيلز</td></tr>';
}

function numberInput(value, placeholder) {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.placeholder = placeholder;
  input.style.width = "110px";
  input.value = value == null ? "" : String(value);
  return input;
}

/** The same target for everybody in scope. Empty fields mean "no such condition" for everybody. */
async function setTargetForAll() {
  const values = await openDialog({
    title: "هدف واحد لكل السيلز",
    sub: "هيتكتب على كل سيلز موجود. سيب خانة فاضية لو مش عايز الشرط ده.",
    confirmLabel: "طبّق على الكل",
    fields: [
      { name: "calls", label: "مكالمات في اليوم", placeholder: "مثلاً 80" },
      { name: "minutes", label: "دقايق كلام في اليوم", placeholder: "مثلاً 60" },
    ],
  });
  if (!values) return;
  const data = await api("/admin/targets", {
    method: "PUT",
    body: { callsTarget: values.calls === "" ? null : Number(values.calls), minutesTarget: values.minutes === "" ? null : Number(values.minutes) },
  });
  toast(`اتحط الهدف لـ ${data.updated} سيلز`, "good");
  loadTargets();
  loadBadges();
  dirtyViews.add("overview");
}

function recordLabel(record) {
  const base = ATTENDANCE_KIND_LABELS[record.kind] || record.kind;
  const window = record.fromTime && record.toTime ? ` (${record.fromTime} - ${record.toTime})` : "";
  const note = record.note ? ` — ${record.note}` : "";
  return base + window + note;
}

async function recordAttendance(rep, date) {
  const values = await openDialog({
    title: `تسجيل لـ ${rep.name}`,
    sub: date,
    confirmLabel: "حفظ",
    fields: [
      {
        name: "kind",
        label: "النوع",
        type: "select",
        value: rep.record ? rep.record.kind : "absent",
        options: [
          { value: "absent", label: "غايب" },
          { value: "leave", label: "إجازة" },
          { value: "permission", label: "إذن (جزء من اليوم)" },
        ],
      },
      { name: "fromTime", label: "من (للإذن بس)", placeholder: "14:00", value: rep.record?.fromTime || "" },
      { name: "toTime", label: "إلى (للإذن بس)", placeholder: "17:00", value: rep.record?.toTime || "" },
      { name: "note", label: "ملاحظة", value: rep.record?.note || "" },
    ],
  });
  if (!values) return;

  await api("/admin/attendance", { method: "POST", body: { userId: rep.id, date, ...values } });
  toast(`اتسجل ${ATTENDANCE_KIND_LABELS[values.kind]} لـ ${rep.name}`, "good");
  loadAttendance();
  dirtyViews.add("overview");
}

async function deleteAttendance(rep, date) {
  if (!(await confirmDialog("مسح التسجيل", { sub: `${rep.name} — ${date}`, confirmLabel: "امسح" }))) return;
  await api(`/admin/attendance?userId=${rep.id}&date=${date}`, { method: "DELETE" });
  toast("اتمسح التسجيل", "good");
  loadAttendance();
  dirtyViews.add("overview");
}

async function loadAttendanceSummary() {
  const month = document.getElementById("attendance-month").value;
  if (!month) return;
  const isStale = beginLoad("attendance-summary");
  const { reps } = await api(`/admin/attendance/summary?month=${month}`);
  if (isStale()) return;

  const tbody = document.getElementById("attendance-summary-tbody");
  tbody.innerHTML = "";
  reps.forEach((rep) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(rep.name)}</td>
      <td>${groupLabel(rep.groupId)}</td>
      <td>${esc(rep.workedDays)}</td>
      <td>${esc(rep.absent)}</td>
      <td>${esc(rep.leave)}</td>
      <td>${esc(rep.permission)}</td>
      <td>${esc(rep.weeklyOff ?? "—")}</td>
      <td>${rep.noWorkDays ? `<span class="badge" style="background:var(--good-soft); color:var(--good)">${esc(rep.noWorkDays)}</span>` : "0"}</td>
      <td>${rep.goodBadges ? `<span class="badge" style="background:var(--good-soft); color:var(--good)">${esc(rep.goodBadges)}</span>` : "0"}</td>
      <td>${rep.badBadges ? `<span class="badge" style="background:var(--critical-soft); color:var(--critical)">${esc(rep.badBadges)}</span>` : "0"}</td>`;
    tbody.appendChild(tr);
  });
}

const WEEKDAY_NAMES = ["الأحد", "الإتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];

/** Which days of the week the business is shut - no absence, no badge, no lateness on them. */
async function editWeeklyOff() {
  const { days } = await api("/admin/settings/weekly-off");
  const values = await openDialog({
    title: "أيام الإجازة الأسبوعية",
    sub: "اليوم اللي إجازة مابيتحسبش غياب ولا تأخير ومابياخدش بادج.",
    confirmLabel: "حفظ",
    fields: WEEKDAY_NAMES.map((name, i) => ({
      name: `d${i}`,
      label: name,
      type: "select",
      value: days.includes(i) ? "off" : "work",
      options: [
        { value: "work", label: "شغل" },
        { value: "off", label: "إجازة" },
      ],
    })),
  });
  if (!values) return;
  const chosen = WEEKDAY_NAMES.map((_, i) => i).filter((i) => values[`d${i}`] === "off");
  await api("/admin/settings/weekly-off", { method: "PUT", body: { days: chosen } });
  toast(chosen.length ? `أيام الإجازة: ${chosen.map((i) => WEEKDAY_NAMES[i]).join("، ")}` : "مفيش إجازة أسبوعية", "good");
  loadAttendance();
  dirtyViews.add("overview");
}

/** Records an absence for whoever the admin picks, without going row by row. */
async function recordAttendanceForAnyone() {
  const reps = allReps.length ? allReps : [];
  if (!reps.length) return toast("مفيش سيلز", "bad");
  const date = document.getElementById("attendance-date").value || todayLocal();
  const userId = await promptDialog("سجّل غياب أو إذن", {
    sub: date,
    label: "السيلز",
    options: reps.map((r) => ({ value: String(r.id), label: r.name })),
    confirmLabel: "التالي",
  });
  if (!userId) return;
  const rep = reps.find((r) => String(r.id) === userId);
  await recordAttendance({ id: rep.id, name: rep.name, record: null }, date);
}

async function loadAssignments() {
  const isStale = beginLoad("assignments");
  const data = await api("/admin/assignments");
  if (isStale()) return;

  document.getElementById("assignments-note").textContent =
    `التوزيع يومي وبالتساوي بين كل اللي موجودين. أرقام آخر ${data.windowDays} أيام (من ${data.windowFrom}) للعلم بس — ` +
    `مابتأثرش على النصيب. اللي مسجّل غياب أو إجازة النهاردة مابياخدش ليدز.`;

  // Reused by the reminder reassign dropdowns rather than refetching the roster.
  allReps = data.reps;
  fillRepFilter();

  const tbody = document.getElementById("assignments-tbody");
  tbody.innerHTML = "";

  data.reps.forEach((rep) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(rep.name)}</td>
      <td>${groupLabel(rep.groupId)}</td>
      <td></td>
      <td></td>
      <td></td>
      <td>${esc(rep.recentCalls)}</td>
      <td>${esc(rep.recentBookings)}</td>
      <td>${esc(rep.leadsToday)}</td>
    `;
    const cells = tr.querySelectorAll("td");
    cells[2].appendChild(doctorSelect(rep, "primary"));
    cells[3].appendChild(doctorSelect(rep, "secondary"));
    cells[4].appendChild(doctorSelect(rep, "tertiary"));
    tbody.appendChild(tr);
  });
}

const DOCTOR_SLOT_FIELD = { primary: "primaryDoctorId", secondary: "secondaryDoctorId", tertiary: "tertiaryDoctorId" };

// Only the rep's own group is offered: leads never cross groups, so a link outside it
// would silently never fire, and the server rejects it anyway.
function doctorSelect(rep, which) {
  const sel = document.createElement("select");
  const current = rep[DOCTOR_SLOT_FIELD[which]];

  const none = document.createElement("option");
  none.value = "";
  none.textContent = which === "primary" ? "— مش محدد —" : "— بدون —";
  sel.appendChild(none);

  allDoctors
    .filter((d) => d.groupId == null || rep.groupId == null || d.groupId === rep.groupId)
    .forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.name;
      if (d.id === current) opt.selected = true;
      sel.appendChild(opt);
    });

  const SLOT_LABELS = { primary: "الأساسي", secondary: "الاحتياطي ١", tertiary: "الاحتياطي ٢" };
  sel.setAttribute("aria-label", `الدكتور ${SLOT_LABELS[which]} لـ ${rep.name}`);

  if (!canEditOperations()) {
    sel.disabled = true;
    return sel;
  }

  sel.addEventListener("change", async () => {
    const previous = current == null ? "" : String(current);
    const chosen = sel.value ? allDoctors.find((d) => String(d.id) === sel.value) : null;
    const before = current ? allDoctors.find((d) => d.id === current) : null;

    // The link decides which pool this rep can claim from, so the effect is spelled out
    // before it is written - and a "no" puts the select back where it was.
    const ok = await confirmDialog(`تغيير الدكتور ${SLOT_LABELS[which]} لـ ${rep.name}`, {
      sub:
        (before ? `من: ${before.name}\n` : "من: — مش محدد —\n") +
        (chosen ? `إلى: ${chosen.name}\n\n` : "إلى: — بدون —\n\n") +
        (chosen
          ? `${rep.name} هيقدر يسحب من مخزون ${chosen.name} من دلوقتي${which === "primary" ? " كأولوية أولى" : ""}.`
          : `${rep.name} مش هيقدر يسحب من مخزون ${before ? before.name : "الدكتور ده"} تاني.`) +
        (before && chosen ? `\nوالليدز اللي معاه حالياً من ${before.name} بتفضل معاه زي ما هي.` : ""),
      confirmLabel: "غيّر",
      danger: false,
    });
    if (!ok) {
      sel.value = previous;
      return;
    }

    const body = {
      primaryDoctorId: rep.primaryDoctorId,
      secondaryDoctorId: rep.secondaryDoctorId,
      tertiaryDoctorId: rep.tertiaryDoctorId,
    };
    body[DOCTOR_SLOT_FIELD[which]] = sel.value || null;
    sel.disabled = true;
    try {
      const data = await api(`/admin/reps/${rep.id}/doctors`, { method: "POST", body });
      rep.primaryDoctorId = data.primaryDoctorId;
      rep.secondaryDoctorId = data.secondaryDoctorId;
      rep.tertiaryDoctorId = data.tertiaryDoctorId;
      toast(`اتغير ربط ${rep.name}`, "good");
      invalidate("doctors", "workload", "overview");
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      sel.value = previous;
      loadAssignments();
    } finally {
      sel.disabled = false;
    }
  });
  return sel;
}

// No floor on any password (owner, 2026-09-20) - only "not empty". Mirrors the server.
function myMinPasswordLength() {
  return 1;
}

function openMyPasswordModal() {
  const min = myMinPasswordLength();
  document.getElementById("password-modal-sub").textContent =
    `${ROLE_LABELS[userRole] || userRole}`;
  ["pw-current", "pw-new", "pw-confirm"].forEach((id) => (document.getElementById(id).value = ""));
  document.getElementById("pw-error").textContent = "";
  showStaticModal("password-modal", {
    onDismiss: closeMyPasswordModal,
    initialFocus: document.getElementById("pw-current"),
    onEnter: saveMyPassword,
  });
}

function closeMyPasswordModal() {
  // Don't leave the typed password sitting in the DOM after closing.
  ["pw-current", "pw-new", "pw-confirm"].forEach((id) => (document.getElementById(id).value = ""));
  hideStaticModal("password-modal");
}

async function saveMyPassword() {
  const err = (m) => (document.getElementById("pw-error").textContent = m);
  const currentPassword = document.getElementById("pw-current").value;
  const newPassword = document.getElementById("pw-new").value;
  const confirmPassword = document.getElementById("pw-confirm").value;
  const min = myMinPasswordLength();

  if (!currentPassword) return err("اكتب كلمة السر الحالية");
  if (newPassword.length < min) return err("اكتب كلمة السر الجديدة");
  if (newPassword !== confirmPassword) return err("الكلمتين مش متطابقتين");

  const btn = document.getElementById("pw-save-btn");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "جاري الحفظ...";
  err("");

  try {
    await api("/me/password", { method: "POST", body: { currentPassword, newPassword }, silent: true });

    // Changing a password revokes every session for the account, including this one,
    // so there is nothing to return to - send them back to the login screen.
    closeMyPasswordModal();
    toast("اتغيّرت كلمة السر. سجّل دخول من تاني بالكلمة الجديدة.", "good");
    logout();
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (!e.reported) err(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

/** An account is active unless the server says otherwise (older servers omit the field). */
const isActiveUser = (u) => u.active === undefined || u.active === null || Boolean(u.active);

async function loadStaff() {
  if (!isSuperAdmin()) return;
  const isStale = beginLoad("staff");
  const { users, currentUserId } = await api("/admin/users");
  if (isStale()) return;

  const tbody = document.getElementById("staff-tbody");
  tbody.innerHTML = "";
  users.forEach((u) => {
    const active = isActiveUser(u);
    const tr = document.createElement("tr");
    if (!active) tr.className = "inactive-row";
    tr.innerHTML = `
      <td>${esc(u.name)}${active ? "" : ' <span class="badge" style="background:var(--surface-3); color:var(--text-secondary)">موقوف</span>'}${u.unrestricted ? ' <span class="badge" style="background:var(--warning); color:#000" title="بيسحب ليدز في أي وقت ومن غير قيود الفريق">بدون قيود</span>' : ""}</td>
      <td>${esc(u.phone)}</td>
      <td>${esc(ROLE_LABELS[u.role] || u.role)}</td>
      <td>${groupLabel(u.groupId)}</td>
      <td></td>
    `;
    const cell = tr.lastElementChild;

    if (!active) {
      // A stopped account keeps its history; this is how it comes back.
      const reBtn = document.createElement("button");
      reBtn.textContent = "تفعيل تاني";
      reBtn.addEventListener("click", () => reactivateUser(u));
      cell.appendChild(reBtn);
      tbody.appendChild(tr);
      return;
    }

    const pwBtn = document.createElement("button");
    pwBtn.textContent = "باسورد";
    pwBtn.addEventListener("click", () => resetRepPassword(u));
    cell.appendChild(pwBtn);

    // Lifting the floor's rules for one sales account (owner, 2026-09-21).
    if (u.role === "sales") {
      const freeBtn = document.createElement("button");
      freeBtn.textContent = u.unrestricted ? "رجّع القيود" : "بدون قيود";
      freeBtn.style.marginInlineStart = "6px";
      freeBtn.addEventListener("click", () => toggleUnrestricted(u));
      cell.appendChild(freeBtn);
    }

    // Deleting yourself would lock the business out of account management entirely.
    if (u.id !== currentUserId) {
      const delBtn = document.createElement("button");
      delBtn.textContent = "مسح";
      delBtn.style.marginInlineStart = "6px";
      delBtn.style.color = "var(--critical)";
      delBtn.addEventListener("click", () => deleteUser(u));
      cell.appendChild(delBtn);
    }
    tbody.appendChild(tr);
  });

  bulkAttach("staff", "staff-tbody", users, [
    {
      label: "حذف",
      danger: true,
      run: async (ids) => {
        // The logged-in account is never offered up for deletion by a stray select-all.
        const targets = ids.filter((id) => id !== currentUserId);
        if (!targets.length) return toast("مينفعش تمسح حسابك", "bad");
        const ok = await confirmDialog("حذف الحسابات المتحددة", {
          sub: `${targets.length} حساب. الحساب بيتوقف ومبيقدرش يدخل، وبيفضل ظاهر هنا عشان يتفعّل تاني لو لزم. اللي عنده عملاء هيتوزعوا على باقي مجموعته.`,
          confirmLabel: "امسح",
        });
        if (!ok) return;
        const results = await Promise.allSettled(
          targets.map((id) => api(`/admin/users/${id}`, { method: "DELETE", silent: true })),
        );
        const done = results.filter((r) => r.status === "fulfilled").length;
        toast(`اتمسح ${done} حساب` + (done < targets.length ? `، ${targets.length - done} فشلوا` : ""), done ? "good" : "bad");
        bulkClear("staff");
        loadStaff();
        afterRosterChanged();
      },
    },
  ]);
}

async function deleteUser(user) {
  const label = `${user.name} (${ROLE_LABELS[user.role] || user.role})`;

  // A rep leaves with work in hand. Ask who takes it before the account goes, rather
  // than letting thirty interested clients sit on a stopped account until noticed.
  let transferToUserId = null;
  let handover = "";
  if (user.role === "sales") {
    const p = await api(`/admin/users/${user.id}/deactivation-preview`);
    const open = p.transferable + p.pendingReminderCalls + p.pendingFollowUps;
    if (open > 0) {
      const sub =
        `${p.transferable} ليد شغالة (مهتم/متابعة/محجوز)، ${p.pendingReminderCalls} مكالمة تذكير مستنية، ${p.pendingFollowUps} متابعة جاية.\n` +
        `الجديد و"مردّش" (${p.returnable}) بيرجعوا لمخزون الدكتور لوحدهم.` +
        (p.candidates.length ? "" : "\nمفيش سيلز تاني في مجموعته يستلمهم.");
      const choice = await promptDialog(`مين يستلم شغل ${user.name}؟`, {
        sub,
        label: "السيلز",
        options: [
          ...p.candidates.map((c) => ({ value: String(c.id), label: c.name })),
          { value: "keep", label: "سيبهم على حسابه (مش مستحب)" },
        ],
        confirmLabel: "التالي",
      });
      if (!choice) return;
      if (choice !== "keep") {
        transferToUserId = Number(choice);
        handover = ` وشغله هيروح لـ ${p.candidates.find((c) => String(c.id) === choice)?.name || "زميله"}`;
      }
    }
  }

  const ok = await confirmDialog(`حذف ${label}`, {
    sub: `الحساب بيتوقف ومبيقدرش يدخل، وبيفضل ظاهر هنا عشان تقدر تفعّله تاني لو لزم${handover}.`,
    confirmLabel: "امسح",
  });
  if (!ok) return;

  const data = await api(`/admin/users/${user.id}`, { method: "DELETE", body: transferToUserId ? { transferToUserId } : undefined });
  const parts = [`اتمسح ${user.name}.`];
  if (data.returnedLeads) parts.push(`رجع ${data.returnedLeads} ليد للمخزون.`);
  if (data.transferredLeads) parts.push(`اتنقل ${data.transferredLeads} ليد و${data.movedReminderCalls || 0} مكالمة تذكير لـ ${data.transferredTo?.name || "زميله"}.`);
  if (data.keptLeads) parts.push(`فاضل على حسابه ${data.keptLeads} ليد (مقفولة أو ماتنقلتش).`);
  toast(parts.join(" "), "good");
  loadStaff();
  afterRosterChanged();
}

async function reactivateUser(user) {
  const ok = await confirmDialog(`تفعيل ${user.name} تاني`, {
    sub: "الحساب هيرجع يقدر يدخل بنفس كلمة السر القديمة. غيّرها بعدها لو كانت اتوزعت.",
    confirmLabel: "فعّل",
    danger: false,
  });
  if (!ok) return;
  await api(`/admin/users/${user.id}`, { method: "PATCH", body: { active: true } });
  toast(`اتفعّل ${user.name} تاني`, "good");
  loadStaff();
  afterRosterChanged();
}

async function addUser() {
  // One form instead of five chained prompts, so the role is picked from a list rather
  // than spelled correctly from memory, and backing out costs one click not five.
  const values = await openDialog({
    title: "حساب جديد",
    confirmLabel: "إنشاء",
    fields: [
      { name: "name", label: "اسم الموظف", required: true },
      {
        name: "role",
        label: "الصلاحية",
        type: "select",
        value: "sales",
        options: [
          { value: "sales", label: "سيلز" },
          { value: "team_lead", label: "رئيس فريق" },
          { value: "admin", label: "أدمن" },
        ],
      },
      { name: "phone", label: "رقم التليفون", type: "tel", required: true, placeholder: "01xxxxxxxxx" },
      {
        name: "password",
        label: "كلمة المرور",
        type: "password",
        required: true,
      },
      {
        name: "groupId",
        label: "المجموعة",
        type: "select",
        options: groupOptions(),
        hint: "بتتجاهل لو الصلاحية أدمن",
      },
    ],
  });
  if (!values) return;

  await api("/admin/users", {
    method: "POST",
    // An admin has no group; sending one anyway would be a value the server has to ignore.
    body: { ...values, groupId: values.role === "admin" ? null : values.groupId },
  });
  toast(`اتعمل حساب ${values.name} بصلاحية ${ROLE_LABELS[values.role]}`, "good");
  loadStaff();
  afterRosterChanged();
}

async function addRep() {
  const values = await openDialog({
    title: "سيلز جديد",
    confirmLabel: "إنشاء",
    fields: [
      { name: "name", label: "الاسم", required: true },
      { name: "phone", label: "رقم التليفون", type: "tel", required: true, placeholder: "01xxxxxxxxx" },
      { name: "password", label: "كلمة المرور", type: "password", required: true },
      { name: "groupId", label: "المجموعة", type: "select", options: groupOptions() },
    ],
  });
  if (!values) return;

  await api("/admin/reps", { method: "POST", body: values });
  toast(`اتضاف ${values.name}`, "good");
  loadStaff();
  afterRosterChanged();
}

/**
 * Resets someone else's password. Two fields and a client-side length check, because a
 * typo here locks the rep out of the app (the reset revokes their sessions) until an
 * admin notices and tries again.
 */
async function toggleUnrestricted(u) {
  const on = !u.unrestricted;
  const ok = await openDialog({
    title: on ? "حساب بدون قيود" : "رجوع القيود",
    sub: on
      ? `${u.name}\nهيسحب ليدز في أي ساعة وحتى لو معاه ليدز مكلمهاش، وهيسجل أي نتيجة من غير ما السيستم يطلب مكالمة، وليدزه مش هترجع للسيستم آخر اليوم.`
      : `${u.name}\nهيرجع عليه نفس قواعد باقي الفريق.`,
    confirmLabel: on ? "فعّل" : "رجّع القيود",
    fields: [],
  });
  if (!ok) return;
  try {
    await api(`/admin/users/${u.id}/unrestricted`, { method: "POST", body: { on } });
    toast(on ? "الحساب بقى بدون قيود" : "القيود رجعت", "good");
    loadStaff();
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    toast(e.message, "bad");
  }
}

async function resetRepPassword(rep) {
  const values = await openDialog({
    title: "تغيير الباسورد",
    sub: `${rep.name}\nالموظف هيتسجل خروجه من التطبيق فوراً وهيحتاج يدخل بالباسورد الجديد.`,
    confirmLabel: "غيّر الباسورد",
    fields: [
      { name: "newPassword", label: "الباسورد الجديد", type: "password", required: true, autocomplete: "new-password" },
      { name: "confirmPassword", label: "أعد كتابة الباسورد", type: "password", required: true, autocomplete: "new-password" },
    ],
    validate: (v) => {
      if (v.newPassword !== v.confirmPassword) return "الكلمتين مش متطابقتين";
      return null;
    },
  });
  if (!values) return;
  await api(`/admin/reps/${rep.id}/password`, { method: "POST", body: { newPassword: values.newPassword } });
  toast(`اتغيّر باسورد ${rep.name} — هيحتاج يدخل التطبيق من تاني`, "good");
}

async function showMonthly(repId) {
  const data = await api(`/admin/reps/${repId}/monthly`);

  const byStatus = Object.fromEntries(data.statusBreakdown.map((s) => [s.status, s.c]));
  // unreachable is an outcome the rep logs (the close after the two-day chase); without it
  // the breakdown added up to fewer than the tile above it.
  const order = ["very_interested", "interested", "booked", "examined", "no_show", "follow_up", "not_interested", "no_answer", "unreachable"];

  document.getElementById("monthly-content").innerHTML = `
    <h2 style="margin:0 0 4px">${esc(data.rep.name)}</h2>
    <div style="color:var(--text-secondary); font-size:13px; margin-bottom:16px">${esc(data.rep.phone)} — شهر ${esc(data.month)}</div>

    <div style="font-size:13px; color:var(--text-secondary); margin-bottom:6px">الدكاترة المربوط بيهم:</div>
    <div style="margin-bottom:16px">${data.doctors.map((d) => esc(d.name)).join("، ") || "مش مربوط بأي دكتور - اربطه من صفحة التوزيع"}</div>

    <div class="tiles" style="grid-template-columns:repeat(3,1fr); margin-bottom:16px">
      <div class="tile"><div class="value">${esc(data.totalCalls)}</div><div class="label">نتايج مسجلة في التطبيق</div></div>
      <div class="tile"><div class="value">${esc(data.dailyTotals.outboundAnswered ?? data.dailyTotals.answeredCount)}</div><div class="label">صادر اتردّ (من التليفون)</div></div>
      <div class="tile"><div class="value">${esc(data.dailyTotals.outboundUnanswered ?? data.dailyTotals.noAnswerCount)}</div><div class="label">صادر لم يرد (من التليفون)</div></div>
      <div class="tile"><div class="value">${esc(data.dailyTotals.inbound ?? 0)}</div><div class="label">وارد</div></div>
      <div class="tile"><div class="value">${esc(fmtDuration(data.dailyTotals.outboundTalkSeconds ?? data.dailyTotals.talkSeconds))}</div><div class="label">وقت الكلام (صادر)</div></div>
      <div class="tile"><div class="value">${esc(data.dailyTotals.daysActive)}</div><div class="label">أيام وصل عنها تقرير</div></div>
    </div>

    <div style="font-size:13px; color:var(--text-secondary); margin-bottom:6px">تفصيل النتايج:</div>
    ${order
      .filter((k) => byStatus[k])
      .map((k) => `<div>${esc(STATUS_LABELS[k])}: ${esc(byStatus[k])}</div>`)
      .join("") || "<div>مفيش نتايج مسجلة الشهر ده</div>"}

    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:22px">
      <strong style="font-size:15px">التقرير اليومي — يوم بيوم</strong>
      <label style="font-size:13px">من <input type="date" id="rep-daily-from"></label>
      <label style="font-size:13px">إلى <input type="date" id="rep-daily-to"></label>
      <button id="rep-daily-load">عرض</button>
    </div>
    <div style="font-size:12.5px; color:var(--text-muted); margin:6px 0 8px">
      الأرقام دي بتيجي من تليفون الموظف تلقائياً: كل نص ساعة في الخلفية، وأول ما يفتح التطبيق بيبعت آخر ٧ أيام كمان. الهدف اللي بيتحسب عليه هو الهدف الحالي.
    </div>
    <div id="rep-daily-summary" style="font-size:13px; color:var(--text-secondary); margin-bottom:8px"></div>
    <div class="table-wrap" style="max-height:52vh; overflow:auto">
      <table>
        <thead><tr>
          <th>اليوم</th><th>البادج</th><th title="مكالمات الموظف الصادرة، من سجل التليفون">صادر (رد · لم يرد)</th><th title="المكالمات اللي جاتله ورد عليها - الفايتة في سجل المكالمات بس">وارد</th><th title="في المكالمات الصادرة">وقت الكلام</th>
          <th>شغل فعلي</th><th>أول – آخر مكالمة</th><th title="حجوزات الموظف اتسجلت في اليوم ده">حجوزات</th><th title="الهدف بيتحسب على كل المكالمات على خط الشغل، صادر ووارد">الهدف (كل المكالمات)</th><th>نسبة التحقيق</th>
        </tr></thead>
        <tbody id="rep-daily-tbody"><tr><td colspan="10" style="color:var(--text-muted)">جاري التحميل…</td></tr></tbody>
      </table>
    </div>
  `;
  const to = todayLocal();
  document.getElementById("rep-daily-to").value = to;
  document.getElementById("rep-daily-from").value = shiftDateStr(to, -29);
  document.getElementById("rep-daily-load").addEventListener("click", () => loadRepDaily(repId));
  showStaticModal("monthly-modal", { initialFocus: document.getElementById("monthly-close-btn") });
  loadRepDaily(repId);
}

/** YYYY-MM-DD moved by a number of days, in local time - for a default range. */
function shiftDateStr(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const at = new Date(y, m - 1, d + days);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
}

const WEEKDAY_SHORT = ["الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];

/**
 * The rep's days in the chosen range, newest first, as the phone reported them and as
 * the target judged them. A day with no report is shown as such, not as a zero the rep
 * earned - the badge column explains it (absent, weekly off, no target...).
 */
async function loadRepDaily(repId) {
  const from = document.getElementById("rep-daily-from").value;
  const to = document.getElementById("rep-daily-to").value;
  const tbody = document.getElementById("rep-daily-tbody");
  const summary = document.getElementById("rep-daily-summary");
  if (!from || !to) return;
  let data;
  try {
    data = await api(`/admin/reps/${repId}/daily?from=${from}&to=${to}`);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="10" style="color:var(--critical)">${esc(e.message || "مقدرناش نجيب التقرير")}</td></tr>`;
    return;
  }
  const t = data.totals;
  const targetText = data.target ? targetLabel(data.target) : "مفيش هدف متحدد";
  summary.textContent =
    `الهدف: ${targetText} · أيام وصل عنها تقرير: ${t.daysReported} · صادر: ${t.outboundAnswered + t.outboundUnanswered} (رد ${t.outboundAnswered}) · وارد: ${t.inbound} · وقت الكلام صادر: ${fmtDuration(t.outboundTalkSeconds)}` +
    ` · حجوزات: ${t.bookingsMade} · شغل فعلي: ${fmtDuration(t.activeWorkSeconds)} · ممتاز: ${t.goodDays} · شد شوية: ${t.badDays}`;

  const noReport = '<span style="color:var(--text-muted)">مفيش تقرير</span>';
  tbody.innerHTML = "";
  data.days.forEach((day) => {
    const { style, text } = badgeText(day.badge);
    const [y, m, d] = day.date.split("-").map(Number);
    const weekday = WEEKDAY_SHORT[new Date(y, m - 1, d).getDay()];
    const pct = day.achievedPct;
    const pctColor = pct == null ? "var(--text-muted)" : pct >= 100 ? "var(--good)" : pct >= 60 ? "var(--warning)" : "var(--critical)";
    const tr = document.createElement("tr");
    if (!day.reported) tr.style.opacity = "0.75";
    tr.innerHTML = `
      <td><div>${esc(day.date)}</div><div style="font-size:12px; color:var(--text-muted)">${esc(weekday)}</div></td>
      <td><span class="badge" style="background:${style.bg}; color:${style.fg}">${esc(text)}</span></td>
      <td>${day.reported ? `<strong>${esc(day.outboundAnswered + day.outboundUnanswered)}</strong> <span style="color:var(--text-muted); font-size:12.5px">(${esc(day.outboundAnswered)} رد · ${esc(day.outboundUnanswered)} لم يرد)</span>` : noReport}</td>
      <td>${day.reported ? esc(day.inbound) : "—"}</td>
      <td>${day.reported ? esc(fmtDuration(day.outboundTalkSeconds)) : "—"}</td>
      <td>${day.reported ? esc(fmtDuration(day.activeWorkSeconds)) : "—"}</td>
      <td>${day.workStartAt ? `${esc(timeOnly(day.workStartAt))} – ${esc(day.workEndAt ? timeOnly(day.workEndAt) : "…")}` : "—"}</td>
      <td style="font-weight:600; color:${day.bookingsMade ? "var(--good)" : "var(--text-muted)"}">${esc(day.bookingsMade)}</td>
      <td>${esc(progressLabel(day.badge))}</td>
      <td style="font-weight:600; color:${pctColor}">${pct == null ? "—" : esc(pct + "%")}</td>`;
    tbody.appendChild(tr);
  });
  if (!data.days.length) tbody.innerHTML = '<tr><td colspan="10" style="color:var(--text-muted)">مفيش أيام في المدة دي</td></tr>';
}

function enterDashboard() {
  document.getElementById("login-view").classList.add("hidden");
  document.getElementById("dashboard-view").classList.remove("hidden");
  document.getElementById("welcome-text").textContent = `أهلاً، ${userName}`;
  document.getElementById("loading").textContent = "جاري تحميل البيانات...";
  document.getElementById("loading").classList.remove("hidden");
  document.getElementById("content").classList.add("hidden");
  doctorsLoaded = false;
  applyRoleVisibility();
  loadDashboard();
  // A greeting on every load (owner, 17 Oct) - not inside /next/'s frames, which load this page several times.
  if (!document.documentElement.classList.contains("embedded")) {
    toast(GREETINGS[Math.floor(Math.random() * GREETINGS.length)], "good");
  }
}

/** One of these on each load, picked at random (owner, 17 Oct). */
const GREETINGS = [
  "يلا بينا، النهارده يوم جديد ونجاح جديد 💪",
  "كل مكالمة النهارده خطوة لقدّام 🚀",
  "النجاح مش صدفة، ده شغل كل يوم ✨",
  "خليك فاكر: الفريق القوي بيبدأ بيك 🌟",
  "حجز ورا حجز، وهنوصل للهدف 🎯",
  "ابدأ يومك بابتسامة، والباقي هييجي 😊",
  "إنت قدها، والنهارده هتثبت ده 🔥",
  "كل دكتور بيثق فينا مسؤولية، وإحنا قدها 🤝",
  "الصبر والاستمرار هما سر الوصول 🌱",
  "خطوة صغيرة كل يوم = فرق كبير آخر الشهر 📈",
  "ركّز، اشتغل، واتبسط بالنتيجة 🏆",
  "النهارده فرصة تعمل أحسن من امبارح ⭐",
];

/* ------------------------------------------------------------------------
   Navigation.

   Icons are drawn here rather than pulled from a font or pasted as emoji, so
   every glyph shares one 1.8px stroke and one 24px box - a mixed icon set is
   the fastest way for an interface to look assembled rather than designed.
   ------------------------------------------------------------------------ */
const ICONS = {
  overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  leads: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  worksheet: '<path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  bookings: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  reminders: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  overdue: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  reps: '<path d="M3 3v18h18"/><path d="m7 15 3-4 3 2 5-6"/>',
  distribution: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  workload: '<path d="M3 3v18h18"/><rect x="6" y="12" width="3" height="6" rx="1"/><rect x="11" y="8" width="3" height="10" rx="1"/><rect x="16" y="5" width="3" height="13" rx="1"/>',
  attendance: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 15 2 2 4-4"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 9 5-5 5 5"/><path d="M12 4v12"/>',
  doctors: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M12 9v5M9.5 11.5h5"/>',
  services: '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>',
  templates: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
  accounts: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  finance: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M16 15h2"/>',
  app: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 7v7"/><path d="m9 11 3 3 3-3"/>',
  "plan-start": '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/><path d="m9.5 11 2 2 3.5-3.5"/>',
  "doctor-report": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
};

/**
 * Every view, its label, and who may reach it.
 *
 * `scoped` marks the views whose data actually honours the doctor/campaign
 * filter - showing that filter above a view it does not affect was the single
 * most misleading thing about the old one-page layout.
 */
const NAV = [
  { id: "overview", label: "نظرة عامة", group: null, scoped: true },

  { id: "leads", label: "العملاء", group: "الشغل اليومي", scoped: true },
  { id: "worksheet", label: "متابعة العملاء", group: null, scoped: true },
  { id: "bookings", label: "الحجوزات والتذكيرات", group: null },
  // The rep's own four tabs, for any rep - next to الحجوزات والتذكيرات, which stays as it
  // is because it also records clinic attendance, a different job entirely.
  // Named as the app names it: the same four tabs a rep sees under المتابعات.
  { id: "reminders", label: "المتابعات", group: null },
  // Look an examined client up and say whether the plan started (owner, 2026-09-24).
  { id: "plan-start", label: "الخطة العلاجية", group: null },
  { id: "overdue", label: "المتابعات المتأخرة", group: null, badge: "overdue" },
  { id: "calls", label: "سجل المكالمات", group: null },

  { id: "reps", label: "السيلز والأداء", group: "الفريق", scoped: true },
  { id: "distribution", label: "التوزيع والربط", group: null },
  { id: "workload", label: "حمل الشغل والتوزيع اليدوي", group: null },
  { id: "attendance", label: "الحضور والغياب", group: null },

  { id: "upload", label: "رفع الشيتات", group: "البيانات", roles: ["admin", "super_admin"] },
  { id: "doctors", label: "الدكاترة والكامبينات", group: null, roles: ["admin", "super_admin"] },
  // One clinic's period, on one printable page (owner, 2026-09-24).
  { id: "doctor-report", label: "تقرير الدكتور", group: null },

  // The books: what clinics owe, what employees are owed, expenses, the month's result.
  { id: "finance", label: "حسابات الموظفين", group: "المالية", roles: ["admin", "super_admin"] },

  { id: "services", label: "الخدمات", group: "الإعدادات" },
  { id: "templates", label: "نصوص الرسائل", group: null },
  { id: "accounts", label: "الحسابات والصلاحيات", group: null, roles: ["admin", "super_admin"] },
  // Releasing a build is operational rather than daily work, and the POST behind it is
  // super-admin only - so the entry itself disappears for everyone else.
  { id: "app", label: "نسخة التطبيق", group: null, roles: ["super_admin"] },
];

const navFor = () => NAV.filter((n) => !n.roles || n.roles.includes(userRole));

let currentView = "overview";

function buildNav() {
  const nav = document.getElementById("nav");
  nav.innerHTML = "";
  navFor().forEach((item) => {
    if (item.group) {
      const g = document.createElement("div");
      g.className = "nav-group";
      g.textContent = item.group;
      nav.appendChild(g);
    }
    const btn = document.createElement("button");
    btn.className = "nav-item";
    btn.dataset.view = item.id;
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[item.id]}</svg>
      <span>${esc(item.label)}</span>
      ${item.badge ? `<span class="count hidden" id="nav-badge-${item.badge}"></span>` : ""}
    `;
    btn.addEventListener("click", () => {
      location.hash = `#/${item.id}`;
      closeSidebar();
    });
    nav.appendChild(btn);
  });
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.querySelector(".scrim")?.remove();
}

function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  if (document.querySelector(".scrim")) return;
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  scrim.addEventListener("click", closeSidebar);
  document.body.appendChild(scrim);
}

/**
 * Set by the one flow that means to carry a doctor across pages - "افتح الداشبورد" on the
 * doctors page - so the reset below skips exactly that navigation.
 */
let keepScopeOnNextRoute = false;

/**
 * Empties the filter bar. Returns whether anything was actually set.
 *
 * The filter used to follow the admin from page to page: pick a doctor on العملاء, open
 * السيلز والأداء a while later, and every number there was that doctor's without the
 * page saying so loudly enough. A filter now belongs to the page it was set on.
 */
function clearScopeFilters() {
  const doctor = document.getElementById("doctor-filter");
  const campaign = document.getElementById("campaign-filter");
  const rep = document.getElementById("rep-filter");
  const from = document.getElementById("scope-from-date");
  const to = document.getElementById("scope-to-date");
  if (!doctor.value && !campaign.value && !rep.value && !from.value && !to.value) return false;
  doctor.value = "";
  campaign.innerHTML = '<option value="">كل الكامبينات</option>';
  campaign.value = "";
  campaign.classList.add("hidden");
  rep.value = "";
  from.value = "";
  to.value = "";
  renderDoctorProfile(null);
  updateUploadPanelVisibility();
  readScope();
  return true;
}

/** Applies the hash route: swaps the visible view, title, nav state, and filter bar. */
function applyRoute() {
  // `#/view/sub`: the part after the view is that view's own business. Today only حمل
  // الشغل has one, naming which of its tabs is open.
  const [wanted, sub] = ((location.hash || "").replace(/^#\/?/, "") || "overview").split("/");
  const allowed = navFor().map((n) => n.id);
  const id = allowed.includes(wanted) ? wanted : allowed[0];
  const changedView = id !== currentView;
  currentView = id;
  if (id === "workload" && sub) selectWorkloadTab(sub, { updateHash: false });
  if (id === "finance" && sub) selectFinanceTab(sub, { updateHash: false });

  // A new page starts with no filter. The scoped views share one core load, so they are
  // all marked to refetch; the ones not on screen do so when opened.
  if (changedView && !keepScopeOnNextRoute && clearScopeFilters()) {
    ["leads", "reps", "worksheet", "overview"].forEach((v) => dirtyViews.add(v));
  }
  keepScopeOnNextRoute = false;

  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${id}`));
  document.querySelectorAll(".nav-item").forEach((b) => {
    if (b.dataset.view === id) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });

  const item = NAV.find((n) => n.id === id);
  document.getElementById("page-title").textContent = item ? item.label : "";
  mountPageHelp(id);
  document.getElementById("scope-filter").classList.toggle("hidden", !item?.scoped);

  // Nothing to fetch before the first load has finished - loadDashboard() runs the
  // active view's loader itself once the core data is in.
  if (document.getElementById("content").classList.contains("hidden")) return;
  runViewLoader(id);
}

/* ---------------------------------------------------------------- page help */

/**
 * What each page is for, what it holds, and what to read off it - opened from a line under
 * the page title (owner, 2026-09-30: "زوّد شرح كبير لكل صفحة بتعمل إيه والمفروض إيه الداتا
 * اللي نعرفها منها"). Plain words, the way the pages are used.
 */
const PAGE_HELP = {
  overview: {
    what: "أول صفحة تفتحها في اليوم: إيه اللي دخل، مين شغال ومين لأ، وإيه اللي متراكم.",
    has: [
      "ليدز جديدة دخلت (بيوم دخولها، من أنهي مصدر)، الحجوزات والكشوفات في المدة، ونتايج المكالمات - كل رقم بيتضغط ويقولك مين ولأنهي دكتور.",
      "التحذيرات: موظف عليه شغل وعمل أقل من 20 مكالمة ومداسش «مفيش شغل».",
      "الشغل المتراكم لكل موظف - كل رقم فيه بيفتحلك الليدز نفسها.",
      "تأكيد حجوزات النهارده وبكرة، اللي أكّدوا ومحضروش، الحجوزات بالخدمة، والشيتات اللي مش جايبة ليدز.",
    ],
    learn: "مين محتاج تكلّمه النهارده، ومين الدكتور اللي إعلانه واقف، وهل الفريق بيحوّل الليدز لحجوزات ولا لأ. الفلاتر فوق (المدة / الدكتور / السيلز) بتغيّر كل الصفحة.",
  },
  leads: {
    what: "كل الليدز على السيستم، بحالتها ومع مين.",
    has: ["بحث بالاسم أو اسم الحالة أو الرقم.", "تحديد كذا ليد مع بعض: نقل لسيلز، قفل، أو مسح اللي محدش اشتغل عليه.", "زرار + عميل جديد.", "الضغط على أي ليد بيفتح قصته كاملة، ومن هناك تقدر تعدّل اسمه."],
    learn: "ليد معيّن وصل لفين ومع مين، ومين اللي ماسك أكتر ليدز مفتوحة.",
  },
  worksheet: {
    what: "الشيت القديم بتاع المتابعة، بس بيتملي لوحده: كل ليد وكام مكالمة اتعملت عليه وإيه اللي حصل.",
    has: ["أعمدة المحاولات (اليوم الأول، التاني، الواتساب)، وحالة الليد، والمطلوب دلوقتي.", "بحث بأي كلمة."],
    learn: "هل الموظف ماشي على خطة المطاردة (مكالمتين في اليوم، وبعد يومين واتساب) ولا لأ.",
  },
  bookings: {
    what: "كل الحجوزات ومكالمات التذكير بتاعتها، وتسجيل الحضور.",
    has: [
      "لكل حجز: الميعاد، مسؤول التذكير، نتيجة مكالمة التذكير (أكّد / مردّش / أجّل / ألغى)، وهل رسالة التأكيد اتبعتت.",
      "عمود الحضور: حضر وكشف / محضرش / لسه - ده اللي بيحرّك الليد لـ«تم الكشف» أو «محضرش» وبيعمل الحالة في الحسابات.",
      "«بس اللي محتاج تسجيل نتيجة»: الزيارات اللي عدّى ميعادها ومحدش سجّلها.",
      "غيّر الميعاد، إلغاء، تعديل اسم الحالة، نقل مسؤول التذكير.",
    ],
    learn: "مين جاي النهارده وبكرة وهل اتأكد، ومين مجاش، وإيه اللي لسه متسجلش.",
  },
  reminders: {
    what: "نفس الأربع تابات اللي على موبايل كل موظف، لأي موظف تختاره - يعني الشغل اللي مستنيه من وجهة نظره هو.",
    has: [
      "متابعة لاحقة: مواعيد الموظف وعد يكلّم فيها العميل (من شاشة الليد)، ومعاهم المكالمات اللي السيستم بيحطها لوحده: «مجاش الكشف - كلّمه واحجزله معاد جديد» و«حاجز ومأكّدش - كلّمه يأكد» تاني يوم 10 الصبح. عمود «السبب» بيفرّق بينهم.",
      "الحجوزات: الحجوزات اللي مكالمة التذكير بتاعتها مع الموظف ده.",
      "محدش كلمها: ليدز سحبها قبل النهارده ومكلمهاش.",
      "مردّش امبارح: ليدز سحبها آخر يوم شغل واتكلمت ولسه عليها مكالمة النهارده.",
      "تم الكشف: الحالات اللي كشفت، ومنها اللي لسه مبدأش الخطة، وهل بدأت ولا لأ.",
      "حدّد صفوف وانقلها لموظف تاني. البحث فوق بيدور في القايمة كلها.",
    ],
    learn: "كل موظف عليه إيه بالظبط النهارده، وإيه اللي فات ميعاده، ومين محتاج ينقل شغله لحد تاني.",
  },
  "plan-start": {
    what: "مكان واحد تدوّر فيه على حالة كشفت وتقول بدأت الخطة العلاجية ولا لأ.",
    has: ["بحث باسم الحالة أو الليد أو الرقم.", "زرار بدأت ✓ / مركّبش - ومين سجّلها (من الموبايل ولا من الداشبورد)."],
    learn: "الحالات اللي بدأت الخطة هي اللي بيتحسب عليها بونص الموظف في شهر البداية.",
  },
  overdue: {
    what: "الليدز اللي وعد الموظف يكلّمها في ميعاد، والميعاد عدّى ومكلمهاش.",
    has: ["اسم العميل، الموظف، عدد المحاولات، والمطلوب دلوقتي.", "نقل لسيلز تاني أو قفل الليد."],
    learn: "مين بينسى مواعيده، وليدز مهتمة بتضيع لأن محدش رجعلها.",
  },
  calls: {
    what: "سجل المكالمات الحقيقي من موبايلات الموظفين على خط الشغل - صادر ووارد وفايت.",
    has: ["فلتر بالموظف والنوع والمدة، وبحث بالرقم أو الاسم.", "جدول لكل موظف: كام مكالمة صادرة، كام رد عليها، كام وارد، ووقت الكلام."],
    learn: "مين بيشتغل فعلاً (المكالمات مش النتايج المسجلة)، ومين العميل اللي اتصل ومحدش رد عليه.",
  },
  reps: {
    what: "أداء كل موظف النهارده وفي الشهر.",
    has: ["ليدز معاه، نتايج اتسجلت، مكالمات صادرة رد عليها ومردّش، وارد، ووقت الكلام.", "دوس على الموظف يفتح تقرير شهره كامل."],
    learn: "مين بيكلّم كتير وبيحجز قليل، ومين العكس.",
  },
  distribution: {
    what: "ربط كل موظف بالدكاترة اللي بيسحب من مخزونهم.",
    has: ["لكل موظف: الدكتور الأساسي، الاحتياطي الأول، الاحتياطي التاني.", "دكتور من غير ولا موظف = ليداته بتقعد في المخزون ومحدش يسحبها."],
    learn: "ليه دكتور معيّن ليداته واقفة: غالباً مش مربوط بحد.",
  },
  workload: {
    what: "توزيع الشغل بإيدك: مخزون كل دكتور، ليدز كل موظف، والحالات اللي كشفت ولسه مبدأتش.",
    has: ["الشغل المستني لكل موظف.", "مخزون الدكاترة: ليدز محدش سحبها.", "رجّع ليدات موظف للمخزون أو وزّعها على غيره.", "كشف ولسه مبدأش: متابعة الخطة، تنقلها أو تقفلها أو تفتحها تاني."],
    learn: "فين الشغل متكدس وفين فاضي، وتوزّع على كده.",
  },
  attendance: {
    what: "حضور الموظفين المستنتج من شغلهم الفعلي، ودوسات «مفيش شغل»، والبادجات.",
    has: ["لكل يوم: مين اشتغل، أول وآخر مكالمة، كام مرة داس مفيش شغل.", "الأهداف اليومية (مكالمات ودقايق) والبادج بتاع كل واحد."],
    learn: "مين غايب من غير ما يقول، ومين بيدوس «مفيش شغل» وهو عنده شغل.",
  },
  upload: {
    what: "إدخال ليدز من ملف Excel لدكتور معيّن.",
    has: ["اختار الدكتور، ارفع الملف، حدّد عمود الرقم (والاسم لو موجود)، وأكّد.", "الأرقام المكررة مش بتتضاف تاني."],
    learn: "الشيتات التلقائية (جوجل) بتتربط من صفحة الدكاترة، مش من هنا.",
  },
  doctors: {
    what: "كل دكتور: بياناته، كامبيناته، لينك التسجيل، شيت جوجل المربوط، وصفحة العيادة.",
    has: ["اربط شيت جوجل واقرا أعمدته وافحصه.", "لينك الإعلان اللي العميل يسجّل منه، ولينك صفحة العيادة بباسوردها.", "أوقف دكتور = محدش يسحب من مخزونه."],
    learn: "مصدر ليدز كل دكتور شغال ولا لأ (آخر قراءة للشيت وكام ليد جاب).",
  },
  "doctor-report": {
    what: "تقرير لدكتور واحد عن مدة: يطلع PDF تبعته له.",
    has: ["الليدز اللي دخلت وحالتهم، الحجوزات، الكشوفات (من الحسابات)، اللي بدأ الخطة، الخدمات، وملخص ملاحظات الموظفات."],
    learn: "الدكتور بيدفع على إعلان بيجيب إيه بالظبط، ولحد فين الليدز بتوصل.",
  },
  finance: {
    what: "حسابات الموظفين الشهرية: المرتب بالأيام، بونص الحالات اللي بدأت الخطة، وأي بونص إضافي.",
    has: ["حساب الشهر لكل موظف مع علامة اتقبض.", "الحالات: كل كشف، ومين حجزه، وبدأت الخطة ولا لأ (وتقدر تعدّل).", "الموظفين والبونص."],
    learn: "كل موظف ليه كام الشهر ده، ومين جاب حالات بدأت فعلاً.",
  },
  services: { what: "قايمة الخدمات (تقويم، زراعة، تبييض…) اللي بتظهر على الليد والحجز.", has: ["أضف أو أوقف خدمة."], learn: "الخدمات هي اللي بيتجمّع عليها تقرير الدكتور والحجوزات بالخدمة." },
  templates: { what: "نصوص الرسايل الجاهزة اللي الموظفة بتبعتها واتساب.", has: ["رسايل عامة، ورسايل لكل دكتور فيها [اليوم] و[الساعة] بيتملوا لوحدهم."], learn: "غيّر النص هنا يتغيّر على كل الموبايلات من غير تحديث للتطبيق." },
  accounts: { what: "حسابات الدخول: الموظفين، التيم ليدرز، الإدارة.", has: ["أضف موظف، وقّفه، غيّر مجموعته، «بدون قيود» للحسابات اللي مش بتخضع لقواعد المكالمات."], learn: "مين يقدر يدخل على إيه." },
  app: { what: "رفع نسخة جديدة من التطبيق للموظفين.", has: ["ارفع ملف APK - الموبايلات بتتنبّه إن فيه تحديث."], learn: "أنهي نسخة شغالة على كل موبايل من صفحة الحسابات." },
};

function mountPageHelp(id) {
  const view = document.getElementById(`view-${id}`);
  const help = PAGE_HELP[id];
  if (!view || !help || view.querySelector(":scope > .page-help")) return;
  const box = document.createElement("details");
  box.className = "page-help";
  const sum = document.createElement("summary");
  sum.textContent = "الصفحة دي بتعمل إيه؟";
  const what = document.createElement("p");
  what.textContent = help.what;
  const ul = document.createElement("ul");
  for (const line of help.has || []) {
    const li = document.createElement("li");
    li.textContent = line;
    ul.appendChild(li);
  }
  const learn = document.createElement("p");
  learn.className = "learn";
  learn.textContent = "تعرف منها: " + help.learn;
  box.append(sum, what, ul, learn);
  view.prepend(box);
}

/**
 * What each view needs fetched when it is opened. Views marked in ALWAYS_RELOAD are
 * fetched on every visit (their data changes from the app side); the others only when
 * something marked them dirty, so switching tabs does not re-render thousands of rows.
 */
const VIEW_LOADERS = {
  overview: () => Promise.allSettled([loadCore(), loadOverviewActions()]),
  leads: loadCore,
  worksheet: loadWorksheet,
  bookings: loadBookings,
  reminders: loadFollowupBoard,
  "plan-start": loadPlanStart,
  "doctor-report": loadDoctorReport,
  overdue: loadOverdue,
  calls: loadCallLog,
  finance: loadFinance,
  reps: loadCore,
  distribution: loadAssignments,
  workload: loadWorkload,
  attendance: loadAttendance,
  upload: loadUploadPickers,
  doctors: loadDoctorsView,
  services: loadServices,
  templates: loadTemplates,
  accounts: () => Promise.allSettled([loadAccounts(), loadStaff()]),
  app: loadAppRelease,
};
const ALWAYS_RELOAD = new Set(["doctors", "workload", "attendance", "upload", "overview", "bookings", "reminders", "plan-start", "overdue", "calls", "app", "finance"]);

async function runViewLoader(id) {
  const loader = VIEW_LOADERS[id];
  if (!loader) return;
  if (!ALWAYS_RELOAD.has(id) && !dirtyViews.has(id)) return;
  dirtyViews.delete(id);
  try {
    await loader();
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    // Reported already; the view stays as it was and reloads on the next visit.
    dirtyViews.add(id);
  }
}

function goto(view) {
  location.hash = `#/${view}`;
}

/** Renders one action-card list, or a short reassurance when there is nothing to do. */
function renderActionList(containerId, countId, rows, emptyText, { alert = false } = {}) {
  const list = document.getElementById(containerId);
  const count = document.getElementById(countId);
  // A card the page no longer has (the owner dropped three, 2026-09-29) is simply skipped.
  if (!list) return;
  list.innerHTML = "";

  if (count) {
    count.textContent = rows.length;
    count.classList.toggle("alert", alert && rows.length > 0);
  }

  if (rows.length === 0) {
    const row = document.createElement("div");
    row.className = "row";
    row.style.color = "var(--text-secondary)";
    row.textContent = emptyText;
    list.appendChild(row);
    return;
  }

  // A card is a glance, not the report: past a screenful it says how many more there
  // are and leaves the rest to the page it links to.
  const shown = rows.length > MAX_ACTION_ROWS ? rows.slice(0, MAX_ACTION_ROWS) : rows;
  shown.forEach((r) => {
    const row = document.createElement("div");
    row.className = "row";
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = r.title;
    row.appendChild(who);
    if (r.leadId) who.insertAdjacentHTML("beforeend", leadEditHtml(r.leadId));
    if (r.parts && r.parts.length) {
      // Each part opens the page that lists exactly those leads (owner, 2026-09-29).
      const parts = document.createElement("span");
      parts.className = "parts";
      for (const p of r.parts) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "link-btn";
        b.textContent = p.label;
        b.title = "افتح الليدز دي";
        b.addEventListener("click", p.onClick);
        parts.appendChild(b);
      }
      row.appendChild(parts);
    } else {
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = r.meta;
      row.appendChild(meta);
    }
    list.appendChild(row);
  });
  if (shown.length < rows.length) {
    const more = document.createElement("div");
    more.className = "row";
    more.style.color = "var(--text-secondary)";
    more.textContent = `و${rows.length - shown.length} كمان — افتح الصفحة الكاملة من اللينك اللي تحت`;
    list.appendChild(more);
  }
}

const MAX_ACTION_ROWS = 12;

/**
 * The overview's actionable half.
 *
 * Everything here is already fetched for other views; this reuses those responses
 * rather than adding a bespoke summary endpoint, so the overview can never disagree
 * with the page it links to.
 */
async function loadOverviewActions() {
  const isStale = beginLoad("overview-actions");
  const todayStr = todayLocal();

  // Each card stands on its own: one failing request (or a missing endpoint on an older
  // server) leaves the others rendering, and api() has already reported it.
  const quiet = (path) => api(path, { silent: true }).catch((e) => (e instanceof ApiError ? null : Promise.reject(e)));
  const [bookingsData, overdueData, assignData, unworkedData, poolData, badgesData, needsResultData, followupsData, overdueAllData] =
    await Promise.all([
      quiet(`/admin/bookings?from=${todayStr}&to=${tomorrowLocal()}${currentScopeQS ? "&" + currentScopeQS.slice(1) : ""}`),
      quiet(`/admin/overdue-leads${currentScopeQS}`),
      quiet("/admin/assignments"),
      quiet("/admin/unworked-claims"),
      quiet("/admin/pool"),
      quiet(`/admin/badges?date=${todayStr}`),
      quiet("/admin/bookings?needsAttendance=1"),
      quiet(`/admin/followups/counts?date=${todayStr}`),
      // The sidebar count is global: it sits beside a page that ignores the filter bar,
      // so it has to ignore it too. It used to be read off the scoped list above, so
      // picking one doctor made the count vanish and picking "كل الدكاترة" again made
      // four overdue leads "appear" - they had been there the whole time. One extra
      // request, and only when a filter is actually set.
      currentScopeQS ? quiet("/admin/overdue-leads") : null,
    ]);
  if (isStale()) return;
  if (!token) return;

  // The day itself: arrivals, who barely worked, the backlog, the warnings.
  // The arrivals box follows the filter bar (from/to, doctor); the rep cards stay today's.
  quiet(`/admin/overview/day?date=${todayStr}${currentScopeQS ? "&" + currentScopeQS.slice(1) : ""}`).then((day) => {
    if (!isStale() && day) renderDayOverview(day);
  });

  // --- what each rep still owes today, split the four ways the app splits it
  renderFollowupsCard(followupsData);

  // --- the pool: leads waiting per doctor
  if (poolData) {
    poolCache = poolData.doctors || [];
    renderPoolCard(poolCache);
  } else {
    renderPoolCard(null);
  }

  // --- today's badges, as counts
  renderBadgesCard(badgesData ? badgesData.reps : null);

  // --- the day's headline numbers
  renderTodayTiles({
    needsResult: needsResultData ? needsResultData.bookings.length : null,
    needsResultLate: needsResultData ? needsResultData.bookings.filter(resultOverdue).length : 0,
    pool: poolData ? poolCache.reduce((s, d) => s + (d.unowned || 0), 0) : null,
    badges: badgesData ? badgesData.reps : null,
  });

  // --- reps sitting on leads they pulled and never called
  if (unworkedData) {
    const { reps } = unworkedData;
    renderActionList(
      "ov-unworked",
      "ov-unworked-n",
      reps.map((r) => ({ title: r.name, meta: `${r.uncalled} ليد مكلمهمش` })),
      "كل اللي اتاخد اتكلم ✓",
      { alert: true },
    );
  }

  // --- today's and tomorrow's bookings, each with what its reminder call came to
  if (bookingsData) {
    const { bookings } = bookingsData;
    const live = bookings.filter((b) => b.status === "scheduled").sort((a, b) => String(a.scheduledFor).localeCompare(String(b.scheduledFor)));
    const outcomeText = (b) => {
      if (b.reminderOutcome === "reminder_confirmed") return "أكّد ✓";
      if (b.reminderOutcome === "reminder_no_answer") return `مردّش${b.noAnswerCount > 1 ? " ×" + b.noAnswerCount : ""}`;
      if (b.reminderOutcome === "reminder_rescheduled") return "اتأجل";
      return "لسه مكالمة التذكير";
    };
    renderActionList(
      "ov-reminders",
      "ov-reminders-n",
      live.map((b) => ({
        title: b.leadName,
        leadId: b.leadId,
        meta: [
          `${String(b.scheduledFor).slice(0, 10) === todayStr ? "النهاردة" : "بكرة"} ${splitDateTime(b.scheduledFor).time}`,
          outcomeText(b),
          b.reminderMessageAt ? "الرسالة ✓" : null,
          b.reminderOwnerName || "—",
        ]
          .filter(Boolean)
          .join(" · "),
      })),
      "مفيش حجوزات النهاردة ولا بكرة",
    );
    const n = document.getElementById("ov-reminders-n");
    if (n) {
      const unconfirmed = live.filter((b) => b.reminderOutcome !== "reminder_confirmed").length;
      n.textContent = unconfirmed;
      n.classList.toggle("alert", unconfirmed > 0);
    }
  }

  // --- leads past the follow-up window
  if (overdueData) {
    const { leads } = overdueData;
    renderActionList(
      "ov-overdue",
      "ov-overdue-n",
      leads.map((l) => ({
        title: l.name,
        leadId: l.id,
        meta: `${l.attemptsTotal} محاولة — ${l.repName || "—"}`,
      })),
      "مفيش حد فات عليه وقت المتابعة ✓",
      { alert: true },
    );
  }

  // --- the sidebar count, always from the unfiltered list (see the request above)
  const overdueForBadge = currentScopeQS ? overdueAllData : overdueData;
  if (overdueForBadge) {
    const badge = document.getElementById("nav-badge-overdue");
    if (badge) {
      badge.textContent = overdueForBadge.leads.length;
      badge.classList.toggle("hidden", overdueForBadge.leads.length === 0);
    }
  }

  // --- doctors with nobody assigned to them
  if (assignData) {
    const { reps } = assignData;
    allReps = reps;
    const linked = new Set();
    reps.forEach((r) => {
      if (r.primaryDoctorId) linked.add(r.primaryDoctorId);
      if (r.secondaryDoctorId) linked.add(r.secondaryDoctorId);
      if (r.tertiaryDoctorId) linked.add(r.tertiaryDoctorId);
    });
    const unlinked = allDoctors.filter((d) => !linked.has(d.id));
    renderActionList(
      "ov-unlinked",
      "ov-unlinked-n",
      unlinked.map((d) => ({ title: d.name, meta: `مجموعة ${groupLabel(d.groupId)}` })),
      "كل الدكاترة مربوطين ✓",
    );
  }
}

/** Today's badges, folded into counts: who cleared their day, who did not, who was excused. */
function renderBadgesCard(reps) {
  if (!reps) {
    renderActionList("ov-badges", "ov-badges-n", [], "بادجات النهاردة مش متاحة");
    return;
  }
  const counts = { good: 0, bad: 0, exempt: 0, pending: 0 };
  reps.forEach((r) => {
    const s = r.badge && counts[r.badge.status] !== undefined ? r.badge.status : "pending";
    counts[s] += 1;
  });
  const bad = reps.filter((r) => r.badge && r.badge.status === "bad");
  const rows = [
    { title: "ممتاز — خلّصوا ليدز اليوم", meta: String(counts.good) },
    { title: "شد شوية — فاضل ليدز من غير عذر", meta: String(counts.bad) },
    { title: "لسه في وقته", meta: String(counts.pending) },
    ...bad.map((r) => ({ title: `⚠ ${r.name}`, meta: r.badge.reason || "شد شوية" })),
  ];
  renderActionList("ov-badges", "ov-badges-n", rows, "مفيش سيلز", { alert: counts.bad > 0 });
  document.getElementById("ov-badges-n").textContent = counts.bad;
}

/**
 * How long a visit may sit without the clinic's answer before it is called overdue. A
 * clinic reports within a day or two; past this the row is red, not merely listed.
 */
const BOOKING_RESULT_GRACE_DAYS = 3;

/** Days since a booking's visit slot (Cairo wall time), or 0 if it is still ahead. */
function daysSinceVisit(booking) {
  const day = String(booking.scheduledFor || "").slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return 0;
  const visit = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const today = Date.UTC(...cairoToday().split("-").map((x, i) => (i === 1 ? +x - 1 : +x)));
  return Math.max(0, Math.round((today - visit) / 86400000));
}

const resultOverdue = (booking) => daysSinceVisit(booking) > BOOKING_RESULT_GRACE_DAYS;

/** The "today" tile row: bookings needing a clinic result, the pool, and the badge split. */
function renderTodayTiles({ needsResult, needsResultLate, pool, badges }) {
  const mount = document.getElementById("today-tiles");
  if (!mount) return;
  mount.innerHTML = "";
  mount.appendChild(
    tile(
      needsResult == null ? "—" : needsResult,
      needsResultLate ? `حجوزات محتاجة نتيجة — ${needsResultLate} فات عليهم أكتر من ${BOOKING_RESULT_GRACE_DAYS} أيام` : "حجوزات محتاجة نتيجة",
      null,
      needsResultLate ? "var(--critical)" : needsResult ? "var(--warning)" : "var(--good)",
    ),
  );
  mount.appendChild(tile(pool == null ? "—" : pool, "ليدز في المخزون", null, "var(--violet)"));
  if (badges) {
    const c = { good: 0, bad: 0, exempt: 0, pending: 0 };
    badges.forEach((r) => {
      const s = r.badge && c[r.badge.status] !== undefined ? r.badge.status : "pending";
      c[s] += 1;
    });
    mount.appendChild(tile(c.good, "ممتاز", null, "var(--good)"));
    mount.appendChild(tile(c.bad, "شد شوية", null, c.bad ? "var(--critical)" : "var(--gridline)"));
  } else {
    mount.appendChild(tile("—", "بادجات النهاردة", null, "var(--gridline)"));
  }
}

/** Today's most active reps, taken from the same rows the performance table uses. */
function renderTopReps(reps) {
  const rows = [...reps]
    // Outbound only: a rep who took eleven incoming calls was ranking above one who
    // dialled thirty clients.
    // The field is `todayStats`, as the performance table reads it; this read `today`,
    // which no row carries, so the card said "no calls yet" every day of its life.
    .map((r) => ({
      name: r.name,
      calls: r.todayStats
        ? Math.max(0, r.todayStats.answered_count - (r.todayStats.incoming_count || 0)) +
          Math.max(0, r.todayStats.no_answer_count - (r.todayStats.missed_count || 0))
        : 0,
    }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 5)
    .filter((r) => r.calls > 0);

  renderActionList(
    "ov-top-reps",
    null,
    rows.map((r) => ({ title: r.name, meta: `${r.calls} مكالمة صادرة` })),
    "مفيش مكالمات اتسجلت النهاردة لسه",
  );
}

/** Doctors and their campaigns, with inline add. Loaded when the view is opened. */
async function loadDoctorsView() {
  const isStale = beginLoad("doctors-view");
  // The linked-reps column reads allReps; on a cold #/doctors load the roster may not be
  // in yet, which used to show "مفيش" for every doctor until the next refresh.
  const [{ doctors }, , sheetsData, onboardingData] = await Promise.all([
    api("/admin/doctors?includeInactive=1"),
    allReps.length ? null : loadAssignments(),
    // The automatic sheets are admin-only on the server, so only an admin asks.
    canManageData() ? api("/admin/doctor-sheets").catch(() => ({ sheets: [] })) : null,
    canManageData() ? api("/admin/onboarding", { silent: true }).catch(() => ({ doctors: [] })) : null,
  ]);
  if (isStale()) return;
  const onboardingByDoctor = new Map((onboardingData?.doctors || []).map((o) => [o.doctorId, o]));
  const sheetsByDoctor = new Map();
  for (const sheet of sheetsData?.sheets || []) {
    if (!sheetsByDoctor.has(sheet.doctorId)) sheetsByDoctor.set(sheet.doctorId, []);
    sheetsByDoctor.get(sheet.doctorId).push(sheet);
  }

  const wrap = document.getElementById("doctors-list");
  wrap.innerHTML = "";

  if (doctors.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = "<strong>مفيش دكاترة لسه</strong>ضيف أول دكتور عشان تقدر ترفع ليدزه.";
    wrap.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "doctors-table";
  table.innerHTML = `
    <thead><tr>
      <th style="min-width:160px">الدكتور</th><th>المجموعة</th><th>الشغل</th><th style="min-width:150px">السيلز المربوطين</th><th style="min-width:260px">الإجراءات</th>
    </tr></thead><tbody id="doctors-tbody"></tbody>`;
  const tbody = table.querySelector("tbody");

  doctors.forEach((d) => {
    const linkedReps = allReps.filter(
      (r) => r.primaryDoctorId === d.id || r.secondaryDoctorId === d.id || r.tertiaryDoctorId === d.id,
    );
    const tr = document.createElement("tr");
    const off = d.active === false;
    if (off) tr.className = "inactive-row";
    tr.innerHTML = `
      <td><strong>${esc(d.name)}</strong>${off ? ' <span class="badge" style="background:var(--surface-3); color:var(--text-secondary)">متوقف</span>' : ""}<div class="sub">${esc(d.city || "—")}</div></td>
      <td></td>
      <td>${esc(d.campaignCount)} كامبين<div class="sub">${esc(d.leadCount)} ليد</div></td>
      <td></td>
      <td><div class="actions"></div></td>`;
    const groupCell = tr.children[1];
    groupCell.innerHTML = `<span>${groupLabel(d.groupId)}</span> `;
    if (canManageData()) {
      const editGroupBtn = iconButton("✎", "تغيير المجموعة");
      editGroupBtn.addEventListener("click", () => editDoctorGroup(d));
      groupCell.appendChild(editGroupBtn);
    }
    const repsCell = tr.children[3];
    const actionsCell = tr.lastElementChild.firstElementChild;
    if (linkedReps.length === 0) {
      repsCell.innerHTML = '<span class="badge" style="background:var(--warning-soft); color:var(--warning)">مفيش</span>';
    } else {
      repsCell.textContent = linkedReps.map((r) => r.name).join("، ");
    }

    if (off) {
      // A stopped doctor keeps their history; this is the way back.
      if (canManageData()) {
        const back = document.createElement("button");
        back.textContent = "فعّل تاني";
        back.addEventListener("click", () => setDoctorActive(d, true));
        actionsCell.appendChild(back);
      }
    } else {
      // How far the clinic's setup has got, and the way back into it.
      const ob = onboardingByDoctor.get(d.id);
      if (ob) {
        const obBtn = document.createElement("button");
        obBtn.className = "ob-row-btn" + (ob.complete ? " done" : ob.missingRequired ? " missing" : " partial");
        obBtn.textContent = ob.complete ? "الإعداد ✓" : `كمّل الإعداد · ناقص ${ob.missingCount}`;
        obBtn.title = ob.steps.filter((s) => !s.done).map((s) => `${s.label}${s.required ? " (لازم)" : ""}`).join("\n") || "كل الخطوات خلصت";
        obBtn.addEventListener("click", () => openOnboarding(d));
        actionsCell.appendChild(obBtn);
      }

      const dashBtn = document.createElement("button");
      dashBtn.textContent = "افتح الداشبورد ←";
      dashBtn.className = "link-btn";
      dashBtn.addEventListener("click", () => openDoctorDashboard(d.id));
      dashBtn.style.padding = "4px 8px";
      actionsCell.appendChild(dashBtn);

      // The clinic's ready-made WhatsApp messages, unfolded under the row.
      const msgBtn = document.createElement("button");
      msgBtn.textContent = "الرسايل";
      msgBtn.title = "رسايل الواتساب الجاهزة اللي السيلز بيبعتها لعملاء الدكتور ده";
      msgBtn.addEventListener("click", () => toggleDoctorMessages(d, tr));
      actionsCell.appendChild(msgBtn);

      if (canManageData()) {
        // The doctor's own lead sheet, read by the server on its own. The button says
        // whether one is linked and whether the last look went well.
        const sheetBtn = document.createElement("button");
        sheetBtn.className = "doctor-sheet-btn";
        applySheetButtonState(sheetBtn, sheetsByDoctor.get(d.id) || []);
        sheetBtn.addEventListener("click", () => toggleDoctorSheet(d, tr));
        actionsCell.appendChild(sheetBtn);

        // The clinic's own read-only page: its link, its password, on or off.
        const portalBtn = document.createElement("button");
        portalBtn.textContent = "لينك العيادة";
        portalBtn.title = "صفحة للدكتور يشوف فيها حجوزاته وحالتها بدل جروب الواتساب - للاطلاع بس";
        portalBtn.addEventListener("click", () => toggleDoctorPortal(d, tr));
        actionsCell.appendChild(portalBtn);

        const stop = document.createElement("button");
        stop.textContent = "أوقف";
        stop.title = "الدكتور بطّل يشتغل معانا - يختفي من كل مكان ويفضل تاريخه";
        stop.addEventListener("click", () => setDoctorActive(d, false));
        actionsCell.appendChild(stop);

        const del = iconButton("🗑", "مسح الدكتور");
        del.addEventListener("click", () => deleteDoctors([d]));
        actionsCell.appendChild(del);
      }
    }

    tbody.appendChild(tr);
  });

  // bulkAttach looks the table up by id via document.getElementById, which only ever
  // finds elements already in the live document - so the table has to be inserted
  // first. Attaching it after used to leave the table detached at the moment
  // bulkAttach ran, and it would find nothing and quietly bail.
  const scroller = document.createElement("div");
  scroller.className = "table-wrap";
  scroller.appendChild(table);
  wrap.appendChild(scroller);

  bulkAttach("doctors", tbody.id, doctors, [
    {
      label: "نقل لمجموعة",
      show: canManageData,
      run: async (ids) => {
        const groupId = await promptDialog("نقل لمجموعة", {
          sub: `${ids.length} دكتور\nأي سيلز من المجموعة القديمة مربوط بدكتور منهم هيتشال ربطه.`,
          label: "المجموعة",
          options: groupOptions(),
          confirmLabel: "التالي",
        });
        if (!groupId) return;

        // Say what the move will do to the links before it is written.
        const moving = doctors.filter((d) => ids.includes(d.id) && String(d.groupId ?? "") !== String(groupId));
        if (!moving.length) return toast("كل الدكاترة المتحددين في المجموعة دي أصلاً");
        const stranded = new Map();
        moving.forEach((d) => repsStrandedByMove(d, groupId).forEach((r) => stranded.set(r.id, r.name)));
        const ok = await confirmDialog(`نقل ${moving.length} دكتور لمجموعة ${GROUP_LABELS[groupId]}`, {
          sub:
            `${moving.map((d) => d.name).join("، ")}\n\n` +
            (stranded.size
              ? `هيتشال ربط ${stranded.size} سيلز: ${[...stranded.values()].join("، ")}\nوهيحتاجوا ربط من جديد من صفحة التوزيع.`
              : "مفيش سيلز من المجموعة القديمة مربوط بيهم، فمفيش ربط هيتشال."),
          confirmLabel: "انقل",
          danger: stranded.size > 0,
        });
        if (!ok) return;

        const results = await Promise.allSettled(
          moving.map((d) => api(`/admin/doctors/${d.id}`, { method: "PATCH", body: { groupId }, silent: true })),
        );
        const okOnes = results.filter((r) => r.status === "fulfilled");
        const done = okOnes.length;
        const strandedRepCount = okOnes.reduce((sum, r) => sum + ((r.value && r.value.strandedRepCount) || 0), 0);
        toast(
          `اتنقل ${done} دكتور لمجموعة ${GROUP_LABELS[groupId]}` +
            (done < moving.length ? `، ${moving.length - done} فشلوا` : "") +
            (strandedRepCount ? `. اتشال ربط ${strandedRepCount} موظف كان بيشتغل بيهم من المجموعة القديمة` : ""),
          done ? "good" : "bad",
        );
        bulkClear("doctors");
        await reloadDoctors();
        // The "التوزيع" dropdowns are built once from allDoctors at render time - without
        // this they keep showing the doctor under their old group until something else
        // happens to trigger a refresh, which reads as the system refusing the new link.
        invalidate("doctors", "distribution", "overview");
      },
    },
    {
      label: "إيقاف",
      show: canManageData,
      run: async (ids) => {
        for (const d of doctors.filter((x) => ids.includes(x.id) && x.active !== false)) await setDoctorActive(d, false);
      },
    },
    {
      label: "حذف",
      danger: true,
      show: canManageData,
      run: (ids) => deleteDoctors(doctors.filter((d) => ids.includes(d.id))),
    },
  ]);
}

/**
 * Stops a doctor (or brings one back). Off means out of every picker, no uploads, no
 * claiming from their pool, links freed - and every lead, call and booking under them
 * kept exactly as it is. The answer for a clinic that stopped working with the business
 * but has history, which delete refuses on purpose.
 */
async function setDoctorActive(d, active) {
  const linked = active ? [] : repsLinkedToDoctor(d.id);
  const ok = await confirmDialog(active ? `تفعيل ${d.name} تاني` : `إيقاف ${d.name}`, {
    sub: active
      ? "هيرجع يظهر في الفلاتر والرفع والربط، وليدزه اللي في المخزون تتسحب تاني."
      : "هيختفي من الفلاتر والرفع والربط، ومخزونه مش هيتسحب. ليدزه وحجوزاته وتاريخه بيفضلوا زي ما هما." +
        (linked.length ? `\nهيتشال ربط ${linked.length} سيلز: ${linked.map((r) => r.name).join("، ")}.` : ""),
    confirmLabel: active ? "فعّل" : "أوقف",
    danger: !active,
  });
  if (!ok) return;

  const selectedBefore = document.getElementById("doctor-filter").value;
  await api(`/admin/doctors/${d.id}`, { method: "PATCH", body: { active } });
  toast(active ? `رجع ${d.name}` : `اتوقف ${d.name}`, "good");
  bulkClear("doctors");
  await reloadDoctors();
  if (!active && String(d.id) === selectedBefore) await onDoctorChange();
  else loadCore();
  loadAssignments();
  invalidate("doctors", "distribution", "overview", "workload", "upload");
}

/* ---------------------------------------------------------------- Doctor messages

   Each clinic's own ready-made WhatsApp messages - a booking confirmation, the offer,
   the address and hours, whatever that clinic needs - written here and sent by the rep
   from the lead's screen with the lead's details filled in. Not one fixed list for all
   doctors: a dental clinic and a dermatologist do not send the same three messages.
   ------------------------------------------------------------------------ */

/** Unfolds (or folds) the message list under a doctor's row. */
/* ------------------------------------------------------------------------
   A doctor's automatic sheet.

   One Google Sheet per doctor that the server reads on its own every so many minutes:
   the same link the upload page takes, the columns chosen once, and a status line that
   says when it last looked and what it found. Unfolds under the doctor's row, like the
   messages do.
   ------------------------------------------------------------------------ */
const SHEET_INTERVAL_OPTIONS = [
  { value: 10, label: "كل ١٠ دقايق" },
  { value: 15, label: "كل ربع ساعة" },
  { value: 30, label: "كل نص ساعة" },
  { value: 60, label: "كل ساعة" },
  { value: 180, label: "كل ٣ ساعات" },
  { value: 720, label: "مرتين في اليوم" },
  { value: 1440, label: "مرة في اليوم" },
];

/** The row's button says how many links the doctor has and how the last looks went. */
function applySheetButtonState(btn, sheets) {
  const list = Array.isArray(sheets) ? sheets : sheets ? [sheets] : [];
  const n = list.length;
  const failed = list.find((x) => x.lastStatus === "error");
  const running = list.filter((x) => x.enabled);
  const count = n > 1 ? ` ${n}` : "";
  btn.textContent = !n ? "الشيت" : failed ? `الشيت ⚠${count}` : running.length ? `الشيت ✓${count}` : `الشيت ⏸${count}`;
  btn.title = !n
    ? "اربط شيت جوجل يتقرا لوحده كل مدة"
    : failed
      ? `آخر فحص فشل: ${failed.lastError || ""}`
      : running.length
        ? `${n} لينك - بيتقرا ${sheetIntervalLabel(running[0].intervalMinutes)}`
        : "الفحص متوقف";
}

/** After anything changes in the panel, the button on the row above it follows - without redrawing the table under the panel. */
function refreshDoctorSheetButton(cell, sheet) {
  const row = cell.parentElement?.previousElementSibling;
  const btn = row?.querySelector(".doctor-sheet-btn");
  if (btn) applySheetButtonState(btn, sheet);
}

function sheetIntervalLabel(minutes) {
  return SHEET_INTERVAL_OPTIONS.find((o) => o.value === minutes)?.label || `كل ${minutes} دقيقة`;
}

/** A UTC stamp as Cairo date and time, for "last looked at". */
function cairoStampText(stamp) {
  const at = utcStampToDate(stamp);
  if (!at) return "—";
  const parts = splitDateTime(cairoWallStamp(at));
  return `${parts.date} ${parts.time}`;
}

/* ---------------------------------------------------------------- The day on the overview */

// The four doors a lead comes in by, always shown even at zero, then the rare two only
// when they happened (the owner, 2026-09-15: "خانة للدخل بس بأنواعه").
const SOURCE_LABELS_AR = { link: "لينكات الإعلانات", upload: "ملفات مرفوعة", sheet: "شيتات تلقائية", rep: "من التطبيق (السيلز)", import: "استيراد", manual: "إدخال يدوي" };
const SOURCE_ALWAYS_SHOWN = ["link", "sheet", "rep"];
const SOURCE_COLORS = { link: "var(--blue)", upload: "var(--violet)", sheet: "var(--good)", rep: "var(--warning)", import: "var(--gridline)", manual: "var(--gridline)" };

/**
 * What the owner asked the first screen to answer (2026-09-15): how many leads came in
 * today and from where; who did not work or barely did; what is piling up; who has work
 * waiting and is neither doing it nor pressing "مفيش شغل"; and what has been open two days.
 * Every number is a count the tables hold - none of it reads "active time".
 */
/** The order the outcome tiles are laid in: the good news first, the closed doors last. */
const ACTIVITY_OUTCOME_ORDER = ["very_interested", "interested", "follow_up", "booked", "not_interested", "no_answer", "unreachable"];

function renderDayOverview(day) {
  const lt = day.leadsToday || { total: 0, bySource: {}, byDoctor: [] };
  const period = lt.period || {};
  // Every box on this page is named after the same period: today, or the filter bar's range.
  const when = !period.isRange
    ? "النهاردة"
    : period.from && period.to
      ? `من ${period.from} لـ ${period.to}`
      : period.from
        ? `من ${period.from}`
        : `لحد ${period.to}`;
  renderActivityTiles(day.activity, when);

  const tiles = document.getElementById("arrivals-tiles");
  if (tiles) {
    tiles.innerHTML = "";
    const title = document.getElementById("arrivals-title");
    if (title) title.textContent = `ليدز جديدة دخلت السيستم ${when}`;
    const pct = (n) => (lt.total ? Math.round((n / lt.total) * 100) : null);
    const detail = lt.detail || null;
    const defs = [{ key: "total", value: lt.total, label: "إجمالي الجديد", pct: null, color: lt.total ? "var(--text-primary)" : "var(--gridline)", rows: detail }];
    for (const key of SOURCE_ALWAYS_SHOWN) {
      const n = (lt.bySource || {})[key] || 0;
      defs.push({ key, value: n, label: SOURCE_LABELS_AR[key], pct: pct(n), color: n ? SOURCE_COLORS[key] : "var(--gridline)", rows: detail && detail.filter((r) => r.kind === key) });
    }
    for (const key of ["upload", "import", "manual"]) {
      const n = (lt.bySource || {})[key] || 0;
      if (n) defs.push({ key, value: n, label: SOURCE_LABELS_AR[key], pct: pct(n), color: SOURCE_COLORS[key], rows: detail && detail.filter((r) => r.kind === key) });
    }
    const arrivalHelp = {
      total: "كل ليد جديد اتضاف للسيستم في المدة، من أي مصدر. بيوم دخوله، مش يوم ما اتشتغل عليه.",
      link: "ليدز سجّلت نفسها من لينك الإعلان بتاع الدكتور.",
      sheet: "ليدز السيستم قراها لوحده من شيت جوجل المربوط بالدكتور.",
      rep: "ليدز الموظفين ضافوها بإيديهم من التطبيق.",
      upload: "ليدز جت من ملف Excel الإدارة رفعته.",
      import: "ليدز اتستوردت من شيتات قديمة.",
      manual: "ليدز الإدارة ضافتها من الداشبورد.",
    };
    for (const d of defs) {
      d.help = arrivalHelp[d.key];
      d.unownedLabel = "لسه في المخزون - محدش سحبها";
      d.describe = (side, g) => {
        const called = g.sum.called || 0;
        if (side === "rep") {
          if (g.unowned) return `${g.n} ليد جديد لسه في مخزون ${g.under.size} دكتور، محدش سحبها.`;
          return `${g.name} سحب ${g.n} ليد جديد من ${g.under.size} دكتور${called ? `، اتكلم منهم ${called}` : "، ولسه مكلمش منهم حد"}.`;
        }
        const pool = g.unownedN || 0;
        const taken = g.n - pool;
        const reps = g.under.size - (pool ? 1 : 0);
        const who = g.name === "من غير دكتور" ? "من غير دكتور" : `لـ${g.name}`;
        return `${g.n} ليد جديد ${who}: ${taken ? `${taken} سحبهم ${reps} موظف${called ? ` واتكلم منهم ${called}` : ""}` : "محدش سحب منهم حد"}${pool ? `، و${pool} لسه في المخزون` : ""}.`;
      };
    }
    renderTileSet("arrivals", tiles, defs, when);
    const chips = document.getElementById("arrivals-doctors");
    if (chips) {
      chips.innerHTML = "";
      const rows = lt.byDoctor || [];
      chips.classList.toggle("hidden", rows.length === 0);
      for (const d of rows) {
        const chip = document.createElement("span");
        chip.className = "badge";
        chip.innerHTML = `${esc(d.doctorName)}<b>${esc(d.n)}</b>`;
        chips.appendChild(chip);
      }
    }
  }

  const reps = day.reps || [];
  const todoText = (t) => {
    if (!t) return "";
    const parts = [];
    if (t.untouched) parts.push(`${t.untouched} مكلمهاش`);
    if (t.secondDay) parts.push(`${t.secondDay} مردّش امبارح`);
    if (t.scheduled) parts.push(`${t.scheduled} متابعة فات وقتها`);
    if (t.bookings) parts.push(`${t.bookings} مكالمة تذكير`);
    if (t.messages) parts.push(`${t.messages} رسالة تذكير للي أكدوا النهاردة`);
    return parts.join(" · ");
  };

  // Warnings: work owed, barely calling, no press. The press is refused while work is
  // owed, so "no press" here means the rep has simply not cleared it.
  const warned = reps.filter((r) => r.warning);
  renderActionList(
    "ov-warnings",
    "ov-warnings-n",
    warned.map((r) => ({ title: `⚠ ${r.name}`, meta: `${r.callsToday} مكالمة · ${todoText(r.todo)}` })),
    "مفيش تحذيرات - كل اللي عنده شغل شغال فيه",
    { alert: true },
  );

  const low = reps.filter((r) => r.low).sort((a, b) => a.callsToday - b.callsToday);
  renderActionList(
    "ov-low",
    "ov-low-n",
    low.map((r) => ({
      title: r.name,
      meta: r.callsToday === 0 ? "مفيش مكالمات النهاردة" : `${r.callsToday} مكالمة بس` + (r.noWorkPresses ? ` · داس مفيش شغل ${r.noWorkPresses}` : ""),
    })),
    `كل السيلز عملوا ${day.lowWorkCalls} مكالمة أو أكتر النهاردة`,
  );

  const backlog = reps.filter((r) => r.todo && r.todo.total > 0).sort((a, b) => b.todo.total - a.todo.total);
  const backlogTotal = backlog.reduce((s, r) => s + r.todo.total, 0);
  const todoParts = (r) => {
    const t = r.todo;
    const parts = [];
    if (t.untouched) parts.push({ label: `${t.untouched} مكلمهاش`, onClick: () => openFollowupBoard("untouched", r.id) });
    if (t.secondDay) parts.push({ label: `${t.secondDay} مردّش امبارح`, onClick: () => openFollowupBoard("second_day", r.id) });
    if (t.scheduled) parts.push({ label: `${t.scheduled} متابعة فات وقتها`, onClick: () => openFollowupBoard("scheduled", r.id, { allDays: true, focus: "overdue" }) });
    if (t.bookings) parts.push({ label: `${t.bookings} مكالمة تذكير`, onClick: () => openFollowupBoard("bookings", r.id, { focus: "reminder" }) });
    if (t.messages) parts.push({ label: `${t.messages} رسالة تذكير للي أكدوا النهاردة`, onClick: () => openFollowupBoard("bookings", r.id, { focus: "message" }) });
    if (t.attendance) parts.push({ label: `${t.attendance} زيارة محتاجة تسجيل`, onClick: () => openFollowupBoard("bookings", r.id, { allDays: true, focus: "attendance" }) });
    return parts;
  };
  renderActionList(
    "ov-backlog",
    "ov-backlog-n",
    backlog.map((r) => ({ title: r.name, meta: todoText(r.todo), parts: todoParts(r) })),
    "مفيش شغل متراكم عند حد",
  );

  // --- the sheets that bring nothing, and the confirmed no-shows
  const sheets = (day.sheets || []).filter((s) => !s.enabled || s.lastStatus === "error" || !s.leads7d);
  renderActionList(
    "ov-sheets",
    "ov-sheets-n",
    sheets.map((s) => ({
      title: `${s.doctorName}${s.label ? " — " + s.label : ""}`,
      meta: !s.enabled
        ? "موقوف"
        : s.lastStatus === "error"
          ? `خطأ في القراءة${s.lastError ? ": " + String(s.lastError).slice(0, 60) : ""}`
          : `مفيش ليدز من 7 أيام${s.lastPolledAt ? " · آخر قراءة " + String(s.lastPolledAt).slice(0, 16) : ""}`,
    })),
    "كل الشيتات المربوطة جابت ليدز الأسبوع ده ✓",
    { alert: true },
  );
  const ns = day.noShowAfterConfirm || { rows: [] };
  renderActionList(
    "ov-noshow",
    "ov-noshow-n",
    (ns.rows || []).map((r) => ({
      title: r.leadName,
      leadId: r.leadId,
      meta: [
        r.doctorName,
        r.repName,
        String(r.at || "").slice(0, 10),
        r.rebooked ? "اتحجز تاني ✓" : r.nextDayCallAt ? `مكالمة تاني يوم ${String(r.nextDayCallAt).slice(0, 10)}` : "من غير مكالمة تاني يوم",
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    "محدش أكّد وبعدين مجاش في المدة دي ✓",
    { alert: true },
  );
  const services = (day.activity && day.activity.services) || [];
  renderActionList(
    "ov-services",
    "ov-services-n",
    services.map((s) => ({ title: s.name, meta: `${s.made} حجز اتعمل · ${s.visits} ميعاد · ${s.examined} كشف` })),
    "مفيش حجوزات في المدة دي",
  );
  const servicesN = document.getElementById("ov-services-n");
  if (servicesN) servicesN.textContent = services.reduce((s, x) => s + x.made, 0);
  const backlogN = document.getElementById("ov-backlog-n");
  if (backlogN) backlogN.textContent = backlogTotal;

  const stale = reps.filter((r) => r.stale > 0).sort((a, b) => b.stale - a.stale);
  renderActionList(
    "ov-stale",
    "ov-stale-n",
    stale.map((r) => ({ title: r.name, meta: `${r.stale} ليد بقاله يومين أو أكتر مفتوح` })),
    "مفيش ليدز بقالها يومين من غير ما تتقفل",
  );
  const staleN = document.getElementById("ov-stale-n");
  if (staleN) staleN.textContent = stale.reduce((s, r) => s + r.stale, 0);
}

/**
 * The period's bookings and visits, and what the calls came to (the owner, 2026-09-24).
 * An older server sends no activity block; the boxes then say so rather than showing zeros
 * that would read as "nothing happened".
 */
function renderActivityTiles(act, when) {
  const actTiles = document.getElementById("activity-tiles");
  const actTitle = document.getElementById("activity-title");
  if (actTitle) actTitle.textContent = `الحجوزات والكشوفات ${when}`;
  if (actTiles) {
    actTiles.innerHTML = "";
    if (!act) {
      actTiles.appendChild(tile("—", "السيرفر الحالي مش بيبعت الأرقام دي", null, "var(--gridline)"));
    } else {
      const v = act.visits || {};
      const pct = (n) => (v.total ? Math.round((n / v.total) * 100) : null);
      const d = act.detail || {};
      const visitRows = (status) => (d.visits ? (status ? d.visits.filter((r) => r.status === status) : d.visits) : null);
      // "Unrecorded" is every status the other three are not - the server's own split.
      const unrecordedRows = d.visits ? d.visits.filter((r) => !["examined", "no_show", "cancelled"].includes(r.status)) : null;
      const defs = [
        {
          key: "made",
          value: act.bookingsMade,
          label: act.bookingsMadeCancelled ? `حجوزات اتعملت — ${act.bookingsMadeCancelled} منهم اتلغى بعدها` : "حجوزات اتعملت",
          pct: null,
          color: act.bookingsMade ? "var(--blue)" : "var(--gridline)",
          rows: d.made || null,
        },
        { key: "total", value: v.total || 0, label: "مواعيد كشف في المدة", pct: null, color: v.total ? "var(--text-primary)" : "var(--gridline)", rows: visitRows(null) },
        { key: "examined", value: v.examined || 0, label: "تم الكشف", pct: pct(v.examined || 0), color: v.examined ? "var(--violet)" : "var(--gridline)", rows: visitRows("examined") },
        { key: "noShow", value: v.noShow || 0, label: "محضرش", pct: pct(v.noShow || 0), color: v.noShow ? "var(--critical)" : "var(--gridline)", rows: visitRows("no_show") },
        { key: "unrecorded", value: v.unrecorded || 0, label: "لسه متسجلتش نتيجته", pct: pct(v.unrecorded || 0), color: v.unrecorded ? "var(--warning)" : "var(--gridline)", rows: unrecordedRows },
      ];
      if (v.cancelled) defs.push({ key: "cancelled", value: v.cancelled, label: "اتلغت", pct: pct(v.cancelled), color: "var(--text-muted)", rows: visitRows("cancelled") });
      const activityHelp = {
        made: "حجوزات الموظفين سجّلوها في المدة، بيوم ما اتسجلت (مش يوم الزيارة). محسوبة على الموظف اللي حجز.",
        total: "كل زيارة ميعادها جوه المدة، أياً كان امتى اتحجزت: اللي اتكشفت واللي محضرتش واللي لسه متسجلتش واللي اتلغت.",
        examined: "زيارات ميعادها في المدة واتعلّم عليها «تم الكشف». النسبة من كل مواعيد المدة.",
        noShow: "زيارات ميعادها في المدة واتعلّم عليها «مجاش». النسبة من كل مواعيد المدة.",
        unrecorded: "زيارات ميعادها في المدة ومحدش سجّل عليها تم الكشف ولا مجاش لحد دلوقتي. لو من امبارح وقبله، بتمنع مفيش شغل على الموظف.",
        cancelled: "زيارات ميعادها كان في المدة واتلغى الحجز.",
        started: "حالات بدأت الخطة العلاجية بتاريخ بداية جوه المدة (من الحسابات). النسبة من الكشوفات. دي اللي بيتحسب عليها البونص.",
      };
      const visitWord = { total: "ميعاد كشف", examined: "كشف تم", noShow: "زيارة محضرتش", unrecorded: "زيارة لسه متسجلتش", cancelled: "حجز اتلغى" };
      for (const d of defs) {
        d.help = activityHelp[d.key];
        d.unownedLabel = d.key === "started" ? "مش محسوبة على موظف" : "من غير موظف";
        d.describe = (side, g) => {
          const cancelled = g.sum.cancelled || 0;
          if (d.key === "made") {
            return side === "rep"
              ? `${g.name} عمل ${g.n} حجز لعملاء ${g.under.size} دكتور${cancelled ? `، اتلغى منهم ${cancelled} بعدها` : ""}.`
              : `${g.n} حجز اتعمل لعملاء ${g.name}، حجزوهم ${g.under.size} موظف${cancelled ? `، واتلغى منهم ${cancelled}` : ""}.`;
          }
          if (d.key === "started") {
            return side === "rep"
              ? `${g.name} ليه ${g.n} حالة بدأت الخطة عند ${g.under.size} دكتور - البونص بيتحسب عليهم.`
              : `${g.n} حالة بدأت الخطة عند ${g.name}، بونصها لـ ${g.under.size} موظف.`;
          }
          const w = visitWord[d.key] || "زيارة";
          return side === "rep"
            ? `${g.n} ${w} من حجوزات ${g.name}، عند ${g.under.size} دكتور.`
            : `${g.n} ${w} عند ${g.name}، من حجوزات ${g.under.size} موظف.`;
        };
      }
      // Plans that started in the period, by the day they were recorded for - the accounts'
      // word, the same the الخطة العلاجية page flips (owner, 2026-09-24).
      defs.push({
        key: "started",
        value: act.planStarted || 0,
        label: "بدأوا الخطة العلاجية",
        pct: v.examined ? Math.round(((act.planStarted || 0) / v.examined) * 100) : null,
        color: act.planStarted ? "var(--brand)" : "var(--gridline)",
        rows: d.started || null,
      });
      renderTileSet("activity", actTiles, defs, when);
    }
  }

  const outTiles = document.getElementById("outcomes-tiles");
  const outTitle = document.getElementById("outcomes-title");
  const outNote = document.getElementById("outcomes-note");
  if (outTitle) outTitle.textContent = `نتايج المكالمات ${when}`;
  if (outTiles) {
    outTiles.innerHTML = "";
    if (!act) {
      if (outNote) outNote.textContent = "";
      outTiles.appendChild(tile("—", "السيرفر الحالي مش بيبعت الأرقام دي", null, "var(--gridline)"));
      return;
    }
    const total = act.outcomesLeads || 0;
    if (outNote) {
      outNote.textContent = total
        ? `${total} ليد اتسجلت عليهم نتيجة في المدة - كل ليد محسوب مرة واحدة بآخر نتيجة اتسجلت عليه.`
        : "مفيش نتايج اتسجلت في المدة دي. كل ليد بيتحسب مرة واحدة بآخر نتيجة اتسجلت عليه.";
    }
    const rows = act.detail && act.detail.outcomes;
    const defs = ACTIVITY_OUTCOME_ORDER.map((key) => {
      const n = (act.outcomes || {})[key] || 0;
      return {
        key,
        value: n,
        label: STATUS_LABELS[key] || key,
        pct: total ? Math.round((n / total) * 100) : null,
        color: n ? STATUS_COLORS[key] : "var(--gridline)",
        rows: rows ? rows.filter((r) => r.outcome === key) : null,
        help: `ليدز آخر نتيجة اتسجلت عليها في المدة كانت «${STATUS_LABELS[key] || key}». كل ليد محسوب مرة واحدة. محسوبة على الموظف اللي سجّل النتيجة.`,
        unownedLabel: "من غير موظف",
        describe: (side, g) =>
          side === "rep"
            ? `${g.name} سجّل «${STATUS_LABELS[key] || key}» كآخر نتيجة على ${g.n} ليد عند ${g.under.size} دكتور.`
            : `${g.n} ليد لـ${g.name} آخر نتيجة عليهم «${STATUS_LABELS[key] || key}»، سجّلها ${g.under.size} موظف.`,
      };
    });
    renderTileSet("outcomes", outTiles, defs, when);
  }
}

/* ---------------------------------------------------------------- clickable tiles */

/** Which tile is open in each set, by key, so a refresh leaves the admin where they were. */
const breakdownOpen = {};

/**
 * A row of tiles that open onto their rows: press one and a panel under the set says who
 * did how many, and for which doctor - both ways round (the owner, 2026-09-24: "مين حجز قد
 * ايه و كام للدكتور"). Pressing it again closes the panel. A tile with no rows (an older
 * server) is plain.
 */
function renderTileSet(section, mount, defs, when) {
  mount.innerHTML = "";
  const panel = document.getElementById(`${section}-detail`);
  const open = breakdownOpen[section];
  const stillThere = defs.some((d) => d.key === open && d.rows);
  if (!stillThere) breakdownOpen[section] = null;
  for (const def of defs) {
    const el = tile(def.value, def.label, def.pct, def.color);
    if (def.rows) {
      el.classList.add("clickable");
      el.title = (def.help ? def.help + " " : "") + "اضغط تشوف مين عمل كام ولأنهي دكتور.";
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      if (breakdownOpen[section] === def.key) el.classList.add("selected");
      const toggle = () => {
        breakdownOpen[section] = breakdownOpen[section] === def.key ? null : def.key;
        renderTileSet(section, mount, defs, when);
      };
      el.addEventListener("click", toggle);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    }
    mount.appendChild(el);
  }
  if (!panel) return;
  const current = defs.find((d) => d.key === breakdownOpen[section] && d.rows);
  if (!current) {
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }
  paintBreakdown(panel, current, when, () => {
    breakdownOpen[section] = null;
    renderTileSet(section, mount, defs, when);
  });
}

/** The rows behind one tile, summed by rep (with the doctors under each) and by doctor (with the reps). */
function paintBreakdown(panel, def, when, onClose) {
  panel.innerHTML = "";
  panel.classList.remove("hidden");
  const total = def.rows.reduce((s, r) => s + (Number(r.n) || 0), 0);

  const h = document.createElement("h4");
  const title = document.createElement("span");
  title.textContent = `${def.label} ${when}: ${total}`;
  const close = document.createElement("button");
  close.textContent = "✕";
  close.title = "اقفل";
  close.addEventListener("click", onClose);
  h.append(title, close);
  panel.appendChild(h);
  // What the number is, and how to read the two columns (owner, 2026-09-29: "يعني إيه اللي حصل").
  const help = document.createElement("p");
  help.className = "help";
  help.textContent = (def.help ? def.help + " " : "") + "القايمة اليمين: كل موظف وعدده، وتحته الدكاترة اللي الرقم ده اتوزع عليهم. القايمة الشمال: نفس الأرقام بالدكتور، وتحت كل دكتور الموظفين.";
  panel.appendChild(help);

  if (!total) {
    const empty = document.createElement("div");
    empty.className = "head";
    empty.textContent = "مفيش حاجة في المدة دي.";
    panel.appendChild(empty);
    return;
  }

  const unownedLabel = def.unownedLabel || "من غير موظف";
  // name -> { name, n, under: Map(otherName -> n), sum: {cancelled, called}, unowned, unownedN }
  // "unowned" marks the rep-side group of leads nobody holds; "unownedN" is, on the doctor
  // side, how many of that doctor's rows have no rep (the owner asked each line to say what
  // its number means and how many a rep took, 2026-09-29).
  const group = (rows, nameOf, otherOf, side) => {
    const map = new Map();
    for (const r of rows) {
      const name = nameOf(r);
      if (!map.has(name)) map.set(name, { name, n: 0, under: new Map(), sum: {}, unowned: side === "rep" && !r.repName, unownedN: 0 });
      const g = map.get(name);
      const k = Number(r.n) || 0;
      g.n += k;
      if (!r.repName) g.unownedN += k;
      for (const f of ["cancelled", "called"]) if (r[f] != null) g.sum[f] = (g.sum[f] || 0) + (Number(r[f]) || 0);
      const other = otherOf(r);
      g.under.set(other, (g.under.get(other) || 0) + k);
    }
    return [...map.values()].sort((a, b) => b.n - a.n);
  };
  const repOf = (r) => r.repName || unownedLabel;
  const doctorOf = (r) => r.doctorName || "من غير دكتور";
  const column = (head, side, entries) => {
    const col = document.createElement("div");
    const label = document.createElement("div");
    label.className = "head";
    label.textContent = head;
    const ul = document.createElement("ul");
    for (const g of entries) {
      const li = document.createElement("li");
      const row = document.createElement("div");
      row.className = "row";
      const nm = document.createElement("span");
      nm.textContent = g.name;
      const n = document.createElement("b");
      n.textContent = `${g.n}${total ? ` (${Math.round((g.n / total) * 100)}%)` : ""}`;
      row.append(nm, n);
      li.appendChild(row);
      // What the number means, in a sentence.
      const meaning = def.describe ? def.describe(side, g) : "";
      if (meaning) {
        const m = document.createElement("div");
        m.className = "meaning";
        m.textContent = meaning;
        li.appendChild(m);
      }
      const sub = document.createElement("div");
      sub.className = "sub";
      sub.textContent =
        (side === "rep" ? "بالدكتور: " : "بالسيلز: ") +
        [...g.under.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([other, k]) => `${other} ${k}`)
          .join(" · ");
      li.appendChild(sub);
      ul.appendChild(li);
    }
    col.append(label, ul);
    return col;
  };
  const cols = document.createElement("div");
  cols.className = "cols";
  cols.append(
    column("بالسيلز — وتحت كل واحد الدكاترة", "rep", group(def.rows, repOf, doctorOf, "rep")),
    column("بالدكتور — وتحت كل واحد السيلز", "doctor", group(def.rows, doctorOf, repOf, "doctor")),
  );
  panel.appendChild(cols);
}

/* ---------------------------------------------------------------- Team call log */

let callLogPage = 1;
let callLogSearchTimer = null;
let callLogRepsFilled = false;

/** The query string the filters currently describe. */
function callLogQuery(page) {
  const params = new URLSearchParams();
  const from = document.getElementById("calls-from").value;
  const to = document.getElementById("calls-to").value;
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const rep = document.getElementById("calls-rep").value;
  if (rep) params.set("repId", rep);
  const type = document.getElementById("calls-type").value;
  if (type) params.set("type", type);
  const q = document.getElementById("calls-q").value.trim();
  if (q) params.set("q", q);
  if (page) params.set("page", String(page));
  params.set("pageSize", "100");
  return params.toString();
}

/** "3 د 25 ث", or "—" for a ring nobody answered. */
function talkTime(seconds) {
  const s = Number(seconds) || 0;
  if (!s) return "—";
  const m = Math.floor(s / 60);
  return m ? `${m} د ${s % 60} ث` : `${s} ث`;
}

async function loadCallLog({ page } = {}) {
  const fromEl = document.getElementById("calls-from");
  const toEl = document.getElementById("calls-to");
  if (!fromEl.value) fromEl.value = todayLocal();
  if (!toEl.value) toEl.value = fromEl.value;
  if (!callLogRepsFilled) {
    // Filled once from the roster; the roster page may never have been opened.
    const select = document.getElementById("calls-rep");
    try {
      const { reps } = await api("/admin/reps", { silent: true });
      for (const rep of reps || []) {
        const opt = document.createElement("option");
        opt.value = rep.id;
        opt.textContent = rep.name;
        select.appendChild(opt);
      }
      callLogRepsFilled = true;
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
    }
  }
  callLogPage = Math.max(1, page || callLogPage);
  const isStale = beginLoad("calls");
  const data = await api(`/admin/call-log?${callLogQuery(callLogPage)}`);
  if (isStale()) return;
  renderCallLog(data);
}

function renderCallLog(data) {
  const t = data.totals || {};
  const summary = document.getElementById("calls-summary");
  summary.innerHTML = "";
  for (const [label, value] of [
    ["كل المكالمات (من غير الفايتة)", t.calls || 0],
    ["رنّة - مردّش", t.rings || 0],
    ["اتردّ عليها", t.answered || 0],
    ["واردة", t.inbound || 0],
    ["فايتة", t.missed || 0],
    ["وقت الكلام", talkTime(t.talkSeconds)],
    ["مش على ليد", t.unmatched || 0],
  ]) {
    const chip = document.createElement("span");
    chip.className = "badge";
    chip.textContent = `${label}: ${value}`;
    summary.appendChild(chip);
  }

  const byRep = document.getElementById("calls-by-rep-tbody");
  byRep.innerHTML = "";
  for (const rep of data.byRep || []) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(rep.repName)}</td>
      <td>${esc(rep.calls)}</td>
      <td>${esc(rep.answered || 0)}</td>
      <td>${esc(talkTime(rep.talkSeconds))}</td>
      <td>${esc(cairoStampText(rep.lastSyncAt))}</td>`;
    byRep.appendChild(tr);
  }
  if (!(data.byRep || []).length) byRep.innerHTML = `<tr><td colspan="5" class="empty-row">مفيش مكالمات في الفترة دي</td></tr>`;

  const tbody = document.getElementById("calls-tbody");
  const wrap = document.getElementById("calls-wrap");
  const empty = document.getElementById("calls-empty");
  tbody.innerHTML = "";
  const rows = data.rows || [];
  if (!rows.length) {
    wrap.classList.add("hidden");
    empty.classList.remove("hidden");
    empty.textContent = "مفيش مكالمات مطابقة للفلتر ده. لو الموظف اتصل فعلاً، التطبيق عنده لسه مرفعش السجل.";
  } else {
    empty.classList.add("hidden");
    wrap.classList.remove("hidden");
    for (const row of rows) {
      const tr = document.createElement("tr");
      const when = splitDateTime(cairoWallStamp(new Date(row.occurredAt)));
      const client = row.leadId
        ? `${esc(row.leadName)}${leadEditHtml(row.leadId)}${subLine(STATUS_LABELS[row.leadStatus] || row.leadStatus || "")}`
        : `${esc(row.cachedName || "—")}${subLine("مش مربوط بليد")}`;
      tr.innerHTML = `
        <td>${esc(when.date)}${subLine(when.time)}</td>
        <td>${esc(row.repName)}</td>
        <td>${esc(row.kindLabel)}</td>
        <td>${esc(talkTime(row.durationSeconds))}</td>
        <td dir="ltr">${esc(row.phoneNumber)}</td>
        <td>${client}</td>
        <td>${esc(row.doctorName || "—")}</td>`;
      tbody.appendChild(tr);
    }
  }
  const pages = Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || 100)));
  document.getElementById("calls-page-label").textContent = `صفحة ${data.page} من ${pages} · ${data.total || 0} سطر في السجل`;
  document.getElementById("calls-prev").disabled = data.page <= 1;
  document.getElementById("calls-next").disabled = data.page >= pages;
}

function exportCallLog() {
  return downloadExport(`/admin/call-log/export?${callLogQuery()}`, "calls.xlsx", document.getElementById("calls-export-btn"), "جاري التصدير...");
}


/* ---------------------------------------------------------------- حسابات الموظفين */

/**
 * What the company owes its employees, month by month, from September 2026 (owner,
 * 2026-09-21: every other money - clinics, expenses, the month's profit - is gone from
 * here). Three tabs: the month's account per employee, the cases the bonus is counted
 * from, and the employees with the bonus settings. The server holds the rules: salary
 * prorates from the joining day; every case that started its plan earns its employee the
 * case bonus in the month it started.
 */
const FINANCE_TABS = [
  { id: "payroll", label: "حساب الشهر" },
  { id: "cases", label: "الحالات" },
  { id: "employees", label: "الموظفين والبونص" },
];
let financeTab = FINANCE_TABS[0].id;
let financeMonth = "";
// The last month's payload: the employee and clinic lists feed every select and dialog.
let financeData = { clinics: [], employees: [], settings: {}, months: [] };
let financeUnlinkedUsers = [];
let financeSearchTimer = null;

function fmtMoney(value) {
  const n = Number(value) || 0;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ج`;
}

/** 2026-09 -> سبتمبر 2026, for the month picker and titles. */
function monthLabel(month) {
  if (!month) return "";
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("ar-EG", { month: "long", year: "numeric", timeZone: "UTC" });
}

function renderFinanceTabs() {
  const host = document.getElementById("finance-tabs");
  if (!host) return;
  host.innerHTML = "";
  for (const tab of FINANCE_TABS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(tab.id === financeTab));
    btn.textContent = tab.label;
    btn.addEventListener("click", () => {
      selectFinanceTab(tab.id);
      loadFinanceTab();
    });
    host.appendChild(btn);
  }
  document.querySelectorAll("#view-finance [data-finance-tab]").forEach((section) => {
    section.classList.toggle("hidden", section.dataset.financeTab !== financeTab);
  });
  const monthless = financeTab === "employees";
  document.getElementById("finance-month").classList.toggle("hidden", monthless);
  document.getElementById("finance-export-btn").classList.toggle("hidden", monthless);
}

function selectFinanceTab(id, { updateHash = true } = {}) {
  if (!FINANCE_TABS.some((t) => t.id === id)) return;
  financeTab = id;
  renderFinanceTabs();
  if (updateHash && currentView === "finance") history.replaceState(null, "", `#/finance/${id}`);
}

function fillFinanceMonths(months) {
  const select = document.getElementById("finance-month");
  const current = months.includes(financeMonth) ? financeMonth : months[0];
  select.innerHTML = "";
  for (const m of months) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = monthLabel(m);
    select.appendChild(opt);
  }
  select.value = current;
  financeMonth = current;
}

/** The month's account, which also brings the months, the employees and the clinics. */
async function fetchFinanceMonth() {
  const data = await api(`/admin/finance/payroll?month=${encodeURIComponent(financeMonth || "")}`);
  financeData = { ...financeData, ...data };
  fillFinanceMonths(data.months || []);
  fillFinanceSelects();
  return data;
}

async function loadFinance() {
  renderFinanceTabs();
  await loadFinanceTab();
}

function fillFinanceSelects() {
  const fill = (id, first, items) => {
    const sel = document.getElementById(id);
    const keep = sel.value;
    sel.innerHTML = "";
    for (const [value, label] of [first, ...items]) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      sel.appendChild(opt);
    }
    sel.value = [...sel.options].some((o) => o.value === keep) ? keep : "";
  };
  fill("fin-cases-doctor", ["", "كل العيادات"], (financeData.clinics || []).map((c) => [String(c.doctorId), c.name]));
  fill("fin-cases-employee", ["", "كل الموظفين"], (financeData.employees || []).map((e) => [String(e.id), e.name]));
}

async function loadFinanceTab() {
  switch (financeTab) {
    case "payroll":
      return loadFinancePayroll();
    case "cases":
      return loadFinanceCases();
    case "employees":
      return loadFinanceEmployees();
    default:
      return null;
  }
}

/* ---- the month */

/** A "paid" mark on a line: one tap sets it, one takes it back. */
function financePaidButton(paidAt, label, onToggle) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = paidAt ? "primary" : "";
  btn.textContent = paidAt ? `${label} ✓` : "لسه";
  btn.title = paidAt ? "اضغط لو ماتقبضش" : "اضغط لما يتقبض";
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await onToggle();
    } finally {
      btn.disabled = false;
    }
  });
  return btn;
}

async function loadFinancePayroll() {
  const isStale = beginLoad("finance-payroll");
  const data = await fetchFinanceMonth();
  if (isStale()) return;
  const t = data.totals;
  const tiles = document.getElementById("finance-tiles");
  tiles.innerHTML = "";
  tiles.append(
    tile(fmtMoney(t.salaries), "المرتبات", null),
    tile(fmtMoney(t.caseBonuses), `بونص الحالات (${t.planStarted} حالة)`, null, "var(--brand)"),
    tile(fmtMoney(t.extraBonuses), "بونص إضافي", null, "var(--brand)"),
    tile(fmtMoney(t.total), `إجمالي ${monthLabel(data.month)}`, null, "var(--warning)"),
    tile(fmtMoney(t.paid), "اتقبض", null),
    tile(fmtMoney(t.remaining), "لسه", null, t.remaining > 0 ? "var(--critical)" : null),
  );
  const unassigned = document.getElementById("finance-unassigned");
  unassigned.classList.toggle("hidden", !t.unassignedStarted);
  unassigned.textContent = t.unassignedStarted
    ? `⚠ ${t.unassignedStarted} حالة بدأت الخطة الشهر ده ومش متسجلة على موظف - مفيش حد هياخد بونصها. افتحها من تبويب الحالات واختار الموظف.`
    : "";

  const tbody = document.getElementById("fin-payroll-tbody");
  tbody.innerHTML = "";
  const put = (l, body) => api("/admin/finance/payroll", { method: "PUT", body: { month: financeMonth, employeeId: l.employeeId, ...body } });
  for (const l of data.payroll || []) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(l.name)}${l.needsData ? subLine("⚠ كمّل الراتب وتاريخ الانضمام") : ""}${l.status === "stopped" ? subLine("متوقف") : ""}</td>
      <td>${esc(l.salary == null ? "—" : fmtMoney(l.salary))}</td>
      <td>${esc(l.workDays)} / ${esc(l.monthDays)}</td>
      <td style="font-weight:600">${esc(fmtMoney(l.salaryDue))}</td>
      <td></td>
      <td style="font-weight:600">${esc(fmtMoney(l.caseBonus))}${l.planStarted ? subLine(`${l.planStarted} × ${fmtMoney(l.bonusRate)}`) : ""}${l.casesBonusPaid ? subLine(`اتدفع بونص ${l.casesBonusPaid} من ${l.planStarted} حالة`) : ""}</td>
      <td>${esc(fmtMoney(l.extraBonus))}${l.extraNote ? subLine(l.extraNote) : ""}</td>
      <td style="font-weight:700">${esc(fmtMoney(l.total))}</td>
      <td></td>
      <td></td>
      <td style="white-space:normal; max-width:200px">${esc(l.note || "")}</td>
      <td style="white-space:nowrap"></td>`;

    const countCell = tr.children[4];
    if (l.planStarted) {
      const show = document.createElement("button");
      show.type = "button";
      show.className = "link-btn";
      show.textContent = `${l.planStarted} حالة ▾`;
      show.addEventListener("click", () => toggleFinanceBonusCases(tr, l));
      countCell.appendChild(show);
    } else {
      countCell.textContent = "0";
    }

    tr.children[8].appendChild(
      financePaidButton(l.salaryPaidAt, "اتقبض", async () => {
        await put(l, { salaryPaid: !l.salaryPaidAt });
        loadFinancePayroll();
      }),
    );
    if (l.bonusTotal > 0 || l.bonusPaidAt) {
      tr.children[9].appendChild(
        financePaidButton(l.bonusPaidAt, "اتقبض", async () => {
          await put(l, { bonusPaid: !l.bonusPaidAt });
          loadFinancePayroll();
        }),
      );
    } else {
      tr.children[9].textContent = "—";
    }

    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "✎";
    edit.title = "بونص إضافي وملاحظات";
    edit.addEventListener("click", async () => {
      const values = await openDialog({
        title: `${l.name} - ${monthLabel(financeMonth)}`,
        sub: `بونص الحالات (${fmtMoney(l.caseBonus)}) بيتحسب لوحده. هنا البونص الزيادة بس - سيبه صفر لو مفيش.`,
        fields: [
          {
            name: "extraBonus",
            label: "بونص إضافي (جنيه)",
            type: "number",
            value: l.extraBonus || 0,
            hint: financeData.settings.badgeBonus ? `بونص البادج المقترح: ${fmtMoney(financeData.settings.badgeBonus)}` : "",
          },
          { name: "extraNote", label: "سببه", value: l.extraNote || "", placeholder: "بادج ممتاز مثلاً" },
          { name: "note", label: "ملاحظات الشهر", value: l.note || "" },
        ],
        confirmLabel: "حفظ",
      });
      if (!values) return;
      await put(l, values);
      toast("اتحفظت ✓");
      loadFinancePayroll();
    });
    tr.lastElementChild.appendChild(edit);
    tbody.appendChild(tr);
  }
  if (!(data.payroll || []).length) {
    tbody.innerHTML = '<tr><td colspan="12" class="empty-row">مفيش موظفين على الشهر ده - ضيفهم من تبويب الموظفين</td></tr>';
  }
}

/** The cases behind a line's case bonus, opened under it. */
function toggleFinanceBonusCases(tr, l) {
  const next = tr.nextElementSibling;
  if (next && next.dataset.bonusFor === String(l.employeeId)) return next.remove();
  const holder = document.createElement("tr");
  holder.dataset.bonusFor = String(l.employeeId);
  const cell = document.createElement("td");
  cell.colSpan = tr.children.length;
  cell.style.cssText = "background:var(--surface-2); padding:10px 16px; white-space:normal";
  const list = document.createElement("ol");
  list.style.cssText = "margin:0; padding-inline-start:20px; font-size:13px; line-height:1.9";
  for (const c of l.cases) {
    const li = document.createElement("li");
    li.textContent =
      `${c.caseName || "من غير اسم"} — ${c.clinicName || "—"} — بدأت ${c.planStartedOn}` +
      (c.reportedByName ? ` (سجّلها ${c.reportedByName} من الموبايل)` : "") +
      (c.bonusPaidAt ? " — تم دفع البونص ✓" : "");
    list.appendChild(li);
  }
  cell.appendChild(list);
  holder.appendChild(cell);
  tr.after(holder);
}

/* ---- cases */

function financeCasesQuery() {
  const q = new URLSearchParams();
  q.set("month", financeMonth);
  const doc = document.getElementById("fin-cases-doctor").value;
  const emp = document.getElementById("fin-cases-employee").value;
  const plan = document.getElementById("fin-cases-plan").value;
  const text = document.getElementById("fin-cases-q").value.trim();
  if (doc) q.set("doctorId", doc);
  if (emp) q.set("employeeId", emp);
  if (plan) q.set("plan", plan);
  if (document.getElementById("fin-cases-flagged").checked) q.set("flagged", "1");
  if (text) q.set("q", text);
  return q.toString();
}

async function loadFinanceCases() {
  const isStale = beginLoad("finance-cases");
  if (!financeMonth || !financeData.months || !financeData.months.length) await fetchFinanceMonth();
  const data = await api(`/admin/finance/cases?${financeCasesQuery()}`);
  if (isStale()) return;
  const tbody = document.getElementById("fin-cases-tbody");
  tbody.innerHTML = "";
  const labels = data.flagLabels || {};
  for (const c of data.cases || []) {
    const tr = document.createElement("tr");
    if (!c.arrived) tr.className = "inactive-row";
    const flags = (c.flags || "").split(",").filter(Boolean).map((f) => labels[f] || f);
    tr.innerHTML = `
      <td>${esc(c.day)}</td>
      <td>${esc(c.clinicName || "—")}</td>
      <td>${esc(c.caseName || "—")}${flags.length ? subLine("⚠ " + flags.join("، ")) : ""}${!c.arrived ? subLine("الكشف اتلغى - مش محسوبة") : ""}</td>
      <td dir="ltr">${esc(c.phone || "—")}</td>
      <td>${c.employeeId ? esc(c.employeeName || "—") : `<span style="color:var(--warning)">${esc(c.employeeName || "من غير موظف")}</span>${subLine("مش هتتحسب بونص لحد")}`}</td>
      <td></td>
      <td></td>
      <td style="white-space:normal; max-width:220px">${esc(c.notes || "")}</td>
      <td style="white-space:nowrap"></td>`;
    const planCell = tr.children[5];
    // "تم دفع بونص الحالة" (owner, 2026-10-06): the case's own bonus handed to the girl -
    // there to press once the plan started, and kept on show while it is marked.
    const bonusCell = tr.children[6];
    bonusCell.style.whiteSpace = "nowrap";
    if ((c.planStarted && c.arrived) || c.bonusPaidAt) {
      const paidBtn = document.createElement("button");
      paidBtn.type = "button";
      paidBtn.className = c.bonusPaidAt ? "primary" : "";
      paidBtn.textContent = c.bonusPaidAt ? "تم دفع البونص ✓" : "تم دفع بونص الحالة";
      paidBtn.title = c.bonusPaidAt ? `اتدفع ${String(c.bonusPaidAt).slice(0, 10)} - اضغط لو اتسجل غلط` : "اضغط لما بونص الحالة دي يتدفع للموظف";
      paidBtn.addEventListener("click", async () => {
        if (c.bonusPaidAt && !(await confirmDialog("تشيل علامة «تم دفع البونص»؟", { sub: `${c.caseName || "—"} - ${c.employeeName || "—"}`, confirmLabel: "شيلها" }))) return;
        paidBtn.disabled = true;
        try {
          await api(`/admin/finance/cases/${c.id}`, { method: "PATCH", body: { bonusPaid: !c.bonusPaidAt } });
          toast(c.bonusPaidAt ? "اتشالت علامة الدفع" : "اتسجل إن بونص الحالة اتدفع ✓");
          dirtyViews.add("finance");
          loadFinanceCases();
        } finally {
          paidBtn.disabled = false;
        }
      });
      bonusCell.appendChild(paidBtn);
    } else {
      bonusCell.textContent = "—";
    }
    const planBtn = document.createElement("button");
    planBtn.type = "button";
    planBtn.className = c.planStarted ? "primary" : "";
    planBtn.textContent = c.planStarted ? `بدأت ✓${c.planStartedOn ? " " + c.planStartedOn : ""}` : "لسه";
    planBtn.title = c.planStarted ? "اضغط لإلغاء بداية الخطة" : "اضغط لما الحالة تبدأ الخطة - البونص بيتحسب في الشهر ده";
    planBtn.addEventListener("click", async () => {
      planBtn.disabled = true;
      try {
        await api(`/admin/finance/cases/${c.id}`, { method: "PATCH", body: { planStarted: !c.planStarted } });
        toast(c.planStarted ? "اتشالت بداية الخطة - والبونص بتاعها" : "اتسجلت بداية الخطة ✓ - البونص اتحسب");
        loadFinanceCases();
      } finally {
        planBtn.disabled = false;
      }
    });
    planCell.appendChild(planBtn);
    if (c.planStarted && c.planReportedByName) {
      const who = document.createElement("div");
      who.style.cssText = "font-size:11px; color:var(--text-muted)";
      who.textContent = planReportedLine(c.planReportedByName, c.planReportedByRole);
      planCell.appendChild(who);
    }
    const actions = tr.lastElementChild;
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "✎";
    edit.title = "تعديل";
    edit.addEventListener("click", () => openFinanceCaseDialog(c));
    actions.appendChild(edit);
    if (c.source !== "system") {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "danger";
      del.textContent = "🗑";
      del.title = "مسح";
      del.style.marginInlineStart = "4px";
      del.addEventListener("click", async () => {
        if (!(await confirmDialog("مسح الحالة دي؟", { sub: `${c.caseName || "—"} - ${c.clinicName || "—"} - ${c.day}`, confirmLabel: "امسح" }))) return;
        await api(`/admin/finance/cases/${c.id}`, { method: "DELETE" });
        toast("اتمسحت");
        loadFinanceCases();
      });
      actions.appendChild(del);
    }
    tbody.appendChild(tr);
  }
  if (!(data.cases || []).length) tbody.innerHTML = '<tr><td colspan="9" class="empty-row">مفيش حالات مطابقة</td></tr>';
}

function financeClinicOptions(includeNone) {
  const opts = (financeData.clinics || []).map((c) => ({ value: String(c.doctorId), label: c.name }));
  return includeNone ? [{ value: "", label: "— اختار العيادة —" }, ...opts] : opts;
}

function financeEmployeeOptions(includeNone) {
  const opts = (financeData.employees || []).map((e) => ({ value: String(e.id), label: e.name + (e.status === "stopped" ? " (متوقف)" : "") }));
  return includeNone ? [{ value: "", label: "— من غير موظف —" }, ...opts] : opts;
}

async function openFinanceCaseDialog(existing) {
  const system = existing && existing.source === "system";
  const fields = [];
  if (!system) {
    fields.push(
      { name: "day", label: "تاريخ الكشف", type: "date", value: existing ? existing.day : todayLocal(), required: true },
      { name: "doctorId", label: "العيادة", type: "select", options: financeClinicOptions(true), value: existing ? existing.doctorId || "" : "" },
      { name: "caseName", label: "اسم الحالة", value: existing ? existing.caseName || "" : "" },
      { name: "phone", label: "رقم الهاتف", type: "tel", value: existing ? existing.phone || "" : "" },
    );
  }
  fields.push(
    { name: "employeeId", label: "الموظف (اللي هياخد البونص)", type: "select", options: financeEmployeeOptions(true), value: existing ? existing.employeeId || "" : "" },
    {
      name: "planStarted",
      label: "بدأت الخطة؟",
      type: "select",
      options: [
        { value: "0", label: "لا" },
        { value: "1", label: "نعم" },
      ],
      value: existing && existing.planStarted ? "1" : "0",
    },
    { name: "planStartedOn", label: "تاريخ بداية الخطة - البونص بينزل في شهره (فاضي = النهارده)", type: "date", value: existing ? existing.planStartedOn || "" : "" },
    { name: "notes", label: "ملاحظات", type: "textarea", value: existing ? existing.notes || "" : "" },
  );
  const values = await openDialog({
    title: existing ? "تعديل حالة" : "حالة جديدة",
    sub: system ? `${existing.caseName || ""} - ${existing.clinicName || ""} - ${existing.day} (جاية من حجز: التاريخ والعيادة والاسم بيتعدلوا من الحجوزات)` : null,
    fields,
    confirmLabel: "حفظ",
  });
  if (!values) return;
  const body = { ...values, planStarted: values.planStarted === "1", clearFlags: true };
  if (existing) await api(`/admin/finance/cases/${existing.id}`, { method: "PATCH", body });
  else await api("/admin/finance/cases", { method: "POST", body });
  toast("اتحفظت ✓");
  // The case is listed on the follow-up pages too, and the pen may have been pressed there.
  ["plan-start", "workload", "reminders", "overview", "finance"].forEach((v) => dirtyViews.add(v));
  if (currentView === "finance") loadFinanceCases();
  else runViewLoader(currentView);
}

/* ---- employees and the bonus settings */

async function loadFinanceEmployees() {
  const isStale = beginLoad("finance-employees");
  const data = await api("/admin/finance/employees");
  if (isStale()) return;
  financeData.employees = data.employees || [];
  financeUnlinkedUsers = data.unlinkedUsers || [];
  financeData.settings = data.settings || financeData.settings;
  document.getElementById("fin-set-bonus").value = financeData.settings.bonusPerCase ?? 100;
  document.getElementById("fin-set-badge").value = financeData.settings.badgeBonus ?? 0;
  const tbody = document.getElementById("fin-employees-tbody");
  tbody.innerHTML = "";
  for (const e of financeData.employees) {
    const tr = document.createElement("tr");
    if (e.status === "stopped") tr.className = "inactive-row";
    tr.innerHTML = `
      <td>${esc(e.name)}${e.groupName ? subLine(e.groupName) : ""}${e.needsData ? subLine("⚠ كمّل الراتب وتاريخ الانضمام") : ""}</td>
      <td>${esc(e.userId ? "مربوط ✓" : "بالاسم بس")}</td>
      <td>${esc(e.salary == null ? "—" : fmtMoney(e.salary))}</td>
      <td>${esc(e.joinedOn || "—")}${e.leftOn ? subLine("لحد " + e.leftOn) : ""}</td>
      <td>${esc(e.status === "active" ? "نشط" : "متوقف")}</td>
      <td>${esc(fmtMoney(e.bonus))}${e.bonusPerCase == null ? subLine("الافتراضي") : ""}</td>
      <td>${esc(e.planStartedThisMonth)}</td>
      <td style="white-space:nowrap"></td>`;
    const actions = tr.lastElementChild;
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "✎";
    edit.addEventListener("click", () => openFinanceEmployeeDialog(e));
    actions.appendChild(edit);
    if (e.deletable) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "danger";
      del.textContent = "🗑";
      del.style.marginInlineStart = "4px";
      del.addEventListener("click", async () => {
        if (!(await confirmDialog(`مسح ${e.name} من الحسابات؟`, { confirmLabel: "امسح" }))) return;
        await api(`/admin/finance/employees/${e.id}`, { method: "DELETE" });
        toast("اتمسح");
        loadFinanceEmployees();
      });
      actions.appendChild(del);
    }
    tbody.appendChild(tr);
  }
  if (!financeData.employees.length) tbody.innerHTML = '<tr><td colspan="8" class="empty-row">مفيش موظفين لسه - أول حالة تتكشف بتضيف صاحبها لوحدها، أو ضيفهم من هنا</td></tr>';
}

async function openFinanceEmployeeDialog(existing) {
  const userOptions = [{ value: "", label: "— من غير حساب —" }];
  if (existing && existing.userId) userOptions.push({ value: String(existing.userId), label: "الحساب الحالي" });
  for (const u of financeUnlinkedUsers) userOptions.push({ value: String(u.id), label: u.name });
  const values = await openDialog({
    title: existing ? `تعديل ${existing.name}` : "موظف جديد",
    sub: `بونص الحالة الافتراضي دلوقتي ${fmtMoney(financeData.settings.bonusPerCase)}. سيبه فاضي عشان يمشي على الافتراضي.`,
    fields: [
      { name: "name", label: "الاسم", value: existing ? existing.name : "", required: true },
      { name: "userId", label: "حساب النظام", type: "select", options: userOptions, value: existing && existing.userId ? String(existing.userId) : "" },
      { name: "salary", label: "الراتب الثابت (جنيه)", type: "number", value: existing ? existing.salary ?? "" : "" },
      { name: "joinedOn", label: "تاريخ الانضمام", type: "date", value: existing ? existing.joinedOn || "" : todayLocal() },
      {
        name: "status",
        label: "الحالة",
        type: "select",
        options: [
          { value: "active", label: "نشط" },
          { value: "stopped", label: "متوقف" },
        ],
        value: existing ? existing.status : "active",
      },
      { name: "leftOn", label: "تاريخ الترك (لو اتوقف)", type: "date", value: existing ? existing.leftOn || "" : "" },
      { name: "bonusPerCase", label: "بونص الحالة (جنيه)", type: "number", value: existing ? existing.bonusPerCase ?? "" : "" },
      { name: "groupName", label: "الجروب", value: existing ? existing.groupName || "" : "" },
      { name: "notes", label: "ملاحظات", type: "textarea", value: existing ? existing.notes || "" : "" },
    ],
    confirmLabel: "حفظ",
  });
  if (!values) return;
  if (existing) await api(`/admin/finance/employees/${existing.id}`, { method: "PATCH", body: values });
  else await api("/admin/finance/employees", { method: "POST", body: values });
  toast("اتحفظ ✓");
  loadFinanceEmployees();
}

async function saveFinanceSettings() {
  const body = {
    bonusPerCase: document.getElementById("fin-set-bonus").value,
    badgeBonus: document.getElementById("fin-set-badge").value,
  };
  const { settings } = await api("/admin/finance/settings", { method: "PUT", body });
  financeData.settings = settings;
  toast("اتحفظ ✓ - الرقم الجديد بيتحسب على كل الشهور، حتى اللي فاتت");
  loadFinanceEmployees();
}

function exportFinance() {
  const kind = financeTab === "cases" ? "cases" : "payroll";
  return downloadExport(
    `/admin/finance/export?kind=${kind}&month=${encodeURIComponent(financeMonth)}`,
    `${kind}-${financeMonth}.xlsx`,
    document.getElementById("finance-export-btn"),
    "جاري التصدير...",
  );
}

/* ---------------------------------------------------------------- Clinic portal */

/** The clinic's page panel under the doctor's row: link, password, on/off. */
async function toggleDoctorPortal(doctor, row) {
  const existing = row.nextElementSibling;
  if (existing && existing.dataset.portalFor === String(doctor.id)) {
    existing.remove();
    return;
  }
  if (existing && (existing.dataset.sheetFor === String(doctor.id) || existing.dataset.messagesFor === String(doctor.id))) existing.remove();
  const holder = document.createElement("tr");
  holder.dataset.portalFor = String(doctor.id);
  const cell = document.createElement("td");
  cell.colSpan = row.children.length;
  cell.style.cssText = "background:var(--surface-2); padding:12px 16px; white-space:normal";
  cell.textContent = "جاري التحميل...";
  holder.appendChild(cell);
  row.after(holder);
  await renderDoctorPortal(doctor, cell);
}

/**
 * The doctor's readable name, and the two addresses it makes.
 *
 * Both are printed and forwarded - one goes into their adverts, the other to their
 * secretary - so the name is typed here once and serves both, and each address gets a
 * copy button rather than asking anyone to transcribe it off a screen.
 */
function renderDoctorLink(doctor, cell, link) {
  const box = document.createElement("div");
  box.style.cssText = "margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid var(--surface-2)";

  const title = document.createElement("div");
  title.textContent = "لينك الدكتور";
  title.style.cssText = "font-weight:600; margin-bottom:6px";
  box.appendChild(title);

  const row = document.createElement("div");
  row.style.cssText = "display:flex; gap:6px; align-items:center; flex-wrap:wrap";
  const prefix = document.createElement("span");
  prefix.textContent = `${link.base || location.origin}/dr/`;
  prefix.style.cssText = "color:var(--text-secondary); font-size:13px; direction:ltr";
  const input = document.createElement("input");
  input.type = "text";
  input.value = link.slug || link.suggestion || "";
  input.placeholder = "karim-naim";
  input.dir = "ltr";
  input.style.cssText = "width:190px";
  if (!link.slug && link.suggestion) input.title = "اقتراح من اسم الدكتور - عدّله زي ما تحب";
  const save = document.createElement("button");
  save.className = "primary";
  save.textContent = link.slug ? "غيّر" : "احفظ";
  row.append(prefix, input, save);
  box.appendChild(row);

  const links = document.createElement("div");
  links.style.cssText = "margin-top:8px";
  box.appendChild(links);

  const showLinks = (data) => {
    links.innerHTML = "";
    if (!data.slug) {
      const hint = document.createElement("div");
      hint.textContent = "اكتب اسم اللينك عشان تطلع لينك التسجيل ولينك العيادة.";
      hint.style.cssText = "color:var(--text-secondary); font-size:12.5px";
      links.appendChild(hint);
      return;
    }
    [
      ["لينك التسجيل (للإعلانات)", data.joinUrl],
      ["لينك العيادة (بالباسورد)", data.clinicUrl],
    ].forEach(([label, url]) => {
      const rowEl = document.createElement("div");
      rowEl.style.cssText = "display:flex; gap:8px; align-items:center; margin:4px 0; flex-wrap:wrap";
      const name = document.createElement("span");
      name.textContent = label;
      name.style.cssText = "font-size:12.5px; color:var(--text-secondary); min-width:150px";
      const a = document.createElement("a");
      a.href = url;
      a.textContent = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.style.cssText = "font-size:12.5px; direction:ltr";
      const copy = document.createElement("button");
      copy.textContent = "نسخ";
      copy.addEventListener("click", async () => {
        await navigator.clipboard.writeText(url);
        copy.textContent = "اتنسخ ✓";
        setTimeout(() => (copy.textContent = "نسخ"), 1200);
      });
      rowEl.append(name, a, copy);
      links.appendChild(rowEl);
    });
  };
  showLinks(link);

  save.addEventListener("click", async () => {
    save.disabled = true;
    try {
      const data = await api(`/admin/doctors/${doctor.id}/link`, { method: "PUT", body: { slug: input.value } });
      input.value = data.slug;
      save.textContent = "غيّر";
      showLinks(data);
      // Said out loud because it is the one edit here that reaches outside: an advert and
      // a clinic may already be pointing at the old one.
      toast("اتحفظ. لو اللينك القديم متبعوت لحد، ابعتله الجديد", "good");
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      toast(e.message, "bad");
    }
    save.disabled = false;
  });

  cell.appendChild(box);
}

async function renderDoctorPortal(doctor, cell) {
  let portal;
  let link;
  try {
    ({ portal } = await api(`/admin/doctors/${doctor.id}/portal`));
    link = await api(`/admin/doctors/${doctor.id}/link`);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    cell.textContent = e.message;
    return;
  }
  cell.innerHTML = "";
  renderDoctorLink(doctor, cell, link);
  const line = (text, muted = true) => {
    const p = document.createElement("div");
    p.textContent = text;
    p.style.cssText = `margin:4px 0; ${muted ? "color:var(--text-secondary); font-size:13px" : ""}`;
    cell.appendChild(p);
    return p;
  };
  const actions = document.createElement("div");
  actions.style.cssText = "display:flex; gap:6px; flex-wrap:wrap; margin-top:10px";
  const button = (label, onClick, primary = false) => {
    const b = document.createElement("button");
    b.textContent = label;
    if (primary) b.className = "primary";
    b.addEventListener("click", onClick);
    actions.appendChild(b);
    return b;
  };
  const askPassword = (title) =>
    promptDialog(title, {
      sub: "الدكتور بيدخل بيه على لينك العيادة، ومش هيقدر يغيّره بنفسه - لو نسيه غيّره من هنا.",
      label: "باسورد العيادة",
      type: "text",
      placeholder: "مثلاً clinic-2026",
      confirmLabel: "حفظ",
    });

  if (!portal) {
    line(`مفيش لينك لـ ${doctor.name} لسه. اللينك صفحة للاطلاع بس: الدكتور يشوف حجوزاته وحالتها (مؤكد / اتأجّل / ملغي / حضر) بدل جروب الواتساب، وكل تعديل بيجي من التطبيق أو الداشبورد.`, false);
    button("أنشئ اللينك", async () => {
      const password = await askPassword(`باسورد لينك ${doctor.name}`);
      if (password == null) return;
      try {
        await api(`/admin/doctors/${doctor.id}/portal`, { method: "PUT", body: { password } });
      } catch (e) {
        if (!(e instanceof ApiError)) throw e;
        return toast(e.message, "bad");
      }
      toast("اتعمل لينك العيادة", "good");
      renderDoctorPortal(doctor, cell);
    }, true);
    cell.appendChild(actions);
    return;
  }

  const head = document.createElement("div");
  head.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap";
  const title = document.createElement("strong");
  title.textContent = `لينك عيادة ${doctor.name} — ${portal.enabled ? "شغّال" : "موقوف"}`;
  head.appendChild(title);
  cell.appendChild(head);

  const linkRow = document.createElement("div");
  linkRow.style.cssText = "display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin:8px 0";
  const linkInput = document.createElement("input");
  linkInput.type = "text";
  linkInput.readOnly = true;
  linkInput.value = portal.url;
  linkInput.style.cssText = "flex:1 1 320px; direction:ltr; font-size:13px";
  linkInput.addEventListener("focus", () => linkInput.select());
  linkRow.appendChild(linkInput);
  const copy = document.createElement("button");
  copy.textContent = "نسخ اللينك";
  copy.addEventListener("click", () => copyText(portal.url));
  linkRow.appendChild(copy);
  if (doctor.phone) {
    const wa = document.createElement("a");
    wa.textContent = "ابعته واتساب للدكتور";
    wa.className = "link-btn";
    wa.target = "_blank";
    wa.rel = "noopener";
    const intl = String(doctor.phone).replace(/\D/g, "").replace(/^0/, "20");
    wa.href = `https://wa.me/${intl}?text=${encodeURIComponent(`لينك حجوزات عيادتك على Lead to Doctor:\n${portal.url}\nالباسورد هيوصلك على حدة.`)}`;
    linkRow.appendChild(wa);
  }
  cell.appendChild(linkRow);
  line(`آخر دخول للدكتور: ${portal.lastSeenAt ? cairoStampText(portal.lastSeenAt) : "لسه مدخلش"} · آخر تعديل: ${cairoStampText(portal.updatedAt)}`);
  line("الباسورد مش بيتعرض هنا. لو الدكتور نسيه غيّره بزرار «غيّر الباسورد» وابعته له من جديد؛ أي تغيير بيقفل جلساته المفتوحة.");

  button("غيّر الباسورد", async () => {
    const password = await askPassword(`باسورد جديد لعيادة ${doctor.name}`);
    if (password == null) return;
    try {
      await api(`/admin/doctors/${doctor.id}/portal`, { method: "PUT", body: { password } });
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      return toast(e.message, "bad");
    }
    toast("اتغيّر باسورد العيادة", "good");
    renderDoctorPortal(doctor, cell);
  });
  button(portal.enabled ? "أوقف اللينك" : "شغّل اللينك", async () => {
    if (portal.enabled && !(await confirmDialog(`توقف لينك عيادة ${doctor.name}؟`, { sub: "الدكتور مش هيقدر يفتح الصفحة لحد ما تشغّله تاني. الحجوزات نفسها مبتتأثرش." }))) return;
    await api(`/admin/doctors/${doctor.id}/portal`, { method: "PUT", body: { enabled: !portal.enabled } });
    toast(portal.enabled ? "اتوقف لينك العيادة" : "اتشغّل لينك العيادة", "good");
    renderDoctorPortal(doctor, cell);
  });
  button("لينك جديد", async () => {
    if (!(await confirmDialog("تعمل لينك جديد؟", { sub: "اللينك القديم هيبطل يشتغل فوراً - لو اتسرّب أو اتبعت لحد غلط. الباسورد زي ما هو." }))) return;
    await api(`/admin/doctors/${doctor.id}/portal/rotate`, { method: "POST" });
    toast("اتعمل لينك جديد - ابعته للدكتور", "good");
    renderDoctorPortal(doctor, cell);
  });
  cell.appendChild(actions);
}

async function toggleDoctorSheet(doctor, row) {
  const existing = row.nextElementSibling;
  if (existing && existing.dataset.sheetFor === String(doctor.id)) {
    existing.remove();
    return;
  }
  // One unfolded panel at a time under a row: the messages panel gives way.
  if (existing && existing.dataset.messagesFor === String(doctor.id)) existing.remove();
  const holder = document.createElement("tr");
  holder.dataset.sheetFor = String(doctor.id);
  const cell = document.createElement("td");
  cell.colSpan = row.children.length;
  cell.style.cssText = "background:var(--surface-2); padding:12px 16px; white-space:normal";
  cell.textContent = "جاري التحميل...";
  holder.appendChild(cell);
  row.after(holder);
  await renderDoctorSheet(doctor, cell);
}

async function renderDoctorSheet(doctor, cell) {
  let sheets;
  let services = [];
  try {
    [{ sheets }, { services }] = await Promise.all([api(`/admin/doctors/${doctor.id}/sheets`), api("/admin/services").catch(() => ({ services: [] }))]);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    cell.textContent = e.message;
    return;
  }
  cell.innerHTML = "";
  refreshDoctorSheetButton(cell, sheets);
  if (!sheets.length) {
    renderDoctorSheetForm(doctor, cell, null, { hasOthers: false });
    return;
  }
  const serviceName = (id) => (services || []).find((x) => x.id === id)?.name || null;

  sheets.forEach((sheet, index) => {
    const box = document.createElement("div");
    box.style.cssText = "padding:10px 0" + (index ? "; border-top:1px solid var(--gridline); margin-top:10px" : "");
    cell.appendChild(box);
    renderDoctorSheetBlock(doctor, cell, box, sheet, serviceName(sheet.serviceId), sheets.length);
  });

  // A second form for a second service - the owner runs "تقويم" and "زراعة" as two campaigns.
  const addWrap = document.createElement("div");
  addWrap.style.cssText = "margin-top:12px";
  const addBtn = document.createElement("button");
  addBtn.textContent = "+ اربط لينك تاني (خدمة تانية)";
  addBtn.addEventListener("click", () => {
    addBtn.disabled = true;
    const formHost = document.createElement("div");
    formHost.style.cssText = "margin-top:10px; padding-top:10px; border-top:1px dashed var(--gridline)";
    addWrap.appendChild(formHost);
    renderDoctorSheetForm(doctor, formHost, null, { hasOthers: true, panel: cell });
  });
  addWrap.appendChild(addBtn);
  cell.appendChild(addWrap);
}

/** One link's block: what it reads, how the last look went, and its own buttons. */
function renderDoctorSheetBlock(doctor, cell, box, sheet, serviceName, total) {
  const head = document.createElement("div");
  head.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px";
  const title = document.createElement("strong");
  const what = sheet.label || serviceName || (total > 1 ? `لينك ${sheet.id}` : `شيت ${doctor.name}`);
  title.textContent = `${what}${serviceName && sheet.label ? ` · ${serviceName}` : ""} — ${sheet.enabled ? "شغّال" : "متوقف"} · ${sheetIntervalLabel(sheet.intervalMinutes)}`;
  head.appendChild(title);
  const actions = document.createElement("div");
  actions.style.cssText = "display:flex; gap:6px; flex-wrap:wrap";
  head.appendChild(actions);
  box.appendChild(head);

  const info = document.createElement("div");
  info.style.cssText = "font-size:13px; color:var(--text-secondary); display:grid; gap:4px; margin-bottom:10px";
  const cols = sheet.columns;
  const colText = !cols.phone
    ? "هتتحدد لوحدها أول ما ينزل في الشيت ليدز"
    : [
        `الرقم: ${cols.phone}`,
        cols.phoneBackup ? `احتياطي: ${cols.phoneBackup}` : null,
        cols.name ? `الاسم: ${cols.name}` : "الاسم: (مفيش - بيتسجل بدون اسم)",
        cols.whatsapp ? `واتساب: ${cols.whatsapp}` : null,
      ].filter(Boolean).join(" · ");
  const lastLine = !sheet.lastPolledAt
    ? "لسه ما اتفحصش"
    : sheet.lastStatus === "ok"
      ? `آخر فحص ${cairoStampText(sheet.lastPolledAt)}: ${sheet.lastNewCount} جديد من ${sheet.lastTotalRows} صف`
      : `آخر فحص ${cairoStampText(sheet.lastPolledAt)} فشل`;
  info.innerHTML = `
    <div><a href="${esc(sheet.sheetUrl)}" target="_blank" rel="noopener" style="word-break:break-all">${esc(sheet.sheetUrl)}</a></div>
    <div>الخدمة: ${esc(serviceName || "بدون خدمة محددة")} · الأعمدة — ${esc(colText)}</div>
    <div>${esc(lastLine)}${sheet.lastStatus === "error" ? ` <span style="color:var(--critical)">${esc(sheet.lastError || "")}</span>` : ""}</div>
    <div>إجمالي اللي دخل من اللينك ده: <strong>${esc(sheet.totalImported)}</strong>${sheet.enabled && sheet.nextPollAt ? ` · الفحص الجاي ${esc(cairoStampText(sheet.nextPollAt))}` : ""}</div>`;
  box.appendChild(info);

  const runBtn = document.createElement("button");
  runBtn.className = "primary";
  runBtn.textContent = "افحص دلوقتي";
  runBtn.addEventListener("click", async () => {
    runBtn.disabled = true;
    try {
      const { result } = await api(`/admin/doctor-sheets/${sheet.id}/run`, { method: "POST" });
      toast(result.ok ? `الشيت اتفحص: ${result.newCount} ليد جديد من ${result.totalRows} صف` : result.error, result.ok ? "good" : "bad");
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      toast(e.message, "bad");
    }
    await renderDoctorSheet(doctor, cell);
  });
  actions.appendChild(runBtn);

  const pauseBtn = document.createElement("button");
  pauseBtn.textContent = sheet.enabled ? "أوقف الفحص" : "شغّل الفحص";
  pauseBtn.addEventListener("click", async () => {
    await api(`/admin/doctor-sheets/${sheet.id}`, { method: "PATCH", body: { enabled: !sheet.enabled } });
    toast(sheet.enabled ? "الفحص اتوقف" : "الفحص اشتغل تاني", "good");
    await renderDoctorSheet(doctor, cell);
  });
  actions.appendChild(pauseBtn);

  const paceBtn = document.createElement("button");
  paceBtn.textContent = "غيّر المدة";
  paceBtn.addEventListener("click", async () => {
    const values = await openDialog({
      title: `كل قد إيه يتفحص اللينك ده؟`,
      confirmLabel: "حفظ",
      fields: [{ name: "interval", label: "المدة", type: "select", value: sheet.intervalMinutes, options: SHEET_INTERVAL_OPTIONS.map((o) => ({ value: String(o.value), label: o.label })) }],
    });
    if (!values) return;
    await api(`/admin/doctor-sheets/${sheet.id}`, { method: "PATCH", body: { intervalMinutes: Number(values.interval) } });
    await renderDoctorSheet(doctor, cell);
  });
  actions.appendChild(paceBtn);

  const editBtn = document.createElement("button");
  editBtn.textContent = "عدّل الربط";
  editBtn.addEventListener("click", () => {
    box.innerHTML = "";
    renderDoctorSheetForm(doctor, box, sheet, { hasOthers: true, panel: cell });
  });
  actions.appendChild(editBtn);

  const unlinkBtn = document.createElement("button");
  unlinkBtn.className = "danger";
  unlinkBtn.textContent = "فك الربط";
  unlinkBtn.addEventListener("click", async () => {
    const ok = await confirmDialog(`فك ربط اللينك ده من ${doctor.name}؟`, {
      sub: "الفحص التلقائي هيقف للينك ده بس. الليدز اللي دخلت منه بتفضل زي ما هي.",
      confirmLabel: "فك الربط",
    });
    if (!ok) return;
    await api(`/admin/doctor-sheets/${sheet.id}`, { method: "DELETE" });
    toast("اتفك الربط", "good");
    await renderDoctorSheet(doctor, cell);
  });
  actions.appendChild(unlinkBtn);
}

/**
 * Linking a sheet: the link, then its columns read live so the admin points at the
 * right ones, then how often. Saving looks at the sheet at once and says what it found.
 */
function renderDoctorSheetForm(doctor, cell, current, { hasOthers = false, panel = null } = {}) {
  const form = document.createElement("div");
  form.style.cssText = "display:grid; gap:10px; max-width:720px";
  form.innerHTML = `
    <strong>${current ? "تعديل ربط شيت" : "ربط شيت جوجل بـ"} ${esc(doctor.name)}</strong>
    <div style="font-size:12.5px; color:var(--text-secondary)">
      الشيت لازم يكون متشارك "أي حد عنده اللينك" (Anyone with the link). السيرفر هيقراه لوحده كل مدة ويدخّل الأرقام الجديدة بس في حملة "شيت ${esc(doctor.name)} (تلقائي)" - المكرر والغلط بيتفلتروا زي الرفع العادي.
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center">
      <input type="url" class="sheet-url" placeholder="https://docs.google.com/spreadsheets/d/..." style="flex:1; min-width:280px" value="${esc(current?.sheetUrl || "")}">
      <button class="sheet-read">اقرا الأعمدة</button>
    </div>
    <label style="font-size:13px; max-width:280px">اسم اللينك (اختياري - زي "حملة التقويم")
      <input type="text" class="sheet-label" maxlength="80" style="width:100%" value="${esc(current?.label || "")}">
    </label>
    <div class="sheet-columns hidden" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px">
      <label style="font-size:13px">عمود الرقم (لازم)<select class="sheet-col-phone"></select></label>
      <label style="font-size:13px">عمود الاسم<select class="sheet-col-name"></select></label>
      <label style="font-size:13px">عمود الواتساب<select class="sheet-col-whatsapp"></select></label>
      <label style="font-size:13px">رقم احتياطي (لو الأول فاضي)<select class="sheet-col-phone-backup"></select></label>
      <label style="font-size:13px">واتساب احتياطي<select class="sheet-col-whatsapp-backup"></select></label>
      <label style="font-size:13px">اسم احتياطي<select class="sheet-col-name-backup"></select></label>
      <label style="font-size:13px">كل قد إيه<select class="sheet-interval"></select></label>
    </div>
    <!--
      The service is the batch's, not a column's, and it applies to a sheet with no rows
      yet too - so it sits outside the columns box, which stays hidden until a read.
      Without it here every save wrote service_id = null, and leads from an automatic
      sheet arrived with no service at all while the manual upload has asked since day one.
    -->
    <label style="font-size:13px; max-width:280px">الخدمة (لكل الليدز من الشيت ده)
      <select class="sheet-service" style="width:100%"><option value="">بدون خدمة محددة</option></select>
    </label>
    <div class="sheet-sample hidden" style="font-size:12px; color:var(--text-muted); overflow:auto"></div>
    <div style="display:flex; gap:8px; align-items:center">
      <button class="primary sheet-save hidden">${current ? "احفظ وافحص دلوقتي" : "اربط وافحص دلوقتي"}</button>
      <button class="sheet-cancel">${current ? "رجوع" : "إلغاء"}</button>
    </div>`;
  cell.appendChild(form);

  const urlInput = form.querySelector(".sheet-url");
  const readBtn = form.querySelector(".sheet-read");
  // Set when the sheet has no rows yet: there is nothing to point at, so the server is
  // asked to work the columns out on the first read that does have rows.
  let columnsLater = false;
  const columnsBox = form.querySelector(".sheet-columns");
  const sampleBox = form.querySelector(".sheet-sample");
  const saveBtn = form.querySelector(".sheet-save");
  const serviceSel = form.querySelector(".sheet-service");
  // Fetched rather than passed in: this form is opened one doctor at a time and the list
  // is small. A failure leaves "بدون خدمة محددة", which is what the field meant before.
  api("/admin/services")
    .then(({ services }) => {
      (services || []).filter((s) => s.active).forEach((svc) => {
        const opt = document.createElement("option");
        opt.value = String(svc.id);
        opt.textContent = svc.name;
        if (current && current.serviceId === svc.id) opt.selected = true;
        serviceSel.appendChild(opt);
      });
    })
    .catch(() => {});

  const intervalSel = form.querySelector(".sheet-interval");
  SHEET_INTERVAL_OPTIONS.forEach((o) => {
    const opt = document.createElement("option");
    opt.value = String(o.value);
    opt.textContent = o.label;
    if (o.value === (current?.intervalMinutes ?? 30)) opt.selected = true;
    intervalSel.appendChild(opt);
  });

  const fillSelect = (sel, headers, chosen, optional) => {
    sel.innerHTML = "";
    if (optional) {
      const none = document.createElement("option");
      none.value = "";
      none.textContent = "— مفيش —";
      sel.appendChild(none);
    }
    headers.forEach((h) => {
      const opt = document.createElement("option");
      opt.value = h;
      opt.textContent = h;
      if (h === chosen) opt.selected = true;
      sel.appendChild(opt);
    });
  };

  readBtn.addEventListener("click", async () => {
    const sheetUrl = urlInput.value.trim();
    if (!sheetUrl) return toast("حط لينك الشيت الأول", "bad");
    readBtn.disabled = true;
    try {
      const data = await api("/admin/sheet-headers", { method: "POST", body: { sheetUrl } });
      columnsLater = !!data.empty;
      if (data.empty) {
        // A campaign that has not run yet is exactly when linking is worth doing.
        columnsBox.classList.add("hidden");
        sampleBox.innerHTML =
          "الشيت لسه فاضي (مفيش ليدز نزلت). تقدر تربطه دلوقتي وهنحدد الأعمدة لوحدنا أول ما ينزل فيه ليدز.";
        sampleBox.classList.remove("hidden");
        saveBtn.classList.remove("hidden");
        return;
      }
      // The columns already chosen lead; the server's guess from the headings fills every
      // gap, the WhatsApp column included. This dialog used to guess on its own, with a
      // phone rule that matched "whats" and no WhatsApp default at all - so a sheet whose
      // WhatsApp question came first had it taken for the phone, and one linked with the
      // WhatsApp picker left at "مفيش" imported every lead without its WhatsApp number.
      const cols = current?.columns || {};
      const guess = data.guess || {};
      const pick = (field) => cols[field] || guess[field] || "";
      fillSelect(form.querySelector(".sheet-col-phone"), data.headers, pick("phone"), false);
      fillSelect(form.querySelector(".sheet-col-name"), data.headers, pick("name"), true);
      fillSelect(form.querySelector(".sheet-col-whatsapp"), data.headers, pick("whatsapp"), true);
      fillSelect(form.querySelector(".sheet-col-phone-backup"), data.headers, pick("phoneBackup"), true);
      // These two were worked out by the server and never shown, so every save from this
      // form wrote them back as null - quietly undoing the WhatsApp-column fix on the very
      // sheets it was meant for. A field the form does not show is a field it destroys.
      fillSelect(form.querySelector(".sheet-col-whatsapp-backup"), data.headers, pick("whatsappBackup"), true);
      fillSelect(form.querySelector(".sheet-col-name-backup"), data.headers, pick("nameBackup"), true);
      sampleBox.innerHTML = `<div>${esc(data.totalRows)} صف. أول صفوف:</div>` +
        `<table style="font-size:12px"><thead><tr>${data.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>` +
        data.sampleRows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("") + "</tbody></table>";
      columnsBox.classList.remove("hidden");
      sampleBox.classList.remove("hidden");
      saveBtn.classList.remove("hidden");
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      toast(e.message, "bad");
    } finally {
      readBtn.disabled = false;
    }
  });

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    try {
      const { result } = await api(current ? `/admin/doctor-sheets/${current.id}` : `/admin/doctors/${doctor.id}/sheets`, {
        method: current ? "PUT" : "POST",
        body: {
          label: form.querySelector(".sheet-label").value.trim() || null,
          sheetUrl: urlInput.value.trim(),
          columns: columnsLater
            ? {}
            : {
                phone: form.querySelector(".sheet-col-phone").value,
                phoneBackup: form.querySelector(".sheet-col-phone-backup").value || null,
                name: form.querySelector(".sheet-col-name").value || null,
                nameBackup: form.querySelector(".sheet-col-name-backup").value || null,
                whatsapp: form.querySelector(".sheet-col-whatsapp").value || null,
                whatsappBackup: form.querySelector(".sheet-col-whatsapp-backup").value || null,
              },
          columnsLater,
          serviceId: serviceSel.value || null,
          intervalMinutes: Number(intervalSel.value),
          enabled: current ? current.enabled : true,
        },
      });
      toast(
        !result.ok
          ? `اتربط، بس الفحص فشل: ${result.error}`
          : result.waiting
            ? "اتربط. الشيت لسه فاضي - هنفحصه لوحدنا وأول ما ينزل ليدز هيدخلوا"
            : `اتربط واتفحص: ${result.newCount} ليد جديد من ${result.totalRows} صف`,
        result.ok ? "good" : "bad",
      );
      await renderDoctorSheet(doctor, panel || cell);
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      toast(e.message, "bad");
      saveBtn.disabled = false;
    }
  });

  form.querySelector(".sheet-cancel").addEventListener("click", async () => {
    if (current || hasOthers) {
      const host = panel || cell;
      host.innerHTML = "";
      await renderDoctorSheet(doctor, host);
    } else if (typeof cell.onSheetCancel === "function") {
      // Inside the onboarding screen there is no row panel to fold away.
      cell.onSheetCancel();
    } else {
      cell.parentElement.remove();
    }
  });
}

async function toggleDoctorMessages(doctor, row) {
  const existing = row.nextElementSibling;
  if (existing && existing.dataset.messagesFor === String(doctor.id)) {
    existing.remove();
    return;
  }
  // One unfolded panel at a time under a row: the sheet panel gives way.
  if (existing && existing.dataset.sheetFor === String(doctor.id)) existing.remove();
  const holder = document.createElement("tr");
  holder.dataset.messagesFor = String(doctor.id);
  const cell = document.createElement("td");
  cell.colSpan = row.children.length;
  cell.style.cssText = "background:var(--surface-2); padding:12px 16px";
  cell.textContent = "جاري التحميل...";
  holder.appendChild(cell);
  row.after(holder);
  await renderDoctorMessages(doctor, cell);
}

async function renderDoctorMessages(doctor, cell) {
  let data;
  try {
    data = await api(`/admin/doctors/${doctor.id}/messages`);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    cell.textContent = e.message;
    return;
  }
  cell.innerHTML = "";

  const head = document.createElement("div");
  head.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px";
  const title = document.createElement("strong");
  title.textContent = `رسايل ${doctor.name} (${data.messages.length})`;
  head.appendChild(title);
  if (canManageData()) {
    const add = document.createElement("button");
    add.className = "primary";
    add.textContent = "+ رسالة جديدة";
    add.addEventListener("click", () => editDoctorMessage(doctor, null, cell));
    head.appendChild(add);
  }
  cell.appendChild(head);

  const hint = document.createElement("div");
  hint.style.cssText = "font-size:12px; color:var(--text-secondary); margin-bottom:10px";
  hint.textContent =
    "الاسم هو اللي بيظهر على تليفون السيلز كزرار، والنص هو اللي بيتبعت للعميل على الواتساب. المتغيرات المتاحة: " +
    data.placeholders.map((k) => `{{${k}}}`).join(" ");
  cell.appendChild(hint);

  if (!data.messages.length) {
    const empty = document.createElement("div");
    empty.style.color = "var(--text-muted)";
    empty.textContent = "مفيش رسايل للدكتور ده لسه.";
    cell.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.style.cssText = "display:grid; gap:8px";
  data.messages.forEach((m) => {
    const item = document.createElement("div");
    item.style.cssText = "background:var(--surface-1); border:1px solid var(--gridline); border-radius:10px; padding:10px 12px";
    const top = document.createElement("div");
    top.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:8px";
    const name = document.createElement("strong");
    name.textContent = m.title;
    top.appendChild(name);
    if (canManageData()) {
      const actions = document.createElement("span");
      const edit = iconButton("✎", "تعديل");
      edit.addEventListener("click", () => editDoctorMessage(doctor, m, cell));
      const del = iconButton("🗑", "مسح");
      del.style.marginInlineStart = "6px";
      del.addEventListener("click", async () => {
        const ok = await confirmDialog(`مسح رسالة "${m.title}"`, { sub: "هتختفي من تليفونات السيلز على طول.", confirmLabel: "امسح" });
        if (!ok) return;
        await api(`/admin/doctor-messages/${m.id}`, { method: "DELETE" });
        toast("اتمسحت الرسالة", "good");
        renderDoctorMessages(doctor, cell);
      });
      actions.append(edit, del);
      top.appendChild(actions);
    }
    const body = document.createElement("div");
    body.style.cssText = "white-space:pre-wrap; font-size:13px; color:var(--text-secondary); margin-top:6px";
    body.textContent = m.body;
    item.append(top, body);
    list.appendChild(item);
  });
  cell.appendChild(list);
}

/** One dialog for a new message and for editing one: the name the rep sees, and the text the client gets. */
async function editDoctorMessage(doctor, message, cell) {
  const values = await openDialog({
    title: message ? `تعديل "${message.title}"` : `رسالة جديدة لـ ${doctor.name}`,
    sub: "اكتب اسم قصير يظهر كزرار على التليفون، والنص كامل زي ما هيوصل للعميل.",
    confirmLabel: "حفظ",
    fields: [
      { name: "title", label: "اسم الرسالة (على التليفون)", required: true, value: message ? message.title : "" },
      { name: "body", label: "نص الرسالة", type: "textarea", required: true, value: message ? message.body : "" },
    ],
  });
  if (!values) return;
  if (message) {
    await api(`/admin/doctor-messages/${message.id}`, { method: "PATCH", body: { title: values.title, body: values.body } });
  } else {
    await api(`/admin/doctors/${doctor.id}/messages`, { method: "POST", body: { title: values.title, body: values.body } });
  }
  toast("اتحفظت الرسالة", "good");
  renderDoctorMessages(doctor, cell);
}

/* ------------------------------------------------------------------------
   Doctor onboarding.

   Setting a clinic up meant five places: the doctor on this page, the sheet and the
   messages and the clinic link under the row, the reps on the distribution page. This
   is one screen that walks through them in order, using the same panels those places
   use, so there is one way each thing is done. What is done is read from the server
   every time (GET /admin/doctors/:id/onboarding), never remembered here, so leaving
   halfway and coming back tomorrow opens on the step that is still missing.
   ------------------------------------------------------------------------ */
const ONBOARD_STEPS = [
  { key: "basics", label: "بيانات الدكتور" },
  { key: "sheet", label: "ربط الشيت" },
  { key: "messages", label: "رسايل الواتساب" },
  { key: "reps", label: "تعيين السيلز" },
  { key: "portal", label: "لينك الدكتور والعيادة" },
  { key: "review", label: "المراجعة" },
];

const ONBOARD_SLOTS = [
  { value: "", label: "— مش مربوط —" },
  { value: "primary", label: "أساسي" },
  { value: "secondary", label: "احتياطي ١" },
  { value: "tertiary", label: "احتياطي ٢" },
];

/** Opens the onboarding screen - for a doctor already in the system, or (with null) a new one. */
function openOnboarding(doctor = null) {
  const state = { doctor, status: null, step: "basics" };

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  const modal = document.createElement("div");
  modal.className = "modal xwide onboard";
  modal.innerHTML = `
    <div class="ob-head">
      <div>
        <h2 class="ob-title"></h2>
        <div class="ob-progress"><div class="ob-bar"><span></span></div><span class="ob-count"></span></div>
      </div>
      <button class="ob-close" aria-label="قفل">✕</button>
    </div>
    <div class="ob-body">
      <nav class="ob-steps"></nav>
      <div class="ob-main">
        <div class="ob-step-head"><h3></h3><p class="ob-why"></p></div>
        <div class="ob-content"></div>
      </div>
    </div>
    <div class="ob-foot">
      <button class="ob-prev">→ السابق</button>
      <span class="ob-foot-note"></span>
      <button class="primary ob-next">التالي ←</button>
    </div>`;
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const $ = (sel) => modal.querySelector(sel);
  const content = $(".ob-content");

  let closeShell = null;
  const close = () => {
    observer.disconnect();
    if (closeShell) closeShell();
    backdrop.remove();
    // Whatever was set up here shows on the doctors table, the pickers and the split.
    reloadDoctors();
    loadAssignments();
    invalidate("doctors", "distribution", "overview", "workload", "upload");
  };
  $(".ob-close").addEventListener("click", close);

  const statusOf = (key) => state.status?.steps.find((s) => s.key === key) || null;
  const stepIndex = () => ONBOARD_STEPS.findIndex((s) => s.key === state.step);

  /** The side list and the progress bar, from the latest status. */
  function paintNav() {
    $(".ob-title").textContent = state.doctor ? `أونبوردنج ${state.doctor.name}` : "أونبوردنج دكتور جديد";
    const steps = state.status?.steps || [];
    const done = steps.filter((s) => s.done).length;
    $(".ob-bar span").style.width = steps.length ? `${Math.round((done / steps.length) * 100)}%` : "0";
    $(".ob-count").textContent = steps.length ? `${done} من ${steps.length} خطوات خلصت` : "ابدأ ببيانات الدكتور";

    const nav = $(".ob-steps");
    nav.innerHTML = "";
    ONBOARD_STEPS.forEach((step, i) => {
      const s = statusOf(step.key);
      const btn = document.createElement("button");
      btn.className = "ob-step" + (step.key === state.step ? " current" : "");
      // Nothing past the first step can be set up for a doctor who does not exist yet.
      btn.disabled = !state.doctor && step.key !== "basics";
      const icon = step.key === "review" ? "★" : !s ? "○" : s.warn ? "⚠" : s.done ? "✓" : "○";
      const cls = step.key === "review" ? "" : !s ? "" : s.warn ? "warn" : s.done ? "done" : s.required ? "missing" : "";
      btn.innerHTML = `
        <span class="ob-icon ${cls}">${icon}</span>
        <span class="ob-step-text">
          <span class="ob-step-label">${i + 1}. ${esc(step.label)}${s && s.required && !s.done ? ' <em>لازم</em>' : ""}</span>
          ${s ? `<span class="ob-step-detail">${esc(s.warn || s.detail)}</span>` : ""}
        </span>`;
      btn.addEventListener("click", () => go(step.key));
      nav.appendChild(btn);
    });

    const i = stepIndex();
    $(".ob-prev").disabled = i === 0;
    const last = i === ONBOARD_STEPS.length - 1;
    $(".ob-next").textContent = last ? "خلصت ✓" : "التالي ←";
    $(".ob-next").disabled = !state.doctor;
    const s = statusOf(state.step);
    $(".ob-foot-note").textContent = s && !s.done ? (s.required ? "الخطوة دي لازمة عشان الليدز توصل وتتسحب" : "اختياري - تقدر تعدّيها وترجعلها بعدين") : "";
  }

  async function refreshStatus() {
    if (!state.doctor) return paintNav();
    try {
      state.status = await api(`/admin/doctors/${state.doctor.id}/onboarding`, { silent: true });
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
    }
    paintNav();
  }

  // The embedded panels save on their own and redraw themselves when they do, so a redraw
  // in the content is the signal that something may have changed - the checklist follows.
  let refreshTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshStatus, 700);
  });
  observer.observe(content, { childList: true, subtree: true });

  const STEP_WHY = {
    basics: "الاسم والمجموعة. المجموعة بتحدد مين من السيلز يقدر يشتغل على الدكتور ده.",
    sheet: "شيت جوجل اللي الليدز بتنزل فيه من الإعلانات. السيستم بيقراه لوحده كل مدة ويدخّل الأرقام الجديدة بس.",
    messages: "الرسايل الجاهزة اللي السيلز بيبعتها واتساب من على التليفون: المواعيد، العنوان، تأكيد الحجز.",
    reps: "مين من السيلز يسحب ليدز الدكتور ده. من غير ما حد يتربط، الليدز بتقعد في المخزن ومحدش بيكلمها.",
    portal: "لينك التسجيل اللي بيتحط في الإعلانات، وصفحة العيادة اللي الدكتور يشوف منها حجوزاته بالباسورد.",
    review: "ملخص بكل خطوة. تقدر ترجع لأي خطوة ناقصة من هنا.",
  };

  async function go(key) {
    state.step = key;
    const step = ONBOARD_STEPS.find((s) => s.key === key);
    $(".ob-step-head h3").textContent = step.label;
    $(".ob-why").textContent = STEP_WHY[key];
    paintNav();
    content.innerHTML = "";
    const cell = document.createElement("div");
    cell.className = "ob-panel";
    content.appendChild(cell);
    await STEP_RENDER[key](cell);
  }

  const STEP_RENDER = {
    async basics(cell) {
      if (state.doctor) {
        cell.innerHTML = `
          <div class="ob-facts">
            <div><span>الاسم</span><strong>${esc(state.doctor.name)}</strong></div>
            <div><span>المجموعة</span><strong>${esc(groupLabel(state.doctor.groupId))}</strong></div>
          </div>
          <p class="ob-hint">تغيير المجموعة بيشيل ربط السيلز من المجموعة القديمة، فبيتعمل من زرار ✎ في صفحة الدكاترة مش من هنا.</p>`;
        return;
      }
      cell.innerHTML = `
        <div class="ob-form">
          <label>اسم الدكتور<input type="text" class="ob-name" placeholder="د. ..." maxlength="80"></label>
          <label>المجموعة<select class="ob-group"></select></label>
          <button class="primary ob-create">احفظ وكمّل ←</button>
        </div>`;
      const select = cell.querySelector(".ob-group");
      groupOptions().forEach((o) => select.add(new Option(o.label, o.value)));
      const nameInput = cell.querySelector(".ob-name");
      setTimeout(() => nameInput.focus(), 0);
      cell.querySelector(".ob-create").addEventListener("click", async (ev) => {
        const name = nameInput.value.trim();
        if (!name) {
          toast("اكتب اسم الدكتور", "bad");
          return nameInput.focus();
        }
        if (allDoctors.some((d) => d.name.trim() === name) && !(await confirmDialog(`فيه دكتور اسمه "${name}" بالفعل`, { sub: "تضيفه تاني كدكتور منفصل؟", confirmLabel: "أيوه ضيفه", danger: false }))) return;
        ev.target.disabled = true;
        try {
          const created = await api("/admin/doctors", { method: "POST", body: { name, groupId: select.value } });
          state.doctor = { id: created.id, name: created.name, groupId: created.groupId };
          toast(`اتضاف ${created.name}`, "good");
          reloadDoctors();
          await refreshStatus();
          go("sheet");
        } catch (e) {
          if (!(e instanceof ApiError)) throw e;
          ev.target.disabled = false;
        }
      });
    },

    async sheet(cell) {
      const tools = document.createElement("div");
      tools.className = "ob-tools";
      tools.innerHTML = `<span class="ob-hint">الخدمة مش موجودة في اللستة؟</span>`;
      const addService = document.createElement("button");
      addService.textContent = "+ خدمة جديدة";
      addService.addEventListener("click", async () => {
        const name = await promptDialog("خدمة جديدة", { label: "اسم الخدمة", placeholder: "مثلاً زراعة أسنان", confirmLabel: "إضافة" });
        if (!name) return;
        try {
          await api("/admin/services", { method: "POST", body: { name } });
        } catch (e) {
          if (!(e instanceof ApiError)) throw e;
          return;
        }
        toast(`اتضافت خدمة ${name} - اختارها من لستة الخدمة`, "good");
        invalidate("services");
        go("sheet");
      });
      tools.appendChild(addService);
      cell.before(tools);
      cell.onSheetCancel = () => go("sheet");
      await renderDoctorSheet(state.doctor, cell);
    },

    async messages(cell) {
      const tools = document.createElement("div");
      tools.className = "ob-tools";
      const others = allDoctors.filter((d) => d.id !== state.doctor.id);
      tools.innerHTML = `<span class="ob-hint">ابدأ من رسايل دكتور تاني وعدّل التفاصيل:</span>`;
      const pick = document.createElement("select");
      pick.add(new Option("اختار دكتور...", ""));
      others.forEach((d) => pick.add(new Option(d.name, d.id)));
      const copy = document.createElement("button");
      copy.textContent = "انسخ رسايله";
      copy.addEventListener("click", async () => {
        if (!pick.value) return toast("اختار الدكتور اللي هتنسخ منه", "bad");
        copy.disabled = true;
        try {
          const r = await api(`/admin/doctors/${state.doctor.id}/messages/copy`, { method: "POST", body: { fromDoctorId: pick.value } });
          toast(
            r.copied
              ? `اتنسخ ${r.copied} رسالة من ${r.from}${r.skipped ? ` (${r.skipped} كانوا موجودين)` : ""} - راجع العنوان والمواعيد`
              : `مفيش رسايل جديدة تتنسخ من ${r.from}`,
            r.copied ? "good" : "",
          );
          go("messages");
        } catch (e) {
          if (!(e instanceof ApiError)) throw e;
          copy.disabled = false;
        }
      });
      tools.append(pick, copy);
      cell.before(tools);
      await renderDoctorMessages(state.doctor, cell);
    },

    async reps(cell) {
      cell.textContent = "جاري التحميل...";
      let data;
      try {
        data = await api("/admin/assignments", { silent: true });
      } catch (e) {
        if (!(e instanceof ApiError)) throw e;
        cell.textContent = e.message;
        return;
      }
      allReps = data.reps;
      const doctorId = state.doctor.id;
      const reps = data.reps.filter((r) => r.groupId === state.doctor.groupId);
      cell.innerHTML = "";
      if (!reps.length) {
        cell.innerHTML = `<div class="empty"><strong>مفيش سيلز في مجموعة ${esc(groupLabel(state.doctor.groupId))}</strong>ضيف موظف للمجموعة دي من صفحة الحسابات الأول.</div>`;
        return;
      }
      const slotOf = (r) => (r.primaryDoctorId === doctorId ? "primary" : r.secondaryDoctorId === doctorId ? "secondary" : r.tertiaryDoctorId === doctorId ? "tertiary" : "");
      const nameIn = (r, which) => r[`${which}DoctorName`] || null;

      const table = document.createElement("table");
      table.className = "ob-reps";
      table.innerHTML = `<thead><tr><th>الموظف</th><th>شغال دلوقتي على</th><th>${esc(state.doctor.name)} عنده</th></tr></thead><tbody></tbody>`;
      const tbody = table.querySelector("tbody");
      reps.forEach((rep) => {
        const tr = document.createElement("tr");
        const current = slotOf(rep);
        if (current) tr.className = "linked";
        const book = ["primary", "secondary", "tertiary"]
          .map((w) => ({ w, name: nameIn(rep, w) }))
          .filter((x) => x.name)
          .map((x) => `<span class="ob-chip${rep[DOCTOR_SLOT_FIELD[x.w]] === doctorId ? " this" : ""}">${esc(ONBOARD_SLOTS.find((s) => s.value === x.w).label)}: ${esc(x.name)}</span>`)
          .join(" ");
        tr.innerHTML = `<td><strong>${esc(rep.name)}</strong>${rep.away ? ' <span class="ob-hint">(غايب النهاردة)</span>' : ""}</td><td>${book || '<span class="ob-hint">مفيش</span>'}</td><td></td>`;
        const sel = document.createElement("select");
        ONBOARD_SLOTS.forEach((s) => sel.add(new Option(s.label, s.value)));
        sel.value = current;
        sel.setAttribute("aria-label", `${state.doctor.name} عند ${rep.name}`);
        sel.addEventListener("change", async () => {
          const target = sel.value;
          const body = { primaryDoctorId: rep.primaryDoctorId, secondaryDoctorId: rep.secondaryDoctorId, tertiaryDoctorId: rep.tertiaryDoctorId };
          // Out of whatever slot it held, then into the chosen one.
          for (const w of ["primary", "secondary", "tertiary"]) if (body[DOCTOR_SLOT_FIELD[w]] === doctorId) body[DOCTOR_SLOT_FIELD[w]] = null;
          const replaced = target ? nameIn(rep, target) : null;
          if (target && replaced && rep[DOCTOR_SLOT_FIELD[target]] !== doctorId) {
            const label = ONBOARD_SLOTS.find((s) => s.value === target).label;
            const ok = await confirmDialog(`${rep.name}: ${label} هيبقى ${state.doctor.name}`, {
              sub: `بدل ${replaced}. ${rep.name} مش هيسحب من مخزون ${replaced} كـ${label} تاني، والليدز اللي معاه منه بتفضل معاه.`,
              confirmLabel: "غيّر",
              danger: false,
            });
            if (!ok) {
              sel.value = current;
              return;
            }
          }
          if (target) body[DOCTOR_SLOT_FIELD[target]] = doctorId;
          sel.disabled = true;
          try {
            const r = await api(`/admin/reps/${rep.id}/doctors`, { method: "POST", body });
            toast(target ? `${rep.name} اتربط بـ ${state.doctor.name}` : `اتشال ربط ${rep.name}`, "good");
            if (r.warning) toast(r.warning, "bad");
          } catch (e) {
            if (!(e instanceof ApiError)) throw e;
          }
          go("reps");
        });
        tr.lastElementChild.appendChild(sel);
        tbody.appendChild(tr);
      });
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      wrap.appendChild(table);
      cell.appendChild(wrap);
      const tip = document.createElement("p");
      tip.className = "ob-hint";
      tip.textContent = "أساسي = بيسحب من الدكتور ده الأول. احتياطي = بيسحب منه لما مخزون الأساسي بتاعه يخلص. ده نفس اللي في صفحة التوزيع.";
      cell.appendChild(tip);
    },

    async portal(cell) {
      await renderDoctorPortal(state.doctor, cell);
    },

    async review(cell) {
      await refreshStatus();
      const s = state.status;
      if (!s) return;
      cell.innerHTML = "";
      const summary = document.createElement("div");
      summary.className = `ob-summary ${s.missingRequired ? "missing" : "ok"}`;
      summary.textContent = s.complete
        ? `${state.doctor.name} جاهز بالكامل 🎉`
        : s.missingRequired
          ? `ناقص ${s.missingRequired} خطوة لازمة - من غيرها الليدز مش هتوصل أو محدش هيسحبها`
          : `الأساسي خلص والليدز هتشتغل. ناقص ${s.missingCount} خطوة اختيارية`;
      cell.appendChild(summary);
      s.steps.forEach((step) => {
        const row = document.createElement("div");
        row.className = "ob-review-row";
        row.innerHTML = `
          <span class="ob-icon ${step.warn ? "warn" : step.done ? "done" : step.required ? "missing" : ""}">${step.warn ? "⚠" : step.done ? "✓" : "○"}</span>
          <div><strong>${esc(step.label)}</strong>${step.required ? "" : ' <span class="ob-hint">(اختياري)</span>'}<div class="ob-hint">${esc(step.detail)}${step.warn ? ` · ${esc(step.warn)}` : ""}</div></div>`;
        if (!step.done || step.warn) {
          const fix = document.createElement("button");
          fix.textContent = step.done ? "راجع" : "كمّلها";
          fix.addEventListener("click", () => go(step.key));
          row.appendChild(fix);
        }
        cell.appendChild(row);
      });
    },
  };

  $(".ob-prev").addEventListener("click", () => {
    const i = stepIndex();
    if (i > 0) go(ONBOARD_STEPS[i - 1].key);
  });
  $(".ob-next").addEventListener("click", () => {
    const i = stepIndex();
    if (i < ONBOARD_STEPS.length - 1) go(ONBOARD_STEPS[i + 1].key);
    else close();
  });

  closeShell = openModalShell(backdrop, { onDismiss: close, initialFocus: $(".ob-close") });

  (async () => {
    await refreshStatus();
    // Back where it was left: the first required step still missing, then any missing one.
    const steps = state.status?.steps || [];
    const next = steps.find((s) => s.required && !s.done) || steps.find((s) => !s.done);
    go(state.doctor ? (next ? next.key : "review") : "basics");
  })();
}

/** The reps whose primary, secondary, or tertiary slot points at this doctor. */
function repsLinkedToDoctor(doctorId) {
  return allReps.filter(
    (r) => r.primaryDoctorId === doctorId || r.secondaryDoctorId === doctorId || r.tertiaryDoctorId === doctorId,
  );
}

/**
 * What removing these doctors takes with them, said before the admin confirms.
 *
 * The counts come from the list already on screen, so the dialog can be exact about
 * campaigns, leads and links without a preview request. The one thing it cannot know is
 * whether a lead has been called - the server refuses the whole doctor in that case, and
 * the dialog says so rather than promising a deletion that may not happen.
 */
function describeDoctorDelete(doctors) {
  const campaigns = doctors.reduce((s, d) => s + (Number(d.campaignCount) || 0), 0);
  const leads = doctors.reduce((s, d) => s + (Number(d.leadCount) || 0), 0);
  const linked = new Map();
  doctors.forEach((d) => repsLinkedToDoctor(d.id).forEach((r) => linked.set(r.id, r.name)));
  return [
    doctors.map((d) => d.name).join("، "),
    campaigns || leads ? `هيتمسح معاه ${campaigns} كامبين و${leads} ليد.` : "مفيش كامبينات ولا ليدز عليه.",
    linked.size ? `هيتشال ربط ${linked.size} سيلز: ${[...linked.values()].join("، ")} — وهيحتاجوا ربط من صفحة التوزيع.` : "",
    leads ? "لو فيه ولو ليد واحد عليه مكالمة أو حجز، المسح هيترفض والدكتور هيفضل زي ما هو." : "",
    "الحركة دي مينفعش ترجع فيها.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Deletes one doctor or a selection, reporting the ones the server kept and why. */
async function deleteDoctors(doctors) {
  if (!doctors.length) return;
  const ok = await confirmDialog(doctors.length === 1 ? `مسح ${doctors[0].name}` : `مسح ${doctors.length} دكتور`, {
    sub: describeDoctorDelete(doctors),
    confirmLabel: "امسح",
  });
  if (!ok) return;

  const selectedBefore = document.getElementById("doctor-filter").value;
  const results = await Promise.allSettled(
    doctors.map((d) => api(`/admin/doctors/${d.id}`, { method: "DELETE", silent: true })),
  );
  const done = results.filter((r) => r.status === "fulfilled").length;
  // Refusals are named one by one: "اتمسح ٢ من ٣" on its own leaves the admin guessing
  // which doctor is still there and why.
  results.forEach((r, i) => {
    if (r.status === "rejected") toast(`${doctors[i].name}: ${(r.reason && r.reason.message) || "فشل المسح"}`, "bad");
  });
  if (done) toast(done === 1 ? `اتمسح ${doctors.find((_, i) => results[i].status === "fulfilled").name}` : `اتمسح ${done} دكتور`, "good");
  if (!done) return;

  bulkClear("doctors");
  await reloadDoctors();
  // The filter bar may have been pointing at a doctor who is gone; loadDoctors() has
  // already fallen back to "كل الدكاترة", and the pages under it have to follow.
  if (doctors.some((d) => String(d.id) === selectedBefore)) await onDoctorChange();
  else loadCore();
  loadAssignments();
  invalidate("doctors", "distribution", "overview", "workload", "upload");
}

/** Rebuilds the upload view's doctor picker from allDoctors, keeping the current choice. */
function fillUploadDoctorSelect() {
  const sel = document.getElementById("upload-doctor");
  if (!sel) return;
  const previous = sel.value;
  sel.innerHTML = '<option value="">اختار دكتور</option>';
  allDoctors.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.name;
    sel.appendChild(opt);
  });
  if (allDoctors.some((d) => String(d.id) === previous)) sel.value = previous;
}

/** The upload view keeps its own doctor/campaign pickers: it targets one campaign, not a filter. */
async function loadUploadPickers() {
  // Always rebuilt from the current list (not only when empty), so a doctor added in
  // this session shows up here without a page reload.
  if (!doctorsLoaded) await loadDoctors();
  else fillUploadDoctorSelect();
}

/** Refills the upload campaign picker for the chosen doctor; `selectId` picks one afterwards. */
async function onUploadDoctorChange(selectId) {
  const doctorId = document.getElementById("upload-doctor").value;
  const sel = document.getElementById("upload-campaign");
  const previous = sel.value;
  sel.innerHTML = '<option value="">اختار كامبين</option>';
  document.getElementById("add-campaign-btn2").classList.toggle("hidden", !doctorId || !canManageData());
  if (!doctorId) {
    updateUploadPanelVisibility();
    return;
  }

  const isStale = beginLoad("upload-campaigns");
  const { campaigns } = await api(`/admin/campaigns?doctorId=${doctorId}`);
  if (isStale()) return;
  campaigns.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.leadCount})`;
    sel.appendChild(opt);
  });
  const wanted = typeof selectId === "number" || typeof selectId === "string" ? String(selectId) : previous;
  if (campaigns.some((c) => String(c.id) === wanted)) sel.value = wanted;
  updateUploadPanelVisibility();
  syncDeleteCampaignButton();
}

/** The delete button follows the campaign picker: shown only with one chosen, and only to an admin. */
function syncDeleteCampaignButton() {
  const btn = document.getElementById("delete-campaign-btn");
  const sel = document.getElementById("upload-campaign");
  if (btn && sel) btn.classList.toggle("hidden", !sel.value || !canManageData());
}

/** Removes the chosen campaign with its untouched leads; refused by the server once any lead was worked. */
async function deleteCampaign() {
  const sel = document.getElementById("upload-campaign");
  const id = Number(sel.value);
  if (!id) return;
  const name = sel.options[sel.selectedIndex]?.textContent || "الكامبين";
  const ok = await confirmDialog(`مسح ${name}`, {
    sub: "هيتمسح الكامبين وسجل رفعاته والليدز اللي محدش لمسها. لو فيه ولو ليد واحد عليه مكالمة أو حجز، المسح هيترفض. الحركة دي مينفعش ترجع فيها.",
    confirmLabel: "امسح",
  });
  if (!ok) return;
  const data = await api(`/admin/campaigns/${id}`, { method: "DELETE" });
  toast(`اتمسح ${data.deleted.name}` + (data.deletedLeads ? ` و${data.deletedLeads} ليد معاه` : ""), "good");
  await reloadDoctors();
  await onUploadDoctorChange();
  afterLeadsChanged();
}

/* ------------------------------------------------------------------------
   Publishing an app build.

   The APK lives on the persistent disk, not in the repository, so releasing a
   new build is an upload rather than a deploy. Super admin only - the POST is
   refused for anyone else, and the nav entry is hidden for them.
   ------------------------------------------------------------------------ */

const MEGABYTE = 1024 * 1024;

/** Bytes as megabytes to one decimal - the only unit an APK is ever discussed in. */
function fmtMegabytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "0.0";
  return (n / MEGABYTE).toFixed(1);
}

// The versionCode on the disk right now. Kept so the upload can warn before publishing a
// build the phones would ignore; null when nothing is published or the panel has not loaded.
let publishedVersionCode = null;

async function loadAppRelease() {
  if (!isSuperAdmin()) return;
  const isStale = beginLoad("app-release");
  const data = await api("/admin/app-release");
  if (isStale()) return;
  renderAppRelease(data);
}

function renderAppRelease(data) {
  const el = document.getElementById("app-release-current");
  if (!el) return;

  if (!data || !data.published) {
    publishedVersionCode = null;
    el.innerHTML = `
      <div class="empty">
        <strong>لسه مفيش نسخة منشورة</strong>
        محدش من السيلز هيتعرض عليه تحديث لحد ما ترفع نسخة من هنا.
        ${data && data.note ? `<div style="margin-top:8px; font-size:13px">${esc(data.note)}</div>` : ""}
      </div>`;
    return;
  }

  const m = data.manifest || {};
  const code = Number(m.versionCode);
  publishedVersionCode = Number.isInteger(code) ? code : null;

  el.innerHTML = `
    <div class="tiles">
      <div class="tile">
        <div class="bar" style="background:var(--brand)"></div>
        <div class="value">${esc(m.versionName || "—")}</div>
        <div class="label">اسم النسخة</div>
      </div>
      <div class="tile">
        <div class="bar" style="background:var(--teal)"></div>
        <div class="value">${esc(m.versionCode ?? "—")}</div>
        <div class="label">رقم النسخة (versionCode)</div>
      </div>
      <div class="tile">
        <div class="bar" style="background:var(--violet)"></div>
        <div class="value">${esc(fmtMegabytes(data.sizeBytes))}</div>
        <div class="label">حجم الملف (ميجابايت)</div>
      </div>
    </div>
    <div class="card" style="padding:16px; margin-top:12px">
      <div style="font-size:13px; color:var(--text-secondary); margin-bottom:4px">ملاحظات النسخة</div>
      <div style="white-space:pre-line">${
        m.notes ? esc(m.notes) : '<span style="color:var(--text-muted)">مفيش ملاحظات مكتوبة للنسخة دي</span>'
      }</div>
      <div style="margin-top:14px">
        <a class="link-btn" style="text-decoration:none" href="${esc(m.url || "/downloads/app-latest.apk")}">
          ⭳ نزّل الملف المنشور
        </a>
      </div>
    </div>`;
}

/** Echoes the picked file back before anything is sent, so the wrong file is visible early. */
function onAppReleaseFileChange() {
  const file = document.getElementById("app-release-file").files[0];
  const info = document.getElementById("app-release-file-info");
  if (!file) {
    info.innerHTML = "مفيش ملف مختار";
    return;
  }
  const wrongType = !/\.apk$/i.test(file.name);
  info.innerHTML =
    `الملف المختار: <strong>${esc(file.name)}</strong> — ${esc(fmtMegabytes(file.size))} ميجابايت` +
    (wrongType
      ? `<div style="color:var(--warning); margin-top:4px">الملف ده مش .apk — اتأكد إنك اخترت الملف الصح.</div>`
      : "");
}

/**
 * A POST that reports how much of the body has actually gone out.
 *
 * fetch() cannot report upload progress at all, so a 17 MB APK on a slow line would sit
 * behind a spinner with no way to tell "still going" from "stuck". XMLHttpRequest is the
 * only API that emits it, so this one request uses it - and repeats api()'s failure
 * handling (401 ends the session, 429 says slow down, anything else surfaces the
 * server's own Arabic error) rather than inventing a second set of behaviours.
 */
function uploadWithProgress(path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", path);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.addEventListener("progress", (e) => {
      onProgress(e.loaded, e.lengthComputable ? e.total : 0);
    });

    xhr.addEventListener("load", () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText) || {};
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
      if (xhr.status === 401) {
        logout("انتهت الجلسة — سجّل دخول تاني");
        const expired = new ApiError(401, {}, "انتهت الجلسة");
        expired.reported = true;
        return reject(expired);
      }
      const message = xhr.status === 429 ? RATE_LIMIT_ERROR : data.error || `حصل خطأ (${xhr.status})`;
      reject(new ApiError(xhr.status, data, message));
    });

    xhr.addEventListener("error", () => reject(new ApiError(0, {}, NETWORK_ERROR)));
    xhr.addEventListener("abort", () => reject(new ApiError(0, {}, "الرفع اتوقف قبل ما يخلص")));
    xhr.send(form);
  });
}

async function publishAppRelease() {
  const fileInput = document.getElementById("app-release-file");
  const codeInput = document.getElementById("app-release-code");
  const nameInput = document.getElementById("app-release-name");
  const notesInput = document.getElementById("app-release-notes");
  const errorEl = document.getElementById("app-release-error");
  errorEl.textContent = "";

  const file = fileInput.files[0];
  const codeRaw = codeInput.value.trim();
  const versionName = nameInput.value.trim();
  const notes = notesInput.value.trim();

  const fail = (message, focus) => {
    errorEl.textContent = message;
    focus?.focus();
  };

  if (!file) return fail("اختار ملف الـAPK الأول", fileInput);
  // The version is the file's own - the server reads it from the manifest. Typed here it
  // is only a check: the server refuses a number that disagrees with the file, which is
  // how a build once went out as "29" when it carried 27 and every phone that installed
  // it kept being told a newer one existed.
  if (codeRaw && (!/^\d+$/.test(codeRaw) || Number(codeRaw) < 1)) return fail("versionCode لازم يكون رقم صحيح أكبر من صفر", codeInput);
  const versionCode = codeRaw ? Number(codeRaw) : null;

  // A phone only offers the update when the number goes up. Re-publishing the same code -
  // or a lower one - reaches nobody, which is the kind of failure that looks like success,
  // so it is worth stopping to say out loud. Known here only when a number was typed;
  // otherwise the server says so (409) and the question is asked then.
  if (versionCode != null && publishedVersionCode != null && versionCode <= publishedVersionCode) {
    const ok = await confirmDialog("رقم النسخة مش أكبر من المنشور", {
      sub:
        `المنشور دلوقتي رقمه ${publishedVersionCode}، وإنت رافع ${versionCode}.\n` +
        "التطبيق مابيعرضش تحديث غير لما الرقم يكبر، يعني النسخة دي مش هتوصل لحد من السيلز.",
      confirmLabel: "اكمل الرفع",
      danger: false,
    });
    if (!ok) return;
  }

  const btn = document.getElementById("app-release-publish-btn");
  const progress = document.getElementById("app-release-progress");
  const bar = document.getElementById("app-release-progress-bar");
  const label = document.getElementById("app-release-progress-label");
  const originalLabel = btn.textContent;
  const totalMb = fmtMegabytes(file.size);

  btn.disabled = true;
  fileInput.disabled = true;
  btn.textContent = "جاري الرفع...";
  progress.classList.remove("hidden");
  bar.style.width = "0%";
  bar.setAttribute("aria-valuenow", "0");
  label.textContent = "بيبدأ الرفع...";

  const send = (force) => {
    const form = new FormData();
    form.append("file", file);
    if (versionCode != null) form.append("versionCode", String(versionCode));
    if (versionName) form.append("versionName", versionName);
    if (notes) form.append("notes", notes);
    if (force) form.append("force", "1");
    return uploadWithProgress("/admin/app-release", form, (sent, total) => {
      const pct = total ? Math.min(100, Math.round((sent / total) * 100)) : 0;
      bar.style.width = `${pct}%`;
      bar.setAttribute("aria-valuenow", String(pct));
      // The last percent is the server writing the file to disk, not the network, so the
      // label says so instead of freezing on 100% and looking stuck.
      label.textContent =
        pct >= 100
          ? "خلص الرفع — السيرفر بيحفظ الملف..."
          : `${pct}% — ${fmtMegabytes(sent)} من ${totalMb} ميجابايت`;
    });
  };

  try {
    let data;
    try {
      data = await send(false);
    } catch (e) {
      // The file's own number is not above the published one. That is usually a mistake,
      // and sometimes the fix - a build published under a number it never had is put
      // right by publishing the true one over it - so it is asked, then sent again.
      if (!(e instanceof ApiError) || e.status !== 409) throw e;
      const ok = await confirmDialog("رقم النسخة مش أكبر من المنشور", {
        sub: `${e.message}\nالتطبيق مابيعرضش تحديث غير لما الرقم يكبر: النسخة دي مش هتوصل لحد عنده رقم أكبر منها.`,
        confirmLabel: "انشرها برضه",
        danger: false,
      });
      if (!ok) return;
      data = await send(true);
    }

    fileInput.value = "";
    codeInput.value = "";
    nameInput.value = "";
    notesInput.value = "";
    onAppReleaseFileChange();
    toast(`اتنشرت نسخة ${data.versionName} (رقم ${data.versionCode}) — زي ما هي في الملف`, "good");
    await loadAppRelease();
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    e.reported = true;
    errorEl.textContent = e.message;
  } finally {
    progress.classList.add("hidden");
    btn.disabled = false;
    fileInput.disabled = false;
    btn.textContent = originalLabel;
  }
}

// Handlers are attached here rather than as onclick="" attributes in the HTML,
// because the Content-Security-Policy sets script-src-attr 'none' - inline handler
// attributes are blocked outright, which is a deliberate XSS defence worth keeping.
function on(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

on("login-btn", "click", doLogin);
on("menu-btn", "click", openSidebar);
// Wrapped so the change event object is not mistaken for a campaign id to select.
on("upload-doctor", "change", () => onUploadDoctorChange());
on("upload-campaign", "change", updateUploadPanelVisibility);
on("upload-source-file", "change", updateUploadSourceVisibility);
on("upload-source-link", "change", updateUploadSourceVisibility);

// Hash routing keeps this a single file with no build step and no router library,
// and makes every view linkable and survivable across a refresh.
window.addEventListener("hashchange", applyRoute);

// The overview cards link onward to the view that owns each list.
document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-goto]");
  if (target) goto(target.dataset.goto);
});
on("logout-btn", "click", signOut);
on("doctor-filter", "change", onDoctorChange);
on("campaign-filter", "change", onCampaignChange);
on("rep-filter", "change", loadDashboard);
on("scope-from-date", "change", loadDashboard);
on("scope-to-date", "change", loadDashboard);
on("scope-date-clear", "click", clearScopeDateFilter);
on("attendance-date", "change", loadAttendance);
on("badges-date", "change", () => loadBadges());
on("followups-date", "change", loadFollowups);
for (const id of ["plan-state", "plan-rep", "plan-doctor", "plan-origin", "plan-due"]) on(id, "change", loadPlanFollowups);
on("plan-search", "input", () => {
  clearTimeout(planSearchTimer);
  planSearchTimer = setTimeout(loadPlanFollowups, 300);
});
for (const id of ["calls-rep", "calls-type", "calls-from", "calls-to"]) on(id, "change", () => loadCallLog({ page: 1 }));
on("calls-q", "input", () => {
  clearTimeout(callLogSearchTimer);
  callLogSearchTimer = setTimeout(() => loadCallLog({ page: 1 }), 300);
});
on("calls-prev", "click", () => loadCallLog({ page: callLogPage - 1 }));
on("calls-next", "click", () => loadCallLog({ page: callLogPage + 1 }));
on("calls-export-btn", "click", exportCallLog);
on("finance-month", "change", (e) => {
  financeMonth = e.target.value;
  loadFinance();
});
on("finance-export-btn", "click", exportFinance);
on("fin-cases-doctor", "change", loadFinanceCases);
on("fin-cases-employee", "change", loadFinanceCases);
on("fin-cases-plan", "change", loadFinanceCases);
on("fin-cases-flagged", "change", loadFinanceCases);
on("fin-cases-q", "input", () => {
  clearTimeout(financeSearchTimer);
  financeSearchTimer = setTimeout(loadFinanceCases, 300);
});
on("fin-case-add-btn", "click", () => openFinanceCaseDialog(null));
on("fin-employee-add-btn", "click", () => openFinanceEmployeeDialog(null));
on("fin-settings-save", "click", saveFinanceSettings);
on("attendance-month", "change", loadAttendanceSummary);
on("attendance-record-btn", "click", recordAttendanceForAnyone);
on("weekly-off-btn", "click", editWeeklyOff);
on("targets-all-btn", "click", setTargetForAll);
on("leads-search", "input", () => renderLeadsTable(currentLeads));
on("leads-source", "change", () => renderLeadsTable(currentLeads));
on("upload-campaign", "change", syncDeleteCampaignButton);
on("delete-campaign-btn", "click", deleteCampaign);
on("suggest-links-btn", "click", suggestLinks);
on("add-doctor-btn2", "click", addDoctor);
on("onboard-doctor-btn", "click", () => openOnboarding(null));
on("add-campaign-btn2", "click", addCampaign);
on("refresh-btn", "click", loadDashboard);
on("notify-btn", "click", async () => {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    // Only on a tap: browsers refuse the prompt otherwise, and rightly.
    await Notification.requestPermission();
  }
  renderNotifyButton();
  if (noWorkNotificationsOn()) toast("تمام - هيوصلك إشعار على الجهاز ده لما موظف يدوس «مفيش شغل»", "success");
});
on("upload-btn", "click", doUpload);
on("delete-todays-leads-btn", "click", deleteTodaysLeads);
on("export-btn", "click", exportLeads);
on("add-rep-btn", "click", addRep);
on("add-user-btn", "click", addUser);
for (const [, id] of BOOKING_RANGE_FIELDS) on(id, "change", loadBookings);
// The box over the table searches every booking on the system, not the rows on screen,
// so the date range above it stops hiding people (owner, 2026-09-25).
let bookingsSearchTimer = null;
on("bookings-q", "input", () => {
  clearTimeout(bookingsSearchTimer);
  bookingsSearchTimer = setTimeout(loadBookings, 300);
});
on("bookings-clear-filters", "click", () => {
  for (const [, id] of BOOKING_RANGE_FIELDS) document.getElementById(id).value = "";
  document.getElementById("bookings-q").value = "";
  loadBookings();
});
on("reminders-q", "input", () => {
  // A new search starts at the first page, or page three of the old result shows nothing.
  for (const tab of FOLLOWUP_TABS) pageState[`followups-${tab.kind}`] = 1;
  renderFollowupBoard();
});
on("reminders-rep", "change", loadFollowupBoard);
on("reminders-from", "change", loadFollowupBoard);
on("reminders-all-dates", "click", () => {
  document.getElementById("reminders-from").value = "";
  document.getElementById("reminders-to").value = "";
  loadFollowupBoard();
});
on("reminders-to", "change", loadFollowupBoard);
on("bookings-needs-attendance", "change", loadBookings);
on("add-service-btn", "click", addService);
on("app-release-file", "change", onAppReleaseFileChange);
on("app-release-publish-btn", "click", publishAppRelease);
on("app-release-refresh-btn", "click", loadAppRelease);
on("worksheet-export-btn", "click", exportWorksheet);
on("worksheet-search", "input", () => {
  // A new query starts from the first page of its own results.
  pageState.worksheet = 1;
  renderWorksheet(currentWorksheetRows);
});
on("add-lead-btn", "click", () => openLeadModal());
on("lead-save-btn", "click", saveLead);
on("lead-cancel-btn", "click", closeLeadModal);
on("activity-close-btn", "click", closeActivityModal);
// Picking a doctor narrows the campaign and rep choices to that doctor's group -
// otherwise a manually entered lead could be handed to a rep who never receives
// that doctor's leads any other way.
on("lead-doctor", "change", async () => {
  const doctorId = document.getElementById("lead-doctor").value;
  await fillLeadCampaignSelect(doctorId ? Number(doctorId) : null, null);
  fillLeadRepSelect(doctorId ? Number(doctorId) : null, null);
});
on("new-service-name", "keydown", (e) => {
  if (e.key === "Enter") addService();
});

// The bookings view opens on today, which is the day the reminder calls are due - as a
// one-day range on the filter that is actually labelled, so what the page is showing is
// readable off the screen instead of out of an unmarked box.
(() => {
  const from = document.getElementById("bookings-from");
  const to = document.getElementById("bookings-to");
  if (from && to && !from.value && !to.value) {
    from.value = todayLocal();
    to.value = todayLocal();
  }
})();

// The follow-ups view opens on today and tomorrow, in Cairo: what is owed now, plus
// what is promised next and would need covering if somebody goes out.
(() => {
  const from = document.getElementById("reminders-from");
  const to = document.getElementById("reminders-to");
  if (from && to && !from.value && !to.value) {
    from.value = cairoToday();
    to.value = addDaysISO(from.value, 1);
  }
})();
on("my-password-btn", "click", openMyPasswordModal);
on("pw-save-btn", "click", saveMyPassword);
on("pw-cancel-btn", "click", closeMyPasswordModal);
// Enter and Escape inside the static modals are handled by the shared modal shell.
on("monthly-close-btn", "click", () => hideStaticModal("monthly-modal"));

// Enter should submit the login form - it is the expected behaviour for a
// two-field sign-in and reps/admins type into it several times a day.
["login-phone", "login-password"].forEach((id) =>
  on(id, "keydown", (e) => {
    if (e.key === "Enter") doLogin();
  }),
);

if (token && userName) enterDashboard();
