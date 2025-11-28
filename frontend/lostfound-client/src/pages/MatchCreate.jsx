import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import itemMatches from '../services/itemMatches';
import { listItems } from '../services/items';

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function MatchCreate() {
  const [lostQuery, setLostQuery] = useState('');
  const [foundQuery, setFoundQuery] = useState('');
  const debLost = useDebounced(lostQuery, 250);
  const debFound = useDebounced(foundQuery, 250);

  const [lostSuggestions, setLostSuggestions] = useState([]);
  const [foundSuggestions, setFoundSuggestions] = useState([]);
  const [lostIndex, setLostIndex] = useState(-1);
  const [foundIndex, setFoundIndex] = useState(-1);
  const [lostItem, setLostItem] = useState(null);
  const [foundItem, setFoundItem] = useState(null);
  const [score, setScore] = useState(80);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const lostRef = useRef();
  const foundRef = useRef();

  useEffect(() => {
    let active = true;
    async function s() {
      if (!debLost) { setLostSuggestions([]); return; }
      try {
        // search Lost items (include items regardless of whether they have an image)
        const res = await listItems({ q: debLost, page: 1, pageSize: 5, typeId: 1 });
        if (!active) return;
        setLostSuggestions(res.items || []);
        setLostIndex(-1);
      } catch (err) { console.error(err); }
    }
    s();
    return () => { active = false; };
  }, [debLost]);

  useEffect(() => {
    let active = true;
    async function s() {
      if (!debFound) { setFoundSuggestions([]); return; }
      try {
        // search Found items (include items regardless of whether they have an image)
        const res = await listItems({ q: debFound, page: 1, pageSize: 5, typeId: 2 });
        if (!active) return;
        setFoundSuggestions(res.items || []);
        setFoundIndex(-1);
      } catch (err) { console.error(err); }
    }
    s();
    return () => { active = false; };
  }, [debFound]);

  function pickLost(item) {
    setLostItem(item);
    setLostQuery(item.id + ' — ' + item.name);
    setLostSuggestions([]);
    setLostIndex(-1);
  }

  function pickFound(item) {
    setFoundItem(item);
    setFoundQuery(item.id + ' — ' + item.name);
    setFoundSuggestions([]);
    setFoundIndex(-1);
  }

  function onLostKeyDown(e) {
    if (!lostSuggestions || lostSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setLostIndex(i => (i + 1) % lostSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setLostIndex(i => (i <= 0 ? lostSuggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (lostIndex >= 0 && lostIndex < lostSuggestions.length) {
        e.preventDefault();
        pickLost(lostSuggestions[lostIndex]);
      }
    } else if (e.key === 'Escape') {
      setLostSuggestions([]);
      setLostIndex(-1);
    }
  }

  function onFoundKeyDown(e) {
    if (!foundSuggestions || foundSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFoundIndex(i => (i + 1) % foundSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFoundIndex(i => (i <= 0 ? foundSuggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (foundIndex >= 0 && foundIndex < foundSuggestions.length) {
        e.preventDefault();
        pickFound(foundSuggestions[foundIndex]);
      }
    } else if (e.key === 'Escape') {
      setFoundSuggestions([]);
      setFoundIndex(-1);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!lostItem || !foundItem) return alert('Select both items from suggestions');
    if (lostItem.id === foundItem.id) return alert('Items must be different');
    setLoading(true);
    try {
      await itemMatches.createItemMatch({ lostItemId: Number(lostItem.id), foundItemId: Number(foundItem.id), score: Number(score) });
      navigate('/matches');
    } catch (err) {
      console.error(err);
      alert('Failed to create match');
    } finally { setLoading(false); }
  }

  return (
    <div className="card">
      <h3>Create Item Match</h3>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
        <label>Lost Item</label>
        <div style={{ position: 'relative' }}>
          <input ref={lostRef} value={lostQuery} onChange={e => { setLostQuery(e.target.value); setLostItem(null); }} onKeyDown={onLostKeyDown} placeholder="Search items by name or id" />
          {lostSuggestions.length > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, background: 'var(--card)', boxShadow: '0 6px 18px rgba(0,0,0,0.06)', zIndex: 60 }}>
              {lostSuggestions.map((it, idx) => (
                <div key={it.id} onMouseEnter={() => setLostIndex(idx)} onMouseLeave={() => setLostIndex(-1)} style={{ padding: 8, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', background: lostIndex === idx ? '#eef2ff' : 'transparent' }} onClick={() => pickLost(it)}>
                  {it.primaryImageUrl ? <img src={it.primaryImageUrl} alt="pri" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 6 }} /> : <div style={{ width: 48, height: 36, background: '#f3f4f6', borderRadius: 6 }} />}
                  <div>{it.id} — {it.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <label>Found Item</label>
        <div style={{ position: 'relative' }}>
          <input ref={foundRef} value={foundQuery} onChange={e => { setFoundQuery(e.target.value); setFoundItem(null); }} onKeyDown={onFoundKeyDown} placeholder="Search items by name or id" />
          {foundSuggestions.length > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, background: 'var(--card)', boxShadow: '0 6px 18px rgba(0,0,0,0.06)', zIndex: 60 }}>
              {foundSuggestions.map((it, idx) => (
                <div key={it.id} onMouseEnter={() => setFoundIndex(idx)} onMouseLeave={() => setFoundIndex(-1)} style={{ padding: 8, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', background: foundIndex === idx ? '#eef2ff' : 'transparent' }} onClick={() => pickFound(it)}>
                  {it.primaryImageUrl ? <img src={it.primaryImageUrl} alt="pri" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 6 }} /> : <div style={{ width: 48, height: 36, background: '#f3f4f6', borderRadius: 6 }} />}
                  <div>{it.id} — {it.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

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
