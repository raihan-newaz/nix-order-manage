import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { documentLoops, type LoopData, type PageDocument } from './core';
import { errorMessage } from './useStudio';

export function useLoopData(document: PageDocument | undefined) {
  const [loops, setLoops] = useState<LoopData>({}); const [error, setError] = useState('');
  const latest = useRef(document); latest.current = document;
  const signature = document ? JSON.stringify(documentLoops(document)) : '[]';
  useEffect(() => {
    let active = true;
    if (signature === '[]') { setLoops({}); setError(''); return; }
    const timer = setTimeout(() => {
      api.post('/builder/render-context', { document: latest.current }).then(response => { if (active) { setLoops(response.data.loops); setError(''); } }).catch(error => { if (active) setError(errorMessage(error)); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [signature]);
  return { loops, error };
}
