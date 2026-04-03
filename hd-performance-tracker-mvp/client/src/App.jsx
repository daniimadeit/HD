import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

const initialMessageForm = {
  senderName: '',
  source: 'manual',
  timestamp: '',
  content: '',
  contact: ''
};

const initialSavedReplyForm = {
  label: '',
  text: ''
};

const priorityOrder = { Urgent: 0, Normal: 1, Low: 2 };

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [messages, setMessages] = useState([]);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [savedReplies, setSavedReplies] = useState([]);
  const [settings, setSettings] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState('');

  const [messageForm, setMessageForm] = useState(initialMessageForm);
  const [savedReplyForm, setSavedReplyForm] = useState(initialSavedReplyForm);

  const [filters, setFilters] = useState({ status: '', priority: '', category: '', source: '' });
  const [sort, setSort] = useState('newest');
  const [quickReplyId, setQuickReplyId] = useState('');

  async function bootstrap() {
    setError('');
    try {
      const [metaDataResp, messagesResp, repliesResp, settingsResp] = await Promise.all([
        api.getMetadata(),
        api.getMessages(),
        api.getSavedReplies(),
        api.getSettings()
      ]);

      setMetadata(metaDataResp);
      setMessages(messagesResp);
      setSavedReplies(repliesResp);
      setSettings(settingsResp);
      if (messagesResp.length && !selectedMessageId) {
        setSelectedMessageId(messagesResp[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load app data.');
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    async function loadDetail() {
      if (!selectedMessageId) {
        setSelectedMessage(null);
        return;
      }
      try {
        const detail = await api.getMessage(selectedMessageId);
        setSelectedMessage(detail);
      } catch (err) {
        setError(err.message || 'Failed to load message detail.');
      }
    }

    loadDetail();
  }, [selectedMessageId]);

  const filteredMessages = useMemo(() => {
    let result = messages.filter((message) => {
      return (
        (!filters.status || message.status === filters.status) &&
        (!filters.priority || message.priority === filters.priority) &&
        (!filters.category || message.category === filters.category) &&
        (!filters.source || message.source === filters.source)
      );
    });

    if (sort === 'oldest') {
      result = [...result].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else if (sort === 'urgent') {
      result = [...result].sort((a, b) => {
        const rankDelta = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
        if (rankDelta !== 0) return rankDelta;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
    } else {
      result = [...result].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    return result;
  }, [messages, filters, sort]);

  async function refreshMessages(params = filters) {
    const data = await api.getMessages({ ...params, sort });
    setMessages(data);
  }

  async function handleCreateMessage(event) {
    event.preventDefault();
    setError('');

    try {
      const created = await api.createMessage(messageForm);
      setMessageForm(initialMessageForm);
      setCurrentView('dashboard');
      await refreshMessages();
      setSelectedMessageId(created.id);
    } catch (err) {
      setError(err.message || 'Failed to add message.');
    }
  }

  async function handleMessageUpdate(patch) {
    if (!selectedMessage) return;

    setError('');
    try {
      const updated = await api.updateMessage(selectedMessage.id, patch);
      setSelectedMessage(updated);
      await refreshMessages();
    } catch (err) {
      setError(err.message || 'Failed to update message.');
    }
  }

  async function handleSendToZapier() {
    if (!selectedMessage) return;

    try {
      await api.sendApprovedToZapier({
        to: selectedMessage.contact || selectedMessage.senderName,
        source: selectedMessage.source,
        message: selectedMessage.draftReply,
        originalMessageId: selectedMessage.id
      });

      await handleMessageUpdate({ status: 'Sent' });
    } catch (err) {
      setError(err.message || 'Failed to send approved message to Zapier.');
    }
  }

  async function handleSavedReplyCreate(event) {
    event.preventDefault();

    try {
      await api.createSavedReply(savedReplyForm);
      setSavedReplyForm(initialSavedReplyForm);
      setSavedReplies(await api.getSavedReplies());
    } catch (err) {
      setError(err.message || 'Failed to create saved reply.');
    }
  }

  async function handleSavedReplyChange(id, patch) {
    try {
      await api.updateSavedReply(id, patch);
      setSavedReplies(await api.getSavedReplies());
    } catch (err) {
      setError(err.message || 'Failed to update saved reply.');
    }
  }

  async function handleSettingsSave(event) {
    event.preventDefault();
    if (!settings) return;

    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
    } catch (err) {
      setError(err.message || 'Failed to save settings.');
    }
  }

  function openMessageDetail(id) {
    setSelectedMessageId(id);
    setCurrentView('detail');
  }

  return (
    <div className="app-shell">
      <header className="top-nav">
        <h1>Message Control System</h1>
        <nav>
          <button className={currentView === 'dashboard' ? 'active' : ''} onClick={() => setCurrentView('dashboard')}>Dashboard</button>
          <button className={currentView === 'saved' ? 'active' : ''} onClick={() => setCurrentView('saved')}>Saved Replies</button>
          <button className={currentView === 'settings' ? 'active' : ''} onClick={() => setCurrentView('settings')}>Settings</button>
        </nav>
      </header>

      {error && <p className="error">{error}</p>}

      {currentView === 'dashboard' && (
        <section className="dashboard">
          <article className="panel">
            <h2>Message Intake</h2>
            <form className="stack" onSubmit={handleCreateMessage}>
              <input required placeholder="Sender name" value={messageForm.senderName} onChange={(e) => setMessageForm((p) => ({ ...p, senderName: e.target.value }))} />
              <select value={messageForm.source} onChange={(e) => setMessageForm((p) => ({ ...p, source: e.target.value }))}>
                {metadata?.sourceOptions?.map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
              <label>
                Timestamp
                <input type="datetime-local" value={messageForm.timestamp} onChange={(e) => setMessageForm((p) => ({ ...p, timestamp: e.target.value }))} />
              </label>
              <input placeholder="Contact (email or phone)" value={messageForm.contact} onChange={(e) => setMessageForm((p) => ({ ...p, contact: e.target.value }))} />
              <textarea required placeholder="Paste full incoming message" value={messageForm.content} onChange={(e) => setMessageForm((p) => ({ ...p, content: e.target.value }))} />
              <button type="submit">Add message</button>
            </form>
          </article>

          <article className="panel">
            <h2>Filter & Sort</h2>
            <div className="filter-grid">
              <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
                <option value="">All statuses</option>
                {metadata?.statusOptions?.map((status) => <option key={status}>{status}</option>)}
              </select>
              <select value={filters.priority} onChange={(e) => setFilters((p) => ({ ...p, priority: e.target.value }))}>
                <option value="">All priorities</option>
                {metadata?.priorityOptions?.map((priority) => <option key={priority}>{priority}</option>)}
              </select>
              <select value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}>
                <option value="">All categories</option>
                {metadata?.categoryOptions?.map((category) => <option key={category}>{category}</option>)}
              </select>
              <select value={filters.source} onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value }))}>
                <option value="">All sources</option>
                {metadata?.sourceOptions?.map((source) => <option key={source}>{source}</option>)}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="urgent">Urgent first</option>
              </select>
            </div>
          </article>

          <article className="panel">
            <h2>Messages ({filteredMessages.length})</h2>
            <div className="message-list">
              {filteredMessages.map((message) => (
                <button className="message-card" key={message.id} onClick={() => openMessageDetail(message.id)}>
                  <div className="row between">
                    <strong>{message.senderName}</strong>
                    <span className={`pill priority-${message.priority.toLowerCase()}`}>{message.priority}</span>
                  </div>
                  <p>{message.content}</p>
                  <div className="row between muted small">
                    <span>{message.source}</span>
                    <span>{new Date(message.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="row between muted small">
                    <span>{message.category}</span>
                    <span>{message.status}</span>
                  </div>
                </button>
              ))}
            </div>
          </article>
        </section>
      )}

      {currentView === 'detail' && selectedMessage && (
        <section className="panel detail-view">
          <div className="row between">
            <h2>Message Detail</h2>
            <button onClick={() => setCurrentView('dashboard')}>Back</button>
          </div>

          <div className="detail-grid">
            <div>
              <p><strong>Sender:</strong> {selectedMessage.senderName}</p>
              <p><strong>Source:</strong> {selectedMessage.source}</p>
              <p><strong>Timestamp:</strong> {new Date(selectedMessage.timestamp).toLocaleString()}</p>
              <p><strong>Status:</strong> {selectedMessage.status}</p>
              <p><strong>Priority:</strong> {selectedMessage.priority}</p>
              <p><strong>Contact:</strong> {selectedMessage.contact || 'Not provided'}</p>
            </div>
            <div>
              <p><strong>Category:</strong> {selectedMessage.category}</p>
              <p><strong>Urgency:</strong> {selectedMessage.urgency}</p>
              <p><strong>Recommended Action:</strong> {selectedMessage.recommendedAction}</p>
              <p><strong>Summary:</strong> {selectedMessage.summary}</p>
            </div>
          </div>

          <h3>Incoming Message</h3>
          <p className="message-body">{selectedMessage.content}</p>

          <h3>Draft Reply (Edit before approval)</h3>
          <textarea
            value={selectedMessage.draftReply}
            onChange={(e) => setSelectedMessage((p) => ({ ...p, draftReply: e.target.value }))}
          />

          <div className="row wrap">
            <select value={quickReplyId} onChange={(e) => setQuickReplyId(e.target.value)}>
              <option value="">Insert saved reply...</option>
              {savedReplies.map((reply) => (
                <option key={reply.id} value={reply.id}>{reply.label}</option>
              ))}
            </select>
            <button
              onClick={() => {
                const selected = savedReplies.find((reply) => String(reply.id) === quickReplyId);
                if (!selected) return;
                setSelectedMessage((prev) => ({ ...prev, draftReply: `${prev.draftReply} ${selected.text}`.trim() }));
              }}
            >
              Insert
            </button>
            <button onClick={() => handleMessageUpdate({ draftReply: selectedMessage.draftReply })}>Save Draft</button>
            <button onClick={() => handleMessageUpdate({ status: 'Approved', draftReply: selectedMessage.draftReply })}>Approve</button>
            <button onClick={() => handleMessageUpdate({ status: 'Sent' })}>Mark Sent</button>
            <button onClick={handleSendToZapier} disabled={!selectedMessage.draftReply}>
              Send to Zapier
            </button>
            <button onClick={() => handleMessageUpdate({ status: 'Waiting' })}>Set Waiting</button>
            <button onClick={() => handleMessageUpdate({ status: 'Ignored' })}>Ignore</button>
          </div>

          <h3>Private Internal Note</h3>
          <textarea
            value={selectedMessage.internalNote || ''}
            onChange={(e) => setSelectedMessage((p) => ({ ...p, internalNote: e.target.value }))}
          />
          <button onClick={() => handleMessageUpdate({ internalNote: selectedMessage.internalNote || '' })}>Save Note</button>
        </section>
      )}

      {currentView === 'saved' && (
        <section className="panel">
          <h2>Saved Replies</h2>
          <form className="stack" onSubmit={handleSavedReplyCreate}>
            <input required placeholder="Label" value={savedReplyForm.label} onChange={(e) => setSavedReplyForm((p) => ({ ...p, label: e.target.value }))} />
            <textarea required placeholder="Reply text" value={savedReplyForm.text} onChange={(e) => setSavedReplyForm((p) => ({ ...p, text: e.target.value }))} />
            <button type="submit">Add saved reply</button>
          </form>

          <div className="saved-list">
            {savedReplies.map((reply) => (
              <div className="saved-card" key={reply.id}>
                <input value={reply.label} onChange={(e) => handleSavedReplyChange(reply.id, { label: e.target.value, text: reply.text })} />
                <textarea value={reply.text} onChange={(e) => handleSavedReplyChange(reply.id, { label: reply.label, text: e.target.value })} />
              </div>
            ))}
          </div>
        </section>
      )}

      {currentView === 'settings' && settings && (
        <section className="panel">
          <h2>Settings</h2>
          <form className="stack" onSubmit={handleSettingsSave}>
            <label>
              Default tone
              <select value={settings.defaultTone} onChange={(e) => setSettings((p) => ({ ...p, defaultTone: e.target.value }))}>
                {metadata?.toneOptions?.map((tone) => <option key={tone}>{tone}</option>)}
              </select>
            </label>

            <label>
              Preferred signature
              <input value={settings.preferredSignature} onChange={(e) => setSettings((p) => ({ ...p, preferredSignature: e.target.value }))} />
            </label>

            <label>
              Auto-priority rules placeholder
              <textarea
                value={settings.autoPriorityRulesPlaceholder}
                onChange={(e) => setSettings((p) => ({ ...p, autoPriorityRulesPlaceholder: e.target.value }))}
              />
            </label>

            <label>
              AI prompt template placeholder
              <textarea
                value={settings.aiPromptTemplatePlaceholder}
                onChange={(e) => setSettings((p) => ({ ...p, aiPromptTemplatePlaceholder: e.target.value }))}
              />
            </label>

            <button type="submit">Save settings</button>
          </form>
        </section>
      )}
    </div>
  );
}

export default App;
