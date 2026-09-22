import { useEffect, useState } from 'react';
import { documentsApi } from '../api/documents';
import { useI18n } from '../i18n/LanguageContext';
import { DOC_STATUS_BADGE } from '../lib/documents';
import { formatDateTime, formatTimeAgo } from '../lib/format';
import type { DocumentDetail, DocumentEvent } from '../types';
import { CheckIcon, FileIcon, UndoIcon, UploadIcon, XIcon } from './icons';

interface Props {
  open: boolean;
  docId: number | null;
  onClose: () => void;
}

// Icon + tone per history action.
const ACTION_META: Record<string, { icon: React.ReactNode; tone: string }> = {
  Submitted: { icon: <FileIcon />, tone: 'neutral' },
  Approved: { icon: <CheckIcon />, tone: 'ok' },
  Returned: { icon: <UndoIcon />, tone: 'warn' },
  Resubmitted: { icon: <UploadIcon />, tone: 'neutral' },
};

// The 3 pipeline steps and their state for a given document status.
function steps(status: string) {
  const order = ['Engineer', 'Manager', 'CEO'];
  // How far along the pipeline we are (index of the current/next actor).
  const reached =
    status === 'PendingManager' ? 1 :
    status === 'PendingCEO' ? 2 :
    status === 'Approved' ? 3 :
    status === 'Returned' ? 0 : 0;
  return order.map((label, i) => ({
    label,
    state: i < reached ? 'done' : i === reached ? 'current' : 'pending',
  }));
}

export function DocumentTimelineModal({ open, docId, onClose }: Props) {
  const { t } = useI18n();
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || docId == null) return;
    let active = true;
    setLoading(true);
    setError('');
    setDetail(null);
    documentsApi.getById(docId)
      .then((d) => { if (active) setDetail(d); })
      .catch((e) => { if (active) setError((e as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, docId]);

  if (!open) return null;

  const doc = detail?.document;
  const actionLabel = (e: DocumentEvent) => t(`docTimeline.action.${e.action}`);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3>{t('docTimeline.title')}</h3>
            <p>{doc ? doc.title : t('docTimeline.sub')}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          {loading && <div className="notif-empty">{t('common.loading')}</div>}
          {!loading && error && <div style={{ color: 'var(--rose)', fontSize: 13 }}>{error}</div>}

          {!loading && !error && doc && (
            <>
              {/* Current status + pipeline stepper */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span className={`badge ${DOC_STATUS_BADGE[doc.status] ?? 'inactive'}`}>
                  <span className="dot" />{t(`doc.status.${doc.status}`)}
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
                  {t('docTimeline.project')}: {doc.projectName}
                </span>
              </div>

              <div className="stepper">
                {steps(doc.status).map((s, i) => (
                  <div key={s.label} className={`step ${s.state}`}>
                    <span className="step-dot">{s.state === 'done' ? <CheckIcon /> : i + 1}</span>
                    <span className="step-label">{t(`docTimeline.step.${s.label}`)}</span>
                  </div>
                ))}
              </div>

              {/* Full history */}
              <div className="timeline">
                {detail!.events.length === 0 ? (
                  <div className="notif-empty">{t('docTimeline.empty')}</div>
                ) : (
                  detail!.events.map((e) => {
                    const meta = ACTION_META[e.action] ?? { icon: <FileIcon />, tone: 'neutral' };
                    return (
                      <div key={e.id} className="tl-item">
                        <span className={`tl-dot ${meta.tone}`}>{meta.icon}</span>
                        <div className="tl-body">
                          <div className="tl-head">
                            <span className="tl-action">{actionLabel(e)}</span>
                            <span className="tl-time" title={formatDateTime(e.createdAt)}>{formatTimeAgo(e.createdAt, t)}</span>
                          </div>
                          <div className="tl-actor">{t('docTimeline.by', { name: e.actorName })}</div>
                          {e.note && <div className="tl-note">“{e.note}”</div>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
