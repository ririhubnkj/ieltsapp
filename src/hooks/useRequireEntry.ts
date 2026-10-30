import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntries } from './useEntries';
import type { Entry } from '../types';

export function useRequireEntry(id: string | undefined): Entry | undefined {
  const navigate = useNavigate();
  const { getEntry } = useEntries();
  const entry = id ? getEntry(id) : undefined;

  useEffect(() => {
    if (!entry) navigate('/', { replace: true });
  }, [entry, navigate]);

  return entry;
}
