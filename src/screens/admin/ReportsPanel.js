import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import * as apiService from '../../utils/apiService';
import { computePeriod, stepPeriod, buildReportHtml, buildRamRepetitionHtml, generateAndSharePdf, splitRowsIntoBatches, RAM_BATCH_BUDGET } from '../../utils/pdfReportService';
import { useLanguage } from '../../context/LanguageContext';

const REPORT_TYPES = ['weekly', 'monthly', 'yearly'];
const SCOPES = ['all', 'single'];
const TOP_N_DEFAULT = 100;
const ROW_CAP_OPTIONS = [
  { id: 'top', label: `Top ${TOP_N_DEFAULT}` },
  { id: 'all', label: 'All Users' },
];

const typeLabel = (type, t) => ({
  weekly: t('admin.reportTypeWeekly') || 'Weekly',
  monthly: t('admin.reportTypeMonthly') || 'Monthly',
  yearly: t('admin.reportTypeYearly') || 'Yearly',
}[type]);

const scopeLabel = (scope, t) => ({
  all: t('admin.scopeAllUsers') || 'All Users',
  single: t('admin.scopeSingleUser') || 'Single User',
}[scope]);

const PREVIEW_LIMIT = 50;

const notify = (title, message) => {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function ReportsPanel({ appId, adminEmail }) {
  const { t, lang } = useLanguage();

  const [type, setType] = useState('weekly');
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [scope, setScope] = useState('all');
  const [userQuery, setUserQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userResults, setUserResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generatingRam, setGeneratingRam] = useState(false);
  // Default to capped output for the heavy reports (monthly/yearly all-users) to keep PDFs fast.
  const [rowCap, setRowCap] = useState('top');
  // Shared progress state across both download buttons. activeKind tells which one is running.
  const [pdfStage, setPdfStage] = useState(null); // null|'preparing'|'building'|'sharing'
  const [pdfStartedAt, setPdfStartedAt] = useState(null);
  const [pdfElapsed, setPdfElapsed] = useState(0);
  const [pdfActiveKind, setPdfActiveKind] = useState(null); // null|'summary'|'ram'
  const [pdfLastResult, setPdfLastResult] = useState(null); // { ok, kind, filename?, durationSec?, error? }
  const [pdfBatch, setPdfBatch] = useState(null); // { current, total, users, rams } while looping multi-PDF

  useEffect(() => {
    if (!pdfStage || !pdfStartedAt) return undefined;
    const tick = () => setPdfElapsed((Date.now() - pdfStartedAt) / 1000);
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [pdfStage, pdfStartedAt]);

  const stageLabel = (stage) => {
    if (stage === 'preparing') return t('pdf.stagePreparing') || 'Preparing data...';
    if (stage === 'building') return t('pdf.stageBuilding') || 'Building PDF...';
    if (stage === 'sharing') return t('pdf.stageSharing') || 'Opening share...';
    return '';
  };
  const elapsedLabel = (sec) => {
    const n = Math.max(0, Math.floor(sec));
    const tpl = t('pdf.elapsedSeconds') || '{n}s';
    return tpl.replace('{n}', String(n));
  };

  const period = useMemo(() => computePeriod(type, anchorDate), [type, anchorDate]);
  // Capping only matters in all-users mode; in single-user mode there's only one row.
  const capRowsForExport = rowCap === 'top' && scope === 'all';

  // Reset preview when inputs change so the Download button reflects current selection.
  useEffect(() => {
    setReportData(null);
    setError('');
  }, [type, period.periodStart, period.periodEnd, scope, selectedUser?.id, appId, rowCap]);

  // Load user list for single-user mode
  useEffect(() => {
    if (scope !== 'single') return;
    let active = true;
    setSearchingUsers(true);
    apiService
      .getAllUsers(50, 1, userQuery, appId)
      .then((data) => {
        if (!active) return;
        setUserResults(Array.isArray(data?.users) ? data.users : []);
      })
      .catch(() => {
        if (active) setUserResults([]);
      })
      .finally(() => {
        if (active) setSearchingUsers(false);
      });
    return () => {
      active = false;
    };
  }, [scope, userQuery, appId]);

  const handleGenerate = async () => {
    if (scope === 'single' && !selectedUser) {
      notify(
        t('admin.errorTitle') || 'Error',
        t('admin.selectUser') || 'Please select a user first.'
      );
      return;
    }
    setLoading(true);
    setError('');
    setReportData(null);
    try {
      const data = await apiService.getChantReport({
        type,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        bucket: period.bucket,
        appId,
        userId: scope === 'single' ? selectedUser?._id || selectedUser?.id : null,
        // When capping is on (default for monthly/yearly all-users), let the backend slice.
        // Smaller payload + smaller HTML = faster PDF.
        topN: capRowsForExport ? TOP_N_DEFAULT : null,
      });
      setReportData(data);
    } catch (e) {
      const status = e?.response?.status;
      let friendly = e?.response?.data?.message || e?.message || '';
      if (status === 404) {
        friendly = lang === 'hi'
          ? 'रिपोर्ट सुविधा अभी सर्वर पर उपलब्ध नहीं है। बैकएंड अपडेट के बाद पुनः प्रयास करें।'
          : 'The reports feature is not yet available on the server. Please retry after the backend update is deployed.';
      } else if (status === 401 || status === 403) {
        friendly = lang === 'hi'
          ? 'एडमिन सत्र समाप्त हो गया है। कृपया फिर से लॉगिन करें।'
          : 'Admin session expired. Please log in again.';
      } else if (!status) {
        friendly = lang === 'hi'
          ? 'सर्वर से कनेक्ट नहीं हो पाया। इंटरनेट जाँचें।'
          : 'Could not reach server. Please check your connection.';
      }
      setError(friendly || (lang === 'hi' ? 'रिपोर्ट नहीं मिली।' : 'Failed to load report.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!reportData) return;
    setGenerating(true);
    setPdfActiveKind('summary');
    setPdfLastResult(null);
    const startedAt = Date.now();
    setPdfStartedAt(startedAt);
    setPdfStage('preparing');
    // Yield so React can paint the spinner + stage label before the synchronous build runs.
    await new Promise((r) => setTimeout(r, 0));
    try {
      const translations = {
        reportTitle: `${typeLabel(type, t)} ${t('admin.reportsTitle') || 'Ram Chant Report'}`,
        totalUsers: t('admin.totalUsers'),
        totalCounts: t('admin.totalCounts') || t('admin.totalCount') || 'Total Counts',
        activeUsers: t('admin.activeUsers') || t('admin.activeToday') || 'Active Users',
        colName: t('admin.colName') || 'Name',
        colMobile: t('admin.colMobile') || 'Mobile',
        colEmail: t('admin.colEmail') || 'Email',
        colStatus: t('admin.colStatus') || 'Status',
        colRegistered: t('admin.colRegistered') || 'Registered',
        colTotal: t('admin.colTotal') || 'Total',
        colBreakdown: t('admin.colBreakdown') || 'Breakdown',
        colBucket: t('admin.colBucket') || 'Period',
        colCount: t('admin.colCount') || 'Count',
        colPeriod: t('admin.colPeriod') || 'Period',
        noDataForPeriod: t('admin.noDataForPeriod') || 'No data for this period',
        reportFooterGenerated: t('admin.reportFooterGenerated') || 'Generated',
        reportScope: t('admin.reportScope') || 'Scope',
        scopeAllUsers: t('admin.scopeAllUsers') || 'All Users',
        scopeSingleUser: t('admin.scopeSingleUser') || 'Single User',
      };
      // Backend has already sorted by totalCount and (when topN was sent) sliced.
      // truncatedRows comes back in totals so the PDF header can show "Top N of M".
      const truncatedRows = Number(reportData.totals?.truncatedRows || 0);
      setPdfStage('building');
      await new Promise((r) => setTimeout(r, 0));
      const html = buildReportHtml({
        type,
        meta: reportData.meta,
        totals: reportData.totals,
        rows: reportData.rows || [],
        scope,
        translations,
        appTitle: t('appName') || 'Shri Ram Nam Bank',
        adminEmail,
        truncatedRows,
      });
      const cappedSuffix = truncatedRows > 0 ? `-top${(reportData.rows || []).length}` : '';
      const filename = `ram-chant-${type}-${period.periodStart}_to_${period.periodEnd}${cappedSuffix}.pdf`;
      setPdfStage('sharing');
      await new Promise((r) => setTimeout(r, 0));
      await generateAndSharePdf(html, filename);
      setPdfLastResult({
        ok: true,
        kind: 'summary',
        filename,
        durationSec: ((Date.now() - startedAt) / 1000).toFixed(1),
      });
    } catch (e) {
      setPdfLastResult({
        ok: false,
        kind: 'summary',
        error: e?.message || (lang === 'hi' ? 'PDF नहीं बन सका।' : 'Failed to generate PDF.'),
        durationSec: ((Date.now() - startedAt) / 1000).toFixed(1),
      });
      notify(
        t('admin.errorTitle') || 'Error',
        e?.message || (lang === 'hi' ? 'PDF नहीं बन सका।' : 'Failed to generate PDF.')
      );
    } finally {
      setGenerating(false);
      setPdfStage(null);
      setPdfStartedAt(null);
      setPdfElapsed(0);
      setPdfActiveKind(null);
    }
  };

  const handleDownloadRamPdf = async () => {
    if (!reportData) return;
    setGeneratingRam(true);
    setPdfActiveKind('ram');
    setPdfLastResult(null);
    const startedAt = Date.now();
    setPdfStartedAt(startedAt);
    setPdfStage('preparing');
    await new Promise((r) => setTimeout(r, 0));
    try {
      const translations = {
        ramNamPdfTitle: t('admin.ramNamPdfTitle') || 'Ram Naam Repetition Report',
        ramNamCumulative: t('admin.ramNamCumulative') || 'Cumulative — All Users',
        ramNamTruncated:
          t('admin.ramNamTruncated') ||
          'Note: rendered first {rendered} of {original} for printing performance.',
        totalUsers: t('admin.totalUsers'),
        totalCounts: t('admin.totalCounts') || t('admin.totalCount') || 'Total Counts',
        colMobile: t('admin.colMobile') || 'Mobile',
        colEmail: t('admin.colEmail') || 'Email',
        colPeriod: t('admin.colPeriod') || 'Period',
        reportScope: t('admin.reportScope') || 'Scope',
        scopeAllUsers: t('admin.scopeAllUsers') || 'All Users',
        scopeSingleUser: t('admin.scopeSingleUser') || 'Single User',
        reportFooterGenerated: t('admin.reportFooterGenerated') || 'Generated',
        noDataForPeriod: t('admin.noDataForPeriod') || 'No data for this period',
      };
      const allRows = reportData.rows || [];
      // Only batch when we're showing the full all-users list (rowCap=all in scope=all).
      // For top-N or single-user mode, one PDF still suffices.
      const shouldBatch = scope === 'all' && rowCap === 'all' && allRows.length > 0;

      if (!shouldBatch) {
        setPdfStage('building');
        await new Promise((r) => setTimeout(r, 0));
        const html = buildRamRepetitionHtml({
          scope,
          meta: reportData.meta,
          totals: reportData.totals,
          rows: allRows,
          translations,
          appTitle: t('appName') || 'Shri Ram Nam Bank',
          adminEmail,
        });
        const filename = `ram-naam-${scope}-${period.periodStart}_to_${period.periodEnd}.pdf`;
        setPdfStage('sharing');
        await new Promise((r) => setTimeout(r, 0));
        await generateAndSharePdf(html, filename);
        setPdfLastResult({
          ok: true,
          kind: 'ram',
          filename,
          durationSec: ((Date.now() - startedAt) / 1000).toFixed(1),
        });
      } else {
        // Multi-PDF: split rows into batches by राम budget. Each user is whole within one batch.
        // Cumulative section appears only on PDF #1 (system aggregate, capped); per-user sections
        // are uncapped (full count) so the admin's "all users" requirement is honored.
        const batches = splitRowsIntoBatches(allRows, RAM_BATCH_BUDGET);
        const totalBatches = batches.length;
        for (let i = 0; i < totalBatches; i++) {
          const batch = batches[i];
          const batchNum = i + 1;
          setPdfBatch({
            current: batchNum,
            total: totalBatches,
            users: batch.rows.length,
            rams: batch.totalRams,
          });
          setPdfStage('building');
          await new Promise((r) => setTimeout(r, 0));
          const batchTotalCount = batch.rows.reduce((s, r) => s + Number(r.totalCount || 0), 0);
          const html = buildRamRepetitionHtml({
            scope: 'all',
            meta: reportData.meta,
            // Only the FIRST batch carries the system-wide cumulative + true total counts.
            totals: i === 0
              ? reportData.totals
              : { totalUsers: batch.rows.length, totalCount: batchTotalCount, activeUsers: 0 },
            rows: batch.rows,
            translations,
            appTitle: t('appName') || 'Shri Ram Nam Bank',
            adminEmail,
            batchInfo: {
              number: batchNum,
              total: totalBatches,
              label: `users ${batch.rows[0]?.name || ''}…${batch.rows[batch.rows.length - 1]?.name || ''}`,
              ramsInBatch: batch.totalRams,
            },
            // Show cumulative only on first batch; subsequent batches are pure per-user pages.
            showCumulative: i === 0,
            // No per-user cap inside each batch — render the user's full count.
            individualCapOverride: null,
          });
          const filename = `ram-naam-${scope}-${period.periodStart}_to_${period.periodEnd}-part-${batchNum}-of-${totalBatches}.pdf`;
          setPdfStage('sharing');
          await new Promise((r) => setTimeout(r, 0));
          await generateAndSharePdf(html, filename);
        }
        setPdfBatch(null);
        setPdfLastResult({
          ok: true,
          kind: 'ram',
          filename: `${totalBatches} PDFs`,
          durationSec: ((Date.now() - startedAt) / 1000).toFixed(1),
        });
      }
    } catch (e) {
      setPdfBatch(null);
      setPdfLastResult({
        ok: false,
        kind: 'ram',
        error: e?.message || (lang === 'hi' ? 'PDF नहीं बन सका।' : 'Failed to generate PDF.'),
        durationSec: ((Date.now() - startedAt) / 1000).toFixed(1),
      });
      notify(
        t('admin.errorTitle') || 'Error',
        e?.message || (lang === 'hi' ? 'PDF नहीं बन सका।' : 'Failed to generate PDF.')
      );
    } finally {
      setGeneratingRam(false);
      setPdfStage(null);
      setPdfStartedAt(null);
      setPdfElapsed(0);
      setPdfActiveKind(null);
    }
  };

  const rows = reportData?.rows || [];
  const visibleRows = rows.slice(0, PREVIEW_LIMIT);
  const truncatedCount = Math.max(0, rows.length - visibleRows.length);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t('admin.reportsTitle') || 'Reports'}</Text>
      <Text style={styles.muted}>
        {t('admin.reportsHint') ||
          (lang === 'hi'
            ? 'साप्ताहिक, मासिक या वार्षिक राम जप रिपोर्ट PDF में डाउनलोड करें।'
            : 'Download weekly, monthly, or yearly Ram chant reports as PDF.')}
      </Text>

      {/* Type selector */}
      <Text style={styles.chipGroupLabel}>{t('admin.chipGroupLabelType') || 'Period'}</Text>
      <View style={styles.chipRow}>
        {REPORT_TYPES.map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.chip, type === k && styles.chipActive]}
            onPress={() => setType(k)}
          >
            <Text style={[styles.chipText, type === k && styles.chipTextActive]}>
              {typeLabel(k, t)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Period stepper */}
      <View style={styles.periodRow}>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => setAnchorDate(stepPeriod(type, anchorDate, -1))}
        >
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.periodLabelBox}>
          <Text style={styles.periodLabel}>{period.label}</Text>
          <Text style={styles.periodSub}>
            {moment(period.periodStart).format('DD MMM YYYY')} – {moment(period.periodEnd).format('DD MMM YYYY')}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => setAnchorDate(stepPeriod(type, anchorDate, +1))}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Scope selector */}
      <Text style={styles.chipGroupLabel}>{t('admin.chipGroupLabelScope') || 'Scope'}</Text>
      <View style={styles.chipRow}>
        {SCOPES.map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.chip, scope === k && styles.chipActive]}
            onPress={() => {
              setScope(k);
              if (k === 'all') setSelectedUser(null);
            }}
          >
            <Text style={[styles.chipText, scope === k && styles.chipTextActive]}>
              {scopeLabel(k, t)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Row cap (only for all-users; default capped to keep PDFs fast on monthly/yearly) */}
      {scope === 'all' && (
        <>
          <Text style={styles.chipGroupLabel}>{t('admin.chipGroupLabelRows') || 'Rows in PDF'}</Text>
          <View style={styles.chipRow}>
            {ROW_CAP_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.chip, rowCap === opt.id && styles.chipActive]}
                onPress={() => setRowCap(opt.id)}
              >
                <Text style={[styles.chipText, rowCap === opt.id && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Single-user picker */}
      {scope === 'single' && (
        <View style={styles.userPickerBox}>
          <TextInput
            style={styles.input}
            placeholder={t('admin.searchPlaceholder') || 'Search users...'}
            value={userQuery}
            onChangeText={setUserQuery}
          />
          {selectedUser ? (
            <View style={styles.selectedUserPanel}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedUserName}>{selectedUser.name || '-'}</Text>
                <Text style={styles.muted}>
                  {selectedUser.mobile || '-'} · {selectedUser.email || '-'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedUser(null)}>
                <Text style={styles.link}>{t('profile.cancel') || 'Cancel'}</Text>
              </TouchableOpacity>
            </View>
          ) : searchingUsers ? (
            <ActivityIndicator color={colors.primary} />
          ) : userResults.length === 0 ? (
            <Text style={styles.muted}>{t('admin.noUserMatches') || 'No users found'}</Text>
          ) : (
            <View style={styles.userList}>
              {userResults.slice(0, 10).map((u) => (
                <TouchableOpacity
                  key={u._id || u.id}
                  style={styles.userItem}
                  onPress={() => setSelectedUser(u)}
                >
                  <Text style={styles.userItemName}>{u.name || '-'}</Text>
                  <Text style={styles.muted}>
                    {u.mobile || '-'} · {u.totalCount || 0}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {t('admin.generatePreview') || 'Generate Preview'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.downloadBtn,
            (!reportData || generating || generatingRam) && styles.btnDisabled,
          ]}
          onPress={handleDownload}
          disabled={!reportData || generating || generatingRam}
        >
          {generating ? (
            <View style={styles.btnInline}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={[styles.primaryBtnText, styles.btnInlineText]} numberOfLines={1}>
                {stageLabel(pdfStage)} · {elapsedLabel(pdfElapsed)}
              </Text>
            </View>
          ) : (
            <Text style={styles.primaryBtnText}>
              {t('admin.downloadPdf') || 'Download PDF'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.ramBtn,
            (!reportData || generatingRam || generating) && styles.btnDisabled,
          ]}
          onPress={handleDownloadRamPdf}
          disabled={!reportData || generatingRam || generating}
        >
          {generatingRam ? (
            <View style={styles.btnInline}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={[styles.primaryBtnText, styles.btnInlineText]} numberOfLines={1}>
                {pdfBatch
                  ? `PDF ${pdfBatch.current}/${pdfBatch.total} · ${stageLabel(pdfStage)} · ${elapsedLabel(pdfElapsed)}`
                  : `${stageLabel(pdfStage)} · ${elapsedLabel(pdfElapsed)}`}
              </Text>
            </View>
          ) : (
            <Text style={styles.primaryBtnText}>
              {t('admin.ramNamPdfButton') || 'Download राम Naam PDF'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Progress hint while generating (shown beneath actionRow regardless of which button) */}
      {(generating || generatingRam) && (
        <View style={styles.pdfProgressBox}>
          {pdfBatch ? (
            <>
              <Text style={[styles.pdfProgressHint, styles.pdfProgressHintBold]}>
                {(t('pdf.batchProgress') || 'PDF {n} of {total} · {users} users · {rams} राम')
                  .replace('{n}', String(pdfBatch.current))
                  .replace('{total}', String(pdfBatch.total))
                  .replace('{users}', String(pdfBatch.users))
                  .replace('{rams}', Number(pdfBatch.rams).toLocaleString('en-IN'))}
              </Text>
              <Text style={styles.pdfProgressHint}>
                {(t('pdf.batchHint') || 'A long users list is split into {total} PDFs for printability. Each share opens after the previous one finishes.')
                  .replace('{total}', String(pdfBatch.total))}
              </Text>
            </>
          ) : (
            <Text style={styles.pdfProgressHint}>
              {t('pdf.hintLargeCount') || 'Large counts may take a few seconds.'}
            </Text>
          )}
        </View>
      )}

      {/* Result summary after a run completes */}
      {!generating && !generatingRam && pdfLastResult && (
        <View style={[styles.pdfResultBox, pdfLastResult.ok ? styles.pdfResultOk : styles.pdfResultErr]}>
          <Ionicons
            name={pdfLastResult.ok ? 'checkmark-circle' : 'alert-circle'}
            size={16}
            color={pdfLastResult.ok ? '#138808' : '#d33'}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.pdfResultText} numberOfLines={2}>
            {pdfLastResult.ok
              ? `${pdfLastResult.kind === 'ram' ? 'राम PDF' : 'Report PDF'}: ${pdfLastResult.filename} · ${pdfLastResult.durationSec}s`
              : `${pdfLastResult.kind === 'ram' ? 'राम PDF' : 'Report PDF'} failed: ${pdfLastResult.error}`}
          </Text>
        </View>
      )}

      {/* Error */}
      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Preview */}
      {reportData && (
        <View style={styles.previewBox}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{reportData.totals?.totalUsers || 0}</Text>
              <Text style={styles.summaryLabel}>{t('admin.totalUsers')}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{reportData.totals?.totalCount || 0}</Text>
              <Text style={styles.summaryLabel}>
                {t('admin.totalCounts') || t('admin.totalCount') || 'Total Counts'}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{reportData.totals?.activeUsers || 0}</Text>
              <Text style={styles.summaryLabel}>
                {t('admin.activeUsers') || t('admin.activeToday') || 'Active'}
              </Text>
            </View>
          </View>

          {rows.length > 0 && (
            <View style={styles.exportInfoRow}>
              <Text style={styles.exportInfoText}>
                {(() => {
                  const truncated = Number(reportData?.totals?.truncatedRows || 0);
                  const fullCount = rows.length + truncated;
                  if (truncated > 0) {
                    return lang === 'hi'
                      ? `PDF में ऊपर के ${rows.length} यूजर शामिल होंगे (कुल ${fullCount})`
                      : `PDF will include top ${rows.length} of ${fullCount} users`;
                  }
                  return lang === 'hi'
                    ? `PDF में सभी ${rows.length} यूजर शामिल होंगे`
                    : `PDF will include all ${rows.length} users`;
                })()}
              </Text>
              {scope === 'all' && type === 'yearly' && !capRowsForExport && rows.length > TOP_N_DEFAULT && (
                <Text style={styles.exportHintText}>
                  {lang === 'hi'
                    ? 'सूचना: वार्षिक रिपोर्ट बड़ी हो सकती है — PDF बनने में कुछ सेकंड लग सकते हैं।'
                    : 'Heads up: yearly all-users PDF may take a few seconds to generate.'}
                </Text>
              )}
            </View>
          )}

          {rows.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {t('admin.noDataForPeriod') || 'No data for this period'}
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={[styles.tableRow, styles.tableHead]}>
                  <Text style={[styles.cell, styles.cellName, styles.cellHead]}>
                    {t('admin.colName') || 'Name'}
                  </Text>
                  <Text style={[styles.cell, styles.cellMobile, styles.cellHead]}>
                    {t('admin.colMobile') || 'Mobile'}
                  </Text>
                  <Text style={[styles.cell, styles.cellStatus, styles.cellHead]}>
                    {t('admin.colStatus') || 'Status'}
                  </Text>
                  <Text style={[styles.cell, styles.cellTotal, styles.cellHead]}>
                    {t('admin.colTotal') || 'Total'}
                  </Text>
                  <Text style={[styles.cell, styles.cellBuckets, styles.cellHead]}>
                    {t('admin.colBreakdown') || 'Breakdown'}
                  </Text>
                </View>
                {visibleRows.map((r) => (
                  <View key={r.userId} style={styles.tableRow}>
                    <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>
                      {r.name || '-'}
                    </Text>
                    <Text style={[styles.cell, styles.cellMobile]} numberOfLines={1}>
                      {r.mobile || '-'}
                    </Text>
                    <Text style={[styles.cell, styles.cellStatus]} numberOfLines={1}>
                      {String(r.status || '-').toUpperCase()}
                    </Text>
                    <Text style={[styles.cell, styles.cellTotal]}>{r.totalCount || 0}</Text>
                    <Text style={[styles.cell, styles.cellBuckets]} numberOfLines={2}>
                      {(r.buckets || []).map((b) => `${b.label}:${b.count}`).join(' · ') || '-'}
                    </Text>
                  </View>
                ))}
                {truncatedCount > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={[styles.cell, styles.muted]}>
                      {lang === 'hi'
                        ? `... और ${truncatedCount} और पंक्तियाँ (PDF में दिखेंगी)`
                        : `... and ${truncatedCount} more rows (included in PDF)`}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: spacing.md },
  title: { fontSize: 17, fontWeight: '700', color: '#222', marginBottom: 4 },
  muted: { fontSize: 12, color: '#777', marginTop: 4 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: '#666' },
  chipTextActive: { color: '#fff' },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    ...shadowStyles.small,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
  },
  periodLabelBox: { flex: 1, alignItems: 'center' },
  periodLabel: { fontSize: 15, fontWeight: '700', color: '#222' },
  periodSub: { fontSize: 11, color: '#777', marginTop: 2 },
  userPickerBox: { marginBottom: spacing.sm },
  input: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    fontSize: 14,
    ...shadowStyles.small,
  },
  userList: { maxHeight: 240 },
  userItem: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    ...shadowStyles.small,
  },
  userItemName: { fontSize: 14, fontWeight: '700', color: '#222' },
  selectedUserPanel: {
    backgroundColor: '#FFF8F0',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  selectedUserName: { fontSize: 14, fontWeight: '700', color: '#222' },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  chipGroupLabel: { fontSize: 11, fontWeight: '700', color: '#6B6B6B', marginTop: spacing.sm, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  downloadBtn: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  ramBtn: {
    backgroundColor: '#E07B20',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180,
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  link: { color: colors.primary, fontWeight: '700' },
  errorBox: {
    marginTop: spacing.sm,
    backgroundColor: '#fee2e2',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
  },
  errorText: { color: '#991b1b', fontSize: 13 },
  previewBox: {
    marginTop: spacing.md,
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadowStyles.small,
  },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  exportInfoRow: { backgroundColor: '#FFF8F0', borderRadius: borderRadius.sm, padding: spacing.sm, marginBottom: spacing.sm, borderWidth: 2, borderColor: '#FFD8A8' },
  btnInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnInlineText: { fontSize: 12 },
  pdfProgressBox: { backgroundColor: '#FFF8F0', borderRadius: borderRadius.sm, padding: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: '#FFD8A8' },
  pdfProgressHint: { fontSize: 11, color: '#5a3a0f', fontStyle: 'italic', textAlign: 'center' },
  pdfProgressHintBold: { fontSize: 12, fontWeight: '700', fontStyle: 'normal', marginBottom: 2 },
  pdfResultBox: { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.sm, padding: spacing.sm, marginBottom: spacing.sm, borderWidth: 1 },
  pdfResultOk: { backgroundColor: '#E8F5E9', borderColor: '#9DCB9F' },
  pdfResultErr: { backgroundColor: '#FDECEA', borderColor: '#F1B0B7' },
  pdfResultText: { flex: 1, fontSize: 12, color: '#333' },
  exportInfoText: { fontSize: 12, fontWeight: '700', color: '#5a3a0f' },
  exportHintText: { fontSize: 11, color: '#8a5a1a', marginTop: 4, fontStyle: 'italic' },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 20, fontWeight: '800', color: colors.primary },
  summaryLabel: { fontSize: 11, color: '#666', marginTop: 2, textAlign: 'center' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tableHead: { backgroundColor: '#FFF3E0', borderBottomColor: colors.primary, borderBottomWidth: 2 },
  cell: { paddingHorizontal: spacing.sm, fontSize: 12, color: '#333' },
  cellHead: { fontWeight: '700', color: '#222' },
  cellName: { width: 140 },
  cellMobile: { width: 110 },
  cellStatus: { width: 90 },
  cellTotal: { width: 70, textAlign: 'right', fontWeight: '700' },
  cellBuckets: { width: 260 },
  empty: { padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#777' },
});
