import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';

const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const fmtDate = (v) => (v && moment(v).isValid() ? moment(v).format('DD MMM YYYY') : '-');

// --- Period math ------------------------------------------------------------

// Returns { periodStart, periodEnd, bucket, label } for the period containing anchorDate.
// Weekly: Monday-start ISO week. Monthly: calendar month. Yearly: calendar year.
export const computePeriod = (type, anchorDate = new Date()) => {
  const m = moment(anchorDate);
  if (!m.isValid()) return computePeriod(type, new Date());

  if (type === 'weekly') {
    const start = m.clone().isoWeekday(1).startOf('day');
    const end = start.clone().add(6, 'days');
    return {
      periodStart: start.format('YYYY-MM-DD'),
      periodEnd: end.format('YYYY-MM-DD'),
      bucket: 'day',
      label: `${start.format('DD MMM')} – ${end.format('DD MMM YYYY')}`,
    };
  }
  if (type === 'monthly') {
    const start = m.clone().startOf('month');
    const end = m.clone().endOf('month');
    return {
      periodStart: start.format('YYYY-MM-DD'),
      periodEnd: end.format('YYYY-MM-DD'),
      bucket: 'week',
      label: start.format('MMMM YYYY'),
    };
  }
  // yearly
  const start = m.clone().startOf('year');
  const end = m.clone().endOf('year');
  return {
    periodStart: start.format('YYYY-MM-DD'),
    periodEnd: end.format('YYYY-MM-DD'),
    bucket: 'month',
    label: start.format('YYYY'),
  };
};

// Move anchor date by one period (direction: -1 back, +1 forward).
export const stepPeriod = (type, anchorDate, direction = 1) => {
  const m = moment(anchorDate);
  if (!m.isValid()) return new Date();
  const step = direction < 0 ? -1 : 1;
  if (type === 'weekly') return m.clone().add(step, 'weeks').toDate();
  if (type === 'monthly') return m.clone().add(step, 'months').toDate();
  return m.clone().add(step, 'years').toDate();
};

// --- HTML template ----------------------------------------------------------

const bucketLine = (buckets = []) =>
  buckets
    .map((b) => `${escapeHtml(b.label)}:${escapeHtml(b.count)}`)
    .join(' · ');

