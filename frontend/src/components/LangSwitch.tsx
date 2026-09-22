import { LANGUAGES } from '../i18n/dictionary';
import { useI18n } from '../i18n/LanguageContext';

/** A compact EN / ع toggle. Click flips to the other language. */
export function LangSwitch() {
  const { lang, setLang } = useI18n();

  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          className={`lang-opt ${lang === l.code ? 'active' : ''}`}
          onClick={() => setLang(l.code)}
          title={l.label}
          aria-pressed={lang === l.code}
        >
          {l.native}
        </button>
      ))}
    </div>
  );
}
