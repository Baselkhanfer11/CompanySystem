import { useI18n } from '../i18n/LanguageContext';
import { downloadXlsx, type Sheet } from '../lib/xlsx';
import { DownloadIcon } from './icons';

interface Props {
  fileName: string; // e.g. "purchases" → purchases-2026-10-21.xlsx
  sheets: () => Sheet[]; // built on click, from exactly what the page shows
  disabled?: boolean;
}

// "Excel" button: downloads the page's list as an .xlsx file, in the current language.
export function ExportButton({ fileName, sheets, disabled }: Props) {
  const { t, dir } = useI18n();
  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => downloadXlsx(fileName, sheets(), dir === 'rtl')}
      disabled={disabled}
      title={t('xl.hint')}
    >
      <DownloadIcon /> {t('xl.button')}
    </button>
  );
}
