import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { documentsApi } from '../api/documents';
import { projectsApi } from '../api/projects';
import { useAuth } from '../auth/AuthContext';
import { ROLES } from '../auth/roles';
import { useNotifications } from '../data/NotificationsContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CheckIcon, DownloadIcon, FileIcon, HistoryIcon, PlusIcon, TrashIcon, UndoIcon, UploadIcon } from '../components/icons';
import { DocumentTimelineModal } from '../components/DocumentTimelineModal';
import { ResubmitDocumentModal } from '../components/ResubmitDocumentModal';
import { ReturnDocumentModal } from '../components/ReturnDocumentModal';
import { useToast } from '../components/toast';
import { UploadDocumentModal } from '../components/UploadDocumentModal';
import { useI18n } from '../i18n/LanguageContext';
import { DOC_STATUS_BADGE, formatBytes } from '../lib/documents';
import { formatDate } from '../lib/format';
import type { LayoutContext } from '../layouts/AppLayout';
import type { ApprovalDocument, Project } from '../types';

export function DocumentsPage() {
  const { search } = useOutletContext<LayoutContext>();
  const toast = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const { refresh: refreshNotifs } = useNotifications();

  const [docs, setDocs] = useState<ApprovalDocument[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null); // approving

  const [returning, setReturning] = useState<ApprovalDocument | null>(null);
  const [returnBusy, setReturnBusy] = useState(false);
  const [resubmitting, setResubmitting] = useState<ApprovalDocument | null>(null);
  const [resubmitBusy, setResubmitBusy] = useState(false);
  const [rejecting, setRejecting] = useState<ApprovalDocument | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [tracing, setTracing] = useState<number | null>(null); // document id shown in the timeline

  const load = () => {
    setLoading(true);
    setLoadError('');
    documentsApi.getAll().then(setDocs).catch((e) => setLoadError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  useEffect(() => {
    projectsApi.getAll().then(setProjects).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) =>
      [d.title, d.fileName, d.projectName, d.uploadedByName].some((v) => v.toLowerCase().includes(q)),
    );
  }, [docs, search]);

  // Who can do what, based on the current user's role and the document's stage.
  const canReview = (d: ApprovalDocument) =>
    (d.status === 'PendingManager' && user?.role === ROLES.WarehouseManager) ||
    (d.status === 'PendingCEO' && user?.role === ROLES.Administrator);
  const canResubmit = (d: ApprovalDocument) => d.status === 'Returned' && d.uploadedById === user?.id;

  const handleUpload = async (form: FormData) => {
    setSaving(true);
    try {
      await documentsApi.upload(form);
      toast('success', t('doc.uploaded'));
      setModalOpen(false);
      load();
      refreshNotifs();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setSaving(false); }
  };

  const handleDownload = async (d: ApprovalDocument) => {
    setDownloadingId(d.id);
    try { await documentsApi.download(d.id, d.fileName); }
    catch (e) { toast('error', (e as Error).message); }
    finally { setDownloadingId(null); }
  };

  const handleApprove = async (d: ApprovalDocument) => {
    setBusyId(d.id);
    try { await documentsApi.approve(d.id); toast('success', t('docReview.approved')); load(); refreshNotifs(); }
    catch (e) { toast('error', (e as Error).message); }
    finally { setBusyId(null); }
  };

  const handleReturn = async (note: string) => {
    if (!returning) return;
    setReturnBusy(true);
    try { await documentsApi.returnToEngineer(returning.id, note); toast('success', t('docReview.returned')); setReturning(null); load(); refreshNotifs(); }
    catch (e) { toast('error', (e as Error).message); }
    finally { setReturnBusy(false); }
  };

  const handleResubmit = async (form: FormData) => {
    if (!resubmitting) return;
    setResubmitBusy(true);
    try { await documentsApi.resubmit(resubmitting.id, form); toast('success', t('docReview.resubmitted')); setResubmitting(null); load(); refreshNotifs(); }
    catch (e) { toast('error', (e as Error).message); }
    finally { setResubmitBusy(false); }
  };

  const handleReject = async () => {
    if (!rejecting) return;
    setRejectBusy(true);
    try { await documentsApi.reject(rejecting.id); toast('success', t('docReview.rejected')); setRejecting(null); load(); refreshNotifs(); }
    catch (e) { toast('error', (e as Error).message); }
    finally { setRejectBusy(false); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1>{t('doc.title')}</h1>
          <p>{t('doc.sub')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <PlusIcon /> {t('doc.upload')}
        </button>
      </div>

      <div className="panel rise">
        <div className="panel-head">
          <div>
            <h3>{t('doc.all')}</h3>
            <div className="sub">
              {loading
                ? t('common.loading')
                : `${filtered.length === 1 ? t('doc.countOne', { n: filtered.length }) : t('doc.countMany', { n: filtered.length })}${search ? ' ' + t('common.found') : ''}`}
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 11 }} />
                <div className="skeleton" style={{ height: 14, flex: 1, maxWidth: 220 }} />
                <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 20 }} />
              </div>
            ))}
          </div>
        )}

        {!loading && loadError && (
          <div className="empty-state">
            <div className="empty-illus" style={{ background: 'rgba(251,113,133,0.1)', borderColor: 'rgba(251,113,133,0.25)' }}>
              <FileIcon style={{ color: 'var(--rose)' }} />
            </div>
            <h4>{t('doc.couldntLoad')}</h4>
            <p>{loadError}. {t('common.backendHint')}</p>
            <button className="btn btn-ghost" onClick={load}>{t('common.tryAgain')}</button>
          </div>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-illus"><FileIcon /></div>
            <h4>{search ? t('common.noMatches') : t('doc.noneTitle')}</h4>
            <p>{search ? t('common.differentSearch') : t('doc.addFirst')}</p>
            {!search && <button className="btn btn-primary" onClick={() => setModalOpen(true)}><PlusIcon /> {t('doc.upload')}</button>}
          </div>
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('doc.colDocument')}</th>
                  <th>{t('doc.colProject')}</th>
                  <th>{t('doc.colStatus')}</th>
                  <th>{t('doc.colUploadedBy')}</th>
                  <th>{t('doc.colDate')}</th>
                  <th style={{ textAlign: 'end' }}>{t('doc.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="cell-user">
                        <div className="file-badge"><FileIcon /></div>
                        <div style={{ minWidth: 0 }}>
                          <div className="name">{d.title}</div>
                          <div className="email">{d.fileName} · {formatBytes(d.fileSize)}</div>
                        </div>
                      </div>
                    </td>
                    <td>{d.projectName}</td>
                    <td>
                      <span className={`badge ${DOC_STATUS_BADGE[d.status] ?? 'inactive'}`}>
                        <span className="dot" />{t(`doc.status.${d.status}`)}
                      </span>
                    </td>
                    <td>{d.uploadedByName}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(d.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        {canReview(d) && (
                          <>
                            <button className="act-btn success" onClick={() => handleApprove(d)} disabled={busyId === d.id} aria-label={t('docReview.approve')} title={t('docReview.approve')}>
                              {busyId === d.id ? <span className="spinner" /> : <CheckIcon />}
                            </button>
                            <button className="act-btn" onClick={() => setReturning(d)} aria-label={t('docReview.returnAction')} title={t('docReview.returnAction')}><UndoIcon /></button>
                            <button className="act-btn danger" onClick={() => setRejecting(d)} aria-label={t('docReview.reject')} title={t('docReview.reject')}><TrashIcon /></button>
                          </>
                        )}
                        {canResubmit(d) && (
                          <button className="act-btn success" onClick={() => setResubmitting(d)} aria-label={t('docReview.resubmitAction')} title={t('docReview.resubmitAction')}><UploadIcon /></button>
                        )}
                        <button className="act-btn" onClick={() => setTracing(d.id)} aria-label={t('docTimeline.view')} title={t('docTimeline.view')}><HistoryIcon /></button>
                        <button className="act-btn" onClick={() => handleDownload(d)} disabled={downloadingId === d.id} aria-label={t('doc.download')} title={t('doc.download')}>
                          {downloadingId === d.id ? <span className="spinner" /> : <DownloadIcon />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UploadDocumentModal
        open={modalOpen}
        projects={projects}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={handleUpload}
      />

      <ReturnDocumentModal
        open={!!returning}
        doc={returning}
        saving={returnBusy}
        onClose={() => setReturning(null)}
        onSave={handleReturn}
      />

      <ResubmitDocumentModal
        open={!!resubmitting}
        doc={resubmitting}
        saving={resubmitBusy}
        onClose={() => setResubmitting(null)}
        onSave={handleResubmit}
      />

      <ConfirmDialog
        open={!!rejecting}
        title={t('docReview.rejectQ')}
        message={t('docReview.rejectMsg', { title: rejecting?.title ?? '' })}
        busy={rejectBusy}
        onCancel={() => setRejecting(null)}
        onConfirm={handleReject}
      />

      <DocumentTimelineModal
        open={tracing !== null}
        docId={tracing}
        onClose={() => setTracing(null)}
      />
    </div>
  );
}