export const buildReportHtml = ({
  type = 'weekly',
  meta = {},
  totals = {},
  rows = [],
  scope = 'all',
  translations = {},
  appTitle = 'Shri Ram Nam Bank',
  adminEmail = '',
  truncatedRows = 0,
}) => {
  const T = (key, fallback) => (translations[key] ? translations[key] : fallback);

  const reportHeading = T(
    'reportTitle',
    `Ram Chant Report (${type.charAt(0).toUpperCase() + type.slice(1)})`
  );
  const periodLine = `${fmtDate(meta.periodStart)} – ${fmtDate(meta.periodEnd)}`;
  const generatedAtLine = meta.generatedAt
    ? moment(meta.generatedAt).format('DD MMM YYYY, hh:mm A')
    : moment().format('DD MMM YYYY, hh:mm A');

  const summaryCards = `
    <div class="summary">
      <div class="card"><div class="card-value">${escapeHtml(totals.totalUsers || 0)}</div><div class="card-label">${escapeHtml(T('totalUsers', 'Total Users'))}</div></div>
      <div class="card"><div class="card-value">${escapeHtml(totals.totalCount || 0)}</div><div class="card-label">${escapeHtml(T('totalCounts', 'Total Counts'))}</div></div>
      <div class="card"><div class="card-value">${escapeHtml(totals.activeUsers || 0)}</div><div class="card-label">${escapeHtml(T('activeUsers', 'Active Users'))}</div></div>
    </div>
  `;

  let body;
  if (scope === 'single' && rows.length > 0) {
    const user = rows[0];
    const bucketRows = (user.buckets || [])
      .map(
        (b) => `
      <tr>
        <td>${escapeHtml(b.label)}</td>
        <td class="num">${escapeHtml(b.count)}</td>
      </tr>
    `
      )
      .join('');
    body = `
      <div class="profile">
        <div class="profile-name">${escapeHtml(user.name || '-')}</div>
        <div class="profile-meta"><b>${escapeHtml(T('colMobile', 'Mobile'))}:</b> ${escapeHtml(user.mobile || '-')}</div>
        <div class="profile-meta"><b>${escapeHtml(T('colEmail', 'Email'))}:</b> ${escapeHtml(user.email || '-')}</div>
        <div class="profile-meta"><b>${escapeHtml(T('colStatus', 'Status'))}:</b> ${escapeHtml(String(user.status || '-').toUpperCase())}</div>
        <div class="profile-meta"><b>${escapeHtml(T('colRegistered', 'Registered'))}:</b> ${escapeHtml(fmtDate(user.registeredDate))}</div>
        <div class="profile-meta"><b>${escapeHtml(T('colTotal', 'Total'))}:</b> ${escapeHtml(user.totalCount || 0)}</div>
      </div>
      <h2 class="section-title">${escapeHtml(T('colBreakdown', 'Breakdown'))}</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>${escapeHtml(T('colBucket', 'Period'))}</th>
            <th class="num">${escapeHtml(T('colCount', 'Count'))}</th>
          </tr>
        </thead>
        <tbody>${bucketRows || `<tr><td colspan="2" class="empty">${escapeHtml(T('noDataForPeriod', 'No data for this period'))}</td></tr>`}</tbody>
      </table>
    `;
  } else if (rows.length === 0) {
    body = `<div class="empty-state">${escapeHtml(T('noDataForPeriod', 'No data for this period'))}</div>`;
  } else {
    const tableRows = rows
      .map(
        (r) => `
      <tr>
        <td>${escapeHtml(r.name || '-')}</td>
        <td>${escapeHtml(r.mobile || '-')}</td>
        <td>${escapeHtml(r.email || '-')}</td>
        <td>${escapeHtml(String(r.status || '-').toUpperCase())}</td>
        <td>${escapeHtml(fmtDate(r.registeredDate))}</td>
        <td class="num"><b>${escapeHtml(r.totalCount || 0)}</b></td>
        <td class="bucket-cell">${bucketLine(r.buckets)}</td>
      </tr>
    `
      )
      .join('');
    body = `
      <table class="data-table">
        <thead>
          <tr>
            <th>${escapeHtml(T('colName', 'Name'))}</th>
            <th>${escapeHtml(T('colMobile', 'Mobile'))}</th>
            <th>${escapeHtml(T('colEmail', 'Email'))}</th>
            <th>${escapeHtml(T('colStatus', 'Status'))}</th>
            <th>${escapeHtml(T('colRegistered', 'Registered'))}</th>
            <th class="num">${escapeHtml(T('colTotal', 'Total'))}</th>
            <th>${escapeHtml(T('colBreakdown', 'Breakdown'))}</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(reportHeading)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, "Noto Sans Devanagari", Arial, sans-serif; color: #222; font-size: 12px; margin: 0; }
  .header { background: #FF9933; color: #fff; padding: 16px 20px; margin: 0 0 18px; border-radius: 4px; }
  .header h1 { margin: 0 0 4px; font-size: 20px; letter-spacing: -0.2px; }
  .header .meta { font-size: 11px; opacity: 0.95; }
  .header .meta b { font-weight: 700; }
  .summary { display: flex; gap: 10px; margin: 0 0 18px; }
  .card { flex: 1; border: 1px solid #EBEBEB; border-radius: 6px; padding: 12px; text-align: center; background: #FFF8F0; }
  .card-value { font-size: 22px; font-weight: 800; color: #E07B20; }
  .card-label { font-size: 10px; color: #6B6B6B; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .section-title { font-size: 14px; margin: 18px 0 8px; color: #2D2D2D; }
  .profile { border: 1px solid #EBEBEB; border-radius: 6px; padding: 12px 14px; margin-bottom: 12px; background: #FFF; }
  .profile-name { font-size: 16px; font-weight: 800; margin-bottom: 6px; }
  .profile-meta { font-size: 11px; margin: 2px 0; color: #444; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .data-table th { background: #FFF3E0; color: #2D2D2D; text-align: left; padding: 5px 6px; border-bottom: 2px solid #FF9933; font-weight: 700; }
  .data-table td { padding: 4px 6px; border-bottom: 1px solid #EEE; vertical-align: top; word-wrap: break-word; }
  .data-table tr { page-break-inside: avoid; }
  .num { text-align: right; }
  .bucket-cell { font-size: 9px; color: #5a3a0f; }
  .empty { text-align: center; color: #9CA3AF; padding: 16px; }
  .empty-state { text-align: center; padding: 48px 16px; color: #6B6B6B; font-size: 14px; border: 1px dashed #CCC; border-radius: 6px; }
  .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #EBEBEB; font-size: 10px; color: #777; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(appTitle)} — ${escapeHtml(reportHeading)}</h1>
    <div class="meta">
      <b>${escapeHtml(T('colPeriod', 'Period'))}:</b> ${escapeHtml(periodLine)}
      &nbsp;·&nbsp; <b>${escapeHtml(T('reportScope', 'Scope'))}:</b> ${escapeHtml(scope === 'single' ? T('scopeSingleUser', 'Single User') : T('scopeAllUsers', 'All Users'))}
      ${meta.appId ? `&nbsp;·&nbsp; <b>App:</b> ${escapeHtml(meta.appId)}` : ''}
    </div>
    <div class="meta"><b>${escapeHtml(T('reportFooterGenerated', 'Generated'))}:</b> ${escapeHtml(generatedAtLine)}${adminEmail ? ` · ${escapeHtml(adminEmail)}` : ''}</div>
    ${truncatedRows > 0 ? `<div class="meta"><b>Showing:</b> top ${escapeHtml(rows.length)} of ${escapeHtml(rows.length + truncatedRows)} users (sorted by total count)</div>` : ''}
  </div>
  ${summaryCards}
  ${body}
  <div class="footer">
    <span>${escapeHtml(appTitle)}</span>
    <span>${escapeHtml(T('reportFooterGenerated', 'Generated'))}: ${escapeHtml(generatedAtLine)}</span>
  </div>
</body>
</html>`;
};

// --- Ram Naam repetition PDF -----------------------------------------------
// Renders the Devanagari mantra (default राम) the user-count number of times,
// separated by a single space. Cumulative section + one section per user.
// A safety cap keeps PDFs printable on mobile devices; truncated sections
// are clearly annotated. Existing report HTML/flow is untouched.

const RAM_MANTRA_DEVANAGARI = 'राम';
// Smaller chunks keep expo-print's render memory bounded — the v4 single-run experiment
// caused ExpoPrint.printToFileAsync to fail ("error writing the PDF data") on counts
// above ~25K, because the WebView allocated too much in one buffer. 500 is a safe
// balance between layout cost and per-chunk allocation size.
const RAM_REPETITION_CHUNK = 500;
// Max mantras rendered in ONE PDF. Above ~10–15K, Android's expo-print PDF writer fails
// with "error occurred while writing the PDF data". So instead of truncating, we SPLIT a
// large count across this many PDFs — every राम is written, just across multiple files.
export const RAM_PER_PDF = 10000;
const RAM_CUMULATIVE_CAP = 5000; // cumulative is an overview sample (full per-user counts appear below it)
const RAM_INDIVIDUAL_IN_ALL_CAP = 5000; // per-user sample in the multi-user "preview" (non-split) report

// Build a render plan: split the rows into PDF-sized parts so each part holds at most
// `perPdf` total रामs, and crucially SPLIT a single user across parts when their own
// count exceeds `perPdf`. Every राम is written — nothing is dropped. Each part's rows
// carry sliceFrom/sliceTo/grandTotal so a split user's section reads
// "राम 10,001–20,000 of 87,432".
export const planRamRepetitionParts = (rows = [], perPdf = RAM_PER_PDF) => {
  const cap = Math.max(1, Math.floor(Number(perPdf) || RAM_PER_PDF));
  const parts = [];
  let current = { rows: [], totalRams: 0 };
  const flush = () => {
    if (current.rows.length > 0) {
      parts.push(current);
      current = { rows: [], totalRams: 0 };
    }
  };
  for (const row of rows) {
    const total = Math.max(0, Math.floor(Number(row?.totalCount || 0)));
    if (total <= 0) continue;
    const isSplit = total > cap;
    let done = 0; // रामs of this user already placed into parts
    while (done < total) {
      const space = cap - current.totalRams;
      if (space <= 0) { flush(); continue; }
      const take = Math.min(space, total - done);
      current.rows.push({
        ...row,
        totalCount: take,
        grandTotal: isSplit ? total : 0,
        sliceFrom: isSplit ? done + 1 : 0,
        sliceTo: isSplit ? done + take : 0,
      });
      current.totalRams += take;
      done += take;
    }
  }
  flush();
  return parts;
};

// Back-compat alias for the older name (kept so existing callers don't break).
export const splitRowsIntoBatches = (rows = [], budget = RAM_PER_PDF) =>
  planRamRepetitionParts(rows, budget);
export const RAM_BATCH_BUDGET = RAM_PER_PDF;

const buildRamWordsHtml = (count, maxCap, mantra = RAM_MANTRA_DEVANAGARI) => {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  // maxCap=null/undefined/0/Infinity → no cap (render full count). Caller's choice.
  const isUncapped = maxCap == null || maxCap === 0 || !Number.isFinite(Number(maxCap));
  const cap = isUncapped ? Number.POSITIVE_INFINITY : Math.max(0, Math.floor(Number(maxCap)));
  const renderCount = Math.min(safeCount, cap);
  if (renderCount === 0) {
    return { html: '<span class="ram-empty">&mdash;</span>', renderCount, originalCount: safeCount };
  }
  // Chunked render: each chunk is a 500-word block separated by <br>. The hard breaks
  // (a) cap the per-chunk text-run buffer the native renderer allocates, avoiding OOM
  // on Android's expo-print for counts ≥25K, and (b) give the paginator clean line
  // boundaries. We trade some shaping-cache reuse for stability.
  const parts = [];
  let remaining = renderCount;
  let first = true;
  while (remaining > 0) {
    const n = Math.min(RAM_REPETITION_CHUNK, remaining);
    const block = (mantra + ' ').repeat(n).slice(0, -1);
    parts.push(first ? block : `<br>${block}`);
    first = false;
    remaining -= n;
  }
  return { html: parts.join(''), renderCount, originalCount: safeCount };
};

export const buildRamRepetitionHtml = ({
  scope = 'all',
  meta = {},
  totals = {},
  rows = [],
  translations = {},
  appTitle = 'Shri Ram Nam Bank',
  adminEmail = '',
  mantra = RAM_MANTRA_DEVANAGARI,
  batchInfo = null, // { number, total, label?, ramsInBatch? } — when rendering one batch of a multi-PDF run
  individualCapOverride, // optional cap; pass null/0 for "no cap" (used by batched all-users path)
  showCumulative, // optional override; defaults to (scope !== 'single')
}) => {
  const T = (key, fallback) => (translations[key] ? translations[key] : fallback);
  // Single-user reports (e.g. the user's yearly PDF) render one big block of mantras,
  // so we flow them into multiple columns to slash the page count — the dominant cost
  // of expo-print rendering. Multi-user/batched reports keep single-column to avoid
  // column/page-break interplay across per-user sections.
  const useMultiColumn = scope === 'single';
  const ramSectionClass = useMultiColumn ? 'ram-section multi-col' : 'ram-section';
  const heading = T('ramNamPdfTitle', 'Ram Naam Repetition Report');
  const periodLine = `${fmtDate(meta.periodStart)} – ${fmtDate(meta.periodEnd)}`;
  const generatedAtLine = meta.generatedAt
    ? moment(meta.generatedAt).format('DD MMM YYYY, hh:mm A')
    : moment().format('DD MMM YYYY, hh:mm A');

  // Per-user truncation (rare in v4 since per-user is uncapped in batched mode and 1M-capped in single).
  const truncationNote = (original, rendered) => {
    if (original <= rendered) return '';
    const tpl = T(
      'ramNamTruncated',
      'Note: rendered first {rendered} of {original} for printing performance.'
    );
    const msg = tpl
      .replace('{rendered}', rendered.toLocaleString('en-IN'))
      .replace('{original}', original.toLocaleString('en-IN'));
    return `<p class="truncation-note">${escapeHtml(msg)}</p>`;
  };

  // Cumulative section uses a clearer note (avoids the v3 confusion where users mistook the
  // system-wide cap for their personal data being truncated). Only shown in single-PDF mode.
  const cumulativeSampleNote = (original, rendered) => {
    if (original <= rendered) return '';
    const tpl = T(
      'cumulativeSampleNote',
      'OVERVIEW SAMPLE: showing first {rendered} of {original} system-wide राम. Each user\'s full count appears in their own section below.'
    );
    const msg = tpl
      .replace('{rendered}', rendered.toLocaleString('en-IN'))
      .replace('{original}', original.toLocaleString('en-IN'));
    return `<p class="truncation-note">${escapeHtml(msg)}</p>`;
  };

  const cumulativeCount = Number(totals.totalCount || 0);
  const renderCumulative = typeof showCumulative === 'boolean' ? showCumulative : scope !== 'single';
  const cumulativeBlock = !renderCumulative
    ? ''
    : (() => {
        const { html, renderCount, originalCount } = buildRamWordsHtml(cumulativeCount, RAM_CUMULATIVE_CAP, mantra);
        return `
          <h2 class="section-title">${escapeHtml(T('ramNamCumulative', 'Cumulative — All Users'))}</h2>
          <div class="ram-summary">
            <b>${escapeHtml(T('totalCounts', 'Total Counts'))}:</b> ${escapeHtml(originalCount.toLocaleString('en-IN'))}
            &nbsp;·&nbsp; <b>${escapeHtml(T('totalUsers', 'Total Users'))}:</b> ${escapeHtml(Number(totals.totalUsers || 0).toLocaleString('en-IN'))}
          </div>
          <div class="ram-section">${html}</div>
          ${cumulativeSampleNote(originalCount, renderCount)}
        `;
      })();

  // Caller may override the per-user cap. Pass null/0 for uncapped (render the full slice
  // — the splitter has already sized each part to fit one PDF). Single-user defaults to
  // uncapped; the multi-user "preview" caps each user to a sample.
  const individualCap = individualCapOverride !== undefined
    ? individualCapOverride
    : (scope === 'single' ? null : RAM_INDIVIDUAL_IN_ALL_CAP);
  const individualBlocks = rows
    .filter((r) => Number(r.totalCount || 0) > 0)
    .map((r, idx) => {
      const c = Number(r.totalCount || 0);
      // Render the full count we were given. The caller (splitter) guarantees this slice
      // is small enough for one PDF, so nothing is ever truncated.
      const { html, renderCount, originalCount } = buildRamWordsHtml(c, individualCap, mantra);
      // When this row is one slice of a split user, show the range + grand total so the
      // reader knows it's "राम 10,001–20,000 of 87,432", not a truncation.
      const grandTotal = Number(r.grandTotal || 0);
      const sliceLine = (r.sliceFrom && r.sliceTo && grandTotal)
        ? `&nbsp;·&nbsp; <b>${escapeHtml(T('ramNamPart', 'राम'))}:</b> ${escapeHtml(Number(r.sliceFrom).toLocaleString('en-IN'))}–${escapeHtml(Number(r.sliceTo).toLocaleString('en-IN'))} ${escapeHtml(T('ofTotal', 'of'))} ${escapeHtml(grandTotal.toLocaleString('en-IN'))}`
        : '';
      // First user starts on the same page as the header unless a cumulative section
      // sits between them. Without this guard the first user got page-break-before
      // and page 1 ended up almost empty.
      const isFirst = idx === 0 && !renderCumulative;
      const titleClass = isFirst ? 'section-title' : 'section-title page-break-before';
      return `
        <h2 class="${titleClass}">${escapeHtml(r.name || '-')}</h2>
        <div class="ram-summary">
          <b>${escapeHtml(T('colMobile', 'Mobile'))}:</b> ${escapeHtml(r.mobile || '-')}
          &nbsp;·&nbsp; <b>${escapeHtml(T('colEmail', 'Email'))}:</b> ${escapeHtml(r.email || '-')}
          &nbsp;·&nbsp; <b>${escapeHtml(T('totalCounts', 'Total Counts'))}:</b> ${escapeHtml((grandTotal || originalCount).toLocaleString('en-IN'))}${sliceLine}
        </div>
        <div class="${ramSectionClass}">${html}</div>
        ${truncationNote(originalCount, renderCount)}
      `;
    })
    .join('');

  const body = (scope === 'single'
    ? individualBlocks
    : `${cumulativeBlock}${individualBlocks}`)
    || `<div class="empty-state">${escapeHtml(T('noDataForPeriod', 'No data for this period'))}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(heading)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Noto Sans Devanagari", "Mangal", "Devanagari MT", -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #222; font-size: 12px; margin: 0; }
  .header { background: #FF9933; color: #fff; padding: 14px 18px; margin: 0 0 14px; border-radius: 4px; }
  .header h1 { margin: 0 0 4px; font-size: 18px; }
  .header .meta { font-size: 11px; opacity: 0.95; }
  .section-title { font-size: 15px; margin: 14px 0 6px; color: #2D2D2D; border-bottom: 2px solid #FF9933; padding-bottom: 4px; }
  .page-break-before { page-break-before: always; }
  .ram-summary { font-size: 12px; margin: 0 0 8px; color: #444; }
  .ram-section { font-size: 11px; line-height: 1.3; color: #FF9933; word-spacing: 0; font-family: "Noto Sans Devanagari", "Mangal", "Devanagari MT", serif; }
  .ram-section.multi-col { column-count: 3; column-gap: 6mm; column-fill: auto; }
  .ram-empty { color: #999; font-style: italic; }
  .truncation-note { font-size: 10px; color: #b91c1c; margin: 6px 0 0; font-style: italic; }
  .empty-state { text-align: center; padding: 48px 16px; color: #6B6B6B; font-size: 14px; border: 1px dashed #CCC; border-radius: 6px; }
  .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #EBEBEB; font-size: 10px; color: #777; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(appTitle)} &mdash; ${escapeHtml(heading)}</h1>
    <div class="meta">
      <b>${escapeHtml(T('colPeriod', 'Period'))}:</b> ${escapeHtml(periodLine)}
      &nbsp;·&nbsp; <b>${escapeHtml(T('reportScope', 'Scope'))}:</b> ${escapeHtml(scope === 'single' ? T('scopeSingleUser', 'Single User') : T('scopeAllUsers', 'All Users'))}
      ${meta.appId ? `&nbsp;·&nbsp; <b>App:</b> ${escapeHtml(meta.appId)}` : ''}
    </div>
    <div class="meta"><b>${escapeHtml(T('reportFooterGenerated', 'Generated'))}:</b> ${escapeHtml(generatedAtLine)}${adminEmail ? ` · ${escapeHtml(adminEmail)}` : ''}</div>
    ${batchInfo && batchInfo.total > 1
      ? `<div class="meta"><b>${escapeHtml(T('batchOfTotal', 'Part'))}:</b> ${escapeHtml(batchInfo.number)} / ${escapeHtml(batchInfo.total)}${batchInfo.label ? ` · ${escapeHtml(batchInfo.label)}` : ''}${batchInfo.ramsInBatch ? ` · ${escapeHtml(Number(batchInfo.ramsInBatch).toLocaleString('en-IN'))} राम` : ''}</div>`
      : ''}
  </div>
  ${body}
  <div class="footer">
    <span>${escapeHtml(appTitle)}</span>
    <span>${escapeHtml(T('reportFooterGenerated', 'Generated'))}: ${escapeHtml(generatedAtLine)}</span>
  </div>
</body>
</html>`;
};

// --- PDF generation / share -------------------------------------------------

// Lazy-require expo modules so web bundles don't fail if absent.
const loadNativePdfModules = () => {
  try {
    // eslint-disable-next-line global-require
    const Print = require('expo-print');
    // eslint-disable-next-line global-require
    const Sharing = require('expo-sharing');
    // eslint-disable-next-line global-require
    const FileSystem = require('expo-file-system');
    return { Print, Sharing, FileSystem };
  } catch (e) {
    return null;
  }
};

const sanitizeFilename = (name) => String(name || 'report').replace(/[^\w.-]+/g, '_').slice(0, 80);

// Native-only: write the PDF to disk and return its URI without opening the share sheet.
// Used by the multi-PDF build-then-list flow so admins see a list of generated files
// instead of N sequential share dialogs.
export const generatePdfFile = async (html, filename = 'ram-chant.pdf', targetDir = null) => {
  const safeName = sanitizeFilename(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);

  if (Platform.OS === 'web') {
    // On web we don't have a stable file path to link to; fall back to the share/print flow.
    await generateAndSharePdf(html, safeName);
    return { uri: null, filename: safeName, sizeBytes: 0, web: true };
  }

  const modules = loadNativePdfModules();
  if (!modules) {
    throw new Error('PDF modules not available. Run: npx expo install expo-print expo-sharing expo-file-system');
  }
  const { Print, FileSystem } = modules;

  const { uri: tempUri } = await Print.printToFileAsync({ html, base64: false });

  const dir = targetDir || `${FileSystem.cacheDirectory}ram-pdfs/`;
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch (_) { /* fall through; copy below will report a clearer error if dir is bad */ }

  const finalUri = `${dir}${safeName}`;
  try {
    await FileSystem.copyAsync({ from: tempUri, to: finalUri });
  } catch (e) {
    // If copy fails, just return the temp URI — still usable for share/open in this session.
    return { uri: tempUri, filename: safeName, sizeBytes: 0 };
  }

  let sizeBytes = 0;
  try {
    const info = await FileSystem.getInfoAsync(finalUri, { size: true });
    sizeBytes = Number(info?.size || 0);
  } catch (_) {}

  return { uri: finalUri, filename: safeName, sizeBytes };
};

// Persisted Storage Access Framework directory the user picked (e.g. Downloads),
// so we only prompt for a folder the first time and save silently afterwards.
const PDF_SAVE_DIR_KEY = 'pdfSaveDirectoryUri';

// Android-only: actually write the PDF into a user-chosen folder so it lands in
// the device's storage (a true "download"), not just a transient share sheet.
// Returns the saved content URI, or null if SAF is unavailable / the user declined
// (caller then falls back to the share sheet).
const savePdfToAndroidStorage = async (FileSystem, sourceUri, safeName) => {
  const SAF = FileSystem?.StorageAccessFramework;
  if (!SAF) return null;

  const baseName = safeName.replace(/\.pdf$/i, '');

  const requestDirectory = async () => {
    const perm = await SAF.requestDirectoryPermissionsAsync();
    if (!perm?.granted || !perm.directoryUri) return null;
    try { await AsyncStorage.setItem(PDF_SAVE_DIR_KEY, perm.directoryUri); } catch (_) {}
    return perm.directoryUri;
  };

  let directoryUri = null;
  try { directoryUri = await AsyncStorage.getItem(PDF_SAVE_DIR_KEY); } catch (_) {}
  if (!directoryUri) {
    directoryUri = await requestDirectory();
    if (!directoryUri) return null;
  }

  const base64 = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const writeInto = async (dirUri) => {
    const destUri = await SAF.createFileAsync(dirUri, baseName, 'application/pdf');
    await FileSystem.writeAsStringAsync(destUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return destUri;
  };

  try {
    return await writeInto(directoryUri);
  } catch (e) {
    // The remembered folder may have had its permission revoked — ask once more.
    try { await AsyncStorage.removeItem(PDF_SAVE_DIR_KEY); } catch (_) {}
    const fresh = await requestDirectory();
    if (!fresh) return null;
    return await writeInto(fresh);
  }
};

export const generateAndSharePdf = async (html, filename = 'ram-chant-report.pdf') => {
  const safeName = sanitizeFilename(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);

  if (Platform.OS === 'web') {
    try {
      const win = typeof window !== 'undefined' ? window.open('', '_blank') : null;
      if (!win) throw new Error('Popup blocked. Please allow popups to download the report.');
      win.document.open();
      win.document.write(html);
      win.document.close();
      // Give the browser a moment to render, then open print dialog (user can Save as PDF).
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch (_) {
          // ignore
        }
      }, 400);
      return { ok: true, mode: 'web-print' };
    } catch (err) {
      throw err;
    }
  }

  const modules = loadNativePdfModules();
  if (!modules) {
    throw new Error('PDF modules not available. Run: npx expo install expo-print expo-sharing expo-file-system');
  }
  const { Print, Sharing, FileSystem } = modules;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  let finalUri = uri;
  try {
    if (FileSystem?.cacheDirectory) {
      const target = `${FileSystem.cacheDirectory}${safeName}`;
      await FileSystem.copyAsync({ from: uri, to: target });
      finalUri = target;
    }
  } catch (_) {
    // fall back to original uri
  }

  // On Android, save the file to a user-chosen folder (e.g. Downloads) so it is a
  // real download. If SAF is unavailable or the user declines, fall through to share.
  if (Platform.OS === 'android') {
    try {
      const savedUri = await savePdfToAndroidStorage(FileSystem, finalUri, safeName);
      if (savedUri) {
        return { ok: true, mode: 'saved', uri: savedUri };
      }
    } catch (_) {
      // fall through to the share sheet below
    }
  }

  const canShare = (await Sharing.isAvailableAsync?.()) ?? true;
  if (canShare) {
    await Sharing.shareAsync(finalUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Download Ram Chant Report',
      UTI: 'com.adobe.pdf',
    });
  }
  return { ok: true, mode: 'native-share', uri: finalUri };
};

