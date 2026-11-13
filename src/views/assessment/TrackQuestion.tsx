import { useEffect } from 'react';
import { trackQuestionView } from '../../lib/store';

/** Renders nothing; records once per question shown (question id only, no answer). */
export function TrackQuestion({ id }: { id: string }) {
  useEffect(() => {
    trackQuestionView(id);
  }, [id]);
  return null;
}
