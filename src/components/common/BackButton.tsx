import { useNavigate } from 'react-router-dom';
import { BackIcon } from './icons';

export function BackButton({ to }: { to?: string }) {
  const navigate = useNavigate();
  return (
    <button className="icon-btn" onClick={() => (to ? navigate(to) : navigate(-1))} aria-label="戻る">
      <BackIcon />
    </button>
  );
}
