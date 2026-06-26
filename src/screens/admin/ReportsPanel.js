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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { colors, spacing, borderRadius, shadowStyles } from '../../config/theme';
import * as apiService from '../../utils/apiService';
import { computePeriod, stepPeriod, buildReportHtml, buildRamRepetitionHtml, generateAndSharePdf, generatePdfFile, splitRowsIntoBatches, downloadRamPdfFromServer, RAM_BATCH_BUDGET, RAM_PER_PDF } from '../../utils/pdfReportService';
import { APP_VERSION } from '../../config/appVersion';
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
  const [generatedPdfList, setGeneratedPdfList] = useState([]); // [{ uri, filename, userName, count }] after build-then-list runs
  const [batchTargetDir, setBatchTargetDir] = useState(null); // cacheDirectory subdir for the current batch session

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
    if (stage === 'saving') return t('pdf.stageSaving') || 'Saving PDF...';
    return '';
  };
  const elapsedLabel = (sec) => {
    const n = Math.max(0, Math.floor(sec));
    const tpl = t('pdf.elapsedSeconds') || '{n}s';
    return tpl.replace('{n}', String(n));
  };

  // Per-row actions for the generated PDF download list.
  const handleOpenPdf = async (file) => {
    if (!file?.uri) return;
    try {
      // On Android the file:// URI from FileSystem can be opened by the default PDF viewer
      // via the intent system. Linking handles this when the URI scheme is registered.
      await Linking.openURL(file.uri);
    } catch (e) {
      // Fall back to share — at least the user can route to a viewer that way.
      try {
        const Sharing = require('expo-sharing');
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } catch (_) {
        notify(t('admin.errorTitle') || 'Error', e?.message || 'Could not open PDF');
      }
    }
  };
  const handleSharePdf = async (file) => {
    if (!file?.uri) return;
    try {
      const Sharing = require('expo-sharing');
      const can = (await Sharing.isAvailableAsync?.()) ?? true;
      if (!can) throw new Error('Sharing not available');
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/pdf',
        dialogTitle: file.filename,
        UTI: 'com.adobe.pdf',
      });
    } catch (e) {
      notify(t('admin.errorTitle') || 'Error', e?.message || 'Could not share PDF');
    }
  };
  const handleShareAllPdfs = async () => {
    for (const f of generatedPdfList) {
      try { await handleSharePdf(f); } catch (_) {}
    }
  };
  const handleClearPdfList = () => {
    setGeneratedPdfList([]);
    setBatchTargetDir(null);
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
    // Self-diagnostic: surfaced in the error message so we can tell which code path ran
    // on the device (proves whether the auto-split build is actually installed).
    const dbg = { v: APP_VERSION, total: 0, server: false };
    try {
      const translations = {
        ramNamPdfTitle: t('admin.ramNamPdfTitle') || 'Ram Naam Repetition Report',
        ramNamCumulative: t('admin.ramNamCumulative') || 'Cumulative — All Users',
        ramNamTruncated:
          t('admin.ramNamTruncated') ||
          'This section\'s render reached the page limit at {rendered} of {original} राम (full count preserved in data).',
        cumulativeSampleNote:
          t('pdf.cumulativeSampleNote') ||
          'OVERVIEW SAMPLE: showing first {rendered} of {original} system-wide राम. Each user\'s full count appears in their own section below.',
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
      const totalRamsToRender = allRows.reduce((s, r) => s + Math.max(0, Number(r.totalCount || 0)), 0);
      dbg.total = totalRamsToRender;
      dbg.server = true;

      // Generate the PDF on the SERVER (every राम, no on-device expo-print memory wall)
      // and download it. Same params as the report query so it matches what's on screen.
      setPdfStage('building');
      await new Promise((r) => setTimeout(r, 0));
      const url = apiService.getRamPdfUrl({
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        appId,
        userId: scope === 'single' ? (selectedUser?._id || selectedUser?.id) : null,
        topN: capRowsForExport ? TOP_N_DEFAULT : null,
      });
      const token = await apiService.getAdminToken();
      const filename = `ram-naam-${scope}-${period.periodStart}_to_${period.periodEnd}.pdf`;
      setPdfStage('sharing');
      await new Promise((r) => setTimeout(r, 0));
      const result = await downloadRamPdfFromServer(url, token, filename);
      setPdfLastResult({
        ok: true,
        kind: 'ram',
        filename: result?.filename || filename,
        durationSec: ((Date.now() - startedAt) / 1000).toFixed(1),
      });
      if (Platform.OS !== 'web' && result?.mode === 'saved') {
        notify(t('admin.ramNamPdfTitle') || 'राम PDF',
          (lang === 'hi' ? 'PDF आपके चुने हुए फ़ोल्डर में सेव हो गई।' : 'PDF saved to your chosen folder.'));
      }
    } catch (e) {
      setPdfBatch(null);
      const baseMsg = e?.message || (lang === 'hi' ? 'PDF नहीं बन सका।' : 'Failed to generate PDF.');
      // Append the diagnostic so a screenshot of the error reveals which build/path ran.
      const diagMsg = `${baseMsg}  [v=${dbg.v} · total=${dbg.total} · server=${dbg.server}]`;
      setPdfLastResult({
        ok: false,
        kind: 'ram',
        error: diagMsg,
        durationSec: ((Date.now() - startedAt) / 1000).toFixed(1),
      });
      notify(t('admin.errorTitle') || 'Error', diagMsg);
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
            <ScrollView
              style={styles.userList}
              contentContainerStyle={styles.userListContent}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
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
            </ScrollView>
          )}
        </View>
      )}

      {/* Actions — primary above, downloads side-by-side below for clean layout on any width */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.primaryBtnFull, loading && styles.btnDisabled]}
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
        <View style={styles.downloadRow}>
          <TouchableOpacity
            style={[
              styles.downloadBtnFlex,
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
              <Text style={styles.primaryBtnText} numberOfLines={1}>
                {t('admin.downloadPdf') || 'Download PDF'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.ramBtnFlex,
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
                    ? `${pdfBatch.current}/${pdfBatch.total} · ${stageLabel(pdfStage)} · ${elapsedLabel(pdfElapsed)}`
                    : `${stageLabel(pdfStage)} · ${elapsedLabel(pdfElapsed)}`}
                </Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText} numberOfLines={1}>
                {t('admin.ramNamPdfButton') || 'Download राम Naam PDF'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
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

      {/* Download list — populated after multi-PDF builds finish */}
      {!generatingRam && generatedPdfList.length > 0 && (
        <View style={styles.pdfListBox}>
          <View style={styles.pdfListHeader}>
            <Text style={styles.pdfListTitle}>
              {(t('admin.pdfsReady') || '{n} PDFs ready').replace('{n}', String(generatedPdfList.length))}
            </Text>
            <View style={styles.pdfListHeaderActions}>
              <TouchableOpacity style={styles.pdfListHeaderBtn} onPress={handleShareAllPdfs}>
                <Ionicons name="share-social-outline" size={14} color="#fff" />
                <Text style={styles.pdfListHeaderBtnText}>{t('admin.shareAllPdfs') || 'Share All'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pdfListHeaderBtn, styles.pdfListClearBtn]} onPress={handleClearPdfList}>
                <Ionicons name="trash-outline" size={14} color="#d33" />
                <Text style={[styles.pdfListHeaderBtnText, styles.pdfListClearBtnText]}>{t('admin.clearPdfs') || 'Clear'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {generatedPdfList.map((file, idx) => (
            <View key={file.uri || idx} style={styles.pdfListRow}>
              <View style={styles.pdfListRowMain}>
                <Text style={styles.pdfListRowFilename} numberOfLines={1}>{file.filename}</Text>
                <Text style={styles.pdfListRowMeta} numberOfLines={1}>
                  {file.label} · {file.userCount} {file.userCount === 1 ? 'user' : 'users'} · {Number(file.ramCount || 0).toLocaleString('en-IN')} राम
                </Text>
              </View>
              <View style={styles.pdfListRowActions}>
                <TouchableOpacity style={styles.pdfListRowBtn} onPress={() => handleOpenPdf(file)} disabled={!file.uri}>
                  <Ionicons name="open-outline" size={16} color={colors.primary} />
                  <Text style={styles.pdfListRowBtnText}>{t('admin.openPdf') || 'Open'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pdfListRowBtn} onPress={() => handleSharePdf(file)} disabled={!file.uri}>
                  <Ionicons name="share-outline" size={16} color={colors.primary} />
                  <Text style={styles.pdfListRowBtnText}>{t('admin.sharePdf') || 'Share'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
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
  userList: { maxHeight: 240, marginBottom: spacing.sm, borderRadius: borderRadius.sm, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#EEE' },
  userListContent: { paddingVertical: spacing.xs },
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
  // v4.1: stack the primary action above the two download buttons so layout is consistent on any width.
  actionsContainer: { marginTop: spacing.sm, marginBottom: spacing.md, gap: spacing.sm },
  downloadRow: { flexDirection: 'row', gap: spacing.sm },
  primaryBtnFull: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtnFlex: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  ramBtnFlex: {
    flex: 1,
    backgroundColor: '#E07B20',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
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
  // Download list (multi-PDF results)
  pdfListBox: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FFD8A8',
    ...shadowStyles.small,
  },
  pdfListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E0D0',
  },
  pdfListTitle: { fontSize: 14, fontWeight: '800', color: colors.primary },
  pdfListHeaderActions: { flexDirection: 'row', gap: spacing.xs },
  pdfListHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  pdfListHeaderBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  pdfListClearBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d33' },
  pdfListClearBtnText: { color: '#d33' },
  pdfListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  pdfListRowMain: { flex: 1, marginRight: spacing.sm },
  pdfListRowFilename: { fontSize: 12, fontWeight: '700', color: '#222' },
  pdfListRowMeta: { fontSize: 10, color: '#777', marginTop: 2 },
  pdfListRowActions: { flexDirection: 'row', gap: 4 },
  pdfListRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: '#FFF3E0',
  },
  pdfListRowBtnText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
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
