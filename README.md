# Dentalwyz — Dental Management Software (Frontend Demo)

A responsive, multi-page frontend demo for a dental clinic management system.
Built with **HTML5, CSS3, Bootstrap 5.3 and vanilla JavaScript**. No backend,
no frameworks, no build step — open `index.html` in a browser.

## Structure

```
index.html                 Sign-in screen (any valid email + password → dashboard)
assets/
  css/style.css            Design system: tokens, layout, components
  css/responsive.css       Tablet / mobile behaviour
  js/demo-data.js          The demo clinic's records (patients, appointments, invoices…)
  js/script.js             Behaviour: data layer, lists, forms, relations, search, reports
  images/                  Logo, favicon, illustrations (SVG)
pages/
  dashboard.html  appointments.html  patients.html  doctors.html
  documents.html  invoices.html      payments.html  transactions.html
  treatment.html  lab.html           pharmacy.html  inventory.html
  reports.html    settings.html      help-support.html
  doctor-details.html   One doctor's day: profile, now consulting, today's list, consultation
                        (doctor-details.html?doctor=<record id>; ?doctor=priya also works)
```

### Ground rules

* **HTML = structure.** Lists hold a `<template data-template>` (the markup of one record); the
  records themselves come from the data layer, so the same patient or invoice shows on every page.
* **Data = `assets/js/demo-data.js`.** Loaded into the browser's localStorage on the first visit.
  Dates are written as if `anchor` (2026-10-01) were today and are moved forward on load, so the
  clinic always has appointments today, this week and this month. Change the file's `version` to
  make browsers load it again; **Reset demo data** in the profile menu does the same on demand.
* **CSS = design.** No inline styles. Width percentages use `.w-pct-0 … .w-pct-100`.
* **JS = behaviour.** `script.js` reads and writes records through `data-*` attributes.

## Data and relations

Every change is saved in this browser (localStorage key `dentalwyz-data-v1`; uploaded document files
in IndexedDB `dentalwyz-files`; preferences in `dentalwyz-settings-v1`). Saving one record keeps the
records that depend on it in step (`afterSave` in `script.js`):

| Action | Also updates |
|---|---|
| Payment saved / completed / refunded | Invoice paid, balance and status → patient's dues → ledger entry (income, or refund expense) |
| Invoice marked **Paid** | Creates a cash payment for the balance |
| Appointment **Checked In** (today) | Adds the patient to the check-in queue with a token; queue status ↔ appointment status |
| Pharmacy sale | Takes the quantities out of medicine stock; paid bills post to the ledger |
| Medicine / inventory stock | Status (In Stock / Low / Out / Expiring) and inventory value |
| Lab order Ready / Delivered, payments, check-ins, low stock | A notification in the bell menu (clicking it opens the right page) |

Collections: `patients doctors appointments checkins recalls invoices payments transactions procedures
plans lab medicines sales documents inventory branches users tickets notifications`. New patients,
doctors, treatments (`procedures`), medicines and branches appear in every dropdown that lists them.

## Page layout

Every page repeats the same shell (copy it from `pages/dashboard.html`):

* `<aside class="sidebar offcanvas-lg offcanvas-start" id="appSidebar">` — on screens below 992px it
  becomes a Bootstrap off-canvas menu. Mark the current page with `class="nav-link active" aria-current="page"`.
* `<header class="topbar">` — collapse button, global search (`#globalSearch`), date chip
  (`#headerDate` + `#headerDatePicker`), notifications, branch switcher, profile menu.
* `<main class="content" id="main-content">` — page content.
* `<div id="toastContainer">` and the Bootstrap bundle + `script.js` at the end of `<body>`.

## Layout classes (custom CSS grid)

The Bootstrap `row` / `col-*` grid is **not used**. Layouts use custom CSS-grid classes from
`style.css` (section 3b, which also has the full breakpoint table). Cards, stat tiles and doctor
cards sit directly in the grid, with no wrapper column divs.

| Class | Use |
|---|---|
| `stats-grid` | The 4 stat cards on every page (1 → 2 → 4 columns) |
| `cards-grid` | Card lists such as doctors (1 → 2 → 3) |
| `tiles-grid`, `duo-grid`, `trio-grid` | Small tiles (2→4, always 2, always 3) |
| `grid-2`, `grid-3`, `split-grid`, `report-grid`, `steps-grid`, `stack` | Equal-width columns at different breakpoints |
| `layout-main-side`, `layout-wide-side`, `layout-split`, `layout-settings` | Page splits: main + side panel |
| `side-stack` | Side panels: 2 across on tablets, stacked on desktop |
| `filter-grid` | Filter bars (auto-fit columns) |
| `grid-12` + `span-half`, `span-sm-half`, `span-2` … `span-8` | Forms with fields of mixed widths |
| `span-full`, `gap-tight` | Full-width child; 0.5rem gap |

## Tables

Every table sits in a `<div class="table-responsive">` wrapper. That wrapper is the one global
table standard (`style.css` section 11 + `initTableScroll` in `script.js`); pages add no table CSS of their own.

