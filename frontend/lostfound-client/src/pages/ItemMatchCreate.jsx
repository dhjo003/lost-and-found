import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import itemMatches from '../services/itemMatches';

export default function ItemMatchCreate() {
  const { id } = useParams(); // current item id (treat as lost or found depending on context)
  const [foundItemId, setFoundItemId] = useState('');
  const [score, setScore] = useState(80);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    if (!foundItemId) return alert('Enter the other item id');
    setLoading(true);
    try {
      await itemMatches.createItemMatch({ lostItemId: Number(id), foundItemId: Number(foundItemId), score: Number(score) });
      navigate(`/items/${id}/matches`);
    } catch (err) {
      console.error(err);
      alert('Failed to create match');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h3>Create match for Item #{id}</h3>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
        <label>Other item id (found/lost)</label>
        <input value={foundItemId} onChange={e => setFoundItemId(e.target.value)} />

        <label>Score</label>
        <input type="number" value={score} onChange={e => setScore(e.target.value)} min={0} max={100} />

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create'}</button>
          <button type="button" className="btn ghost" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
