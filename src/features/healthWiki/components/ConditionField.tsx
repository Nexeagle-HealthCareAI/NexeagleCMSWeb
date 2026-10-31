import { useEffect, useState } from 'react';
import { conditionLabel, slugifyCondition } from './conditionSlug';

const OTHER = '__other__';

interface Props {
  /** The condition the article is linked to (the stored name), or null. */
  value: string | null;
  options: string[];
  disabled?: boolean;
  onChange: (condition: string | null) => void;
}

/** The "Related condition" choice. When the condition is not in the list, the writer picks Other and types it. */
export default function ConditionField({ value, options, disabled, onChange }: Props) {
  // An article that already has a condition outside the list opens as Other, with that condition filled in.
  const outside = value !== null && !options.includes(value);
  const [other, setOther] = useState(outside);
  const [text, setText] = useState(outside ? conditionLabel(value!) : '');

  // The article is read after this field first shows: when a condition outside the list arrives, show it as Other.
  useEffect(() => {
    if (value !== null && !options.includes(value) && !other) { setOther(true); setText(conditionLabel(value)); }
  }, [value, options, other]);

  const choose = (v: string) => {
    if (v === OTHER) { setOther(true); onChange(slugifyCondition(text) || null); return; }
    setOther(false);
    onChange(v || null);
  };
  const type = (t: string) => {
    setText(t);
    onChange(slugifyCondition(t) || null);
  };

  const slug = slugifyCondition(text);
  const typedButUnusable = other && text.trim() !== '' && slug === '';
  return (
    <>
      <div className="hw-field">
        <label className="hw-label" htmlFor="hw-cond">Related condition</label>
        <select id="hw-cond" value={other ? OTHER : value ?? ''} disabled={disabled} onChange={(e) => choose(e.target.value)}>
          <option value="">None</option>
          {options.map((c) => <option key={c} value={c}>{conditionLabel(c)}</option>)}
          <option value={OTHER}>Other</option>
        </select>
        <div className="hw-hint"><span /><span>Used for the Find doctors card next to the article.</span></div>
      </div>
      {other && (
        <div className="hw-field">
          <label className="hw-label" htmlFor="hw-cond-other">Which condition?</label>
          <input id="hw-cond-other" type="text" maxLength={60} value={text} disabled={disabled} placeholder="For example: knee pain" onChange={(e) => type(e.target.value)} />
          <div className="hw-hint">
            <span className="hw-err" role={typedButUnusable ? 'alert' : undefined}>{typedButUnusable ? 'Use English letters or numbers.' : ''}</span>
            <span>{slug ? `Saved as “${slug}”.` : 'Type the condition, for example Knee pain. Leave it empty to link none.'}</span>
          </div>
        </div>
      )}
    </>
  );
}
