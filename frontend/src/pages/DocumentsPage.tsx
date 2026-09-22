import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { documentsApi } from '../api/documents';
import { projectsApi } from '../api/projects';
import { DownloadIcon, FileIcon, PlusIcon } from '../components/icons';
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

  const [docs, setDocs] = useState<ApprovalDocument[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    setLoadError('');
    documentsApi.getAll().then(setDocs).catch((e) => setLoadError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Projects feed the upload dropdown; load them quietly in the background.
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

  const handleUpload = async (form: FormData) => {
    setSaving(true);
    try {
      await documentsApi.upload(form);
      toast('success', t('doc.uploaded'));
      setModalOpen(false);
      load();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setSaving(false); }
  };

  const handleDownload = async (d: ApprovalDocument) => {
    setDownloadingId(d.id);
    try { await documentsApi.download(d.id, d.fileName); }
    catch (e) { toast('error', (e as Error).message); }
    finally { setDownloadingId(null); }
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
    </div>
  );
}
