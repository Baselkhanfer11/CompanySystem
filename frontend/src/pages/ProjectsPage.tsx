import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { projectsApi } from '../api/projects';
import { stockApi } from '../api/stock';
import { useAuth } from '../auth/AuthContext';
import { canManage, canProcure } from '../auth/roles';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ClipboardIcon, EditIcon, PlusIcon, ProjectsIcon, TrashIcon } from '../components/icons';
import { ProjectModal } from '../components/ProjectModal';
import { ProjectPlanModal } from '../components/ProjectPlanModal';
import { SiteStockModal } from '../components/SiteStockModal';
import { useToast } from '../components/toast';
import { useItems } from '../data/ItemsContext';
import { useI18n } from '../i18n/LanguageContext';
import { formatDate } from '../lib/format';
import { STATUS_BADGE_CLASS } from '../lib/projects';
import type { LayoutContext } from '../layouts/AppLayout';
import type { Project, ProjectInput, SiteStock } from '../types';

export function ProjectsPage() {
  const { search } = useOutletContext<LayoutContext>();
  const toast = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const manage = canManage(user?.role);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // What's on each site right now.
  const [siteStock, setSiteStock] = useState<SiteStock[]>([]);
  const [viewingSite, setViewingSite] = useState<Project | null>(null);
  const [planning, setPlanning] = useState<Project | null>(null);
  const { items, refresh: refreshItems } = useItems();
  const siteRows = (projectId: number) => siteStock.filter((s) => s.projectId === projectId);

  const load = () => {
    setLoading(true);
    setLoadError('');
    projectsApi.getAll().then(setProjects).catch((e) => setLoadError(e.message)).finally(() => setLoading(false));
    stockApi.onSite().then(setSiteStock).catch(() => {});
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      [p.name, p.code, p.description].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [projects, search]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p: Project) => { setEditing(p); setModalOpen(true); };

  const handleSave = async (data: ProjectInput) => {
    setSaving(true);
    try {
      if (editing) { await projectsApi.update(editing.id, data); toast('success', t('project.updated')); }
      else { await projectsApi.create(data); toast('success', t('project.added')); }
      setModalOpen(false);
      load();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await projectsApi.remove(deleting.id);
      toast('success', t('project.removed'));
      setDeleting(null);
      load();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setDeleteBusy(false); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1>{t('project.title')}</h1>
          <p>{t('project.sub')}</p>
        </div>
        {manage && (
          <button className="btn btn-primary" onClick={openCreate}>
            <PlusIcon /> {t('project.add')}
          </button>
        )}
      </div>

      <div className="panel rise">
        <div className="panel-head">
          <div>
            <h3>{t('project.all')}</h3>
            <div className="sub">
              {loading
                ? t('common.loading')
                : `${filtered.length === 1 ? t('project.countOne', { n: filtered.length }) : t('project.countMany', { n: filtered.length })}${search ? ' ' + t('common.found') : ''}`}
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
              <ProjectsIcon style={{ color: 'var(--rose)' }} />
            </div>
            <h4>{t('project.couldntLoad')}</h4>
            <p>{loadError}. {t('common.backendHint')}</p>
            <button className="btn btn-ghost" onClick={load}>{t('common.tryAgain')}</button>
          </div>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-illus"><ProjectsIcon /></div>
            <h4>{search ? t('common.noMatches') : t('project.noneTitle')}</h4>
            <p>{search ? t('common.differentSearch') : t('project.addFirst')}</p>
            {!search && manage && <button className="btn btn-primary" onClick={openCreate}><PlusIcon /> {t('project.add')}</button>}
          </div>
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('project.colName')}</th>
                  <th>{t('project.colCode')}</th>
                  <th>{t('project.colStatus')}</th>
                  <th>{t('project.colOnSite')}</th>
                  <th>{t('project.colCreated')}</th>
                  <th style={{ textAlign: 'end' }}>{t('project.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div>
                        <div className="name">{p.name}</div>
                        {p.description && <div className="email">{p.description}</div>}
                      </div>
                    </td>
                    <td><span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>{p.code}</span></td>
                    <td>
                      <span className={`badge ${STATUS_BADGE_CLASS[p.status] ?? 'inactive'}`}>
                        <span className="dot" />{t(`project.status.${p.status}`)}
                      </span>
                    </td>
                    <td>
                      {(() => {
                        const n = siteRows(p.id).length;
                        return n > 0 ? (
                          <button type="button" className="link-btn" onClick={() => setViewingSite(p)}>
                            {n === 1 ? t('project.itemsOne', { n }) : t('project.itemsMany', { n })}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>{t('project.nothingOnSite')}</span>
                        );
                      })()}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(p.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="act-btn" onClick={() => setPlanning(p)} aria-label={t('project.plan')} title={t('project.plan')}><ClipboardIcon /></button>
                        {manage && (
                          <>
                            <button className="act-btn" onClick={() => openEdit(p)} aria-label={t('common.edit')}><EditIcon /></button>
                            <button className="act-btn danger" onClick={() => setDeleting(p)} aria-label={t('common.delete')}><TrashIcon /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProjectModal
        open={modalOpen}
        initial={editing}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      <ProjectPlanModal project={planning} canEdit={canProcure(user?.role)} items={items} onClose={() => setPlanning(null)} onSaved={refreshItems} />

      <SiteStockModal project={viewingSite} rows={viewingSite ? siteRows(viewingSite.id) : []} onClose={() => setViewingSite(null)} />

      <ConfirmDialog
        open={!!deleting}
        title={t('project.deleteQ')}
        message={t('project.deleteMsg', { name: deleting?.name ?? '' })}
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
