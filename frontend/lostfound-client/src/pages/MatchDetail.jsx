import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Match detail page removed; redirect to the matches list if accessed.
export default function MatchDetail() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/matches', { replace: true }); }, [navigate]);
  return null;
}