* **6 rows visible**, the rest scroll inside the wrapper (the page does not grow). Override per table
  with `data-visible-rows="8"`; opt out with `data-visible-rows="all"` (used by the editable line-item builders).
* **Sticky header** with a solid background; a soft shadow appears once the rows are scrolled.
* **Sticky `<tfoot>`** — totals rows stay visible at the bottom.
* **Horizontal scroll** when columns don't fit; header and body share one table, so columns stay aligned.
* Height is re-measured on search/filter, tab/modal/collapse open, resize and font load, so tables in
  hidden tabs and modals (including history tables copied into a modal) work too.
* **Pagination** — every `table[data-list]` (and any table with `data-page-size`, e.g. the Reports tables)
  gets a pager below its viewport: "Showing 1–10 of 12", rows per page (10 / 25 / 50 / 100), Prev · pages · Next.
  `data-page-size="25"` sets the starting size, `"all"` turns it off. Search and filters go back to page 1;
  a new record opens the page it lands on; counts, row numbers, CSV export and print cover all matching records.
* Phones: the viewport is capped at ~70% of the screen height (row-card tables are tall), and touch scrolling
  continues to the page at the end of a table. Print shows every row.

## Interaction API (data attributes)

| Attribute | Where | Behaviour |
|---|---|---|
| `data-list` (+ `id`) | `<table>` or a grid container | Marks a searchable/filterable list. The first `[data-record]` is used as the template for new items. |
| `data-record` | `<tr>` / card | One item in a list. |
| `data-field="key"` | inside a record or a modal | A value. Hidden extra details: `<span data-field="phone" hidden>`. |
| `data-primary` | on one `[data-field]` | The record's label used in toasts and delete prompts. |
| `data-format="currency\|date"` | on a `[data-field]` | Formats values written from forms (`₹1,250`, `24 Oct 2026`). |
| `data-default="…"` | on a `[data-field]` | Value used for new records when the form has no matching control. |
| `data-avatar="name"` | avatar element | Shows the first letter of that field. |
| `data-new-only` | inside a record | Visible only on records added in this session (e.g. a "New" tag). |
| `.badge-status` | status badge | Colour is derived from its text (Pending, Paid, Low Stock …). |
| `data-row-index` | `<td>` | Auto-renumbered. |
| `data-count-for="#id"` | any element | Shows the number of visible records. |
| `data-empty-for="#id"` | empty state | Shown when no records are visible. |
| `data-search-target="#id"` | `<input>` | Live text search. |
| `data-filter-target="#id"` + `data-filter-field` | `<select>` or buttons with `data-filter-value` | Filters by a field (`all` shows everything). |
| `data-action="reset-filters"` + `data-target` | button | Clears search and filters. |
| `form[data-add-to="#id"]` | form inside a modal | Saves a new record (clones the template) or updates the record being edited. Controls are matched to fields by `name`. Messages: `data-success`, `data-success-edit`. |
| `data-edit-title` | `.modal` | Title shown when opened in edit mode (title element: `[data-modal-title]`). |
| `data-mode="edit"` | modal trigger | Opens a form modal pre-filled from the trigger's record. |
| any modal trigger inside a record | | The modal's `[data-field]` elements are filled from that record (preview). |
| `data-prefill` | modal trigger inside a record | Opens a form in *add* mode pre-filled from that record (e.g. Re-Call → Book appointment). |
| `data-prefill-<name>="value"` | modal trigger | Presets one control in add mode (e.g. calendar day `data-prefill-date="2026-10-20"`). |
| `#paneId` in the URL | link | Opens that tab, e.g. `appointments.html#recallPane`. |
| `data-view-param="doctor"` + children `data-view="…"` | container | Shows the child named in the URL (`?doctor=priya`); `data-view-default`, `data-page-title`. |
| `form[data-edit-form]` | form in a modal | Edit-only form (no list to add to), e.g. consultation, edit doctor. |
| `data-submit-status="Completed"` / `data-success` | submit button | Saves with that status and message (Save vs Save & Complete). Add `formnovalidate` for draft saves. |
| `data-add-target="#id"` | modal trigger | Sends a new record to that list instead of the form's `data-add-to`. |
| `data-insert="end"` | list | New records are appended (keeps time-ordered lists in order). |
| `data-record-ref="#id"` | modal trigger | Uses a record that is elsewhere on the page (e.g. header "Edit Doctor"). |
| `data-status-count-for="#id"` + `data-status-value="waiting,checked-in"` or `"all"` | any element | Live count of records with those statuses. |
| `data-spotlight-for="#id"` + `data-spotlight-status` | card | Shows the first record with that status (`[data-spotlight-filled]` / `[data-spotlight-empty]`); buttons inside act on it. |
| `data-row-status` | set by script on records | Status slug on the row/card, for CSS (row highlight, Start vs Continue buttons). |
| `data-field-html="key"` + `data-empty` | inside a record and in a modal | Copies a block of markup (visit history, billing…) into the modal; new records show `data-empty`. |
| `data-append-to="#field"` + `data-append` | chip button | Adds the text to a field (quick complaint / diagnosis / prescription). |
| `data-switch-modal="#id"` | button inside a modal | Closes this modal and opens another for the same record (e.g. Preview → Edit). |
| `data-action="confirm-delete"` | button in the delete modal | Removes the record. `[data-record-label]` shows its name. |
| `data-set-status="Paid"` | button / menu item | Updates the record's status badge. |
| `data-status-on` / `data-status-off` | checkbox switch in a record | Toggles the record's status. |
| `form[data-success]` | any form | Validates, shows a toast, closes its modal. `data-reset-on-success`, `data-redirect`, `data-keep-open` optional. |
| `data-toast="message"` | any button/link/switch | Shows a demo toast. `data-toast-type="info\|warning\|danger"`, `data-close-modal`. |
| `data-action="print"` | button | Prints the page, or only the open modal. |
| `data-action="download"` | button | Downloads a text copy of the record / modal (`data-filename`, `data-download-target`). |
| `data-action="export-csv"` + `data-target` | button | Exports the visible rows of a table to CSV. |
| `select[data-panel-switch="#id"]` | select | Shows the child `[data-panel="value"]` matching the selection. |
| `data-line-items`, `data-line`, `data-qty`, `data-price`, `data-line-total`, `data-subtotal`, `data-discount`, `data-tax` + `data-tax-rate`, `data-grand-total`, `data-action="add-line\|remove-line"`, `select[data-line-product]` with `option[data-price]` | invoice / bill builders | Live totals. |
| `data-dropzone` + `[data-file-label]`, `input[data-fill-name]` | upload area | Shows chosen file names, can pre-fill a title field. |
| `data-branch` / `data-current-branch` / `select[data-branch-select]` | header | Branch switching (remembered per browser). |
| `#modalId` in the URL | link | Opens that modal on load, e.g. `patients.html#patientModal`. |
| `data-collection="name"` + `<template data-template>` | list / table / menu | Draws the saved records of that collection. `data-where="date=today; status!=Cancelled"`, `data-sort="-date,time"`, `data-limit`, `data-join="patients:phone"` (fill missing fields from another collection). |
| `data-seq="INV-1001"` / `data-stamp` | field in a template | Number / today's date given to new records. |
| `data-stat="invoices"` + `-where` `-fn` (count, sum, avg, pct, perday, top) `-field` `-negate` `-bar` | any element | Live figure from a collection. |
| `data-derive="agg\|relday\|progress\|pct\|since\|ago\|workday"` | field | Computed value (e.g. a patient's last visit). |
| `data-chart="line\|bar\|bars2\|donut"` + `data-chart-source` `-value` `-x` (`last-7-days`, `last-30-days`, `last-6-months`, `weekdays`, `range`, `group:field`) | figure | Chart drawn from records. |
| `data-breakdown` / `data-group` | list / tbody | Share bars and grouped report tables (`[data-g="count:status=Completed"]`, `sum:amount`, `share:amount`…). |
| `data-related="appointments"` + `data-related-match="phone=phone"` | tbody / list in a preview | The opened record's linked history (visits, invoices, payments, documents). |
| `data-lines-from="items"` | tbody in a preview | Itemised bill from the stored line items. |
| `select[data-options="doctors"]` + `data-option-field` `data-option-attr-price` `data-option-fill="price:cost"` `data-options-match="patient=patient"` | select | Options from records; picking one fills other controls; dependent lists. |
| `page.html?open=<id>` / `?find=<text>` / `?date=YYYY-MM-DD` / `?prefill-<field>=…#modal` | URL | Open a record's preview, search the page's list, filter by date, open a pre-filled form. |
| `input[type=date][data-filter-target]` / period values (`today`, `this-week`, `last-month`…) | filter | Date filters. |
| `data-adjust="add\|subtract"` + `data-no-fill` | input in an edit form | Receive / use stock. |
| `data-increment="done"` + `data-increment-max` | button | Record one more treatment session. |
| `form[data-reply-to="thread"]` | form in a preview | Adds a message to the record's conversation (support tickets). |
| `input[data-counter="PO-0317"]` | plain form | Numbered documents such as purchase orders. |
| `data-persist` + `data-setting-text` / `data-setting-initials` | settings area | Saves preferences; shows the saved profile name in the header. |
| `data-store-file` + `[data-file-preview]` | upload input / preview | Keeps the uploaded file and previews / downloads it. |
| `[data-report]` + `form[data-report-form]` | reports page | Every figure, chart and table follows the chosen period and doctor. |
| `data-action="reset-demo"` / `"logout"` / `"remind-all"` | button | Restore the demo data / sign out / send all due recall reminders. |

Clicking anywhere on a table row opens that record's preview. The header search finds patients,
appointments, doctors, invoices, payments, treatments, plans, lab orders, medicines, documents and
transactions, and opens the one you pick.
