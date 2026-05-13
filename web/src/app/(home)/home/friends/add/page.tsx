'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Profile, searchUsers, sendFriendRequest } from '@/lib/api';

export default function AddFriendsPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchUsers(query));
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleAdd = async (id: string) => {
    try { await sendFriendRequest(id); } catch { /* already sent */ }
    setSent(s => new Set([...s, id]));
  };

  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.back()} style={{ color: '#555', fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#EFEFEF' }}>Add Friends</h1>
      </div>

      <div className="inp-wrap" style={{ marginBottom: 14 }}>
        <input
          style={{ flex: 1, background: 'transparent', padding: '10px 14px', fontSize: 13, color: '#EFEFEF', width: '100%' }}
          placeholder="Search by name or @username…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {searching && <p style={{ color: '#555', fontSize: 12, textAlign: 'center', padding: '10px 0' }}>Searching…</p>}

      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map(u => (
            <div key={u.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
              <div className="av-dim" style={{ width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#555' }}>{u.initials}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#D0D0D0' }}>{u.name}</p>
                <p style={{ fontSize: 10, color: '#333' }}>{u.username}</p>
              </div>
              <button
                onClick={() => handleAdd(u.id)}
                disabled={sent.has(u.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  backgroundColor: sent.has(u.id) ? '#111' : '#0D1F11',
                  border: `1px solid ${sent.has(u.id) ? '#2A2A2A' : '#39FF7A'}`,
                  color: sent.has(u.id) ? '#555' : '#39FF7A',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: sent.has(u.id) ? 'default' : 'pointer',
                }}
              >
                {sent.has(u.id) ? 'Sent ✓' : 'Add'}
              </button>
            </div>
          ))}
        </div>
      )}

      {query.length >= 2 && !searching && results.length === 0 && (
        <p style={{ color: '#333', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No users found.</p>
      )}

      {query.length < 2 && (
        <p style={{ color: '#333', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Type at least 2 characters to search.</p>
      )}
    </div>
  );
}
