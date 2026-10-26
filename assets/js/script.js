/* ==========================================================================
   Dentalwyz — Interactions
   Behaviour only: the demo records live in assets/js/demo-data.js and are kept in
   this browser; pages describe how to show them with data-* attributes
   (see README.md for the full attribute reference).
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */
  function slug(text) {
    return String(text || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function storage(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { /* storage unavailable (private mode) — ignore */ }
    return null;
  }

  function formatCurrency(value) {
    var num = parseFloat(String(value).replace(/[^0-9.\-]/g, ""));
    if (isNaN(num)) return value;
    var hasDecimals = Math.round(num) !== num;
    return (num < 0 ? "−₹" : "₹") + Math.abs(num).toLocaleString("en-IN", { minimumFractionDigits: hasDecimals ? 2 : 0, maximumFractionDigits: 2 });
  }

  function formatDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return iso;
    return m[3] + " " + MONTHS[parseInt(m[2], 10) - 1] + " " + m[1];
  }

  // "24 Oct 2026" -> "2026-10-24" (for filling <input type="date">)
  function toIsoDate(text) {
    var t = String(text || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    var m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s+(\d{4})$/.exec(t);
    if (!m) return "";
    var idx = MONTHS.map(function (x) { return x.toLowerCase(); }).indexOf(m[2].toLowerCase());
    if (idx < 0) return "";
    return m[3] + "-" + String(idx + 1).padStart(2, "0") + "-" + String(m[1]).padStart(2, "0");
  }

  function parseNumber(text) {
    var n = parseFloat(String(text || "").replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  }

  function fieldText(el) {
    if (!el) return "";
    if (el.matches("input, select, textarea")) return el.value;
    return el.textContent.trim();
  }

  function setStatusAttr(el) {
    if (!el || !el.classList.contains("badge-status")) return;
    el.setAttribute("data-status", slug(el.textContent));
    // Mirror a record's status on the record itself so CSS can style the whole row/card
    var rec = el.getAttribute("data-field") === "status" && el.closest("[data-record]");
    if (rec) rec.setAttribute("data-row-status", slug(el.textContent));
  }

  function setFieldValue(el, value) {
    var fmt = el.getAttribute("data-format");
    if (fmt === "currency") value = formatCurrency(value);
    if (fmt === "date") value = formatDate(value);
    if (el.matches("input, select, textarea")) el.value = value;
    else el.textContent = value;
    setStatusAttr(el);
  }

  function refreshAvatars(scope) {
    $$("[data-avatar]", scope).forEach(function (av) {
      var src = $('[data-field="' + av.getAttribute("data-avatar") + '"]', scope);
      if (src) {
        var t = fieldText(src).replace(/^dr\.?\s+/i, ""); // "Dr. Ravi" → R
        if (t && t !== "—") av.textContent = t.charAt(0).toUpperCase();
      }
    });
  }

  function getFields(record) {
    var map = {};
    $$("[data-field]", record).forEach(function (el) {
      var key = el.getAttribute("data-field");
      if (!(key in map)) map[key] = el;
    });
    return map;
  }

  function recordLabel(record) {
    var el = $("[data-field][data-primary]", record) || $("[data-field]", record);
    return el ? fieldText(el) : "this record";
  }

  /* ------------------------------------------------------------------
     Toasts
     ------------------------------------------------------------------ */
  var TOAST_ICONS = { success: "bi-check-circle-fill", danger: "bi-x-octagon-fill", info: "bi-info-circle-fill", warning: "bi-exclamation-triangle-fill" };

  function showToast(message, type) {
    type = type || "success";
    var container = $("#toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container position-fixed bottom-0 end-0 p-3";
      document.body.appendChild(container);
    }
    var toast = document.createElement("div");
    toast.className = "toast toast-app toast-" + type;
    toast.setAttribute("role", type === "danger" ? "alert" : "status");
    toast.setAttribute("aria-live", type === "danger" ? "assertive" : "polite");
    toast.setAttribute("aria-atomic", "true");

    var icon = document.createElement("i");
    icon.className = "bi toast-icon " + (TOAST_ICONS[type] || TOAST_ICONS.success);
    icon.setAttribute("aria-hidden", "true");
    var text = document.createElement("span");
    text.textContent = message;
    var close = document.createElement("button");
    close.type = "button";
    close.className = "btn-close";
    close.setAttribute("data-bs-dismiss", "toast");
    close.setAttribute("aria-label", "Close");

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(close);
    container.appendChild(toast);
    var instance = bootstrap.Toast.getOrCreateInstance(toast, { delay: 3200 });
    toast.addEventListener("hidden.bs.toast", function () { toast.remove(); });
    instance.show();
  }
  window.dwToast = showToast;

  /* ------------------------------------------------------------------
     Sidebar & header
     ------------------------------------------------------------------ */
  function initSidebar() {
    if (storage("dw-sidebar") === "collapsed") document.body.classList.add("sidebar-collapsed");

    document.addEventListener("click", function (e) {
      var btn = e.target.closest('[data-action="sidebar-collapse"]');
      if (!btn) return;
      var collapsed = document.body.classList.toggle("sidebar-collapsed");
      btn.setAttribute("aria-expanded", String(!collapsed));
      storage("dw-sidebar", collapsed ? "collapsed" : "expanded");
    });

    // Mini sidebar: show labels as tooltips
    $$(".nav-list .nav-link").forEach(function (link) {
      var label = link.textContent.trim();
      link.setAttribute("title", label);
    });

    // Close the mobile off-canvas after navigating
    $$("#appSidebar .nav-link").forEach(function (link) {
      link.addEventListener("click", function () {
        var oc = bootstrap.Offcanvas.getInstance($("#appSidebar"));
        if (oc) oc.hide();
      });
    });
  }

  function initHeaderDate() {
    var picker = $("#headerDatePicker");
    var trigger = $("#headerDate");
    function render(date, announce) {
      $$("[data-current-date]").forEach(function (el) {
        el.textContent = String(date.getDate()).padStart(2, "0") + " " + MONTHS[date.getMonth()] + " " + date.getFullYear();
      });
      $$("[data-current-day]").forEach(function (el) { el.textContent = DAYS[date.getDay()]; });
      if (announce) showToast("Showing schedule for " + DAYS[date.getDay()] + ", " + formatDate(picker.value), "info");
    }
    var today = new Date();
    render(today, false);
    if (!picker || !trigger) return;
    picker.value = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    trigger.addEventListener("click", function () {
      if (typeof picker.showPicker === "function") {
        try { picker.showPicker(); return; } catch (err) { /* fall through */ }
      }
      picker.focus();
      picker.click();
    });
    picker.addEventListener("change", function () {
      if (!picker.value) return;
      var p = picker.value.split("-");
      render(new Date(+p[0], +p[1] - 1, +p[2]), false);
      // Show that day's appointments: filter the list here, or open the Appointments page on that date
      var filter = $('input[type="date"][data-filter-param="date"]');
      if (filter) {
        filter.value = picker.value;
        filter.dispatchEvent(new Event("change", { bubbles: true }));
        var pane = filter.closest(".tab-pane");
        var tab = pane && $('[data-bs-toggle="tab"][data-bs-target="#' + pane.id + '"]');
        if (tab) bootstrap.Tab.getOrCreateInstance(tab).show();
        showToast("Showing appointments for " + DAYS[fromIso(picker.value).getDay()] + ", " + formatDate(picker.value), "info");
      } else {
        window.location.href = "appointments.html?date=" + picker.value;
      }
    });
  }

  function applyBranch(item, announce) {
    var name = item.getAttribute("data-branch");
    var location = item.getAttribute("data-branch-location") || "";
    $$("[data-current-branch]").forEach(function (el) { el.textContent = name; });
    $$("[data-current-location]").forEach(function (el) { el.textContent = location; });
    $$("[data-branch]").forEach(function (el) {
      var active = el.getAttribute("data-branch") === name;
      el.classList.toggle("active", active);
      el.setAttribute("aria-current", active ? "true" : "false");
    });
    $$("select[data-branch-select]").forEach(function (sel) { sel.value = name; });
    storage("dw-branch", name);
    if (announce) showToast("Switched to " + name + (location ? " (" + location + ")" : "") + ". Showing branch data.", "info");
  }

  // The header lists the branches saved in Settings; show the one chosen last (or the first)
  function showSavedBranch() {
    var items = $$("[data-branch]").filter(function (el) { return !el.closest("template"); });
    var saved = storage("dw-branch");
    var match = items.filter(function (el) { return el.getAttribute("data-branch") === saved; })[0] || items[0];
    if (match) applyBranch(match, false);
  }

  function initBranches() {
    document.addEventListener("click", function (e) {
      var item = e.target.closest("[data-branch]");
      if (!item) return;
      e.preventDefault();
      if (item.classList.contains("active")) { showToast("You are already viewing " + item.getAttribute("data-branch"), "info"); return; }
      applyBranch(item, true);
    });
    document.addEventListener("change", function (e) {
      var sel = e.target.closest("select[data-branch-select]");
      if (!sel) return;
      var item = $$("[data-branch]").filter(function (el) { return el.getAttribute("data-branch") === sel.value; })[0];
      if (item) applyBranch(item, true);
    });
  }

  function initNotifications() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest('[data-action="mark-all-read"]');
      if (!btn) return;
      e.preventDefault();
      var unread = coll("notifications").filter(function (n) { return n.f.unread === "yes"; });
      if (!unread.length) { showToast("No unread notifications", "info"); return; }
      unread.forEach(function (n) { n.f.unread = ""; });
      saveDb();
      renderAll();
      showToast("All notifications marked as read");
    });
  }

  function initTopbarSearch() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest('[data-action="toggle-search"]');
      if (!btn) return;
      var bar = btn.closest(".topbar");
      var open = bar.classList.toggle("search-open");
      btn.setAttribute("aria-expanded", String(open));
      if (open) { var input = $("input", bar.querySelector(".topbar-search")); if (input) input.focus(); }
    });
  }

  /* ==================================================================
     Data: records are saved in this browser (localStorage) and drawn into
     every page. Any element with data-collection="patients" is filled from
     its <template data-template> (the markup of one record), so the same
     records appear on every page that shows them. See README → "Data".
     ================================================================== */
  var DB_KEY = "dentalwyz-data-v1";
  var TONES = ["blue", "purple", "teal", "pink", "amber", "green"];
  var PERIODS = ["today", "tomorrow", "upcoming", "future", "past", "this-week", "last-week",
    "this-month", "last-month", "this-year", "last-7-days", "prev-7-days", "last-30-days", "prev-30-days", "last-6-months"];
  var DB = loadDb();
  var CTX = null;      // page context record, e.g. the doctor on doctor-details.html
  var NEW_IDS = {};     // records added during this visit (their "New" tag shows)
  var saveWarned = false;

  function loadDb() {
    try {
      var d = JSON.parse(storage(DB_KEY) || "null");
      if (d && d.c) return d;
    } catch (e) { /* unreadable → start empty */ }
    return { c: {}, seeded: {}, n: 0 };
  }

  function saveDb() {
    try { window.localStorage.setItem(DB_KEY, JSON.stringify(DB)); }
    catch (e) {
      if (!saveWarned) showToast("Could not save — this browser is blocking or out of storage", "danger");
      saveWarned = true;
    }
  }

  function coll(name) { return DB.c[name] || (DB.c[name] = []); }
  function getRec(name, id) { return coll(name).filter(function (r) { return r.id === id; })[0] || null; }
  function newId() { DB.n = (DB.n || 0) + 1; return Date.now().toString(36) + DB.n.toString(36); }

  /* Demo data: assets/js/demo-data.js defines window.DW_DEMO = { version, anchor, collections }.
     It is loaded into this browser on the first visit (and again when its version changes, or on
     "Reset demo data"). Dates are written as if `anchor` were today and are moved forward so the
     clinic always has appointments today, this week and this month. */
  var DATE_RE = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/;

  function seedDemo(force) {
    var S = window.DW_DEMO;
    if (!S || !S.collections) return false;
    if (!force && DB.demo === S.version) return false;
    var shift = Math.round((fromIso(isoOf(new Date())) - fromIso(S.anchor)) / 86400000);
    var move = function (v) {
      if (typeof v !== "string" || !DATE_RE.test(v)) return v;
      var iso = toIsoDate(v);
      return iso ? formatDate(isoOf(addDays(fromIso(iso), shift))) : v;
    };
    DB = { c: {}, seeded: {}, n: 0, demo: S.version };
    var now = Date.now();
    Object.keys(S.collections).forEach(function (name) {
      DB.seeded[name] = true;
      DB.c[name] = S.collections[name].map(function (src, i) {
        var f = {}, h = src._h || {};
        Object.keys(src).forEach(function (k) { if (k.charAt(0) !== "_") f[k] = move(src[k]); });
        var t = src._ago !== undefined ? now - src._ago * 60000 : now - (S.collections[name].length - i) * 3600000;
        return { id: newId(), f: f, h: h, t: t };
      });
    });
    saveDb();
    return true;
  }

  function pad2(n) { return String(n).padStart(2, "0"); }
  function isoOf(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function weekStart(d) { return addDays(d, -((d.getDay() + 6) % 7)); } // Monday
  function fromIso(iso) { var p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function norm(v) { return slug(v).replace(/-/g, ""); }

  function inPeriod(iso, p) {
    if (!iso) return false;
    var now = new Date(), t = isoOf(now), s;
    switch (p) {
      case "today": return iso === t;
      case "tomorrow": return iso === isoOf(addDays(now, 1));
      case "upcoming": return iso >= t;
      case "future": return iso > t;
      case "past": return iso < t;
      case "this-week": s = weekStart(now); return iso >= isoOf(s) && iso <= isoOf(addDays(s, 6));
      case "last-week": s = addDays(weekStart(now), -7); return iso >= isoOf(s) && iso <= isoOf(addDays(s, 6));
      case "this-month": return iso.slice(0, 7) === t.slice(0, 7);
      case "last-month": return iso.slice(0, 7) === isoOf(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
      case "this-year": return iso.slice(0, 4) === t.slice(0, 4);
      case "last-7-days": return iso > isoOf(addDays(now, -7)) && iso <= t;
      case "prev-7-days": return iso > isoOf(addDays(now, -14)) && iso <= isoOf(addDays(now, -7));
      case "last-30-days": return iso > isoOf(addDays(now, -30)) && iso <= t;
      case "last-6-months": return iso >= isoOf(new Date(now.getFullYear(), now.getMonth() - 5, 1)) && iso <= t;
      case "prev-30-days": return iso > isoOf(addDays(now, -60)) && iso <= isoOf(addDays(now, -30));
    }
    return false;
  }

  /* data-where="date=today; status!=Cancelled|No Show; doctor=@name"
     (| = any of; @key = a field of the page context record; periods: see PERIODS) */
  function parseWhere(str) {
    return String(str || "").split(";").map(function (part) {
      var m = /^\s*([\w-]+)\s*(!=|>=|<=|=|>|<)\s*(.*?)\s*$/.exec(part);
      if (!m) return null;
      if (/[<>]/.test(m[2])) return { field: m[1], cmp: m[2], num: parseNumber(m[3]) };
      return { field: m[1], neg: m[2] === "!=", values: m[3].split("|") };
    }).filter(Boolean);
  }

  function matchWhere(f, conds) {
    return conds.every(function (c) {
      var raw = f[c.field] || "";
      if (c.range) { var d = toIsoDate(raw); return !!d && d >= c.range[0] && d <= c.range[1]; } // report period
      if (c.cmp) {
        var n = parseNumber(raw);
        return c.cmp === ">" ? n > c.num : c.cmp === "<" ? n < c.num : c.cmp === ">=" ? n >= c.num : n <= c.num;
      }
      var ok = c.values.some(function (v) {
        v = v.trim();
        if (v.charAt(0) === "@") v = CTX ? (CTX.rec.f[v.slice(1)] || "\u0000") : "\u0000";
        if (PERIODS.indexOf(v) !== -1) return inPeriod(toIsoDate(raw), v);
        return slug(raw) === slug(v);
      });
      return c.neg ? !ok : ok;
    });
  }

  function sortKey(v) {
    var iso = toIsoDate(v);
    if (iso) return iso;
    var t = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(v || "").trim());
    if (t) return "T" + pad2((parseInt(t[1], 10) % 12) + (t[3].toUpperCase() === "PM" ? 12 : 0)) + t[2];
    var n = String(v || "").replace(/[₹,\s]/g, "");
    if (n !== "" && !isNaN(n)) return Number(n);
    return String(v || "").toLowerCase();
  }

  function sortRecords(rows, spec) {
    var keys = spec.split(",").map(function (k) { k = k.trim(); return { f: k.replace(/^-/, ""), dir: k.charAt(0) === "-" ? -1 : 1 }; });
    return rows.sort(function (a, b) {
      for (var i = 0; i < keys.length; i++) {
        var x = sortKey(a.f[keys[i].f]), y = sortKey(b.f[keys[i].f]);
        if (x < y) return -keys[i].dir;
        if (x > y) return keys[i].dir;
      }
      return 0;
    });
  }

  // data-join="patients:phone" fills a record's missing fields from the matching patient
  function joinedFields(spec, f) {
    var m = /^(\w+):(\w+)(?:=(\w+))?$/.exec(spec || "");
    if (!m) return null;
    var key = norm(f[m[2]]);
    if (!key) return null;
    var hit = coll(m[1]).filter(function (r) { return norm(r.f[m[3] || m[2]]) === key; })[0];
    return hit ? hit.f : null;
  }

  function nextSeq(name, field, start, daily) {
    var m = /^(.*?)(\d+)$/.exec(start || "");
    if (!m) return start;
    var max = parseInt(m[2], 10) - 1, today = isoOf(new Date());
    coll(name).forEach(function (r) {
      if (daily && (!r.t || isoOf(new Date(r.t)) !== today)) return;
      var v = String(r.f[field] || "");
      if (v.indexOf(m[1]) !== 0) return;
      var n = parseInt(v.slice(m[1].length), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return m[1] + String(max + 1).padStart(m[2].length, "0");
  }

  /* Reports: everything inside [data-report] follows the period and doctor chosen in form[data-report-form].
     The date field is "date" (patients: "registered"); the doctor applies where the records have one. */
  var REPORT = null;
  var REPORT_DATE = { patients: "registered" };
  var NO_DOCTOR = ["payments", "transactions", "patients", "medicines", "inventory"];
  function reportConds(el, name) {
    if (!REPORT || !el.closest || !el.closest("[data-report]")) return [];
    var dateField = el.getAttribute("data-report-date") || REPORT_DATE[name] || "date";
    var out = dateField === "none" ? [] : [{ field: dateField, range: [REPORT.from, REPORT.to] }]; // "none": not tied to the period
    if (REPORT.doctor && NO_DOCTOR.indexOf(name) === -1) out.push({ field: "doctor", neg: false, values: [REPORT.doctor] });
    return out;
  }
  function reportDays() { return REPORT ? Math.round((fromIso(REPORT.to) - fromIso(REPORT.from)) / 86400000) + 1 : 30; }

  /* Numbers over a collection: count / sum / avg / pct / perday / top / latest / last-past / next (dates) */
  function aggregate(name, conds, fn, field, base, pick, negate) {
    var rows = coll(name).filter(function (r) { return matchWhere(r.f, conds); });
    fn = fn || "count";
    if (fn === "count") return rows.length;
    if (fn === "top") { // the most frequent value of `field`
      var tally = {}, best = "", n = 0;
      rows.forEach(function (r) { var k = r.f[field]; if (k) { tally[k] = (tally[k] || 0) + 1; if (tally[k] > n) { n = tally[k]; best = k; } } });
      return best;
    }
    if (fn === "pct") {
      var all = coll(name).filter(function (r) { return matchWhere(r.f, base || []); }).length;
      return all ? Math.round(rows.length * 100 / all) : 0;
    }
    if (fn === "latest" || fn === "last-past" || fn === "next") {
      var t = isoOf(new Date());
      var dated = rows.map(function (r) { return { d: toIsoDate(r.f[field]), r: r }; }).filter(function (x) {
        return x.d && (fn === "latest" || (fn === "next" ? x.d >= t : x.d <= t));
      });
      if (!dated.length) return "";
      dated = sortRecords(dated.map(function (x) { return x.r; }), field + ",time");
      var hit = fn === "next" ? dated[0] : dated[dated.length - 1];
      return pick ? (hit.f[pick] || "") : formatDate(toIsoDate(hit.f[field]));
    }
    // negate: rows matching it count as minus, e.g. data-stat-negate="type=Expense" gives a net total
    var total = rows.reduce(function (s, r) { return s + (negate && negate.length && matchWhere(r.f, negate) ? -1 : 1) * parseNumber(r.f[field]); }, 0);
    if (fn === "avg") return rows.length ? total / rows.length : 0;
    if (fn === "perday") return total / reportDays();
    return total;
  }

  function formatAmount(v, fmt) {
    if (typeof v !== "number") return v;
    if (fmt === "currency") return formatCurrency(Math.round(v * 100) / 100);
    if (fmt === "pct") return Math.round(v) + "%";
    if (fmt === "lakh") return Math.abs(v) >= 100000 ? (v < 0 ? "−" : "") + "₹" + (Math.abs(v) / 100000).toFixed(2).replace(/\.?0+$/, "") + " L" : formatCurrency(Math.round(v));
    return String(Math.round(v * 10) / 10);
  }

  function aggFromAttrs(el, prefix, rec) {
    var conds = parseWhere(el.getAttribute(prefix + "-where")).concat(reportConds(el, el.getAttribute(prefix)));
    var match = el.getAttribute(prefix + "-match"); // remoteField=localField
    if (match && rec) match.split(";").forEach(function (p) {
      var kv = p.split("=");
      conds.push({ field: kv[0].trim(), neg: false, values: [rec.f[(kv[1] || kv[0]).trim()] || "\u0000"] });
    });
    var base = el.hasAttribute(prefix + "-base") ? parseWhere(el.getAttribute(prefix + "-base")).concat(reportConds(el, el.getAttribute(prefix))) : null;
    var negate = el.hasAttribute(prefix + "-negate") ? parseWhere(el.getAttribute(prefix + "-negate")) : null;
    return aggregate(el.getAttribute(prefix), conds, el.getAttribute(prefix + "-fn"), el.getAttribute(prefix + "-field"), base, el.getAttribute(prefix + "-pick"), negate);
  }

  function plural(el, v) {
    var s = el.getAttribute("data-stat-suffix");
    if (!s) return "";
    var parts = s.split("|");
    return parts.length > 1 && v !== 1 ? parts[1] : parts[0];
  }

  function toneFor(text) {
    var h = 0;
    String(text || "").split("").forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
    return TONES[h % TONES.length];
  }

  function applyTone(el, value) {
    var prefix = el.getAttribute("data-tone-prefix") || "tone-";
    TONES.forEach(function (t) { el.classList.remove(prefix + t); });
    el.classList.add(prefix + toneFor(value));
  }

  // [data-field]s of a record itself, not those inside copied history blocks
  function ownFields(el) {
    return $$("[data-field]", el).filter(function (x) {
      var h = x.parentElement && x.parentElement.closest("[data-field-html]");
      return !h || !el.contains(h);
    });
  }

  function readRecord(el) {
    var f = {}, h = {}, joined = el._dwJoin || {}, own = storedRecord(el);
    ownFields(el).forEach(function (x) {
      var k = x.getAttribute("data-field");
      if (x.hasAttribute("data-derive") || k in f) return;
      var v = fieldText(x);
      if (v === "—") v = "";
      // shown from the joined record (e.g. the patient's allergies), unless this record has its own value
      if (joined[k] !== undefined && joined[k] === v && !(own && own.f[k])) return;
      f[k] = v;
    });
    $$("[data-field-html]", el).forEach(function (x) { h[x.getAttribute("data-field-html")] = x.innerHTML; });
    return { f: f, h: h };
  }

  function fillDerived(el, rec) {
    $$("[data-derive]", el).forEach(function (x) {
      var kind = x.getAttribute("data-derive"), v = "";
      if (kind === "relday") { // Today / Upcoming / Past from a date field
        var iso = toIsoDate(rec.f[x.getAttribute("data-derive-from") || "date"]), t = isoOf(new Date());
        v = !iso ? "" : iso === t ? "Today" : iso > t ? "Upcoming" : "Past";
      } else if (kind === "workday") { // weekly schedule row from "Mon – Sat" + "9:00 AM – 6:00 PM"
        v = worksOn(rec.f.days, x.getAttribute("data-derive-day")) ? (rec.f.hours || "On duty") : "Off";
      } else if (kind === "since") { // minutes since a time today (e.g. waiting since check-in)
        var on = parseWhere(x.getAttribute("data-derive-while"));
        var tm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(rec.f[x.getAttribute("data-derive-from")] || "").trim());
        if (tm && matchWhere(rec.f, on)) {
          var at = new Date(); at.setHours((parseInt(tm[1], 10) % 12) + (tm[3].toUpperCase() === "PM" ? 12 : 0), parseInt(tm[2], 10), 0, 0);
          var mins = Math.round((Date.now() - at) / 60000);
          v = mins < 1 ? "Just arrived" : mins < 60 ? mins + " min" : Math.floor(mins / 60) + " h " + (mins % 60) + " min";
        } else v = x.getAttribute("data-derive-else") || "—";
      } else if (kind === "pct") { // data-derive-from="quantity/reorder" → "40%"
        var pr = (x.getAttribute("data-derive-from") || "").split("/"), base = parseNumber(rec.f[pr[1]]);
        v = base ? Math.round(parseNumber(rec.f[pr[0]]) * 100 / base) + "%" : "";
      } else if (kind === "progress") { // data-derive-from="done/sessions" → bar width
        var parts = (x.getAttribute("data-derive-from") || "").split("/"), of = parseNumber(rec.f[parts[1]]);
        var pct = of ? Math.min(100, Math.round(parseNumber(rec.f[parts[0]]) * 100 / of)) : 0;
        x.className = x.className.replace(/w-pct-\d+/g, "").trim() + " w-pct-" + Math.round(pct / 5) * 5;
        var bar = x.closest(".progress");
        if (bar) bar.setAttribute("aria-valuenow", pct);
        return;
      } else if (kind === "ago") {
        v = timeAgo(rec.t);
      } else if (kind === "agg") { // a number from another collection, e.g. a doctor's appointments today
        v = formatAmount(aggFromAttrs(x, "data-agg", rec), x.getAttribute("data-format"));
      }
      x.textContent = v === "" || v === undefined ? (x.getAttribute("data-default") || "—") : v;
      setStatusAttr(x);
    });
  }

  // "Mon – Sat", "Mon, Wed, Fri", "Mon-Fri, Sun" → does it include `day` (Mon…Sun)?
  function worksOn(days, day) {
    var names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], want = names.indexOf(String(day).slice(0, 3).toLowerCase());
    if (!days || want < 0) return false;
    if (/daily|all days|every ?day/i.test(days)) return true;
    return String(days).split(/,|&|and/).some(function (part) {
      var ends = part.split(/–|—|-|to/).map(function (x) { return names.indexOf(x.trim().slice(0, 3).toLowerCase()); });
      if (ends.length === 1) return ends[0] === want;
      var a = ends[0], b = ends[ends.length - 1];
      if (a < 0 || b < 0) return false;
      return a <= b ? want >= a && want <= b : want >= a || want <= b;
    });
  }

  function timeAgo(t) {
    if (!t) return "";
    var s = (Date.now() - t) / 1000;
    if (s < 60) return "Just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " hr ago";
    if (s < 172800) return "Yesterday";
    return formatDate(isoOf(new Date(t)));
  }

  function fillTokens(text, f) {
    return String(text || "").replace(/\{(\w+)\}/g, function (_, k) { return f[k] || ""; }).replace(/\s+/g, " ").trim();
  }

  // Bell menu entries: list[data-notify="Appointment booked for {name}"] posts one per new record
  var NOTIFY_PAGE = { "bi-cash-coin": "payments.html", "bi-person-check": "appointments.html#checkinPane", "bi-calendar-check": "appointments.html",
    "bi-capsule": "pharmacy.html", "bi-box-seam": "inventory.html", "bi-eyedropper": "lab.html", "bi-person-plus": "patients.html", "bi-receipt": "invoices.html",
    "bi-send": "appointments.html#recallPane", "bi-cart-check": "inventory.html", "bi-bag-check": "pharmacy.html" };
  function notify(text, icon, href) {
    var list = coll("notifications");
    var page = href || NOTIFY_PAGE[icon] || currentPage() || "dashboard.html"; // clicking it opens where it happened
    list.push({ id: newId(), f: { text: text, icon: icon || "bi-bell", unread: "yes", href: page }, h: {}, t: Date.now() });
    if (list.length > 50) DB.c.notifications = list.slice(-50);
    saveDb();
  }

  // Links in a preview that carry the record, e.g. data-bind-href="invoices.html?prefill-patient={name}#invoiceModal"
  function bindModalLinks(modal, rec) {
    $$("*", modal).forEach(function (x) {
      if (x.closest("template") || x.closest("[data-related-row]")) return;
      Array.prototype.slice.call(x.attributes).forEach(function (a) {
        if (a.name.indexOf("data-bind-") !== 0) return;
        var isUrl = a.name === "data-bind-href";
        x.setAttribute(a.name.slice(10), a.value.replace(/\{(\w+)\}/g, function (_, k) {
          var v = k === "id" ? rec.id : (rec.f[k] || "");
          return isUrl ? encodeURIComponent(v) : v;
        }));
      });
    });
  }

  function bindAttrs(el, rec) {
    [el].concat($$("*", el)).forEach(function (x) {
      Array.prototype.slice.call(x.attributes).forEach(function (a) {
        if (a.name.indexOf("data-bind-") !== 0) return;
        var isUrl = a.name === "data-bind-href";
        x.setAttribute(a.name.slice(10), a.value.replace(/\{(\w+)\}/g, function (_, k) {
          var v = k === "id" ? rec.id : (rec.f[k] || "");
          return isUrl ? encodeURIComponent(v) : v;
        }));
      });
    });
    [el].concat($$("[data-tone-from]", el)).forEach(function (x) {
      if (x.hasAttribute("data-tone-from")) applyTone(x, rec.f[x.getAttribute("data-tone-from")]);
    });
  }

  // Draw one stored record into its markup. Returns true when it assigned a new number.
  function fillRecord(el, rec, name, joined) {
    var dirty = false;
    el.setAttribute("data-id", rec.id);
    el.setAttribute("data-of", name);
    el._dwJoin = joined || null;
    ownFields(el).forEach(function (x) {
      if (x.hasAttribute("data-derive")) return;
      var k = x.getAttribute("data-field"), v = rec.f[k];
      if ((v === undefined || v === "") && joined && joined[k]) v = joined[k];
      if ((v === undefined || v === "") && x.hasAttribute("data-seq")) {
        v = rec.f[k] = nextSeq(name, k, x.getAttribute("data-seq"), x.hasAttribute("data-seq-daily"));
        dirty = true;
      }
      if (v === undefined || v === "") v = x.hasAttribute("data-default") ? x.getAttribute("data-default") : (x.hidden ? "" : "—");
      setFieldValue(x, v);
    });
    $$("[data-field-html]", el).forEach(function (x) {
      var k = x.getAttribute("data-field-html");
      if (rec.h && rec.h[k]) x.innerHTML = rec.h[k];
      else x.textContent = x.getAttribute("data-empty") || "";
    });
    $$("[data-new-only]", el).forEach(function (x) { x.hidden = !NEW_IDS[rec.id]; });
    fillDerived(el, rec);
    bindAttrs(el, rec);
    refreshAvatars(el);
    syncSwitches(el);
    return dirty;
  }

  function hostRecords(host, name) {
    var conds = parseWhere(host.getAttribute("data-where"));
    var join = host.getAttribute("data-join");
    var rows = coll(name).filter(function (r) {
      var f = r.f, j = join && joinedFields(join, r.f);
      if (j) f = Object.assign({}, j, r.f);
      return matchWhere(f, conds);
    });
    if (host.getAttribute("data-sort")) rows = sortRecords(rows, host.getAttribute("data-sort"));
    else if (host.getAttribute("data-insert") !== "end") rows.reverse(); // newest first
    var limit = parseInt(host.getAttribute("data-limit"), 10);
    return limit ? rows.slice(0, limit) : rows;
  }

  // Kept setup lists (e.g. the procedure catalogue) start from the records written in the page
  function seedHost(host, name) {
    if (DB.seeded[name] || coll(name).length) { DB.seeded[name] = true; return; }
    DB.seeded[name] = true;
    var tpl = $("template[data-template]", host);
    var body = tpl ? tpl.parentElement : host;
    $$(":scope > [data-record]", body).forEach(function (el) {
      var d = readRecord(el);
      coll(name).push({ id: newId(), f: d.f, h: d.h, t: Date.now() });
    });
    saveDb();
  }

  function renderHost(host) {
    var name = host.getAttribute("data-collection");
    var tpl = $("template[data-template]", host);
    if (!name || !tpl) return;
    var body = tpl.parentElement, dirty = false;
    $$(":scope > [data-record]", body).forEach(function (r) { r.remove(); });
    var rows = hostRecords(host, name);
    var frag = document.createDocumentFragment();
    var join = host.getAttribute("data-join");
    rows.forEach(function (rec) {
      var el = tpl.content.firstElementChild.cloneNode(true);
      if (fillRecord(el, rec, name, join && joinedFields(join, rec.f))) dirty = true;
      frag.appendChild(el);
    });
    body.insertBefore(frag, tpl);
    if (dirty) saveDb();
    initTooltips(body);
    if (host.hasAttribute("data-list")) applyFilters(host);
    else if (host.id) $$('[data-empty-for="#' + host.id + '"]').forEach(function (e) { e.hidden = rows.length > 0; });
  }

  /* data-stat="invoices" data-stat-where="status=Paid" data-stat-fn="sum" data-stat-field="amount" data-format="currency" */
  function renderStats() {
    $$("[data-stat]").forEach(function (el) {
      var v = aggFromAttrs(el, "data-stat", CTX && CTX.rec);
      if (el.hasAttribute("data-stat-bar")) { // a progress bar: width from a percentage (data-stat-fn="pct")
        el.className = el.className.replace(/w-pct-\d+/g, "").trim() + " w-pct-" + Math.min(100, Math.round(v / 5) * 5);
        var bar = el.closest(".progress");
        if (bar) bar.setAttribute("aria-valuenow", Math.round(v));
        return;
      }
      var out = formatAmount(v, el.getAttribute("data-format"));
      el.textContent = (out === "" ? (el.getAttribute("data-default") || "—") : out) + plural(el, v);
    });
  }

  /* Share bars: ul[data-breakdown="payments"][data-breakdown-field="method"][data-breakdown-value="amount"]
     Rows are fixed (li[data-breakdown-key]) or built from a <template> for every group found. */
  function renderBreakdowns() {
    $$("[data-breakdown]").forEach(function (box) {
      var name = box.getAttribute("data-breakdown"), field = box.getAttribute("data-breakdown-field");
      var valueField = box.getAttribute("data-breakdown-value");
      var conds = parseWhere(box.getAttribute("data-breakdown-where")).concat(reportConds(box, name));
      var groups = {}, order = [], total = 0;
      coll(name).filter(function (r) { return matchWhere(r.f, conds); }).forEach(function (r) {
        var key = (r.f[field] || "Other").trim() || "Other";
        var v = valueField ? parseNumber(r.f[valueField]) : 1;
        if (!(key in groups)) { groups[key] = { v: 0, n: 0 }; order.push(key); }
        groups[key].v += v; groups[key].n++; total += v;
      });
      var fmt = box.getAttribute("data-format");
      var fill = function (li, key) {
        var g = groups[key] || { v: 0, n: 0 }, pct = total ? Math.round(g.v * 100 / total) : 0;
        $$("[data-bd]", li).forEach(function (x) {
          var k = x.getAttribute("data-bd");
          x.textContent = k === "label" ? key : k === "pct" ? pct + "%" : k === "count" ? g.n : formatAmount(g.v, fmt);
        });
        $$("[data-bar]", li).forEach(function (bar) {
          bar.className = bar.className.replace(/\bw-pct-\d+\b/g, "").trim() + " w-pct-" + Math.min(100, Math.round(pct / 5) * 5);
          var prog = bar.closest(".progress");
          if (prog) prog.setAttribute("aria-valuenow", pct);
        });
      };
      var tpl = $("template[data-template]", box);
      if (tpl) {
        $$(":scope > [data-breakdown-row]", tpl.parentElement).forEach(function (r) { r.remove(); });
        order.sort(function (a, b) { return groups[b].v - groups[a].v; }).slice(0, parseInt(box.getAttribute("data-limit"), 10) || 6).forEach(function (key) {
          var li = tpl.content.firstElementChild.cloneNode(true);
          li.setAttribute("data-breakdown-row", "");
          fill(li, key);
          tpl.parentElement.insertBefore(li, tpl);
        });
      } else {
        $$("[data-breakdown-key]", box).forEach(function (li) {
          var want = li.getAttribute("data-breakdown-key");
          var key = Object.keys(groups).filter(function (k) { return slug(k) === slug(want); })[0] || want;
          fill(li, key);
        });
      }
      if (box.id) $$('[data-empty-for="#' + box.id + '"]').forEach(function (e) { e.hidden = total > 0; });
    });
  }

  /* select[data-options="doctors"][data-option-field="name"]: options from saved records
     (static options in the markup, such as "All doctors", stay first) */
  /* Group tables (reports): <tbody data-group="appointments" data-group-by="doctor" data-group-where="…">
     with a <template> row whose cells say what to show — [data-g="label"], [data-g="count"],
     [data-g="count:status=Completed"], [data-g="sum:amount"], [data-g="avg:amount"],
     [data-g="pct:status=Completed"] (share of the group), [data-g="share:amount"] (share of all groups).
     <tfoot> cells [data-g-total="…"] use the same words over every row. data-group-by="age-band" groups ages. */
  var AGE_BANDS = [[0, 12, "0–12 yrs"], [13, 19, "13–19 yrs"], [20, 35, "20–35 yrs"], [36, 50, "36–50 yrs"], [51, 200, "51+ yrs"]];
  function groupKey(r, by) {
    if (by === "age-band") {
      var a = parseNumber(r.f.age), band = AGE_BANDS.filter(function (x) { return a >= x[0] && a <= x[1]; })[0];
      return band ? band[2] : "Unknown";
    }
    return (r.f[by] || "Other").trim() || "Other";
  }
  function groupValue(rows, spec, all, fmt) {
    var parts = spec.split(":"), kind = parts[0], arg = parts.slice(1).join(":");
    var sum = function (list, f) { return list.reduce(function (s, r) { return s + parseNumber(r.f[f]); }, 0); };
    if (kind === "count") return String((arg ? rows.filter(function (r) { return matchWhere(r.f, parseWhere(arg)); }) : rows).length);
    if (kind === "pct") return rows.length ? Math.round(rows.filter(function (r) { return matchWhere(r.f, parseWhere(arg)); }).length * 100 / rows.length) + "%" : "0%";
    if (kind === "sum") return formatAmount(sum(rows, arg), fmt || "currency");
    if (kind === "avg") return formatAmount(rows.length ? sum(rows, arg) / rows.length : 0, fmt || "currency");
    if (kind === "share") { var t = sum(all, arg); return t ? Math.round(sum(rows, arg) * 100 / t) + "%" : "0%"; }
    return "";
  }
  function renderGroups() {
    $$("[data-group]").forEach(function (box) {
      var tpl = $("template", box);
      if (!tpl) return;
      var name = box.getAttribute("data-group"), by = box.getAttribute("data-group-by");
      var conds = parseWhere(box.getAttribute("data-group-where")).concat(reportConds(box, name));
      var rows = coll(name).filter(function (r) { return matchWhere(r.f, conds); });
      var groups = {}, order = [];
      if (by === "age-band") AGE_BANDS.forEach(function (b) { groups[b[2]] = []; order.push(b[2]); });
      rows.forEach(function (r) { var k = groupKey(r, by); if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(r); });
      var sortBy = box.getAttribute("data-group-sort");
      if (sortBy) order.sort(function (a, b) { return parseNumber(groupValue(groups[b], sortBy, rows)) - parseNumber(groupValue(groups[a], sortBy, rows)); });
      var limit = parseInt(box.getAttribute("data-limit"), 10);
      if (limit) order = order.slice(0, limit);
      $$(":scope > [data-group-row]", box).forEach(function (r) { r.remove(); });
      order.forEach(function (k) {
        var tr = tpl.content.firstElementChild.cloneNode(true);
        tr.setAttribute("data-group-row", "");
        $$("[data-g]", tr).forEach(function (c) { c.textContent = c.getAttribute("data-g") === "label" ? k : groupValue(groups[k], c.getAttribute("data-g"), rows, c.getAttribute("data-format")); });
        box.insertBefore(tr, tpl);
      });
      var table = box.closest("table");
      if (table) $$("[data-g-total]", table).forEach(function (c) { c.textContent = groupValue(rows, c.getAttribute("data-g-total"), rows, c.getAttribute("data-format")); });
      if (table && table.id) {
        $$('[data-empty-for="#' + table.id + '"]').forEach(function (e) { e.hidden = rows.length > 0; });
        if (table._dwPager) paginate(table);
      }
    });
  }

  function initReports() {
    var form = $("form[data-report-form]");
    if (!form) return;
    var t = new Date(), presets = {
      "this-month": [new Date(t.getFullYear(), t.getMonth(), 1), t],
      "last-month": [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)],
      "last-30-days": [addDays(t, -29), t],
      "last-3-months": [new Date(t.getFullYear(), t.getMonth() - 2, 1), t],
      "last-6-months": [new Date(t.getFullYear(), t.getMonth() - 5, 1), t],
      "this-year": [new Date(t.getFullYear(), 0, 1), t]
    };
    var setPreset = function (key) {
      var p = presets[key];
      if (!p) return;
      form.elements.from.value = isoOf(p[0]);
      form.elements.to.value = isoOf(p[1]);
    };
    var apply = function (announce) {
      var doctor = form.elements.doctor ? form.elements.doctor.value : "";
      REPORT = { from: form.elements.from.value, to: form.elements.to.value, doctor: /^all/i.test(doctor) || !doctor ? "" : doctor };
      var label = formatDate(REPORT.from) + " – " + formatDate(REPORT.to) + (REPORT.doctor ? " · " + REPORT.doctor : " · all doctors");
      $$("[data-report-label]").forEach(function (el) { el.textContent = label; });
      renderAll();
      if (announce) showToast("Report updated: " + label, "info");
    };
    setPreset(form.elements.range ? form.elements.range.value : "last-30-days");
    apply(false);
    form.addEventListener("change", function (e) {
      if (e.target.name === "range") { setPreset(e.target.value); apply(true); }
      if ((e.target.name === "from" || e.target.name === "to") && form.elements.range) form.elements.range.value = "custom";
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!form.checkValidity()) { form.classList.add("was-validated"); showToast("Pick both dates for the report", "danger"); return; }
      if (form.elements.from.value > form.elements.to.value) { showToast("The start date must be before the end date", "danger"); form.elements.from.focus(); return; }
      form.classList.remove("was-validated");
      apply(true);
    }, true);
    form.addEventListener("reset", function () {
      setTimeout(function () {
        if (form.elements.range) form.elements.range.value = "last-30-days";
        setPreset("last-30-days");
        apply(false);
        showToast("Report filters reset to the last 30 days", "info");
      }, 0);
    });
  }

  /* select[data-options-match="patient=patient"] only lists records whose `patient` equals the value of
     the form's "patient" control (e.g. a patient's own invoices); data-options-sort orders them */
  function renderOptions(only) {
    (only || $$("select[data-options]")).forEach(function (sel) {
      var name = sel.getAttribute("data-options"), field = sel.getAttribute("data-option-field") || "name";
      var current = sel.value;
      $$("option[data-dynamic]", sel).forEach(function (o) { o.remove(); });
      var seen = {};
      $$("option", sel).forEach(function (o) { seen[slug(o.text)] = true; });
      var conds = parseWhere(sel.getAttribute("data-options-where"));
      (sel.getAttribute("data-options-match") || "").split(";").forEach(function (pair) {
        var kv = pair.split("="), ctrl = kv[1] && sel.form && sel.form.elements[kv[1].trim()];
        if (ctrl && ctrl.value) conds.push({ field: kv[0].trim(), neg: false, values: [controlDisplayValue(ctrl)] });
      });
      var rows = coll(name).filter(function (r) { return matchWhere(r.f, conds); });
      if (sel.getAttribute("data-options-sort")) rows = sortRecords(rows.slice(), sel.getAttribute("data-options-sort"));
      rows.forEach(function (r) {
        var label = (r.f[field] || "").trim();
        if (!label || seen[slug(label)]) return;
        seen[slug(label)] = true;
        var o = document.createElement("option");
        o.textContent = label;
        o.setAttribute("data-dynamic", "");
        Array.prototype.slice.call(sel.attributes).forEach(function (a) { // data-option-attr-price="price" → option data-price="6500"
          if (a.name.indexOf("data-option-attr-") !== 0) return;
          var v = r.f[a.value] || "";
          o.setAttribute("data-" + a.name.slice(17), /^[−-]?₹/.test(v) ? v.replace(/[^0-9.]/g, "") : v); // amounts as plain numbers
        });
        sel.appendChild(o);
      });
      // Nothing saved yet: say where to add it (form dropdowns only, not filters)
      $$("option[data-options-hint]", sel).forEach(function (o) { o.remove(); });
      if (!$("option[data-dynamic]", sel) && sel.getAttribute("data-options-empty") !== "off" && !sel.hasAttribute("data-filter-target")) {
        var hint = document.createElement("option");
        hint.disabled = true;
        hint.setAttribute("data-options-hint", "");
        hint.textContent = sel.getAttribute("data-options-empty") || (name === "doctors" ? "No doctors yet — add one on the Doctors page" : "Nothing added yet");
        sel.appendChild(hint);
      }
      if (Array.prototype.some.call(sel.options, function (o) { return o.value === current; })) sel.value = current;
    });
  }

  /* ------------------------------------------------------------------
     Charts drawn from saved records (same SVG markup and classes as the design)
     <figure data-chart="line|bar|bars2|donut" data-chart-source="payments"
             data-chart-value="amount" data-chart-x="week-days|month-weeks|year-quarters|last-6-months|weekdays|group:field">
     ------------------------------------------------------------------ */
  function chartBuckets(spec, now) {
    var b = [], i, s;
    if (spec === "week-days") {
      s = weekStart(now);
      for (i = 0; i < 7; i++) (function (d) { b.push({ label: DAYS[d.getDay()].slice(0, 3), full: DAYS[d.getDay()], test: function (iso) { return iso === isoOf(d); } }); })(addDays(s, i));
    } else if (spec === "month-weeks") {
      var ym = isoOf(now).slice(0, 7);
      for (i = 0; i < 5; i++) (function (w) {
        b.push({ label: "Wk " + (w + 1), full: "Week " + (w + 1), test: function (iso) { return iso.slice(0, 7) === ym && Math.floor((parseInt(iso.slice(8), 10) - 1) / 7) === w; } });
      })(i);
    } else if (spec === "year-quarters") {
      for (i = 0; i < 4; i++) (function (q) {
        b.push({ label: "Q" + (q + 1), full: "Q" + (q + 1), test: function (iso) { return iso.slice(0, 4) === String(now.getFullYear()) && Math.floor((parseInt(iso.slice(5, 7), 10) - 1) / 3) === q; } });
      })(i);
    } else if (spec === "last-6-months" || spec === "year-months") {
      var n = spec === "year-months" ? 12 : 6;
      for (i = n - 1; i >= 0; i--) (function (d) {
        var key = isoOf(d).slice(0, 7);
        b.push({ label: MONTHS[d.getMonth()], full: MONTHS[d.getMonth()] + " " + d.getFullYear(), test: function (iso) { return iso.slice(0, 7) === key; } });
      })(spec === "year-months" ? new Date(now.getFullYear(), 11 - i, 1) : new Date(now.getFullYear(), now.getMonth() - i, 1));
    } else if (spec === "last-7-days") { // rolling: the 7 days up to today
      for (i = 6; i >= 0; i--) (function (d) { b.push({ label: DAYS[d.getDay()].slice(0, 3), full: DAYS[d.getDay()] + ", " + formatDate(isoOf(d)), test: function (iso) { return iso === isoOf(d); } }); })(addDays(now, -i));
    } else if (spec === "last-30-days") { // rolling: 5 blocks of 6 days up to today
      for (i = 4; i >= 0; i--) (function (end) {
        var from = isoOf(addDays(end, -5)), to = isoOf(end);
        b.push({ label: pad2(addDays(end, -5).getDate()) + " " + MONTHS[addDays(end, -5).getMonth()], full: formatDate(from) + " – " + formatDate(to), test: function (iso) { return iso >= from && iso <= to; } });
      })(addDays(now, -6 * i));
    } else if (spec === "range") { // the report period: days, weeks or months depending on its length
      var from = REPORT ? fromIso(REPORT.from) : addDays(now, -29), to = REPORT ? fromIso(REPORT.to) : now;
      var days = Math.round((to - from) / 86400000) + 1;
      if (days <= 14) {
        for (i = 0; i < days; i++) (function (d) { b.push({ label: pad2(d.getDate()) + " " + MONTHS[d.getMonth()], full: formatDate(isoOf(d)), test: function (iso) { return iso === isoOf(d); } }); })(addDays(from, i));
      } else if (days <= 92) {
        for (i = 0; i < days; i += 7) (function (a) {
          var z = addDays(a, 6) > to ? to : addDays(a, 6), fa = isoOf(a), fz = isoOf(z);
          b.push({ label: pad2(a.getDate()) + " " + MONTHS[a.getMonth()], full: formatDate(fa) + " – " + formatDate(fz), test: function (iso) { return iso >= fa && iso <= fz; } });
        })(addDays(from, i));
      } else {
        for (var m = new Date(from.getFullYear(), from.getMonth(), 1); m <= to; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) (function (mm) {
          var key = isoOf(mm).slice(0, 7);
          b.push({ label: MONTHS[mm.getMonth()], full: MONTH_NAMES[mm.getMonth()] + " " + mm.getFullYear(), test: function (iso) { return iso.slice(0, 7) === key; } });
        })(m);
      }
    } else if (spec === "weekdays") {
      [1, 2, 3, 4, 5, 6].forEach(function (d) { b.push({ label: DAYS[d].slice(0, 3), full: DAYS[d], test: function (iso) { return fromIso(iso).getDay() === d; } }); });
    }
    return b;
  }

  function chartSeries(fig, conds) {
    var name = fig.getAttribute("data-chart-source"), valueField = fig.getAttribute("data-chart-value");
    conds = conds.concat(reportConds(fig, name));
    var dateField = fig.getAttribute("data-chart-date") || "date", x = fig.getAttribute("data-chart-x") || "last-6-months";
    var rows = coll(name).filter(function (r) { return matchWhere(r.f, conds); });
    var val = function (r) { return valueField ? parseNumber(r.f[valueField]) : 1; };
    if (x.indexOf("group:") === 0) {
      var field = x.slice(6), groups = {}, order = [];
      rows.forEach(function (r) {
        var k = (r.f[field] || "Other").trim() || "Other";
        if (!(k in groups)) { groups[k] = 0; order.push(k); }
        groups[k] += val(r);
      });
      order.sort(function (a, b) { return groups[b] - groups[a]; });
      var top = parseInt(fig.getAttribute("data-chart-top"), 10) || 6;
      var out = order.slice(0, top).map(function (k) { return { label: k, full: k, v: groups[k] }; });
      if (order.length > top) out.push({ label: "Others", full: "Others", v: order.slice(top).reduce(function (s, k) { return s + groups[k]; }, 0) });
      return out;
    }
    return chartBuckets(x, new Date()).map(function (bk) {
      return { label: bk.label, full: bk.full, v: rows.filter(function (r) { var iso = toIsoDate(r.f[dateField]); return iso && bk.test(iso); }).reduce(function (s, r) { return s + val(r); }, 0) };
    });
  }

  function shortAmount(v, fmt) {
    if (fmt !== "currency") return String(Math.round(v * 10) / 10);
    if (v >= 100000) return (v / 100000).toFixed(v >= 1000000 ? 0 : 1).replace(/\.0$/, "") + "L";
    if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K";
    return String(Math.round(v));
  }

  function niceMax(v) {
    if (v <= 0) return 4;
    var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10) * p;
  }

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

  function renderChart(fig) {
    var type = fig.getAttribute("data-chart"), fmt = fig.getAttribute("data-format");
    var label = fig.getAttribute("data-chart-label") || "Chart";
    if (type === "donut") return renderDonut(fig);
    var sets = type === "bars2"
      ? (fig.getAttribute("data-chart-series") || "").split("||").map(function (w) { return chartSeries(fig, parseWhere(fig.getAttribute("data-chart-where") + ";" + w)); })
      : [chartSeries(fig, parseWhere(fig.getAttribute("data-chart-where")))];
    var names = (fig.getAttribute("data-chart-series-names") || "").split("|");
    var pts = sets[0], n = pts.length;
    var max = niceMax(Math.max.apply(null, sets.map(function (s) { return Math.max.apply(null, s.map(function (p) { return p.v; }).concat([0])); })));
    var X0 = 40, X1 = 390, Y0 = 150, Y1 = 10, H = Y0 - Y1;
    var y = function (v) { return (Y0 - (v / max) * H).toFixed(1); };
    var tip = function (p, si) { return esc(p.full + " · " + (names[si] ? names[si] + " " : "") + (fmt === "currency" ? formatCurrency(Math.round(p.v)) : Math.round(p.v * 10) / 10)); };
    var svg = '<g class="chart-grid">', axis = '<g class="chart-axis">', i;
    for (i = 0; i <= 3; i++) {
      var gy = (Y1 + H * i / 3).toFixed(1);
      svg += '<line x1="40" y1="' + gy + '" x2="390" y2="' + gy + '"/>';
      axis += '<text x="30" y="' + (+gy + 4) + '" text-anchor="end">' + shortAmount(max * (3 - i) / 3, fmt) + "</text>";
    }
    svg += "</g>";
    var body = "", desc = [];
    if (type === "line") {
      var xs = pts.map(function (p, k) { return n === 1 ? (X0 + X1) / 2 : X0 + (X1 - X0) * k / (n - 1); });
      var line = pts.map(function (p, k) { return xs[k].toFixed(1) + "," + y(p.v); }).join(" ");
      body += '<polygon class="chart-area" points="' + xs[0].toFixed(1) + "," + Y0 + " " + line + " " + xs[n - 1].toFixed(1) + "," + Y0 + '"/>';
      body += '<polyline class="chart-line" points="' + line + '"/>';
      pts.forEach(function (p, k) {
        body += '<circle class="chart-dot" cx="' + xs[k].toFixed(1) + '" cy="' + y(p.v) + '" r="4.5" tabindex="0" data-bs-toggle="tooltip" data-bs-title="' + tip(p, 0) + '"/>';
        axis += '<text x="' + xs[k].toFixed(1) + '" y="170" text-anchor="middle">' + esc(p.label) + "</text>";
      });
    } else {
      var slot = (X1 - X0) / n, per = sets.length, bw = Math.min(per > 1 ? 18 : 44, slot * 0.7 / per);
      pts.forEach(function (p, k) {
        var cx = X0 + slot * k + slot / 2;
        sets.forEach(function (s, si) {
          var v = s[k].v, bx = cx - (bw * per + 4 * (per - 1)) / 2 + si * (bw + 4);
          body += '<rect class="chart-bar' + (si ? " alt" : "") + '" x="' + bx.toFixed(1) + '" y="' + y(v) + '" width="' + bw.toFixed(1) + '" height="' + (Y0 - y(v)).toFixed(1) + '" tabindex="0" data-bs-toggle="tooltip" data-bs-title="' + tip(s[k], si) + '"/>';
        });
        axis += '<text x="' + cx.toFixed(1) + '" y="170" text-anchor="middle">' + esc(p.label.length > 9 ? p.label.slice(0, 8) + "…" : p.label) + "</text>";
      });
    }
    pts.forEach(function (p, k) { desc.push(p.full + " " + sets.map(function (s, si) { return (names[si] ? names[si] + " " : "") + (fmt === "currency" ? formatCurrency(Math.round(s[k].v)) : s[k].v); }).join(", ")); });
    axis += "</g>";
    var id = fig.id || (fig.id = "chart-" + newId());
    fig.innerHTML = '<svg class="chart-svg" viewBox="0 0 400 175" role="img" aria-labelledby="' + id + '-d"><desc id="' + id + '-d">' + esc(label + ": " + desc.join("; ")) + "</desc>" + svg + axis + body + "</svg>";
    initTooltips(fig);
  }

  function renderDonut(box) {
    var pts = chartSeries(box, parseWhere(box.getAttribute("data-chart-where"))).filter(function (p) { return p.v > 0; }).slice(0, 5);
    var total = pts.reduce(function (s, p) { return s + p.v; }, 0), fmt = box.getAttribute("data-format");
    var off = 0, segs = "", legend = "";
    pts.forEach(function (p, i) {
      var share = p.v * 100 / total;
      segs += '<circle class="seg-' + (i + 1) + '" cx="21" cy="21" r="15.9155" pathLength="100" stroke-dasharray="' + Math.max(share - 0.8, 0.1).toFixed(1) + " " + (100 - share + 0.8).toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '"/>';
      legend += '<li><span class="legend-dot seg-' + (i + 1) + '"></span>' + esc(p.label) + " <strong>" + Math.round(share) + "%</strong></li>";
      off += share;
    });
    if (!pts.length) legend = '<li class="text-muted">No data yet</li>';
    box.innerHTML = '<div class="donut-center"><svg class="donut" viewBox="0 0 42 42" role="img" aria-label="' + esc(box.getAttribute("data-chart-label") || "Share") + '">' +
      (pts.length ? segs : '<circle class="donut-empty" cx="21" cy="21" r="15.9155"/>') + '</svg><div class="donut-label"><strong>' +
      (fmt === "currency" ? shortAmount(total, fmt) : Math.round(total)) + "</strong><span>" + esc(box.getAttribute("data-chart-center") || "Total") + '</span></div></div><ul class="legend">' + legend + "</ul>";
  }

  /* ------------------------------------------------------------------
     Calendar: <div data-calendar="appointments"> builds the month grid from saved records.
     Holds a <template data-template> for one event and a month <select data-calendar-month>.
     ------------------------------------------------------------------ */
  function renderCalendar(cal) {
    var name = cal.getAttribute("data-calendar"), tpl = $("template[data-template]", cal);
    var sel = $("select[data-calendar-month]", cal.closest("section") || document);
    var grid = $("[data-calendar-grid]", cal);
    if (!tpl || !grid) return;
    var now = new Date();
    if (sel && !sel.options.length) {
      for (var i = -6; i <= 12; i++) {
        var d = new Date(now.getFullYear(), now.getMonth() + i, 1), o = document.createElement("option");
        o.value = isoOf(d).slice(0, 7);
        o.textContent = MONTH_NAMES[d.getMonth()] + " " + d.getFullYear();
        if (i === 0) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener("change", function () { renderCalendar(cal); });
    }
    var ym = sel ? sel.value : isoOf(now).slice(0, 7);
    var first = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1);
    var start = addDays(first, -first.getDay()), today = isoOf(now);
    var byDay = {};
    sortRecords(coll(name).slice(), "date,time").forEach(function (r) {
      var iso = toIsoDate(r.f.date);
      if (iso) (byDay[iso] = byDay[iso] || []).push(r);
    });
    var html = document.createDocumentFragment(), max = parseInt(cal.getAttribute("data-calendar-max"), 10) || 3;
    for (var k = 0; k < 42; k++) {
      var day = addDays(start, k), iso = isoOf(day), events = byDay[iso] || [];
      if (k === 35 && day.getMonth() !== first.getMonth()) break; // 5-week months
      var cell = document.createElement("div");
      cell.className = "cal-day" + (day.getMonth() !== first.getMonth() ? " is-muted" : "") + (events.length ? " has-events" : "") + (iso === today ? " is-today" : "");
      cell.setAttribute("data-cal-date", iso);
      if (iso === today) cell.setAttribute("aria-current", "date");
      var label = DAYS[day.getDay()].slice(0, 3) + ", " + pad2(day.getDate()) + " " + MONTHS[day.getMonth()];
      cell.innerHTML = '<div class="cal-date"><span class="cal-date-num">' + day.getDate() + '</span><span class="cal-date-full">' + label + "</span>" +
        '<button type="button" class="cal-add" data-bs-toggle="modal" data-bs-target="' + (cal.getAttribute("data-calendar-add") || "#appointmentModal") + '" data-prefill-date="' + iso + '" aria-label="Add appointment on ' + formatDate(iso) + '"><i class="bi bi-plus" aria-hidden="true"></i></button></div>';
      events.slice(0, events.length > max + 1 ? max : max + 1).forEach(function (r) {
        var ev = tpl.content.firstElementChild.cloneNode(true);
        fillRecord(ev, r, name, joinedFields(cal.getAttribute("data-join"), r.f));
        cell.appendChild(ev);
      });
      if (events.length > max + 1) {
        var more = document.createElement("button");
        more.type = "button"; more.className = "cal-more";
        more.setAttribute("data-cal-more", iso);
        more.textContent = "+" + (events.length - max) + " more";
        cell.appendChild(more);
      }
      html.appendChild(cell);
    }
    grid.innerHTML = "";
    grid.appendChild(html);
    cal._dwByDay = byDay;
    initTooltips(grid);
  }

  function initCalendarDays() {
    document.addEventListener("click", function (e) {
      var more = e.target.closest("[data-cal-more]");
      if (!more) return;
      var cal = more.closest("[data-calendar]"), modal = $(cal.getAttribute("data-calendar-day-modal") || "#calDayModal");
      if (!modal) return;
      var iso = more.getAttribute("data-cal-more"), events = (cal._dwByDay || {})[iso] || [];
      var tpl = $("template[data-template]", cal), list = $(".cal-day-list", modal);
      $$("[data-cal-day-title]", modal).forEach(function (t) { t.textContent = DAYS[fromIso(iso).getDay()] + ", " + formatDate(iso); });
      $$("[data-cal-day-count]", modal).forEach(function (t) { t.textContent = events.length + " appointment" + (events.length === 1 ? "" : "s"); });
      $$("[data-cal-day-add]", modal).forEach(function (b) { b.setAttribute("data-prefill-date", iso); });
      list.innerHTML = "";
      events.forEach(function (r) {
        var ev = tpl.content.firstElementChild.cloneNode(true);
        fillRecord(ev, r, cal.getAttribute("data-calendar"), joinedFields(cal.getAttribute("data-join"), r.f));
        ev.setAttribute("data-switch-modal", ev.getAttribute("data-bs-target"));
        ev.removeAttribute("data-bs-toggle"); ev.removeAttribute("data-bs-target");
        list.appendChild(ev);
      });
      bootstrap.Modal.getOrCreateInstance(modal).show();
    });
  }

  /* doctor-details.html?doctor=<id>: [data-context="doctors"] picks the record named in the URL */
  function initContext() {
    var wrap = $("[data-context]");
    if (!wrap) return;
    var name = wrap.getAttribute("data-context");
    var id = null;
    try { id = new URLSearchParams(window.location.search).get(wrap.getAttribute("data-context-param") || "id"); } catch (e) { id = null; }
    var rec = (id && getRec(name, id)) || null;
    if (!rec && id) rec = coll(name).filter(function (r) { return norm(r.f.name).indexOf(norm(id)) !== -1; })[0] || null; // ?doctor=manoj
    if (!rec && !id) rec = sortRecords(coll(name).slice(), "name")[0] || null;
    CTX = rec ? { name: name, rec: rec } : null;
    $$("[data-context-found]").forEach(function (el) { el.hidden = !rec; });
    $$("[data-context-missing]").forEach(function (el) { el.hidden = !!rec; });
    if (rec && wrap.getAttribute("data-context-title")) {
      document.title = wrap.getAttribute("data-context-title").replace(/\{(\w+)\}/g, function (_, k) { return rec.f[k] || ""; });
    }
  }

  function renderContext() {
    if (!CTX) return;
    var rec = getRec(CTX.name, CTX.rec.id);
    if (!rec) { CTX = null; return; }
    CTX.rec = rec;
    $$("[data-context-record]").forEach(function (el) { fillRecord(el, rec, CTX.name, null); });
  }

  // Redraw everything that shows saved data
  function renderAll() {
    renderContext();
    renderOptions();
    $$("[data-collection]").forEach(renderHost);
    $$("[data-calendar]").forEach(renderCalendar);
    renderStats();
    $$("[data-notif-dot]").forEach(function (d) { d.hidden = !coll("notifications").some(function (n) { return n.f.unread === "yes"; }); });
    renderBreakdowns();
    renderGroups();
    $$("[data-chart]").forEach(renderChart);
    $$("[data-badge-scope]").forEach(function (s) { $$(".badge-status", s).forEach(setStatusAttr); });
    var current = storage("dw-branch");
    $$("[data-branch]").forEach(function (el) {
      var on = el.getAttribute("data-branch") === current;
      el.classList.toggle("active", on);
      el.setAttribute("aria-current", on ? "true" : "false");
    });
  }

  // Save a record element (new or edited) into its collection
  function persist(el, host) {
    host = host || el.closest("[data-collection]");
    var name = el.getAttribute("data-of") || (host && host.getAttribute("data-collection"));
    if (!name) return null;
    var data = readRecord(el), id = el.getAttribute("data-id");
    var rec = id ? getRec(name, id) : null, isNew = !rec;
    if (!rec) {
      rec = { id: newId(), f: {}, h: {}, t: Date.now() };
      coll(name).push(rec);
      NEW_IDS[rec.id] = true;
      $$("[data-seq]", el).forEach(function (x) { // numbers such as P-1001, INV-0001
        var k = x.getAttribute("data-field");
        if (!data.f[k]) data.f[k] = nextSeq(name, k, x.getAttribute("data-seq"), x.hasAttribute("data-seq-daily"));
      });
      $$("[data-stamp]", el).forEach(function (x) { // e.g. registration date = today
        if (!data.f[x.getAttribute("data-field")]) data.f[x.getAttribute("data-field")] = formatDate(isoOf(new Date()));
      });
    }
    var before = Object.assign({}, rec.f);
    Object.assign(rec.f, data.f);
    Object.assign(rec.h, data.h);
    el.setAttribute("data-id", rec.id);
    el.setAttribute("data-of", name);
    afterSave(name, rec, isNew, before);
    saveDb();
    return rec;
  }

  function unpersist(el) {
    var name = el.getAttribute("data-of"), id = el.getAttribute("data-id");
    if (!name || !id) return;
    var rec = getRec(name, id);
    DB.c[name] = coll(name).filter(function (r) { return r.id !== id; });
    if (rec) afterDelete(name, rec);
    saveDb();
  }

  /* form[data-also-add="patients"][data-also-match="phone"][data-also-fields="name,phone,age,gender"]:
     booking for someone new also creates their patient record */
  function alsoAdd(form) {
    var name = form.getAttribute("data-also-add");
    if (!name) return;
    var match = form.getAttribute("data-also-match") || "phone";
    var ctrl = form.elements[match];
    var key = ctrl && norm(ctrl.value);
    if (!key || coll(name).some(function (r) { return norm(r.f[match]) === key; })) return;
    var f = {};
    (form.getAttribute("data-also-fields") || match).split(",").forEach(function (k) {
      var c = form.elements[k.trim()];
      if (c && c.tagName) f[k.trim()] = controlDisplayValue(c);
    });
    if (form.getAttribute("data-also-stamp")) f[form.getAttribute("data-also-stamp")] = formatDate(isoOf(new Date()));
    var rec = { id: newId(), f: f, h: {}, t: Date.now() };
    coll(name).push(rec);
    NEW_IDS[rec.id] = true;
    saveDb();
    notify("New patient registered: " + (f.name || f[match]), "bi-person-plus");
    showToast("New patient added: " + (f.name || f[match]), "info");
  }

  function findById(name, id) {
    return $$('[data-of="' + name + '"][data-id="' + id + '"]').filter(function (el) { return !el.closest("template"); });
  }

  function initData() {
    seedDemo(false);
    $$("[data-collection][data-seed]").forEach(function (host) { seedHost(host, host.getAttribute("data-collection")); });
    initContext();
    initCalendarDays();
    // Another tab saved something: reload and redraw
    window.addEventListener("storage", function (e) {
      if (e.key !== DB_KEY) return;
      DB = loadDb();
      if (CTX) initContext();
      renderAll();
    });
  }

  /* ------------------------------------------------------------------
     Relations: saving one record keeps the records that depend on it in step
       payment → its invoice (paid / balance / status) → the patient's dues, plus a ledger entry
       invoice marked Paid → a payment for the balance
       appointment checked in ↔ today's check-in queue
       pharmacy sale → medicine stock (and a ledger entry); medicine stock → stock status
     ------------------------------------------------------------------ */
  function findBy(name, field, value) {
    var key = norm(value);
    return key ? coll(name).filter(function (r) { return norm(r.f[field]) === key; }) : [];
  }

  function addRec(name, f) {
    var rec = { id: newId(), f: f, h: {}, t: Date.now() };
    coll(name).push(rec);
    NEW_IDS[rec.id] = true;
    return rec;
  }

  function money(n) { return formatCurrency(Math.round(n * 100) / 100); }
  function nowTime() { var d = new Date(), h = d.getHours(); return ((h % 12) || 12) + ":" + pad2(d.getMinutes()) + " " + (h < 12 ? "AM" : "PM"); }
  function todayText() { return formatDate(isoOf(new Date())); }

  function syncPatientDues(name) {
    findBy("patients", "name", name).forEach(function (p) {
      var due = findBy("invoices", "patient", name).filter(function (i) { return slug(i.f.status) !== "cancelled"; })
        .reduce(function (s, i) { return s + parseNumber(i.f.balance); }, 0);
      p.f.balance = money(due);
    });
  }

  function paidOn(no) {
    return findBy("payments", "invoice", no).filter(function (p) { return slug(p.f.status) === "completed"; })
      .reduce(function (s, p) { return s + parseNumber(p.f.amount); }, 0);
  }

  function syncInvoice(no) {
    var inv = findBy("invoices", "invoice", no)[0];
    if (!inv) return;
    var amount = parseNumber(inv.f.amount), paid = paidOn(no);
    inv.f.paid = money(paid);
    inv.f.balance = money(Math.max(amount - paid, 0));
    if (["cancelled", "draft"].indexOf(slug(inv.f.status)) === -1) {
      var due = toIsoDate(inv.f.due);
      inv.f.status = amount > 0 && paid >= amount ? "Paid" : paid > 0 ? "Partially Paid" : due && due < isoOf(new Date()) ? "Overdue" : "Pending";
    }
    syncPatientDues(inv.f.patient);
  }

  function postLedger(f) {
    return addRec("transactions", Object.assign({ txn: nextSeq("transactions", "txn", "TXN-0001"), date: todayText() }, f)).f.txn;
  }

  function stockStatus(m) {
    var stock = parseNumber(m.f.stock), reorder = parseNumber(m.f.reorder), exp = toIsoDate(m.f.expiry), t = isoOf(new Date());
    if (exp && exp < t) return "Expired";
    if (stock <= 0) return "Out of Stock";
    if (stock <= reorder) return "Low Stock";
    if (exp && exp <= isoOf(addDays(new Date(), 60))) return "Expiring Soon";
    return "In Stock";
  }

  // "Amoxicillin 500mg × 10 @ ₹98, Chlorhexidine 0.2% × 1" → [{ name, qty, price }]
  function parseItems(text) {
    return String(text || "").split(/,(?!\d)\s*/).map(function (part) { // "₹1,200" is not a separator
      var m = /^(.*?)\s+[×x]\s*(\d+)\s*[a-z]*(?:\s*@\s*₹?\s*([\d,.]+))?$/i.exec(part.trim());
      return m ? { name: m[1].trim(), qty: parseInt(m[2], 10), price: m[3] ? parseNumber(m[3]) : null } : null;
    }).filter(Boolean);
  }

  var CHECKIN_OF = { "checked-in": "Waiting", "in-consultation": "In Consultation", "completed": "Completed" };
  var APPT_OF = { "waiting": "Checked In", "in-consultation": "In Consultation", "completed": "Completed" };

  function todaysFor(name, phone) {
    var t = isoOf(new Date());
    return findBy(name, "phone", phone).filter(function (r) { return toIsoDate(r.f.date) === t; });
  }

  function lowStockNote(m, was) {
    if (m.f.status !== was && /low|out/i.test(m.f.status)) notify(m.f.name + " is " + m.f.status.toLowerCase() + " (" + m.f.stock + " left)", "bi-capsule");
  }

  function afterSave(name, rec, isNew, before) {
    var f = rec.f, changed = function (k) { return isNew || before[k] !== f[k]; };
    if (name === "payments") {
      if (before.invoice && before.invoice !== f.invoice) syncInvoice(before.invoice);
      if (f.invoice) syncInvoice(f.invoice);
      if (slug(f.status) === "completed" && !f.txn) {
        var inv = findBy("invoices", "invoice", f.invoice)[0];
        f.txn = postLedger({
          description: (inv && inv.f.treatment ? inv.f.treatment : "Payment") + " — " + f.patient + (f.invoice ? " (" + f.invoice + ")" : ""),
          category: "Treatment", type: "Income", mode: f.method, amount: f.amount, reference: f.reference || f.payment,
          notes: "Posted automatically from payment " + f.payment + "."
        });
        notify("Payment of " + formatCurrency(f.amount) + " received from " + f.patient, "bi-cash-coin");
      }
      if (!isNew && changed("status") && slug(f.status) === "refunded" && slug(before.status) === "completed") {
        postLedger({ description: "Refund — " + f.patient + (f.invoice ? " (" + f.invoice + ")" : ""), category: "Refund", type: "Expense", mode: f.method, amount: f.amount, reference: f.payment, notes: "Refund of payment " + f.payment + "." });
      }
    } else if (name === "invoices") {
      var firstItem = parseItems(f.items)[0];
      if (firstItem) f.procedure = firstItem.name;
      if (changed("status") && slug(f.status) === "paid") {
        var open = parseNumber(f.amount) - paidOn(f.invoice);
        if (open > 0) {
          var pay = addRec("payments", {
            payment: nextSeq("payments", "payment", "PAY-1001"), reference: "CASH-" + String(Date.now()).slice(-4),
            patient: f.patient, invoice: f.invoice, date: todayText(), method: "Cash", amount: money(open), status: "Completed",
            notes: "Recorded when the invoice was marked as paid."
          });
          afterSave("payments", pay, true, {});
        }
      }
      syncInvoice(f.invoice);
      if (before.patient && before.patient !== f.patient) syncPatientDues(before.patient);
    } else if (name === "appointments") {
      var st = slug(f.status);
      if (CHECKIN_OF[st] && changed("status")) {
        var ci = todaysFor("checkins", f.phone)[0];
        if (ci) ci.f.status = CHECKIN_OF[st];
        else if (st === "checked-in" && toIsoDate(f.date) === isoOf(new Date())) {
          var q = addRec("checkins", { name: f.name, phone: f.phone, appt: f.time, date: todayText(), checkin: nowTime(), doctor: f.doctor, status: "Waiting" });
          q.f.token = nextSeq("checkins", "token", "T-01", true);
          notify(f.name + " checked in, token " + q.f.token, "bi-person-check");
        }
      }
    } else if (name === "checkins") {
      var appt = todaysFor("appointments", f.phone)[0];
      if (appt && APPT_OF[slug(f.status)]) appt.f.status = APPT_OF[slug(f.status)];
    } else if (name === "medicines") {
      var was = f.status;
      f.status = stockStatus(rec);
      lowStockNote(rec, was);
    } else if (name === "inventory") {
      var q = parseNumber(f.quantity), lvl = parseNumber(f.reorder), was2 = f.status;
      f.status = q <= 0 ? "Out of Stock" : q <= lvl ? "Low Stock" : "In Stock";
      f.value = money(q * parseNumber(f.cost));
      if (changed("quantity") || isNew) f.updated = todayText();
      if (f.status !== was2 && f.status !== "In Stock") notify(f.name + " is " + f.status.toLowerCase() + " (" + q + " " + (f.unit || "") + " left)", "bi-box-seam");
    } else if (name === "sales" && isNew) {
      parseItems(f.items).forEach(function (it) {
        coll("medicines").filter(function (m) { return norm(m.f.name).indexOf(norm(it.name)) === 0 || norm(it.name).indexOf(norm(m.f.name)) === 0; }).slice(0, 1).forEach(function (m) {
          var was = m.f.status;
          m.f.stock = String(Math.max(parseNumber(m.f.stock) - it.qty, 0));
          m.f.status = stockStatus(m);
          lowStockNote(m, was);
        });
      });
    }
    if (name === "sales" && /paid|completed/i.test(f.status) && !f.txn) {
      f.txn = postLedger({ description: "Pharmacy sale — " + f.patient + (f.bill ? " (" + f.bill + ")" : ""), category: "Pharmacy", type: "Income", mode: f.mode, amount: f.amount, reference: f.bill, notes: f.items });
    }
    if (name === "lab" && changed("status") && /ready|delivered/i.test(f.status)) {
      notify("Lab work " + f.status.toLowerCase() + ": " + f.work + " for " + f.patient + " (" + f.req + ")", "bi-eyedropper");
    }
  }

  function afterDelete(name, rec) {
    if (name === "documents") delFile(name + ":" + rec.id);
    if (name === "payments" && rec.f.invoice) syncInvoice(rec.f.invoice);
    if (name === "invoices") syncPatientDues(rec.f.patient);
  }

  /* ------------------------------------------------------------------
     Records opened from elsewhere: page.html?open=<id> (global search, notifications),
     and a click anywhere on a table row opens that record's preview
     ------------------------------------------------------------------ */
  // The trigger that previews a record (eye icon / "View profile"), never edit or delete
  function viewTrigger(rec) {
    var all = $$('[data-bs-toggle="modal"]', rec).filter(function (b) { return !b.closest("template"); });
    var bad = function (b) { return b.getAttribute("data-mode") === "edit" || /delete|remove|cancel/i.test(b.getAttribute("data-bs-target") || ""); };
    return all.filter(function (b) { return !bad(b) && /view|preview|receipt|profile|detail/i.test(b.getAttribute("data-bs-target") || ""); })[0] ||
      all.filter(function (b) { return !bad(b); })[0] || null;
  }

  function openRecord(id) {
    var el = $$('[data-record][data-id="' + id + '"]').filter(function (x) { return !x.closest("template") && !x.closest(".modal"); })[0];
    if (!el) return false;
    var pane = el.closest(".tab-pane");
    if (pane && !pane.classList.contains("active")) {
      var tab = $('[data-bs-toggle="tab"][data-bs-target="#' + pane.id + '"]');
      if (tab) bootstrap.Tab.getOrCreateInstance(tab).show();
    }
    var list = el.closest("[data-list]");
    if (list) {
      if (el.hidden) { list._dwState = null; applyFilters(list); }
      showRecordPage(list, el);
    }
    setTimeout(function () {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      flash(el);
      var trig = viewTrigger(el);
      if (trig) trig.click();
    }, 250);
    return true;
  }

  function initOpenParam() {
    var id = null;
    try { id = new URLSearchParams(window.location.search).get("open"); } catch (e) { id = null; }
    if (id && !openRecord(id)) showToast("That record is no longer available — it may have been deleted", "warning");
    // page.html?find=<text>: search the page's main list; a single match opens straight away
    var find = null;
    try { find = new URLSearchParams(window.location.search).get("find"); } catch (e) { find = null; }
    var box = find && $("[data-search-target]");
    if (box) {
      box.value = find;
      box.dispatchEvent(new Event("input", { bubbles: true }));
      var hits = visibleRecords($(box.getAttribute("data-search-target")));
      if (hits.length === 1 && hits[0].getAttribute("data-id")) openRecord(hits[0].getAttribute("data-id"));
    }
    if (id && window.history.replaceState) {
      var url = new URL(window.location.href);
      url.searchParams.delete("open");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    document.addEventListener("click", function (e) {
      var row = e.target.closest("table[data-list] > tbody > tr[data-record], [data-row-open] [data-record]");
      if (!row || e.target.closest("a, button, input, select, textarea, label, .dropdown, [data-bs-toggle]")) return;
      if (window.getSelection && String(window.getSelection())) return; // selecting text, not opening
      var trig = viewTrigger(row);
      if (trig) trig.click();
    });
  }

  /* ------------------------------------------------------------------
     Global search (header): finds records in every module and opens them
     ------------------------------------------------------------------ */
  var SEARCH_SOURCES = [
    { c: "patients", page: "patients.html", icon: "bi-person", title: "name", sub: ["pid", "phone"], label: "Patient" },
    { c: "appointments", page: "appointments.html", icon: "bi-calendar-check", title: "name", sub: ["date", "time", "doctor", "treatment"], label: "Appointment" },
    { c: "doctors", page: "doctors.html", icon: "bi-person-badge", title: "name", sub: ["specialization", "phone"], label: "Doctor" },
    { c: "invoices", page: "invoices.html", icon: "bi-receipt", title: "invoice", sub: ["patient", "amount", "status"], label: "Invoice" },
    { c: "payments", page: "payments.html", icon: "bi-credit-card-2-front", title: "payment", sub: ["patient", "amount", "method"], label: "Payment" },
    { c: "procedures", page: "treatment.html", icon: "bi-clipboard2-pulse", title: "procedure", sub: ["category", "price"], label: "Treatment" },
    { c: "plans", page: "treatment.html", icon: "bi-journal-medical", title: "plan", sub: ["patient", "treatment", "status"], label: "Treatment plan" },
    { c: "lab", page: "lab.html", icon: "bi-eyedropper", title: "req", sub: ["patient", "work", "status"], label: "Lab order" },
    { c: "medicines", page: "pharmacy.html", icon: "bi-capsule", title: "name", sub: ["generic", "stock"], label: "Medicine" },
    { c: "documents", page: "documents.html", icon: "bi-file-earmark-text", title: "name", sub: ["patient", "category"], label: "Document" },
    { c: "transactions", page: "transactions.html", icon: "bi-arrow-left-right", title: "txn", sub: ["description", "amount"], label: "Transaction" }
  ];

  function searchAll(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean), out = [];
    SEARCH_SOURCES.forEach(function (s) {
      coll(s.c).filter(function (r) {
        var text = Object.keys(r.f).map(function (k) { return r.f[k]; }).join(" ").toLowerCase();
        return terms.every(function (t) { return text.indexOf(t) !== -1; });
      }).slice(0, 4).forEach(function (r) { out.push({ s: s, r: r }); });
    });
    return out.slice(0, 14);
  }

  function currentPage() { return (window.location.pathname.split("/").pop() || "").toLowerCase(); }

  function initGlobalSearch() {
    var input = $("#globalSearch");
    if (!input) return;
    var form = input.closest("form");
    var box = document.createElement("div");
    box.className = "search-results";
    box.id = "globalSearchResults";
    box.setAttribute("role", "listbox");
    box.setAttribute("aria-label", "Search results");
    box.hidden = true;
    form.appendChild(box);
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-controls", box.id);
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-autocomplete", "list");
    var active = -1;
    var items = function () { return $$(".search-hit", box); };
    var close = function () { box.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; };
    var mark = function (i) {
      items().forEach(function (it, k) { it.classList.toggle("is-active", k === i); it.setAttribute("aria-selected", String(k === i)); });
      active = i;
    };
    var render = function () {
      var q = input.value.trim();
      if (q.length < 2) { close(); return; }
      var hits = searchAll(q);
      box.innerHTML = hits.length ? hits.map(function (h, i) {
        var sub = h.s.sub.map(function (k) { return h.r.f[k]; }).filter(Boolean).join(" · ");
        return '<a class="search-hit" role="option" id="gsr-' + i + '" aria-selected="false" href="' + h.s.page + "?open=" + h.r.id + '" data-open-id="' + h.r.id + '" data-open-page="' + h.s.page + '">' +
          '<span class="search-hit-icon"><i class="bi ' + h.s.icon + '" aria-hidden="true"></i></span>' +
          '<span class="search-hit-text"><strong>' + esc(h.r.f[h.s.title] || "—") + "</strong><small>" + esc(sub) + "</small></span>" +
          '<span class="search-hit-type">' + h.s.label + "</span></a>";
      }).join("") : '<p class="search-empty"><i class="bi bi-search" aria-hidden="true"></i> Nothing matches “' + esc(q) + "”. Try a patient name, phone, invoice or medicine.</p>";
      box.hidden = false;
      input.setAttribute("aria-expanded", "true");
      active = -1;
    };
    var go = function (a) {
      close();
      if (a.getAttribute("data-open-page") === currentPage() && openRecord(a.getAttribute("data-open-id"))) return;
      window.location.href = a.getAttribute("href");
    };
    input.addEventListener("input", render);
    input.addEventListener("focus", function () { if (input.value.trim().length >= 2) render(); });
    input.addEventListener("keydown", function (e) {
      var list = items();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (box.hidden || !list.length) return;
        e.preventDefault();
        mark(e.key === "ArrowDown" ? (active + 1) % list.length : (active <= 0 ? list.length - 1 : active - 1));
        input.setAttribute("aria-activedescendant", list[active].id);
      } else if (e.key === "Escape") { close(); }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!input.value.trim()) { showToast("Type a patient, appointment, invoice or medicine to search", "info"); return; }
      var list = items();
      if (box.hidden) { render(); list = items(); }
      if (list.length) go(list[Math.max(active, 0)]);
      else showToast('No results for "' + input.value.trim() + '"', "warning");
    });
    box.addEventListener("mousedown", function (e) { e.preventDefault(); }); // keep focus while clicking a hit
    box.addEventListener("click", function (e) {
      var a = e.target.closest(".search-hit");
      if (!a) return;
      e.preventDefault();
      go(a);
    });
    input.addEventListener("blur", function () { setTimeout(close, 150); });
  }

  /* ------------------------------------------------------------------
     Linked records inside a preview, e.g. a patient's appointments and invoices:
     <tbody data-related="appointments" data-related-match="phone=phone" data-related-sort="-date,time">
       <template data-template><tr>… [data-field] …</tr></template></tbody>
     [data-related-empty] / [data-related-count] / [data-related-hide-empty] inside the
     closest [data-related-wrap] follow it.
     ------------------------------------------------------------------ */
  function storedRecord(el) {
    var name = el && el.getAttribute && el.getAttribute("data-of"), id = el && el.getAttribute && el.getAttribute("data-id");
    return name && id ? getRec(name, id) : null;
  }

  function renderRelated(scope, rec) {
    $$("[data-related]", scope).forEach(function (box) {
      var tpl = $("template[data-template]", box);
      if (!tpl) return;
      $$(":scope > [data-related-row]", box).forEach(function (r) { r.remove(); });
      var name = box.getAttribute("data-related");
      var conds = parseWhere(box.getAttribute("data-related-where"));
      (box.getAttribute("data-related-match") || "").split(";").forEach(function (p) {
        if (!p.trim()) return;
        var kv = p.split("=");
        conds.push({ field: kv[0].trim(), neg: false, values: [rec ? (rec.f[(kv[1] || kv[0]).trim()] || "\u0000") : "\u0000"] });
      });
      var rows = rec ? coll(name).filter(function (r) { return matchWhere(r.f, conds); }) : [];
      if (box.getAttribute("data-related-sort")) rows = sortRecords(rows, box.getAttribute("data-related-sort"));
      var limit = parseInt(box.getAttribute("data-limit"), 10);
      if (limit) rows = rows.slice(0, limit);
      rows.forEach(function (r) {
        var el = tpl.content.firstElementChild.cloneNode(true);
        el.setAttribute("data-related-row", "");
        fillRecord(el, r, name, null);
        box.insertBefore(el, tpl);
      });
      var wrap = box.closest("[data-related-wrap]") || box.parentElement;
      $$("[data-related-empty]", wrap).forEach(function (e) { e.hidden = rows.length > 0; });
      $$("[data-related-count]", wrap).forEach(function (e) { e.textContent = rows.length; });
      $$("[data-related-hide-empty]", wrap).forEach(function (e) { e.hidden = rows.length === 0; });
    });
  }

  /* ------------------------------------------------------------------
     Confirm dialog (built once), demo reset, sign out, notification clicks
     ------------------------------------------------------------------ */
  function confirmDialog(opts, onYes) {
    var m = $("#dwConfirmModal");
    if (!m) {
      m = document.createElement("div");
      m.className = "modal fade";
      m.id = "dwConfirmModal";
      m.tabIndex = -1;
      m.setAttribute("aria-hidden", "true");
      m.setAttribute("aria-labelledby", "dwConfirmTitle");
      m.innerHTML = '<div class="modal-dialog modal-dialog-centered modal-sm"><div class="modal-content text-center"><div class="modal-body p-4">' +
        '<span class="confirm-icon tone-red"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i></span><h2 class="h5" id="dwConfirmTitle"></h2>' +
        '<p class="text-muted mb-0" data-confirm-text></p></div><div class="modal-footer justify-content-center">' +
        '<button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-danger" data-confirm-yes></button></div></div></div>';
      document.body.appendChild(m);
    }
    $("#dwConfirmTitle", m).textContent = opts.title;
    $("[data-confirm-text]", m).textContent = opts.text;
    var yes = $("[data-confirm-yes]", m);
    yes.textContent = opts.yes || "Confirm";
    yes.onclick = function () { bootstrap.Modal.getOrCreateInstance(m).hide(); onYes(); };
    bootstrap.Modal.getOrCreateInstance(m).show();
  }

  function initReplies() {
    document.addEventListener("submit", function (e) {
      var form = e.target, key = form.getAttribute && form.getAttribute("data-reply-to");
      if (!key) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!form.checkValidity()) { form.classList.add("was-validated"); showToast("Write a reply before sending", "danger"); return; }
      var modal = form.closest(".modal"), el = modal && modal._dwRecord, rec = storedRecord(el);
      if (!rec) return;
      var who = loadSettings().pfName || "Dr. Max D'Souza", d = new Date(), h = d.getHours();
      var when = formatDate(isoOf(d)) + ", " + ((h % 12) || 12) + ":" + pad2(d.getMinutes()) + " " + (h < 12 ? "AM" : "PM");
      var text = form.elements.reply.value.trim();
      rec.h = rec.h || {};
      rec.h[key] = (rec.h[key] || "") + '<li class="person align-items-start"><span class="avatar avatar-sm tone-blue">' + esc(who.replace(/^dr\.?\s+/i, "").split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase()) +
        '</span><div class="info-tile flex-grow-1"><span class="label">' + esc(who) + " · " + when + '</span><span class="value fw-normal">' + esc(text) + "</span></div></li>";
      if (/resolved|closed/i.test(rec.f.status || "")) rec.f.status = "Open";
      saveDb();
      renderAll();
      var fresh = findById(el.getAttribute("data-of"), rec.id)[0];
      if (fresh) { modal._dwRecord = fresh; fillModalFromRecord(modal, fresh); }
      form.reset();
      form.classList.remove("was-validated");
      showToast(form.getAttribute("data-success") || "Reply sent");
    }, true);
  }

  function initDemoActions() {
    document.addEventListener("click", function (e) {
      var reset = e.target.closest('[data-action="reset-demo"]');
      if (reset) {
        e.preventDefault();
        confirmDialog({ title: "Reset demo data?", text: "Every change made in this browser (new patients, appointments, invoices…) is replaced with the original demo data.", yes: "Reset data" }, function () {
          seedDemo(true);
          try { if (FILE_DB) FILE_DB.close(); window.indexedDB.deleteDatabase("dentalwyz-files"); } catch (err) { /* no stored files */ }
          storage("dw-flash", "Demo data restored");
          window.location.reload();
        });
        return;
      }
      // Bulk reminder: data-action="remind-all" data-target="#recallTable" data-remind-status="Due,Overdue"
      var remind = e.target.closest('[data-action="remind-all"]');
      if (remind) {
        e.preventDefault();
        var want = (remind.getAttribute("data-remind-status") || "").split(",").map(slug);
        var hits = $$("[data-record]", $(remind.getAttribute("data-target"))).map(storedRecord).filter(function (r) { return r && want.indexOf(slug(r.f.status)) !== -1; });
        if (!hits.length) { showToast("Nobody is due a reminder right now", "info"); return; }
        hits.forEach(function (r) { r.f.status = "Contacted"; });
        notify("Recall reminders sent to " + hits.length + " patient" + (hits.length === 1 ? "" : "s"), "bi-send");
        saveDb();
        renderAll();
        showToast("Reminders sent by SMS & WhatsApp to " + hits.length + " patient" + (hits.length === 1 ? "" : "s") + " — marked as contacted");
        return;
      }
      var out = e.target.closest('[data-action="logout"]');
      if (out) {
        e.preventDefault();
        storage("dw-session", "");
        storage("dw-flash", "You have been signed out");
        window.location.href = out.getAttribute("href") || "../index.html";
        return;
      }
      var note = e.target.closest("#notifList [data-record]");
      if (note) {
        var rec = storedRecord(note);
        if (rec && rec.f.unread) { rec.f.unread = ""; saveDb(); renderAll(); }
        if (rec && rec.f.href) window.location.href = rec.f.href;
      }
    });
    document.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("#notifList [data-record]")) { e.preventDefault(); e.target.click(); }
    });
    var flashMsg = storage("dw-flash");
    if (flashMsg) { storage("dw-flash", ""); setTimeout(function () { showToast(flashMsg, "info"); }, 300); }
  }

  /* ------------------------------------------------------------------
     Lists: search, filters, counts, numbering
     ------------------------------------------------------------------ */
  function getState(list) {
    if (!list._dwState) list._dwState = { search: "", global: "", filters: {} };
    return list._dwState;
  }

  function records(list) { return $$("[data-record]", list); }
  function visibleRecords(list) { return records(list).filter(function (r) { return !r.hidden; }); }

  function applyFilters(list) {
    var st = getState(list);
    var terms = [st.search, st.global].map(function (t) { return t.trim().toLowerCase(); });
    records(list).forEach(function (rec) {
      var text = rec.textContent.toLowerCase();
      var ok = terms.every(function (t) { return !t || text.indexOf(t) !== -1; });
      if (ok) {
        Object.keys(st.filters).forEach(function (field) {
          var want = st.filters[field];
          if (!want || want === "all") return;
          var el = $('[data-field="' + field + '"]', rec);
          var text = el ? fieldText(el) : rec.getAttribute("data-" + field);
          var iso = toIsoDate(text);
          if (want.indexOf("iso:") === 0) { if (iso !== want.slice(4)) ok = false; return; } // <input type="date"> filter
          if (iso && PERIODS.indexOf(want) !== -1) { if (!inPeriod(iso, want)) ok = false; return; } // "this-week" on a date field
          if (slug(text) !== want) ok = false;
        });
      }
      rec.hidden = !ok;
    });
    updateListMeta(list);
  }

  /* Every .table-responsive is a table viewport: N rows visible (data-visible-rows, default 6,
     "all" = no limit), the rest scroll inside it under a sticky header (style.css section 11) */
  var TABLE_ROWS = 6;
  var TABLE_WRAP = ".table-responsive";

  function sizeTableScroll(wrap) {
    var attr = wrap.getAttribute("data-visible-rows");
    var limit = parseInt(attr, 10) || TABLE_ROWS;
    var table = $(":scope > table", wrap);
    if (!table || !wrap.offsetParent) return; // hidden (inactive tab, closed modal) — measured when shown
    var rows = $$(":scope > tbody > tr", table).filter(function (r) { return !r.hidden && !r.classList.contains("is-paged-out"); });
    if (attr === "all" || rows.length <= limit) { wrap.style.removeProperty("--table-max-h"); return; }
    // Rect maths covers table rows and the phone card layout (margins between cards) alike
    var foot = $(":scope > tfoot", table);
    var height = rows[limit - 1].getBoundingClientRect().bottom - table.getBoundingClientRect().top;
    if (foot) height += foot.offsetHeight; // sticky totals row stays in view
    wrap.style.setProperty("--table-max-h", Math.ceil(height) + 1 + "px");
  }

  function initTableScroll() {
    var seen = typeof WeakSet === "function" ? new WeakSet() : null;
    var ro = typeof ResizeObserver === "function" ? new ResizeObserver(function (entries) {
      entries.forEach(function (en) { var w = en.target.closest(TABLE_WRAP); if (w) sizeTableScroll(w); });
    }) : null;
    var onScroll = function () { this.classList.toggle("is-scrolling", this.scrollTop > 0); };
    // Picks up tables added later too (e.g. history tables copied into a modal)
    var all = function () {
      $$(TABLE_WRAP).forEach(function (wrap) {
        if (seen && !seen.has(wrap)) {
          seen.add(wrap);
          wrap.addEventListener("scroll", onScroll, { passive: true });
          var table = $(":scope > table", wrap);
          if (ro && table) ro.observe(table); // re-measures when shown, filtered, or resized
        }
        sizeTableScroll(wrap);
      });
    };
    all();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
    var t;
    window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(all, 150); });
    ["shown.bs.tab", "shown.bs.modal", "shown.bs.collapse"].forEach(function (ev) { document.addEventListener(ev, all); });
    // Row menus must not be clipped by the scroll area: position them relative to the viewport.
    // Listens on window (capture) so it runs before Bootstrap's own document-level handler.
    window.addEventListener("click", function (e) {
      var toggle = e.target.closest('.table-responsive [data-bs-toggle="dropdown"]');
      if (!toggle || bootstrap.Dropdown.getInstance(toggle)) return;
      bootstrap.Dropdown.getOrCreateInstance(toggle, {
        popperConfig: function (cfg) { return Object.assign({}, cfg, { strategy: "fixed" }); }
      });
    }, true);
  }

  function recordStatus(rec) {
    var el = $('[data-field="status"]', rec);
    return el ? slug(fieldText(el)) : "";
  }

  /* Status counters and spotlights that follow a list (ignore search/filter state):
     [data-status-count-for="#id"][data-status-value="waiting,checked-in" | "all"] → number
     [data-spotlight-for="#id"][data-spotlight-status="in-consultation"] → shows the first matching record,
     with [data-spotlight-filled] / [data-spotlight-empty] parts */
  function updateStatusWidgets(list) {
    var sel = "#" + list.id;
    $$('[data-status-count-for="' + sel + '"]').forEach(function (el) {
      var want = (el.getAttribute("data-status-value") || "all").split(",");
      el.textContent = records(list).filter(function (r) {
        return want[0] === "all" || want.indexOf(recordStatus(r)) !== -1;
      }).length;
    });
    $$('[data-spotlight-for="' + sel + '"]').forEach(function (spot) {
      var want = (spot.getAttribute("data-spotlight-status") || "").split(",");
      var match = records(list).filter(function (r) { return want.indexOf(recordStatus(r)) !== -1; })[0] || null;
      spot._dwRecord = match;
      if (match) fillModalFromRecord(spot, match);
      $$("[data-spotlight-filled]", spot).forEach(function (p) { p.hidden = !match; });
      $$("[data-spotlight-empty]", spot).forEach(function (p) { p.hidden = !!match; });
    });
  }

  function updateListMeta(list) {
    paginate(list);
    var scrollWrap = list.closest && list.closest(TABLE_WRAP);
    if (scrollWrap) sizeTableScroll(scrollWrap);
    if (!list.id) return;
    updateStatusWidgets(list);
    var count = visibleRecords(list).length;
    $$('[data-count-for="#' + list.id + '"]').forEach(function (el) { el.textContent = count; });
    $$('[data-empty-for="#' + list.id + '"]').forEach(function (el) { el.hidden = count !== 0; });
    var i = 0;
    records(list).forEach(function (rec) {
      var idx = $("[data-row-index]", rec);
      if (!rec.hidden) i++;
      if (idx) idx.textContent = rec.hidden ? idx.textContent : i;
    });
  }

  /* ------------------------------------------------------------------
     Pagination: every table[data-list] (and any table with data-page-size) gets a pager
     under its scroll viewport. data-page-size="25" sets the start size, "all" turns it off.
     Rows on other pages get .is-paged-out — search/filters keep using [hidden], so counts,
     numbering and CSV export still cover every matching record.
     ------------------------------------------------------------------ */
  var PAGE_SIZES = [10, 25, 50, 100];

  function pageableRows(table) {
    return table.hasAttribute("data-list") ? records(table) : $$(":scope > tbody > tr", table);
  }

  function buildPager(table) {
    var attr = table.getAttribute("data-page-size");
    if (attr === "all" || table.tagName !== "TABLE" || table._dwPager) return;
    var size = parseInt(attr, 10) || PAGE_SIZES[0];
    var sizes = PAGE_SIZES.indexOf(size) === -1 ? PAGE_SIZES.concat(size).sort(function (a, b) { return a - b; }) : PAGE_SIZES;
    table._dwPageSize = size;
    table._dwPage = 1;
    var nav = document.createElement("nav");
    nav.className = "table-pager";
    nav.setAttribute("aria-label", "Table pages");
    nav.innerHTML =
      '<p class="table-pager-info" aria-live="polite"></p>' +
      '<div class="table-pager-controls">' +
        '<label class="table-pager-size"><span>Rows per page</span>' +
          '<select class="form-select form-select-sm" data-pager-size aria-label="Rows per page">' +
            sizes.map(function (n) { return '<option value="' + n + '"' + (n === size ? " selected" : "") + ">" + n + "</option>"; }).join("") +
          "</select></label>" +
        '<div class="table-pager-pages"></div>' +
      "</div>";
    // Below the scroll viewport and its empty state, never inside the scrolling rows
    var anchor = table.closest(TABLE_WRAP) || table;
    while (anchor.nextElementSibling && anchor.nextElementSibling.hasAttribute("data-empty-for")) anchor = anchor.nextElementSibling;
    anchor.parentNode.insertBefore(nav, anchor.nextSibling);
    nav._dwTable = table;
    table._dwPager = nav;
  }

  // Page numbers with gaps: 1 … 4 5 6 … 20 (0 = gap)
  function pageList(page, pages) {
    var out = [], i;
    if (pages <= 7) { for (i = 1; i <= pages; i++) out.push(i); return out; }
    var start = Math.max(2, page - 1), end = Math.min(pages - 1, page + 1);
    if (page <= 3) { start = 2; end = 4; }
    if (page >= pages - 2) { start = pages - 3; end = pages - 1; }
    out.push(1);
    if (start > 2) out.push(0);
    for (i = start; i <= end; i++) out.push(i);
    if (end < pages - 1) out.push(0);
    out.push(pages);
    return out;
  }

  function paginate(table) {
    var nav = table && table._dwPager;
    if (!nav) return;
    var all = pageableRows(table);
    var rows = all.filter(function (r) { return !r.hidden; });
    var size = table._dwPageSize;
    var pages = Math.max(1, Math.ceil(rows.length / size));
    var page = Math.min(Math.max(table._dwPage || 1, 1), pages);
    var from = (page - 1) * size;
    table._dwPage = page;
    all.forEach(function (r) { r.classList.remove("is-paged-out"); });
    rows.forEach(function (r, i) { if (i < from || i >= from + size) r.classList.add("is-paged-out"); });

    nav.hidden = rows.length === 0; // the empty state takes over
    $(".table-pager-info", nav).innerHTML = "Showing <strong>" + (from + 1) + "–" + Math.min(from + size, rows.length) +
      "</strong> of <strong>" + rows.length + "</strong>";
    var btn = function (target, content, label, disabled, cls) {
      return '<button type="button" class="pager-btn' + (cls ? " " + cls : "") + '" data-page="' + target + '" aria-label="' + label + '"' +
        (disabled ? " disabled" : "") + (cls === "pager-num active" ? ' aria-current="page"' : "") + ">" + content + "</button>";
    };
    $(".table-pager-pages", nav).innerHTML =
      btn(page - 1, '<i class="bi bi-chevron-left" aria-hidden="true"></i>', "Previous page", page === 1) +
      pageList(page, pages).map(function (n) {
        return n ? btn(n, n, "Page " + n, false, n === page ? "pager-num active" : "pager-num") : '<span class="pager-gap" aria-hidden="true">…</span>';
      }).join("") +
      '<span class="pager-status">Page ' + page + " of " + pages + "</span>" +
      btn(page + 1, '<i class="bi bi-chevron-right" aria-hidden="true"></i>', "Next page", page === pages);
  }

  function goToPage(table, page) {
    table._dwPage = page;
    paginate(table);
    var wrap = table.closest(TABLE_WRAP);
    if (wrap) { wrap.scrollTop = 0; sizeTableScroll(wrap); }
  }

  // Open the page that holds a record (e.g. one just added)
  function showRecordPage(list, rec) {
    if (!list._dwPager) return;
    var i = pageableRows(list).filter(function (r) { return !r.hidden; }).indexOf(rec);
    if (i !== -1) goToPage(list, Math.floor(i / list._dwPageSize) + 1);
  }

  function initPagination() {
    $$("table[data-list], table[data-page-size]").forEach(function (table) {
      buildPager(table);
      if (!table.hasAttribute("data-list")) paginate(table); // lists paginate in updateListMeta
    });
    document.addEventListener("click", function (e) {
      var b = e.target.closest(".table-pager [data-page]");
      if (!b || b.disabled) return;
      goToPage(b.closest(".table-pager")._dwTable, parseInt(b.getAttribute("data-page"), 10));
    });
    document.addEventListener("change", function (e) {
      var sel = e.target.closest(".table-pager [data-pager-size]");
      if (!sel) return;
      var table = sel.closest(".table-pager")._dwTable;
      var first = (table._dwPage - 1) * table._dwPageSize; // keep the first visible record on screen
      table._dwPageSize = parseInt(sel.value, 10);
      goToPage(table, Math.floor(first / table._dwPageSize) + 1);
    });
  }

  function initLists() {
    initPagination();
    $$("[data-list]").forEach(function (list) {
      // Keep a pristine copy of the first record to use as a template for new items
      var tpl = $("template[data-template]", list);
      var first = tpl ? tpl.content.firstElementChild : $("[data-record]", list);
      if (first) list._dwTemplate = first.cloneNode(true);
      updateListMeta(list);
    });

    document.addEventListener("input", function (e) {
      var input = e.target.closest("[data-search-target]");
      if (!input) return;
      $$(input.getAttribute("data-search-target")).forEach(function (list) {
        getState(list).search = input.value;
        list._dwPage = 1;
        applyFilters(list);
      });
    });

    document.addEventListener("change", function (e) {
      var sel = e.target.closest("select[data-filter-target], input[data-filter-target]");
      if (!sel) return;
      var value = sel.type === "date" ? (sel.value ? "iso:" + sel.value : "all") : slug(sel.value);
      $$(sel.getAttribute("data-filter-target")).forEach(function (list) {
        getState(list).filters[sel.getAttribute("data-filter-field") || "status"] = value;
        list._dwPage = 1;
        applyFilters(list);
      });
    });

    document.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-filter-target], a[data-filter-target]");
      if (!btn) return;
      e.preventDefault();
      var group = btn.closest("[data-filter-group]") || btn.parentElement;
      $$("[data-filter-target]", group).forEach(function (b) {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
      $$(btn.getAttribute("data-filter-target")).forEach(function (list) {
        getState(list).filters[btn.getAttribute("data-filter-field") || "status"] = slug(btn.getAttribute("data-filter-value"));
        list._dwPage = 1;
        applyFilters(list);
      });
    });

    // Reset all filters inside a toolbar
    document.addEventListener("click", function (e) {
      var btn = e.target.closest('[data-action="reset-filters"]');
      if (!btn) return;
      $$(btn.getAttribute("data-target")).forEach(function (list) {
        list._dwState = null;
        list._dwPage = 1;
        applyFilters(list);
      });
      var scope = btn.closest(".panel-header, .card-panel, form") || document;
      $$("[data-search-target]", scope).forEach(function (i) { i.value = ""; });
      $$("select[data-filter-target]", scope).forEach(function (s) { s.selectedIndex = 0; });
      $$("input[data-filter-target]", scope).forEach(function (i) { i.value = ""; });
      $$("[data-filter-value]", scope).forEach(function (b) {
        var all = slug(b.getAttribute("data-filter-value")) === "all";
        b.classList.toggle("active", all);
        b.setAttribute("aria-pressed", String(all));
      });
      showToast("Filters cleared", "info");
    });
  }

  /* ------------------------------------------------------------------
     Modals: preview / edit / add / delete
     ------------------------------------------------------------------ */
  function findRecord(trigger) {
    if (!trigger || !trigger.closest) return null;
    // data-record-ref="#id": a trigger outside the record (e.g. page header "Edit doctor")
    var ref = trigger.getAttribute && trigger.getAttribute("data-record-ref");
    if (ref && $(ref)) return $(ref);
    var rec = trigger.closest("[data-record]");
    if (rec) return rec;
    var spot = trigger.closest("[data-spotlight-for]");
    if (spot && spot._dwRecord) return spot._dwRecord;
    var modal = trigger.closest(".modal");
    return modal && modal._dwRecord ? modal._dwRecord : null;
  }

  function fillModalFromRecord(modal, record) {
    var fields = getFields(record);
    $$("[data-field]", modal).forEach(function (el) {
      var key = el.getAttribute("data-field");
      if (!fields[key]) return;
      var value = fieldText(fields[key]);
      if (el.matches("input, select, textarea")) return; // form controls are filled via name
      el.textContent = value;
      setStatusAttr(el);
    });
    $$("[data-record-label]", modal).forEach(function (el) { el.textContent = recordLabel(record); });
    // Rich blocks (e.g. a patient's visit history) are copied as markup from the record
    $$("[data-field-html]", modal).forEach(function (el) {
      var src = $('[data-field-html="' + el.getAttribute("data-field-html") + '"]', record);
      if (!src) return;
      el.innerHTML = "";
      Array.prototype.forEach.call(src.childNodes, function (n) { el.appendChild(n.cloneNode(true)); });
    });
    refreshAvatars(modal);
  }

  function fillFormFromRecord(form, record) {
    var fields = getFields(record);
    Array.prototype.forEach.call(form.elements, function (ctrl) {
      if (!ctrl.name || !fields[ctrl.name] || ctrl.hasAttribute("data-no-fill")) return;
      var value = fieldText(fields[ctrl.name]);
      if (value === "—") value = ""; // empty-field placeholder, not a value
      var pre = fields[ctrl.name].getAttribute("data-prefix");
      if (pre && value.indexOf(pre) === 0) value = value.slice(pre.length); // the form shows the prefix itself
      if (ctrl.type === "date") value = toIsoDate(value);
      else if (ctrl.type === "number") value = parseNumber(value);
      if (ctrl.tagName === "SELECT") {
        var opt = Array.prototype.filter.call(ctrl.options, function (o) { return o.text.trim() === value || o.value === value; })[0];
        if (opt) ctrl.value = opt.value;
      } else if (ctrl.type === "checkbox" || ctrl.type === "radio") {
        ctrl.checked = slug(ctrl.value) === slug(value);
      } else {
        ctrl.value = value;
      }
    });
    // No recalculation here: an edited record keeps its stored totals until the user changes line items.
  }

  function controlDisplayValue(ctrl) {
    if (ctrl.tagName === "SELECT") return ctrl.value && ctrl.selectedOptions[0] ? ctrl.selectedOptions[0].text.trim() : ""; // placeholder options have value=""
    if (ctrl.type === "date") return formatDate(ctrl.value);
    return ctrl.value.trim();
  }

  function writeRecordFromForm(record, form, isNew) {
    $$("[data-field]", record).forEach(function (el) {
      var key = el.getAttribute("data-field");
      var ctrl = form.elements[key];
      if (ctrl && ctrl.length && !ctrl.tagName) { // RadioNodeList: use the checked option
        setFieldValue(el, ctrl.value || "—");
      } else if (ctrl) {
        var v = controlDisplayValue(ctrl);
        var adjust = ctrl.getAttribute("data-adjust"); // stock received / used: change the current number
        if (adjust === "add") v = String(parseNumber(fieldText(el)) + parseNumber(v));
        if (adjust === "subtract") v = String(Math.max(parseNumber(fieldText(el)) - parseNumber(v), 0));
        var pre = el.getAttribute("data-prefix"); // e.g. doctor names always start with "Dr. "
        if (pre && v && v.toLowerCase().indexOf(pre.trim().toLowerCase()) !== 0) v = pre + v;
        // hidden detail fields stay empty (so an empty textarea reopens empty); visible ones show a dash
        setFieldValue(el, v || (el.hidden ? "" : "—"));
      } else if (key === "items" && $("[data-line-items]", form)) {
        setFieldValue(el, serializeLines(form) || (el.hidden ? "" : "—"));
      } else if ($('[data-value-for="' + key + '"]', form)) { // e.g. the subtotal / GST shown in a totals box
        setFieldValue(el, fieldText($('[data-value-for="' + key + '"]', form)));
      } else if (isNew) {
        setFieldValue(el, el.hasAttribute("data-default") ? el.getAttribute("data-default") : "—");
      }
    });
    // New records start without the template's history blocks
    if (isNew) $$("[data-field-html]", record).forEach(function (el) { el.textContent = el.getAttribute("data-empty") || ""; });
    // Elements only shown for brand new records (e.g. a "New" tag)
    $$("[data-new-only]", record).forEach(function (el) { el.hidden = !isNew; });
    refreshAvatars(record);
    syncSwitches(record);
  }

  // Keep status toggle switches in step with the record's status badge
  function syncSwitches(record) {
    var status = $('[data-field="status"]', record);
    if (!status) return;
    $$("input[data-status-on]", record).forEach(function (sw) {
      sw.checked = slug(fieldText(status)) === slug(sw.getAttribute("data-status-on"));
    });
  }

  /* ------------------------------------------------------------------
     Typeahead lookup (e.g. mobile number → existing patient auto-fill).
     Options are written in the HTML; JS only filters and copies values.
     ------------------------------------------------------------------ */
  function setControlValue(ctrl, value) {
    if (ctrl.type === "date") value = toIsoDate(value);
    else if (ctrl.type === "number") value = parseNumber(value);
    if (ctrl.tagName === "SELECT") {
      var opt = Array.prototype.filter.call(ctrl.options, function (o) { return o.text.trim() === value || o.value === value; })[0];
      if (opt) ctrl.value = opt.value;
    } else {
      ctrl.value = value;
    }
  }

  function suggestParts(wrap) {
    return {
      input: $("[data-suggest-input]", wrap),
      list: $(".suggest-list", wrap),
      clear: $('[data-action="clear-suggest"]', wrap),
      empty: $("[data-suggest-empty]", wrap),
      items: $$("[data-suggest-item]", wrap)
    };
  }

  function setSuggestActive(wrap, item) {
    var s = suggestParts(wrap);
    s.items.forEach(function (it) {
      var on = it === item;
      it.classList.toggle("is-active", on);
      it.setAttribute("aria-selected", String(on));
    });
    if (item) { s.input.setAttribute("aria-activedescendant", item.id); item.scrollIntoView({ block: "nearest" }); }
    else s.input.removeAttribute("aria-activedescendant");
  }

  function closeSuggest(wrap) {
    var s = suggestParts(wrap);
    if (!s.list) return;
    s.list.hidden = true;
    s.input.setAttribute("aria-expanded", "false");
    if (s.clear) s.clear.hidden = !s.input.value;
    setSuggestActive(wrap, null);
  }

  function filterSuggest(wrap) {
    var s = suggestParts(wrap);
    var q = s.input.value.trim();
    var digits = q.replace(/\D/g, "");
    var min = parseInt(wrap.getAttribute("data-suggest-min") || "3", 10);
    var hasLetters = /[a-z]/i.test(q);
    if (s.clear) s.clear.hidden = !q;
    if (digits.length < min && !(hasLetters && q.length >= 2)) { closeSuggest(wrap); return; }
    var shown = 0;
    s.items.forEach(function (it) {
      var phone = (fieldText($('[data-fill="phone"]', it)) || "").replace(/\D/g, "");
      var name = (fieldText($('[data-fill="name"]', it)) || "").toLowerCase();
      var match = hasLetters ? name.indexOf(q.toLowerCase()) !== -1 : phone.indexOf(digits) !== -1;
      it.hidden = !match;
      if (match) shown++;
    });
    if (s.empty) s.empty.hidden = shown > 0;
    s.list.hidden = false;
    s.input.setAttribute("aria-expanded", "true");
    setSuggestActive(wrap, null);
  }

  function chooseSuggest(wrap, item) {
    var form = wrap.closest("form");
    $$("[data-fill]", item).forEach(function (el) {
      var ctrl = form && form.elements[el.getAttribute("data-fill")];
      if (ctrl && ctrl.tagName) setControlValue(ctrl, fieldText(el));
    });
    closeSuggest(wrap);
    var name = $('[data-fill="name"]', item);
    showToast("Existing patient selected — details filled for " + (name ? fieldText(name) : "patient"), "info");
  }

  function initSuggest() {
    document.addEventListener("input", function (e) {
      var input = e.target.closest && e.target.closest("[data-suggest-input]");
      if (input) filterSuggest(input.closest("[data-suggest]"));
    });
    document.addEventListener("focusin", function (e) {
      var input = e.target.closest && e.target.closest("[data-suggest-input]");
      if (input && input.value.trim()) filterSuggest(input.closest("[data-suggest]"));
    });
    document.addEventListener("focusout", function (e) {
      var wrap = e.target.closest && e.target.closest("[data-suggest]");
      if (!wrap) return;
      setTimeout(function () { if (!wrap.contains(document.activeElement)) closeSuggest(wrap); }, 120);
    });
    document.addEventListener("keydown", function (e) {
      var input = e.target.closest && e.target.closest("[data-suggest-input]");
      if (!input) return;
      var wrap = input.closest("[data-suggest]");
      var s = suggestParts(wrap);
      if (s.list.hidden) return;
      var visible = s.items.filter(function (it) { return !it.hidden; });
      var idx = visible.indexOf($(".is-active", s.list));
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!visible.length) return;
        idx = e.key === "ArrowDown" ? (idx + 1) % visible.length : (idx <= 0 ? visible.length - 1 : idx - 1);
        setSuggestActive(wrap, visible[idx]);
      } else if (e.key === "Enter" && idx > -1) {
        e.preventDefault();
        chooseSuggest(wrap, visible[idx]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation(); // keep the modal open
        closeSuggest(wrap);
      }
    }, true);
    document.addEventListener("mousedown", function (e) {
      if (e.target.closest(".suggest-list")) e.preventDefault(); // keep focus on the input
    });
    document.addEventListener("click", function (e) {
      var item = e.target.closest("[data-suggest-item]");
      if (item) { chooseSuggest(item.closest("[data-suggest]"), item); return; }
      var clear = e.target.closest('[data-action="clear-suggest"]');
      if (clear) {
        var wrap = clear.closest("[data-suggest]");
        var input = suggestParts(wrap).input;
        input.value = "";
        closeSuggest(wrap);
        input.focus();
      }
    });
    document.addEventListener("mouseover", function (e) {
      var item = e.target.closest("[data-suggest-item]");
      if (item) setSuggestActive(item.closest("[data-suggest]"), item);
    });
  }

  /* Split time picker: hour / minute / AM-PM selects feeding one hidden input ("5:45 PM") */
  function syncTimePicker(picker, fromHidden) {
    var hidden = $('input[type="hidden"]', picker);
    var hour = $('[data-time-part="hour"]', picker);
    var minute = $('[data-time-part="minute"]', picker);
    var period = $('[data-time-part="period"]', picker);
    if (!hidden || !hour || !minute || !period) return;
    var m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(hidden.value.trim());
    if (fromHidden && m) {
      hour.value = String(m[1]).padStart(2, "0");
      minute.value = String(Math.round(parseInt(m[2], 10) / 5) * 5 % 60).padStart(2, "0");
      period.value = m[3].toUpperCase();
    }
    hidden.value = parseInt(hour.value, 10) + ":" + minute.value + " " + period.value;
  }

  function initTimePickers() {
    $$("[data-time-picker]").forEach(function (p) { syncTimePicker(p, false); });
    document.addEventListener("change", function (e) {
      var part = e.target.closest("[data-time-part]");
      if (part) syncTimePicker(part.closest("[data-time-picker]"), false);
    });
  }

  function flash(el) {
    el.classList.remove("record-flash");
    void el.offsetWidth;
    el.classList.add("record-flash");
  }

  function initModals() {
    document.addEventListener("show.bs.modal", function (e) {
      var modal = e.target;
      var trigger = e.relatedTarget;
      var record = findRecord(trigger);
      var form = $("form[data-add-to], form[data-edit-form]", modal);
      // data-add-target on the trigger sends new records to a different list (one modal, many tables)
      if (form) form._dwAddTo = trigger && trigger.getAttribute ? trigger.getAttribute("data-add-target") : null;
      var title = $("[data-modal-title]", modal);
      if (title && !title._dwOriginal) title._dwOriginal = title.innerHTML;

      modal._dwRecord = record || null;
      if (record) fillModalFromRecord(modal, record);
      var stored = storedRecord(record);
      renderRelated(modal, stored);
      renderLines(modal, record);
      renderSteps(modal, record);
      renderFilePreview(modal, record);
      if (stored) bindModalLinks(modal, stored);

      var plain = !form && $("form[data-success]", modal);
      if (plain && !plain.closest("[data-persist]")) {
        plain.reset();
        resetLineItems(plain);
        $$("input[data-counter]", plain).forEach(function (c) { // next number after the last one sent, e.g. PO-0319
          var last = storage("dw-counter-" + c.name) || c.getAttribute("data-counter"), m = /^(.*?)(\d+)$/.exec(last);
          c.value = m ? m[1] + String(parseInt(m[2], 10) + 1).padStart(m[2].length, "0") : last;
        });
        $$("input[type='date'][data-default-days]", plain).forEach(function (d) { d.value = isoOf(addDays(new Date(), parseInt(d.getAttribute("data-default-days"), 10) || 0)); });
        if (trigger && trigger.getAttribute) Array.prototype.forEach.call(trigger.attributes, function (a) {
          var key = a.name.indexOf("data-prefill-") === 0 ? a.name.slice(13) : null;
          if (key === "item") {
            var sel = $("select[data-line-product]", plain), o = sel && Array.prototype.filter.call(sel.options, function (x) { return norm(x.text) === norm(a.value); })[0];
            if (o) { sel.value = o.value; sel.dispatchEvent(new Event("change", { bubbles: true })); }
          } else if (key && plain.elements[key] && plain.elements[key].tagName) setControlValue(plain.elements[key], a.value);
        });
        recalc(plain);
      }
      if (form) {
        var isEdit = !!(record && trigger && trigger.getAttribute("data-mode") === "edit");
        form._dwEditing = isEdit ? record : null;
        form.classList.remove("was-validated");
        if (isEdit) {
          form.reset();
          resetLineItems(form);
          renderOptions($$("select[data-options-match]", form)); // full lists again before filling
          fillFormFromRecord(form, record);
          var itemsEl = getFields(record).items, taxEl = getFields(record).tax;
          $$("[data-tax-toggle]", form).forEach(function (t) { t.checked = !!taxEl && parseNumber(fieldText(taxEl)) > 0; });
          if (itemsEl && $("[data-line-items]", form)) restoreLines(form, fieldText(itemsEl));
          if (title && modal.hasAttribute("data-edit-title")) title.textContent = modal.getAttribute("data-edit-title");
        } else {
          form.reset();
          resetLineItems(form);
          renderOptions($$("select[data-options-match]", form)); // full lists again before filling
          if (title && title._dwOriginal) title.innerHTML = title._dwOriginal;
          // input[type=date][data-default-days="7"]: new records start today (+ n days)
          $$("input[type='date'][data-default-days]", form).forEach(function (d) { d.value = isoOf(addDays(new Date(), parseInt(d.getAttribute("data-default-days"), 10) || 0)); });
          form.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (!isEdit && trigger && trigger.getAttribute) {
          // data-prefill: copy matching fields from the trigger's record (e.g. Re-Call → Book appointment)
          if (record && trigger.hasAttribute("data-prefill")) fillFormFromRecord(form, record);
          // data-prefill-item="Amoxicillin 500mg": first bill line (e.g. "Sell" on a medicine)
          var item = trigger.getAttribute("data-prefill-item"), firstSel = item && $("select[data-line-product]", form);
          if (firstSel) {
            var match = Array.prototype.filter.call(firstSel.options, function (o) { return norm(o.text) === norm(item); })[0];
            if (match) { firstSel.value = match.value; firstSel.dispatchEvent(new Event("change", { bubbles: true })); }
          }
          // data-prefill-<name>="value": preset single controls (e.g. calendar day → date)
          Array.prototype.forEach.call(trigger.attributes, function (a) {
            if (a.name === "data-prefill-item") return;
            var key = a.name.indexOf("data-prefill-") === 0 ? a.name.slice(13) : null;
            if (key && form.elements[key] && form.elements[key].tagName) setControlValue(form.elements[key], a.value);
          });
        }
        $$("[data-time-picker]", form).forEach(function (p) {
          var hidden = $('input[type="hidden"]', p);
          if (!isEdit && p.hasAttribute("data-time-now") && hidden) { // e.g. "checked in at" = now
            var d = new Date(), h = d.getHours();
            hidden.value = ((h % 12) || 12) + ":" + pad2(Math.floor(d.getMinutes() / 5) * 5) + " " + (h < 12 ? "AM" : "PM");
            syncTimePicker(p, true);
          } else syncTimePicker(p, isEdit);
        });
        $$("[data-suggest]", form).forEach(closeSuggest);
        $$("[data-file-label]", form).forEach(function (l) { if (l._dwOriginal) l.textContent = l._dwOriginal; });
      }
    });

    // Switch from one modal to another (e.g. "Edit" inside a preview)
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-switch-modal]");
      if (!btn) return;
      e.preventDefault();
      var current = btn.closest(".modal");
      var next = $(btn.getAttribute("data-switch-modal"));
      if (!next) return;
      var open = function () { bootstrap.Modal.getOrCreateInstance(next).show(btn); };
      if (current) {
        current.addEventListener("hidden.bs.modal", function handler() {
          current.removeEventListener("hidden.bs.modal", handler);
          open();
        });
        bootstrap.Modal.getOrCreateInstance(current).hide();
      } else open();
    });

    // Confirm delete
    document.addEventListener("click", function (e) {
      var btn = e.target.closest('[data-action="confirm-delete"]');
      if (!btn) return;
      var modal = btn.closest(".modal");
      var record = modal && modal._dwRecord;
      if (modal) bootstrap.Modal.getOrCreateInstance(modal).hide();
      if (!record) return;
      var list = record.closest("[data-list]");
      var label = recordLabel(record);
      record.classList.add("record-removing");
      unpersist(record);
      setTimeout(function () {
        record.remove();
        if (list) updateListMeta(list);
        if (record.hasAttribute("data-of")) renderAll();
      }, 300);
      showToast((btn.getAttribute("data-success") || "Deleted") + ": " + label, btn.getAttribute("data-toast-type") || "success");
    });
  }

  /* ------------------------------------------------------------------
     Forms: validation, add / edit records, generic submit
     ------------------------------------------------------------------ */
  function initForms() {
    document.addEventListener("submit", function (e) {
      var form = e.target;
      if (form.id === "globalSearchForm") return;
      var isRecordForm = form.hasAttribute("data-add-to") || form.hasAttribute("data-edit-form");
      if (!isRecordForm && !form.hasAttribute("data-success") && !form.hasAttribute("data-redirect")) return;
      e.preventDefault();
      var submitter = e.submitter || null;

      // A bill needs at least one priced line (its read-only total is not checked by the browser)
      if ($("[data-line-items]", form) && !(submitter && submitter.formNoValidate) && !serializeLines(form)) {
        form.classList.add("was-validated");
        var firstLine = $("[data-line] select, [data-line] input", form);
        if (firstLine) firstLine.focus();
        showToast("Add at least one item to the bill", "danger");
        return;
      }
      // formnovalidate submit buttons skip validation
      if (!(submitter && submitter.formNoValidate) && !form.checkValidity()) {
        form.classList.add("was-validated");
        var bad = form.querySelector(":invalid");
        if (bad) bad.focus();
        showToast("Please complete the highlighted fields", "danger");
        return;
      }
      form.classList.remove("was-validated");
      var modal = form.closest(".modal");

      // A submit button may set the status it saves with, e.g. "Save & Complete" → Completed
      if (submitter && submitter.hasAttribute("data-submit-status") && form.elements.status) {
        form.elements.status.value = submitter.getAttribute("data-submit-status");
      }
      var submitMsg = submitter && submitter.getAttribute("data-success");

      if (isRecordForm) {
        var list = $(form._dwAddTo || form.getAttribute("data-add-to"));
        var editing = form._dwEditing;
        if (editing && (document.body.contains(editing) || editing.hasAttribute("data-id"))) {
          writeRecordFromForm(editing, form, false);
          var saved = editing.hasAttribute("data-of") || editing.closest("[data-collection]") ? persist(editing) : null;
          if (saved) storeFormFile(form, editing.getAttribute("data-of"), saved.id);
          if (saved) {
            renderAll();
            findById(editing.getAttribute("data-of"), saved.id).forEach(flash);
          } else {
            flash(editing);
            var ownList = editing.closest("[data-list]") || list;
            if (ownList) applyFilters(ownList);
          }
          showToast(submitMsg || form.getAttribute("data-success-edit") || "Changes saved successfully");
        } else if (list && list._dwTemplate) {
          var rec = list._dwTemplate.cloneNode(true);
          rec.hidden = false;
          rec.classList.remove("record-removing");
          writeRecordFromForm(rec, form, true);
          if (list.hasAttribute("data-collection")) {
            var added = persist(rec, list);
            storeFormFile(form, list.getAttribute("data-collection"), added.id);
            if (list.getAttribute("data-notify")) notify(fillTokens(list.getAttribute("data-notify"), added.f), list.getAttribute("data-notify-icon"));
            alsoAdd(form);
            renderAll();
            var shown = findById(list.getAttribute("data-collection"), added.id);
            var inList = shown.filter(function (el) { return list.contains(el); })[0];
            if (inList) showRecordPage(list, inList);
            shown.forEach(flash);
            var msg = submitMsg || form.getAttribute("data-success") || "Saved successfully";
            showToast(inList || !list.hasAttribute("data-where") ? msg : msg + " — it is not shown in this list (" + (list.getAttribute("data-where-label") || "outside this view") + ")");
          } else {
            var body = list.tagName === "TABLE" ? $("tbody", list) : list;
            // data-insert="end" keeps chronological lists (e.g. today's appointments) in order
            if (list.getAttribute("data-insert") === "end") body.appendChild(rec);
            else body.insertBefore(rec, body.firstElementChild);
            initTooltips(rec);
            applyFilters(list);
            showRecordPage(list, rec);
            flash(rec);
            showToast(submitMsg || form.getAttribute("data-success") || "Saved successfully");
          }
        } else if (list) {
          showToast("This list cannot take new records here", "warning");
        }
        form._dwEditing = null;
      } else {
        // input[data-counter="PO-0318"]: numbered documents such as purchase orders
        $$("input[data-counter]", form).forEach(function (c) { storage("dw-counter-" + c.name, c.value); });
        var vals = {};
        Array.prototype.forEach.call(form.elements, function (c) { if (c.name && c.tagName) vals[c.name] = controlDisplayValue(c); });
        var done = fillTokens(submitMsg || form.getAttribute("data-success") || "Saved successfully", vals);
        if (form.hasAttribute("data-notify")) notify(fillTokens(form.getAttribute("data-notify"), vals), form.getAttribute("data-notify-icon"));
        showToast(done);
      }

      if (modal && !form.hasAttribute("data-keep-open")) bootstrap.Modal.getOrCreateInstance(modal).hide();
      if (form.hasAttribute("data-reset-on-success")) { form.reset(); resetLineItems(form); recalc(form); }
      if (form.hasAttribute("data-redirect")) {
        var to = form.getAttribute("data-redirect");
        // Sign-in: remember who signed in and the branch they picked
        if (form.elements.email && form.elements.password) storage("dw-session", form.elements.email.value);
        var pickedBranch = $("select[data-branch-select]", form);
        if (pickedBranch) storage("dw-branch", pickedBranch.value);
        setTimeout(function () { window.location.href = to; }, 700);
      }
    });

    // Password visibility toggle
    document.addEventListener("click", function (e) {
      var btn = e.target.closest('[data-action="toggle-password"]');
      if (!btn) return;
      var input = $(btn.getAttribute("data-target"));
      if (!input) return;
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      var icon = $("i", btn);
      if (icon) icon.className = show ? "bi bi-eye-slash" : "bi bi-eye";
    });
  }

  /* ------------------------------------------------------------------
     Status changes
     ------------------------------------------------------------------ */
  function setRecordStatus(record, status) {
    $$('[data-field="status"]', record).forEach(function (el) { setFieldValue(el, status); });
    syncSwitches(record);
    if (record.hasAttribute("data-of")) {
      var saved = persist(record);
      renderAll();
      if (saved) findById(record.getAttribute("data-of"), saved.id).forEach(flash);
      return;
    }
    flash(record);
    var list = record.closest("[data-list]");
    if (list) applyFilters(list);
  }

  /* data-increment="done" data-increment-max="sessions": count one more session; at the maximum the
     record becomes data-complete-status (default Completed), otherwise data-progress-status */
  function initIncrement() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-increment]");
      if (!btn) return;
      e.preventDefault();
      var el = findRecord(btn), rec = storedRecord(el);
      if (!rec) return;
      var k = btn.getAttribute("data-increment"), max = parseNumber(rec.f[btn.getAttribute("data-increment-max")]);
      var before = Object.assign({}, rec.f), n = parseNumber(rec.f[k]);
      if (max && n >= max) { showToast("All " + max + " sessions are already recorded", "info"); return; }
      rec.f[k] = String(n + 1);
      if (rec.f.status !== undefined) rec.f.status = max && n + 1 >= max ? (btn.getAttribute("data-complete-status") || "Completed") : (btn.getAttribute("data-progress-status") || rec.f.status);
      afterSave(el.getAttribute("data-of"), rec, false, before);
      saveDb();
      renderAll();
      findById(el.getAttribute("data-of"), rec.id).forEach(flash);
      var modal = btn.closest(".modal");
      if (modal) fillModalFromRecord(modal, findById(el.getAttribute("data-of"), rec.id)[0] || el);
      showToast("Session " + (n + 1) + (max ? " of " + max : "") + " recorded" + (rec.f.status === "Completed" ? " — plan completed" : ""));
    });
  }

  function initStatus() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-set-status]");
      if (!btn) return;
      e.preventDefault();
      var record = findRecord(btn);
      if (!record) return;
      var status = btn.getAttribute("data-set-status");
      setRecordStatus(record, status);
      var modal = btn.closest(".modal");
      if (modal) {
        $$('[data-field="status"]', modal).forEach(function (el) { setFieldValue(el, status); });
        if (btn.hasAttribute("data-close-modal")) bootstrap.Modal.getOrCreateInstance(modal).hide();
      }
      showToast(recordLabel(record) + " — status updated to " + status, btn.getAttribute("data-toast-type") || "success");
    });

    document.addEventListener("change", function (e) {
      var sw = e.target.closest("input[data-status-on]");
      if (!sw) return;
      var record = findRecord(sw);
      var status = sw.checked ? sw.getAttribute("data-status-on") : sw.getAttribute("data-status-off");
      if (record) setRecordStatus(record, status);
      showToast((record ? recordLabel(record) + " is now " : "Status: ") + status, sw.checked ? "success" : "warning");
    });
  }

  /* ------------------------------------------------------------------
     Line items (invoice / prescription builders)
     ------------------------------------------------------------------ */
  function recalc(scope) {
    var lines = $$("[data-line]", scope);
    if (!lines.length && !$("[data-subtotal]", scope)) return;
    var subtotal = 0;
    lines.forEach(function (line) {
      var qty = parseNumber(($("[data-qty]", line) || {}).value);
      var price = parseNumber(($("input[data-price]", line) || {}).value);
      var total = qty * price;
      subtotal += total;
      var out = $("[data-line-total]", line);
      if (out) out.textContent = formatCurrency(total.toFixed(2));
    });
    var discountEl = $("[data-discount]", scope);
    var discount = discountEl ? parseNumber(discountEl.value) : 0;
    var taxEl = $("[data-tax]", scope), taxOn = $("[data-tax-toggle]", scope);
    var rate = taxEl && (!taxOn || taxOn.checked) ? parseNumber(taxEl.getAttribute("data-tax-rate")) : 0;
    var taxable = Math.max(subtotal - discount, 0);
    var tax = taxable * rate / 100;
    var grand = taxable + tax;
    $$("[data-subtotal]", scope).forEach(function (el) { el.textContent = formatCurrency(subtotal.toFixed(2)); });
    if (taxEl) taxEl.textContent = formatCurrency(tax.toFixed(2));
    $$("[data-grand-total]", scope).forEach(function (el) {
      if (el.matches("input")) el.value = grand.toFixed(2);
      else el.textContent = formatCurrency(grand.toFixed(2));
    });
  }

  // Line items are stored on the record as one text field: "Composite Filling × 1 @ ₹1,200, X-Ray × 2 @ ₹250"
  function serializeLines(form) {
    return $$("[data-line]", form).map(function (line) {
      var sel = $("select[data-line-product]", line), name = $("input[data-line-name]", line);
      var label = sel && sel.value ? sel.selectedOptions[0].text.trim() : name ? name.value.trim() : "";
      var qty = parseNumber(($("[data-qty]", line) || {}).value) || 1;
      var price = parseNumber(($("input[data-price]", line) || {}).value);
      return label ? label + " × " + qty + " @ " + formatCurrency(price) : "";
    }).filter(Boolean).join(", ");
  }

  function restoreLines(form, text) {
    var items = parseItems(text);
    $$("[data-line-items]", form).forEach(function (wrap) {
      var first = $("[data-line]", wrap);
      if (!first || !items.length) return;
      items.forEach(function (it, i) {
        var line = i === 0 ? first : first.cloneNode(true);
        if (i > 0) wrap.appendChild(line);
        var sel = $("select[data-line-product]", line);
        if (sel) {
          var opt = Array.prototype.filter.call(sel.options, function (o) { return norm(o.text) === norm(it.name); })[0];
          if (!opt) { opt = document.createElement("option"); opt.text = it.name; opt.setAttribute("data-price", it.price || 0); sel.appendChild(opt); }
          sel.value = opt.value;
        }
        var name = $("input[data-line-name]", line);
        if (name) name.value = it.name;
        var qty = $("[data-qty]", line);
        if (qty) qty.value = it.qty;
        var price = $("input[data-price]", line);
        if (price) price.value = it.price !== null ? it.price : (sel && sel.selectedOptions[0] ? sel.selectedOptions[0].getAttribute("data-price") || "" : "");
      });
    });
    recalc(form);
  }

  /* Progress steps in a preview: <ul data-steps="Pending|Sent to Lab|In Progress|Ready|Delivered"> with
     li[data-step="Ready"] each holding a .badge-status — earlier steps Completed, the current one In Progress */
  function renderSteps(scope, record) {
    $$("[data-steps]", scope).forEach(function (box) {
      var order = box.getAttribute("data-steps").split("|").map(slug);
      var src = record && getFields(record)[box.getAttribute("data-steps-field") || "status"];
      var at = order.indexOf(slug(src ? fieldText(src) : ""));
      $$("[data-step]", box).forEach(function (li) {
        var i = order.indexOf(slug(li.getAttribute("data-step"))), badge = $(".badge-status", li);
        if (!badge) return;
        badge.textContent = at < 0 ? "Pending" : i < at || (i === at && at === order.length - 1) ? "Completed" : i === at ? "In Progress" : "Pending";
        setStatusAttr(badge);
      });
      $$("[data-steps-note]", box.parentElement).forEach(function (n) { n.hidden = at >= 0; });
    });
  }

  /* Printable line list in a preview: <tbody data-lines-from="items"> with a <template> row holding
     [data-line-n] [data-line-name] [data-line-qty] [data-line-price] [data-line-amount] */
  function renderLines(scope, record) {
    $$("[data-lines-from]", scope).forEach(function (box) {
      var tpl = $("template", box);
      if (!tpl) return;
      $$(":scope > [data-line-row]", box).forEach(function (r) { r.remove(); });
      var src = record && getFields(record)[box.getAttribute("data-lines-from")];
      var items = parseItems(src ? fieldText(src) : "");
      if (!items.length && src) items = [{ name: fieldText(getFields(record)[box.getAttribute("data-lines-fallback") || "treatment"] || src) || "Treatment", qty: 1, price: null }];
      items.forEach(function (it, i) {
        var row = tpl.content.firstElementChild.cloneNode(true);
        row.setAttribute("data-line-row", "");
        var set = function (k, v) { $$("[data-line-" + k + "]", row).forEach(function (x) { x.textContent = v; }); };
        set("n", i + 1);
        set("name", it.name);
        set("qty", it.qty);
        set("price", it.price !== null ? formatCurrency(it.price) : "—");
        set("amount", it.price !== null ? formatCurrency(it.price * it.qty) : (getFields(record).subtotal ? fieldText(getFields(record).subtotal) : "—"));
        box.insertBefore(row, tpl);
      });
    });
  }

  function resetLineItems(form) {
    $$("[data-line-items]", form).forEach(function (wrap) {
      var lines = $$("[data-line]", wrap);
      lines.slice(1).forEach(function (l) { l.remove(); });
    });
  }

  function initLineItems() {
    document.addEventListener("input", function (e) {
      if (!e.target.closest) return;
      var form = e.target.closest("form");
      if (form && $("[data-subtotal], [data-line]", form)) recalc(form);
    });
    // Dependent dropdowns: changing "patient" re-lists select[data-options-match="patient=patient"]
    document.addEventListener("change", function (e) {
      var ctrl = e.target, form = ctrl.form;
      if (!form || !ctrl.name) return;
      var deps = $$("select[data-options-match]", form).filter(function (sel) {
        return sel !== ctrl && sel.getAttribute("data-options-match").split(";").some(function (p) { return (p.split("=")[1] || "").trim() === ctrl.name; });
      });
      if (deps.length) renderOptions(deps);
    });
    // select[data-option-fill="duration:duration"]: the chosen option's data-duration presets the "duration" control
    document.addEventListener("change", function (e) {
      var sel = e.target.closest && e.target.closest("select[data-option-fill]");
      var form = sel && sel.form;
      if (!form || !sel.selectedOptions[0]) return;
      sel.getAttribute("data-option-fill").split(";").forEach(function (pair) {
        var kv = pair.split(":"), v = sel.selectedOptions[0].getAttribute("data-" + kv[0].trim());
        var ctrl = form.elements[(kv[1] || kv[0]).trim()];
        if (!v || !parseNumber(v) && /^[\d.]+$/.test(v) || !ctrl || !ctrl.tagName) return; // nothing to fill (e.g. a ₹0 balance)
        if (ctrl.tagName === "SELECT") {
          var opts = Array.prototype.slice.call(ctrl.options);
          var opt = opts.filter(function (o) { return o.text.trim() === v; })[0] ||
            (parseNumber(v) ? opts.filter(function (o) { return parseNumber(o.text) === parseNumber(v); })[0] : null); // "30" → "30 min"
          if (opt) ctrl.value = opt.value;
        } else ctrl.value = v;
      });
    });
    // input[type=date][data-age-target="age"]: date of birth fills in the age
    document.addEventListener("change", function (e) {
      var dob = e.target.closest && e.target.closest("input[data-age-target]");
      if (!dob || !dob.value || !dob.form) return;
      var b = fromIso(dob.value), now = new Date();
      var age = now.getFullYear() - b.getFullYear() - (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate()) ? 1 : 0);
      var ctrl = dob.form.elements[dob.getAttribute("data-age-target")];
      if (ctrl && age >= 0) ctrl.value = Math.max(age, 1);
    });
    document.addEventListener("change", function (e) {
      var sel = e.target.closest("select[data-line-product]");
      if (!sel) return;
      var line = sel.closest("[data-line]");
      var opt = sel.selectedOptions[0];
      var price = line && $("input[data-price]", line);
      if (price && opt && opt.hasAttribute("data-price")) price.value = opt.getAttribute("data-price");
      var form = sel.closest("form");
      if (form) recalc(form);
    });
    document.addEventListener("click", function (e) {
      var add = e.target.closest('[data-action="add-line"]');
      if (add) {
        e.preventDefault();
        var wrap = $(add.getAttribute("data-target"));
        var first = wrap && $("[data-line]", wrap);
        if (!first) return;
        var clone = first.cloneNode(true);
        $$("input", clone).forEach(function (i) { i.value = i.getAttribute("value") || ""; });
        $$("select", clone).forEach(function (s) { s.selectedIndex = 0; });
        wrap.appendChild(clone);
        var focus = $("select, input", clone);
        if (focus) focus.focus();
        recalc(add.closest("form") || document);
        return;
      }
      var rm = e.target.closest('[data-action="remove-line"]');
      if (rm) {
        e.preventDefault();
        var line = rm.closest("[data-line]");
        var form = rm.closest("form");
        var siblings = line ? $$("[data-line]", line.parentElement) : [];
        if (siblings.length <= 1) { showToast("At least one line item is required", "warning"); return; }
        line.remove();
        if (form) recalc(form);
      }
    });
    $$("form").forEach(function (f) { if ($("[data-subtotal], [data-line]", f)) recalc(f); });
  }

  /* ------------------------------------------------------------------
     File upload dropzones
     ------------------------------------------------------------------ */
  function initDropzones() {
    $$("[data-dropzone]").forEach(function (zone) {
      var input = $('input[type="file"]', zone);
      var label = $("[data-file-label]", zone);
      if (label) label._dwOriginal = label.textContent;
      if (!input) return;
      ["dragenter", "dragover"].forEach(function (ev) {
        zone.addEventListener(ev, function () { zone.classList.add("is-dragover"); });
      });
      ["dragleave", "drop"].forEach(function (ev) {
        zone.addEventListener(ev, function () { zone.classList.remove("is-dragover"); });
      });
      input.addEventListener("change", function () {
        var form0 = input.closest("form"), chosen = input.files && input.files[0];
        if (chosen && chosen.size > 25 * 1024 * 1024) { showToast("That file is over 25 MB — choose a smaller file", "danger"); input.value = ""; return; }
        if (chosen && form0) {
          if (form0.elements.size) form0.elements.size.value = fileLabel(chosen);
          if (form0.elements.file) form0.elements.file.value = chosen.name;
        }
        var files = Array.prototype.map.call(input.files, function (f) { return f.name; });
        if (label) label.textContent = files.length ? files.join(", ") : label._dwOriginal;
        var target = input.getAttribute("data-fill-name");
        var form = input.closest("form");
        if (target && form && form.elements[target] && files.length && !form.elements[target].value) {
          form.elements[target].value = files[0].replace(/\.[^.]+$/, "");
        }
        if (files.length) showToast(files.length + " file" + (files.length > 1 ? "s" : "") + " attached", "info");
      });
    });
  }

  /* ------------------------------------------------------------------
     Uploaded files (documents): kept in this browser's IndexedDB, keyed "<collection>:<id>",
     so previews and downloads use the real file. input[type=file][data-store-file] in a record form.
     ------------------------------------------------------------------ */
  var FILE_DB = null;
  function fileStore(mode, fn) {
    if (!window.indexedDB) { fn(null); return; }
    var go = function (db) { try { fn(db.transaction("files", mode).objectStore("files")); } catch (e) { fn(null); } };
    if (FILE_DB) { go(FILE_DB); return; }
    try {
      var req = window.indexedDB.open("dentalwyz-files", 1);
      req.onupgradeneeded = function () { req.result.createObjectStore("files"); };
      req.onsuccess = function () { FILE_DB = req.result; go(FILE_DB); };
      req.onerror = function () { fn(null); };
    } catch (e) { fn(null); }
  }
  function putFile(key, file) { fileStore("readwrite", function (st) { if (st) st.put(file, key); }); }
  function delFile(key) { fileStore("readwrite", function (st) { if (st) st.delete(key); }); }
  function getFile(key, cb) {
    fileStore("readonly", function (st) {
      if (!st) { cb(null); return; }
      var r = st.get(key);
      r.onsuccess = function () { cb(r.result || null); };
      r.onerror = function () { cb(null); };
    });
  }

  function fileLabel(file) {
    var ext = (file.name.split(".").pop() || "file").toUpperCase(), kb = file.size / 1024;
    return ext + " · " + (kb >= 1024 ? (kb / 1024).toFixed(1) + " MB" : Math.max(1, Math.round(kb)) + " KB");
  }

  function storeFormFile(form, name, id) {
    var input = $("input[type='file'][data-store-file]", form);
    var file = input && input.files && input.files[0];
    if (file && name && id) putFile(name + ":" + id, file);
  }

  // [data-file-preview] in a preview modal shows the stored file (image / PDF), else its [data-file-empty] part
  function renderFilePreview(modal, record) {
    $$("[data-file-preview]", modal).forEach(function (box) {
      var view = $("[data-file-view]", box), empty = $("[data-file-empty]", box);
      if (box._dwUrl) { URL.revokeObjectURL(box._dwUrl); box._dwUrl = null; }
      if (view) { view.innerHTML = ""; view.hidden = true; }
      if (empty) empty.hidden = false;
      var name = record && record.getAttribute("data-of"), id = record && record.getAttribute("data-id");
      if (!name || !id || !view) return;
      getFile(name + ":" + id, function (blob) {
        if (!blob) return;
        var url = box._dwUrl = URL.createObjectURL(blob), type = blob.type || "";
        if (/^image\//.test(type)) view.innerHTML = '<img src="' + url + '" alt="Uploaded file preview">';
        else if (/pdf/.test(type)) view.innerHTML = '<iframe src="' + url + '" title="PDF preview"></iframe>';
        else view.innerHTML = '<p class="small mb-0"><i class="bi bi-file-earmark-zip" aria-hidden="true"></i> ' + esc(blob.name || "File") + ' — no preview for this file type. Use Download.</p>';
        view.hidden = false;
        if (empty) empty.hidden = true;
      });
    });
  }

  /* ------------------------------------------------------------------
     Print, download, CSV export
     ------------------------------------------------------------------ */
  function downloadBlob(content, filename, type) {
    var blob = new Blob([content], { type: type || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function tableToCsv(table) {
    var skip = [];
    var rows = [];
    $$(":scope > thead > tr > th", table).forEach(function (th, i) { if (th.hasAttribute("data-no-export")) skip.push(i); });
    $$(":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr", table).forEach(function (tr) {
      if (tr.hidden) return;
      var cells = $$(":scope > th, :scope > td", tr).filter(function (c, i) { return skip.indexOf(i) === -1; });
      if (!cells.length) return;
      rows.push(cells.map(function (c) {
        var t = c.innerText.replace(/\s+/g, " ").trim();
        return '"' + t.replace(/"/g, '""') + '"';
      }).join(","));
    });
    return "﻿" + rows.join("\r\n");
  }

  function initFileActions() {
    document.addEventListener("click", function (e) {
      var p = e.target.closest('[data-action="print"]');
      if (p) { e.preventDefault(); window.print(); return; }

      var d = e.target.closest('[data-action="download"]');
      if (d && !d._dwChecked) {
        e.preventDefault();
        var holder = findRecord(d), key = holder && holder.getAttribute("data-of") && holder.getAttribute("data-of") + ":" + holder.getAttribute("data-id");
        if (key && holder.getAttribute("data-of") === "documents") { // the real uploaded file, when there is one
          getFile(key, function (blob) {
            if (blob) {
              var a = document.createElement("a"), url = URL.createObjectURL(blob);
              a.href = url; a.download = blob.name || recordLabel(holder);
              document.body.appendChild(a); a.click(); a.remove();
              setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
              showToast("Downloading " + (blob.name || recordLabel(holder)));
            } else { d._dwChecked = true; d.click(); d._dwChecked = false; }
          });
          return;
        }
      }
      if (d) {
        e.preventDefault();
        var source = d.getAttribute("data-download-target") ? $(d.getAttribute("data-download-target")) : null;
        var record = findRecord(d);
        var modal = d.closest(".modal");
        var node = source || (modal && $(".modal-body", modal)) || record || $("main");
        var name = d.getAttribute("data-filename") || slug(record ? recordLabel(record) : document.title) + ".txt";
        var header = "Dentalwyz — " + document.title + "\nGenerated: " + new Date().toLocaleString("en-IN") + "\n\n";
        downloadBlob(header + node.innerText.replace(/\n{3,}/g, "\n\n"), name);
        showToast("Downloading " + name);
        return;
      }

      var x = e.target.closest('[data-action="export-csv"]');
      if (x) {
        e.preventDefault();
        var table = $(x.getAttribute("data-target"));
        if (!table) { showToast("Nothing to export", "warning"); return; }
        var file = x.getAttribute("data-filename") || "dentalwyz-export.csv";
        downloadBlob(tableToCsv(table), file, "text/csv;charset=utf-8");
        showToast("Exported " + file);
      }
    });
  }

  /* ------------------------------------------------------------------
     Panel switcher (e.g. chart period: week / month / year)
     ------------------------------------------------------------------ */
  function initPanelSwitch() {
    document.addEventListener("change", function (e) {
      var sel = e.target.closest("select[data-panel-switch]");
      if (!sel) return;
      var wrap = $(sel.getAttribute("data-panel-switch"));
      if (!wrap) return;
      $$("[data-panel]", wrap).forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== sel.value; });
    });
  }

  /* ------------------------------------------------------------------
     Generic demo feedback: data-toast on any element
     ------------------------------------------------------------------ */
  function initGenericToasts() {
    document.addEventListener("click", function (e) {
      var el = e.target.closest("[data-toast]");
      if (!el || el.matches("input, select, textarea") || el.type === "submit") return;
      if (el.tagName === "A" && (el.getAttribute("href") === "#" || !el.getAttribute("href"))) e.preventDefault();
      showToast(el.getAttribute("data-toast"), el.getAttribute("data-toast-type") || "success");
      var modal = el.closest(".modal");
      if (modal && el.hasAttribute("data-close-modal")) bootstrap.Modal.getOrCreateInstance(modal).hide();
    });
    document.addEventListener("change", function (e) {
      var el = e.target.closest("input[data-toast], select[data-toast]");
      if (!el || el.hasAttribute("data-status-on")) return;
      var msg = el.getAttribute("data-toast");
      if (el.type === "checkbox") msg += el.checked ? " enabled" : " disabled";
      showToast(msg, el.type === "checkbox" && !el.checked ? "warning" : (el.getAttribute("data-toast-type") || "success"));
    });
  }

  /* ------------------------------------------------------------------
     Misc: tooltips, deep-link modals, status badge colours
     ------------------------------------------------------------------ */
  function initTooltips(scope) {
    $$('[data-bs-toggle="tooltip"]', scope).forEach(function (el) { bootstrap.Tooltip.getOrCreateInstance(el); });
  }

  function openModalFromHash() {
    var id = window.location.hash.slice(1);
    if (!id || !/^[A-Za-z][\w-]*$/.test(id)) return;
    var modal = document.getElementById(id);
    if (modal && modal.classList.contains("modal")) {
      // page.html?prefill-name=…&prefill-phone=…#modalId opens the form with those values (e.g. Book appointment for a patient)
      var params = null;
      try { params = new URLSearchParams(window.location.search); } catch (err) { params = null; }
      modal.addEventListener("shown.bs.modal", function once() {
        modal.removeEventListener("shown.bs.modal", once);
        var form = $("form", modal) || (modal.matches("form") ? modal : null);
        if (!form || !params) return;
        params.forEach(function (value, key) {
          if (key.indexOf("prefill-") !== 0 || !value) return;
          var ctrl = form.elements[key.slice(8)];
          if (ctrl && ctrl.tagName) { setControlValue(ctrl, value); ctrl.dispatchEvent(new Event("change", { bubbles: true })); }
        });
        var treat = params.get("prefill-treatment"), line = $("select[data-line-product]", form);
        if (treat && line && !line.value) {
          var opt = Array.prototype.filter.call(line.options, function (o) { return norm(o.text) === norm(treat); })[0];
          if (opt) { line.value = opt.value; line.dispatchEvent(new Event("change", { bubbles: true })); }
        }
        recalc(form);
      });
      bootstrap.Modal.getOrCreateInstance(modal).show();
    }
    // #paneId opens that tab (e.g. appointments.html#recallPane, settings.html#pane-profile)
    var tab = $('[data-bs-toggle="tab"][data-bs-target="#' + id + '"], [data-bs-toggle="pill"][data-bs-target="#' + id + '"]');
    if (tab) {
      bootstrap.Tab.getOrCreateInstance(tab).show();
      var pane = document.getElementById(id);
      if (pane && pane.scrollIntoView) setTimeout(function () { (tab.closest(".card-panel, section") || pane).scrollIntoView({ block: "start", behavior: "smooth" }); }, 50);
    }
  }

  /* Preferences: controls with an id inside [data-persist] keep their value in this browser (switches at
     once, other fields when their form is saved). [data-setting-text="pfName"] shows a saved value anywhere
     (e.g. the profile name in the header); [data-setting-initials="pfName"] shows its initials. */
  var SETTINGS_KEY = "dentalwyz-settings-v1";
  function loadSettings() { try { return JSON.parse(storage(SETTINGS_KEY) || "{}") || {}; } catch (e) { return {}; } }

  function renderSettingText() {
    var saved = loadSettings();
    $$("[data-setting-text]").forEach(function (el) { var v = saved[el.getAttribute("data-setting-text")]; if (v) el.textContent = v; });
    $$("[data-setting-initials]").forEach(function (el) {
      var v = saved[el.getAttribute("data-setting-initials")];
      if (v) el.textContent = v.replace(/^dr\.?\s+/i, "").split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase();
    });
  }

  function initSettings() {
    var saved = loadSettings();
    var ctrls = function (scope) {
      return $$("input[id], select[id], textarea[id]", scope || document).filter(function (c) {
        return c.closest("[data-persist]") && c.type !== "password" && c.type !== "file" && !c.disabled && !c.closest("form[data-add-to], form[data-edit-form], [data-list], template");
      });
    };
    var apply = function () {
      ctrls().forEach(function (c) {
        if (!(c.id in saved)) return;
        if (c.type === "checkbox" || c.type === "radio") c.checked = !!saved[c.id]; else c.value = saved[c.id];
      });
    };
    var put = function (c) { saved[c.id] = c.type === "checkbox" || c.type === "radio" ? c.checked : c.value; };
    var store = function () { storage(SETTINGS_KEY, JSON.stringify(saved)); renderSettingText(); };
    apply();
    renderSettingText();
    document.addEventListener("change", function (e) {
      var c = e.target;
      if ((c.type === "checkbox" || c.type === "radio") && ctrls().indexOf(c) !== -1) { put(c); store(); }
    });
    document.addEventListener("submit", function (e) {
      var form = e.target;
      if (!form.closest("[data-persist]") || !form.checkValidity()) return;
      ctrls(form).forEach(put);
      store();
    }, true);
    document.addEventListener("reset", function (e) { if (e.target.closest("[data-persist]")) setTimeout(apply, 0); });
    // input[data-match="#newPassword"]: must equal that field (e.g. confirm password)
    document.addEventListener("input", function (e) {
      var form = e.target.form;
      if (!form) return;
      $$("input[data-match]", form).forEach(function (c) {
        var other = $(c.getAttribute("data-match"), form);
        c.setCustomValidity(other && c.value && other.value !== c.value ? "Passwords do not match" : "");
      });
    });
  }

  /* page.html?date=2026-10-05 presets a filter control marked data-filter-param="date" */
  function initFilterParams() {
    var params = null;
    try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
    $$("[data-filter-param]").forEach(function (ctrl) {
      var v = params.get(ctrl.getAttribute("data-filter-param"));
      if (!v) return;
      if (ctrl.tagName === "SELECT") setControlValue(ctrl, v); else ctrl.value = v;
      ctrl.dispatchEvent(new Event("change", { bubbles: true }));
      if (ctrl.type === "date") showToast("Showing appointments for " + DAYS[fromIso(v).getDay()] + ", " + formatDate(v), "info");
    });
  }

  /* Quick-insert chips: data-append-to="#field" data-append="text" adds the text to that field */
  function initAppendChips() {
    document.addEventListener("click", function (e) {
      var chip = e.target.closest("[data-append-to]");
      if (!chip) return;
      e.preventDefault();
      var field = $(chip.getAttribute("data-append-to"));
      if (!field) return;
      var text = chip.getAttribute("data-append") || chip.textContent.trim();
      var sep = field.tagName === "TEXTAREA" ? "\n" : ", ";
      var current = field.value.trim();
      if (current.split(/\n|,\s*/).indexOf(text) !== -1) return; // already added
      field.value = current ? current + sep + text : text;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.focus();
    });
  }

  /* One page, several views chosen by URL: <div data-view-param="doctor" data-view-default="manoj">
     with children [data-view="manoj"] … → page.html?doctor=priya shows that child only */
  function initViewParam() {
    $$("[data-view-param]").forEach(function (wrap) {
      var param = wrap.getAttribute("data-view-param");
      var wanted = null;
      try { wanted = new URLSearchParams(window.location.search).get(param); } catch (err) { wanted = null; }
      var views = $$("[data-view]", wrap).filter(function (v) { return v.parentElement === wrap; });
      var active = views.filter(function (v) { return v.getAttribute("data-view") === wanted; })[0] ||
        views.filter(function (v) { return v.getAttribute("data-view") === wrap.getAttribute("data-view-default"); })[0] || views[0];
      views.forEach(function (v) { v.hidden = v !== active; });
      if (active && active.getAttribute("data-page-title")) document.title = active.getAttribute("data-page-title");
      // size scroll areas that were hidden at first measurement
      if (active) $$(TABLE_WRAP, active).forEach(sizeTableScroll);
    });
  }

  /* Calendar: highlight today and open the month that contains it */
  function initCalendar() {
    var now = new Date();
    var iso = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
    $$('[data-cal-date="' + iso + '"]').forEach(function (d) {
      d.classList.add("is-today");
      d.setAttribute("aria-current", "date");
    });
    $$("select[data-current-month]").forEach(function (sel) {
      var month = iso.slice(0, 7);
      if (Array.prototype.some.call(sel.options, function (o) { return o.value === month; }) && sel.value !== month) {
        sel.value = month;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  function initBadges() {
    $$(".badge-status").forEach(setStatusAttr);
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", function () {
    if (typeof bootstrap === "undefined") return;
    initViewParam();
    initBadges();
    initSidebar();
    initHeaderDate();
    initBranches();
    initNotifications();
    initTopbarSearch();
    initGlobalSearch();
    initDemoActions();
    initReplies();
    initSettings();
    initData();
    initLists();
    initReports();
    renderAll();
    showSavedBranch();
    initTableScroll();
    initModals();
    initForms();
    initStatus();
    initIncrement();
    initLineItems();
    initDropzones();
    initTimePickers();
    initSuggest();
    initFileActions();
    initPanelSwitch();
    initGenericToasts();
    initCalendar();
    initAppendChips();
    initTooltips(document);
    openModalFromHash();
    window.addEventListener("hashchange", openModalFromHash); // same-page links such as the profile menu on Settings
    initFilterParams();
    initOpenParam();
  });
})();