// Download a server-generated राम PDF (one complete file with every राम) and save it.
// Android: into the chosen folder via SAF; iOS: share sheet; web: browser download.
// The server has no WebView memory limit, so this works at any count.
export const downloadRamPdfFromServer = async (url, token, filename = 'ram-naam.pdf') => {
  const safeName = sanitizeFilename(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);

  if (Platform.OS === 'web') {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) throw new Error(`Server error ${resp.status}`);
    const blob = await resp.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    return { ok: true, mode: 'web-download', filename: safeName };
  }

  const modules = loadNativePdfModules();
  if (!modules) {
    throw new Error('PDF modules not available. Run: npx expo install expo-print expo-sharing expo-file-system');
  }
  const { Sharing, FileSystem } = modules;

  const tempUri = `${FileSystem.cacheDirectory}${safeName}`;
  const dl = await FileSystem.downloadAsync(url, tempUri, { headers: { Authorization: `Bearer ${token}` } });
  if (dl.status && dl.status >= 400) throw new Error(`Server error ${dl.status}`);

  if (Platform.OS === 'android') {
    try {
      const savedUri = await savePdfToAndroidStorage(FileSystem, dl.uri, safeName);
      if (savedUri) return { ok: true, mode: 'saved', uri: savedUri, filename: safeName };
    } catch (_) { /* fall through to share */ }
  }
  const canShare = (await Sharing.isAvailableAsync?.()) ?? true;
  if (canShare) {
    await Sharing.shareAsync(dl.uri, { mimeType: 'application/pdf', dialogTitle: 'राम Naam PDF', UTI: 'com.adobe.pdf' });
  }
  return { ok: true, mode: 'native-share', uri: dl.uri, filename: safeName };
};

