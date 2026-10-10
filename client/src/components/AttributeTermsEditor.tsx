import { useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';

type Props = { options: string[]; onChange: (options: string[]) => void; allowReorder?: boolean; placeholder?: string };

export const AttributeTermsEditor = ({ options, onChange, allowReorder = true, placeholder = 'e.g. Medium' }: Props) => {
  const [draft, setDraft] = useState('');
  const [dragging, setDragging] = useState<number | null>(null);

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (options.some((option) => option.toLocaleLowerCase() === value.toLocaleLowerCase())) return;
    onChange([...options, value]);
    setDraft('');
  };
  const rename = (index: number, value: string) => onChange(options.map((option, i) => i === index ? value : option));
  const remove = (index: number) => onChange(options.filter((_, i) => i !== index));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= options.length || from === to) return;
    const next = [...options];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return <div className="space-y-2">
    {options.map((option, index) => <div key={`${index}-${option}`} draggable={allowReorder} onDragStart={() => setDragging(index)} onDragOver={(event) => { if (allowReorder) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); if (allowReorder && dragging !== null) move(dragging, index); setDragging(null); }} onDragEnd={() => setDragging(null)} className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950 ${dragging === index ? 'opacity-50' : ''}`}>
      <GripVertical className={`h-4 w-4 shrink-0 ${allowReorder ? 'cursor-grab text-slate-400' : 'text-slate-300'}`}/>
      <input aria-label={`Option ${index + 1}`} value={option} onChange={(event) => rename(index, event.target.value)} className="h-8 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none" placeholder={placeholder}/>
      {allowReorder && <div className="flex shrink-0"><button type="button" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Move ${option} up`} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"><ChevronUp className="h-4 w-4"/></button><button type="button" disabled={index === options.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move ${option} down`} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"><ChevronDown className="h-4 w-4"/></button></div>}
      <button type="button" onClick={() => remove(index)} aria-label={`Remove ${option}`} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4"/></button>
    </div>)}
    <div className="flex gap-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950" placeholder={placeholder}/><button type="button" onClick={add} disabled={!draft.trim()} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"><Plus className="h-4 w-4"/>Add option</button></div>
  </div>;
};
