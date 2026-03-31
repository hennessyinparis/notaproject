import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { api } from '../api/client';

type Conversation = {
  user: { id: number; username: string; display_name: string; avatar_url: string | null };
  last_message: string;
  last_time: string;
  unread_count: number;
};

type Message = {
  id: number;
  sender_id: number;
  text: string;
  track_id?: number | null;
  track?: { id: number; title: string; cover_url: string | null; duration_seconds: number } | null;
  is_read: boolean;
  created_at: string;
  is_mine: boolean;
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function Avatar({ user, size = 40 }: { user: { display_name: string; avatar_url?: string | null }; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-elevated)' }}>
      {user.avatar_url ? <img src={user.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
    </div>
  );
}

export function Messages() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState<string | null>(username ?? null);

  useEffect(() => {
    setSelectedUser(username ?? null);
  }, [username]);

  const conversationsQ = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<Conversation[]>('/api/messages/conversations').then((r) => r.data),
    refetchInterval: 6000,
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', height: 'calc(100vh - 72px - 64px)', background: 'var(--bg-surface)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ borderRight: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Сообщения</h2>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {conversationsQ.data?.map((conv) => (
            <div
              key={conv.user.id}
              onClick={() => {
                setSelectedUser(conv.user.username);
                navigate(`/messages/${conv.user.username}`);
              }}
              style={{
                display: 'flex',
                gap: 12,
                padding: '12px 16px',
                cursor: 'pointer',
                background: selectedUser === conv.user.username ? 'var(--bg-elevated)' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <Avatar user={conv.user} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: conv.unread_count > 0 ? 700 : 500, fontSize: 14 }}>{conv.user.display_name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatTime(conv.last_time)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.last_message}</span>
                  {conv.unread_count > 0 && (
                    <span style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedUser ? <ChatWindow username={selectedUser} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Выберите диалог</div>}
    </div>
  );
}

function ChatWindow({ username }: { username: string }) {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messagesQ = useQuery({
    queryKey: ['messages', username],
    queryFn: () => api.get<Message[]>(`/api/messages/${username}`).then((r) => r.data),
    refetchInterval: 4000,
  });

  const recipientQ = useQuery({
    queryKey: ['user', username, 'message-card'],
    queryFn: () => api.get<{ display_name: string; username: string; avatar_url: string | null }>(`/api/users/${username}`).then((r) => r.data),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesQ.data]);

  useEffect(() => {
    api.put(`/api/messages/${username}/read`).catch(() => undefined);
  }, [username, messagesQ.data?.length]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    await api.post(`/api/messages/${username}`, { text });
    setText('');
    queryClient.invalidateQueries({ queryKey: ['messages', username] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar user={{ display_name: recipientQ.data?.display_name ?? username, avatar_url: recipientQ.data?.avatar_url }} size={36} />
        <Link to={`/artist/${username}`} style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', textDecoration: 'none' }}>
          {recipientQ.data?.display_name ?? username}
        </Link>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messagesQ.data?.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.is_mine ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                maxWidth: '70%',
                padding: '8px 14px',
                background: msg.is_mine ? 'var(--primary)' : 'var(--bg-elevated)',
                color: msg.is_mine ? 'white' : 'var(--text-primary)',
                borderRadius: msg.is_mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                fontSize: 14,
                lineHeight: 1.4,
              }}
            >
              {msg.track && <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>Трек: {msg.track.title}</div>}
              {msg.text}
              <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2, textAlign: 'right' }}>{formatTime(msg.created_at)}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
          placeholder="Сообщение..."
          style={{ flex: 1, padding: '10px 16px', borderRadius: 22, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}
        />
        <button type="button" onClick={sendMessage} style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