// Generate one PDF per HTML part and save them ALL into a single user-chosen folder
// (Android) so a large राम count split across parts lands as N files in one place with a
// single folder prompt. On web/iOS (no silent folder save) it shares/prints each part.
// `parts` is an array of { html, filename }. Returns { saved: [{filename, uri}], mode }.
export const generateAndSaveRamPdfs = async (parts = []) => {
  const list = Array.isArray(parts) ? parts.filter((p) => p && p.html) : [];
  if (list.length === 0) return { saved: [], mode: 'none' };

  if (Platform.OS === 'web') {
    for (const p of list) {
      // eslint-disable-next-line no-await-in-loop
      await generateAndSharePdf(p.html, p.filename);
    }
    return { saved: list.map((p) => ({ filename: p.filename, uri: null })), mode: 'web-print' };
  }

  const modules = loadNativePdfModules();
  if (!modules) {
    throw new Error('PDF modules not available. Run: npx expo install expo-print expo-sharing expo-file-system');
  }
  const { Print, Sharing, FileSystem } = modules;
  const SAF = FileSystem?.StorageAccessFramework;

  // Android: save every part into one chosen folder (prompt once, reuse thereafter).
  if (Platform.OS === 'android' && SAF) {
    const requestDir = async () => {
      const perm = await SAF.requestDirectoryPermissionsAsync();
      if (!perm?.granted || !perm.directoryUri) return null;
      try { await AsyncStorage.setItem(PDF_SAVE_DIR_KEY, perm.directoryUri); } catch (_) {}
      return perm.directoryUri;
    };
    let directoryUri = null;
    try { directoryUri = await AsyncStorage.getItem(PDF_SAVE_DIR_KEY); } catch (_) {}
    if (!directoryUri) directoryUri = await requestDir();

    if (directoryUri) {
      const saved = [];
      try {
        for (const p of list) {
          const safeName = sanitizeFilename(p.filename.endsWith('.pdf') ? p.filename : `${p.filename}.pdf`);
          // eslint-disable-next-line no-await-in-loop
          const { uri: tempUri } = await Print.printToFileAsync({ html: p.html, base64: false });
          // eslint-disable-next-line no-await-in-loop
          const base64 = await FileSystem.readAsStringAsync(tempUri, { encoding: FileSystem.EncodingType.Base64 });
          // eslint-disable-next-line no-await-in-loop
          const destUri = await SAF.createFileAsync(directoryUri, safeName.replace(/\.pdf$/i, ''), 'application/pdf');
          // eslint-disable-next-line no-await-in-loop
          await FileSystem.writeAsStringAsync(destUri, base64, { encoding: FileSystem.EncodingType.Base64 });
          saved.push({ filename: safeName, uri: destUri });
        }
        return { saved, folderUri: directoryUri, mode: 'saved' };
      } catch (e) {
        // A remembered folder may have lost permission — forget it and fall through to share.
        try { await AsyncStorage.removeItem(PDF_SAVE_DIR_KEY); } catch (_) {}
      }
    }
  }

  // iOS / SAF unavailable / declined / error → share each part in turn.
  const saved = [];
  for (const p of list) {
    const safeName = sanitizeFilename(p.filename.endsWith('.pdf') ? p.filename : `${p.filename}.pdf`);
    // eslint-disable-next-line no-await-in-loop
    const { uri } = await Print.printToFileAsync({ html: p.html, base64: false });
    // eslint-disable-next-line no-await-in-loop
    const canShare = (await Sharing.isAvailableAsync?.()) ?? true;
    if (canShare) {
      // eslint-disable-next-line no-await-in-loop
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'राम Naam PDF', UTI: 'com.adobe.pdf' });
    }
    saved.push({ filename: safeName, uri });
  }
  return { saved, mode: 'native-share' };
};
