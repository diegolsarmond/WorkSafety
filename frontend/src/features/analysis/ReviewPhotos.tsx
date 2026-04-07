import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function ReviewPhotos() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/analysis/camera', { replace: true });
  }, [navigate]);
  return null;
}
