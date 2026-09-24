import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { projectsApi } from '../api/projects';
import { useAuth } from '../auth/AuthContext';
import { canManage, canProcure } from '../auth/roles';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ClipboardIcon, EditIcon, PlusIcon, ProjectsIcon, TrashIcon } from '../components/icons';
import { ProjectModal } from '../components/ProjectModal';
import { ProjectPlanModal } from '../components/ProjectPlanModal';
import { SiteStockModal } from '../components/SiteStockModal';
import { LoadError, TableSkeleton } from '../components/States';
import { useToast } from '../components/toast';
import { useItems } from '../data/ItemsContext';
import { NONE, projectsChanged, useProjects, useSiteStock } from '../data/queries';
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

  const { data, loading, error: loadError, refresh } = useProjects();
  const projects: Project[] = data ?? NONE;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // What's on each site right now.
  const siteStock: SiteStock[] = useSiteStock().data ?? NONE;
  const [viewingSite, setViewingSite] = useState<Project | null>(null);
  const [planning, setPlanning] = useState<Project | null>(null);
  const { items, refresh: refreshItems } = useItems();
  const siteRows = (projectId: number) => siteStock.filter((s) => s.projectId === projectId);


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
      projectsChanged();
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
      projectsChanged();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setDeleteBusy(false); }
  };

  return (
    <div>
      <div className="page-header with-actions">
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
          <TableSkeleton />
        )}

        {!loading && loadError && (
          <LoadError icon={<ProjectsIcon />} title={t('project.couldntLoad')} error={loadError} onRetry={refresh} />
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
                  <th className="num">{t('project.colActions')}</th>
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
                    <td><span className="cell-code">{p.code}</span></td>
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
                        <button className="act-btn" onClick={() => setPlanning(p)} aria-label={t('project.plan')} data-tip={t('project.plan')}><ClipboardIcon /></button>
                        {manage && (
                          <>
                            <button className="act-btn" onClick={() => openEdit(p)} aria-label={t('common.edit')} data-tip={t('common.edit')}><EditIcon /></button>
                            <button className="act-btn danger" onClick={() => setDeleting(p)} aria-label={t('common.delete')} data-tip={t('common.delete')}><TrashIcon /></button>
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
