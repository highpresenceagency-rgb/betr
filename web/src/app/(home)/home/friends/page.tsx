'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Profile, getMyFriends, getPendingRequests, respondToFriendRequest } from '@/lib/api';

type PendingRow = { id: string; profiles: Profile };

export default function FriendsPage() {
  const [friends, setFriends] = useState<Profile[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    Promise.all([getMyFriends(), getPendingRequests()])
      .then(([f, p]) => { setFriends(f); setPending(p); })
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const respond = async (id: string, accept: boolean) => {
    try {
      await respondToFriendRequest(id, accept);
    } catch {
      // ignore — reload will reflect actual state
    }
    load();
  };

  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#EFEFEF' }}>Friends</h1>
        <Link href="/home/friends/add" style={{ backgroundColor: '#39FF7A', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 800, color: '#0C0C0C' }}>
          + Add
        </Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}><span style={{ color: '#39FF7A' }}>Loading…</span></div>
      ) : (
        <>
          {pending.length > 0 && (
            <>
              <span className="section-tag">PENDING REQUESTS</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {pending.map(req => (
                  <div key={req.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                    <div className="av-dim" style={{ width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#555' }}>{req.profiles.initials}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#D0D0D0' }}>{req.profiles.name}</p>
                      <p style={{ fontSize: 10, color: '#333' }}>{req.profiles.username}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => respond(req.id, true)}
                        style={{ padding: '5px 10px', borderRadius: 6, backgroundColor: '#0D1F11', border: '1px solid #39FF7A', color: '#39FF7A', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >Accept</button>
                      <button
                        onClick={() => respond(req.id, false)}
                        style={{ padding: '5px 10px', borderRadius: 6, backgroundColor: '#1A0A0A', border: '1px solid #3A1A1A', color: '#F87171', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <span className="section-tag">ALL FRIENDS ({friends.length})</span>

          {friends.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 20 }}>
              <p style={{ color: '#333', fontSize: 13, marginBottom: 8 }}>No friends yet.</p>
              <Link href="/home/friends/add" style={{ color: '#39FF7A', fontSize: 13, fontWeight: 600 }}>Find people →</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {friends.map((f, i) => (
                <div key={f.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#555', width: 16 }}>#{i + 1}</span>
                  <div className="av-green" style={{ width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#39FF7A' }}>{f.initials}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#D0D0D0' }}>{f.name}</p>
                    <p style={{ fontSize: 10, color: '#333' }}>{f.username}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
