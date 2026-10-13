import React from 'react';
import { segmentWordListTitle } from '../../core/word-lists.js';

export type BilingualWordListTitleProps = {
  title: string;
  translatedTitle: string | null;
  lang: string;
  guiLang: string;
  priority?: 'source' | 'gui';
  layout?: 'inline' | 'stacked';
  /** Keep counters beside each title, or once at the end (print/page headings). */
  counter?: 'inline' | 'small' | 'suffix';
  loading?: boolean;
  className?: string;
  primaryClassName?: string;
  secondaryClassName?: string;
};

/** Presentation only: accepts prepared or live V3 titles, without fetching data.
 * Consumers choose title order and layout; title resolution lives in core.
 */
export function BilingualWordListTitle({ title, translatedTitle, lang, guiLang,
  priority = 'source', layout = 'inline', counter = 'inline', loading = false,
  className, primaryClassName, secondaryClassName }: BilingualWordListTitleProps) {
  const source = { ...segmentWordListTitle(title), lang };
  const translated = { ...segmentWordListTitle(translatedTitle ?? (loading ? '…' : '—')), lang: guiLang };
  const bilingual = lang !== guiLang;
  const labels = bilingual ? priority === 'gui' ? [translated, source] : [source, translated] : [source];
  return <span className={className} style={layout === 'stacked'
    ? { display: 'flex', flexDirection: 'column' }
    : { display: 'inline', whiteSpace: 'normal' }}>
    {labels.map((label, index) => <React.Fragment key={index}>
      {index > 0 && layout === 'inline' && <span aria-hidden="true"> / </span>}
      <span lang={label.lang} className={index === 0 ? primaryClassName : secondaryClassName}>
        {label.titleLabel}{counter !== 'suffix' && label.titleCounter !== null &&
          (counter === 'small' ? <small>{label.titleCounter}</small> : ` ${label.titleCounter}`)}
      </span>
    </React.Fragment>)}
    {counter === 'suffix' && source.titleCounter !== null && <small>{` #${source.titleCounter}`}</small>}
  </span>;
}
