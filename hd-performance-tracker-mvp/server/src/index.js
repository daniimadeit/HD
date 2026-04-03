import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');
const dataFilePath = path.join(dataDir, 'store.json');

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

const SOURCE_OPTIONS = ['text', 'email', 'whatsapp', 'manual'];
const STATUS_OPTIONS = ['New', 'Draft Ready', 'Waiting', 'Approved', 'Sent', 'Ignored'];
const PRIORITY_OPTIONS = ['Urgent', 'Normal', 'Low'];
const CATEGORY_OPTIONS = ['Family', 'Friend', 'Work', 'Appointment', 'School', 'Sales/Spam', 'Other'];
const ACTION_OPTIONS = ['Reply now', 'Reply later', 'Ignore', 'Archive'];
const WEBHOOK_SECRET = process.env.ZAPIER_WEBHOOK_SECRET || '';
const OUTGOING_WEBHOOK_URL = process.env.ZAPIER_OUTGOING_WEBHOOK_URL || '';

const defaultStore = {
  settings: {
    defaultTone: 'friendly',
    preferredSignature: '— Thanks',
    autoPriorityRulesPlaceholder: 'If sender contains "boss" then mark as Urgent.',
    aiPromptTemplatePlaceholder:
      'Summarize the incoming message, classify category/urgency, suggest an action, and draft a concise reply in the chosen tone.'
  },
  savedReplies: [
    { id: 1, label: 'Get back soon', text: 'I’ll get back to you soon.' },
    { id: 2, label: 'Saw this', text: 'Thanks, I saw this.' },
    { id: 3, label: 'Tied up', text: 'I’m tied up right now but will reply later.' },
    { id: 4, label: 'Need details', text: 'Can you send me a few more details?' },
    { id: 5, label: 'Tomorrow', text: 'Let’s revisit this tomorrow.' }
  ],
  messages: [
    {
      id: 1,
      senderName: 'Mom',
      source: 'text',
      timestamp: '2026-04-03T08:12:00.000Z',
      content: 'Can you call me tonight? Need help with your aunt’s travel plans.',
      status: 'New',
      internalNote: ''
    },
    {
      id: 2,
      senderName: 'Jake',
      source: 'whatsapp',
      timestamp: '2026-04-03T09:02:00.000Z',
      content: 'Basketball Saturday at 10? Confirm if you’re in.',
      status: 'Draft Ready',
      internalNote: 'Could be a quick yes/no.'
    },
    {
      id: 3,
      senderName: 'Priya (Manager)',
      source: 'email',
      timestamp: '2026-04-03T10:17:00.000Z',
      content: 'Please send the revised budget sheet before 3 PM today.',
      status: 'Waiting',
      internalNote: 'Attach latest version before replying.'
    },
    {
      id: 4,
      senderName: 'Dental Clinic',
      source: 'text',
      timestamp: '2026-04-03T11:40:00.000Z',
      content: 'Reminder: appointment Monday at 9:30 AM. Reply C to confirm.',
      status: 'Draft Ready',
      internalNote: ''
    },
    {
      id: 5,
      senderName: 'Unknown Promo',
      source: 'text',
      timestamp: '2026-04-02T20:20:00.000Z',
      content: 'You have won a $500 gift card! Click now to claim.',
      status: 'Ignored',
      internalNote: 'Likely scam.'
    },
    {
      id: 6,
      senderName: 'School Office',
      source: 'email',
      timestamp: '2026-04-02T17:15:00.000Z',
      content: 'Please complete the parent feedback form by Friday.',
      status: 'New',
      internalNote: ''
    },
    {
      id: 7,
      senderName: 'Alex',
      source: 'text',
      timestamp: '2026-04-02T15:01:00.000Z',
      content: 'Can you review my resume tonight? Applying tomorrow morning.',
      status: 'Approved',
      internalNote: ''
    },
    {
      id: 8,
      senderName: 'Landlord',
      source: 'email',
      timestamp: '2026-04-02T13:45:00.000Z',
      content: 'Maintenance visit window changed to Friday 1-3 PM. Does that work?',
      status: 'Sent',
      internalNote: ''
    },
    {
      id: 9,
      senderName: 'Dad',
      source: 'whatsapp',
      timestamp: '2026-04-02T12:22:00.000Z',
      content: 'Need your insurance policy number for taxes when you have a minute.',
      status: 'Draft Ready',
      internalNote: 'Look up policy PDF first.'
    },
    {
      id: 10,
      senderName: 'Recruiter - Sam',
      source: 'email',
      timestamp: '2026-04-02T09:10:00.000Z',
      content: 'Are you open to a 20-minute intro call this week?',
      status: 'Waiting',
      internalNote: ''
    },
    {
      id: 11,
      senderName: 'Pharmacy',
      source: 'text',
      timestamp: '2026-04-01T18:30:00.000Z',
      content: 'Your refill is ready for pickup until 8 PM tomorrow.',
      status: 'New',
      internalNote: ''
    },
    {
      id: 12,
      senderName: 'Maya',
      source: 'manual',
      timestamp: '2026-04-01T16:05:00.000Z',
      content: 'Can we move coffee from Thursday to Friday afternoon?',
      status: 'Draft Ready',
      internalNote: ''
    }
  ]
};

const toneInstructions = {
  professional: 'Thank you for your message.',
  friendly: 'Thanks for reaching out!',
  concise: 'Got it.',
  warm: 'Thanks so much for checking in.'
};

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFilePath)) {
    const seeded = {
      ...defaultStore,
      messages: defaultStore.messages.map((message) => ({
        ...message,
        ...analyzeMessage(message.content, defaultStore.settings.defaultTone, defaultStore.settings.preferredSignature)
      }))
    };

    fs.writeFileSync(dataFilePath, JSON.stringify(seeded, null, 2), 'utf-8');
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
}

function writeStore(store) {
  fs.writeFileSync(dataFilePath, JSON.stringify(store, null, 2), 'utf-8');
}

function detectCategory(content = '', senderName = '') {
  const text = `${content} ${senderName}`.toLowerCase();

  if (/mom|dad|aunt|uncle|family|sister|brother/.test(text)) return 'Family';
  if (/manager|team|budget|project|meeting|recruiter|client/.test(text)) return 'Work';
  if (/appointment|clinic|doctor|dent|pharmacy|maintenance|visit|reminder/.test(text)) return 'Appointment';
  if (/school|teacher|class|assignment|parent/.test(text)) return 'School';
  if (/win|gift card|promo|offer|sale|free|click/.test(text)) return 'Sales/Spam';
  if (/coffee|basketball|weekend|friend/.test(text)) return 'Friend';
  return 'Other';
}

function detectUrgency(content = '') {
  const text = content.toLowerCase();
  if (/asap|urgent|today|before|now|immediately|3 pm|tomorrow morning/.test(text)) return 'Urgent';
  if (/when you can|minute|this week|soon|later/.test(text)) return 'Normal';
  return 'Low';
}

function determineAction(category, urgency) {
  if (category === 'Sales/Spam') return 'Ignore';
  if (urgency === 'Urgent') return 'Reply now';
  if (category === 'Appointment') return 'Reply now';
  if (urgency === 'Normal') return 'Reply later';
  return 'Archive';
}

function summarize(content = '') {
  if (content.length <= 100) return content;
  return `${content.slice(0, 97)}...`;
}

function generateDraftReply({ content, category, recommendedAction, tone, signature }) {
  if (category === 'Sales/Spam') {
    return 'No reply needed.';
  }

  const intro = toneInstructions[tone] || toneInstructions.friendly;
  const actionLine =
    recommendedAction === 'Reply now'
      ? 'I can confirm and follow up shortly.'
      : recommendedAction === 'Reply later'
        ? 'I’ll follow up soon once I review this.'
        : 'I received this and will keep it noted.';

  return `${intro} ${actionLine} ${signature}`.trim();
}

function analyzeMessage(content, tone, signature, senderName = '') {
  const category = detectCategory(content, senderName);
  const urgency = detectUrgency(content);
  const recommendedAction = determineAction(category, urgency);

  return {
    summary: summarize(content),
    category,
    urgency,
    priority: urgency,
    recommendedAction,
    draftReply: generateDraftReply({ content, category, recommendedAction, tone, signature })
  };
}

function normalizeMessageInput(payload) {
  const normalizedSource = String(payload.source || '').toLowerCase();
  const source = SOURCE_OPTIONS.includes(normalizedSource) ? normalizedSource : normalizedSource || 'manual';

  return {
    senderName: String(payload.senderName || '').trim(),
    source,
    timestamp: payload.timestamp ? new Date(payload.timestamp).toISOString() : new Date().toISOString(),
    content: String(payload.content || '').trim(),
    contact: String(payload.contact || '').trim(),
    status: STATUS_OPTIONS.includes(payload.status) ? payload.status : 'New',
    internalNote: String(payload.internalNote || '').trim()
  };
}

function requireWebhookAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!WEBHOOK_SECRET || token !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

function applyFilters(messages, query) {
  return messages.filter((message) => {
    const statusMatch = !query.status || message.status === query.status;
    const priorityMatch = !query.priority || message.priority === query.priority;
    const categoryMatch = !query.category || message.category === query.category;
    const sourceMatch = !query.source || message.source === query.source;
    return statusMatch && priorityMatch && categoryMatch && sourceMatch;
  });
}

function applySort(messages, sort) {
  if (sort === 'oldest') {
    return [...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  if (sort === 'urgent') {
    const rank = { Urgent: 0, Normal: 1, Low: 2 };
    return [...messages].sort((a, b) => {
      const priorityDelta = (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3);
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  }

  return [...messages].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

app.get('/', (_req, res) => {
  res.json({ message: 'Message Control System API running.' });
});

app.get('/metadata', (_req, res) => {
  res.json({
    sourceOptions: SOURCE_OPTIONS,
    statusOptions: STATUS_OPTIONS,
    priorityOptions: PRIORITY_OPTIONS,
    categoryOptions: CATEGORY_OPTIONS,
    actionOptions: ACTION_OPTIONS,
    toneOptions: ['professional', 'friendly', 'concise', 'warm']
  });
});

app.get('/messages', (req, res) => {
  const store = readStore();
  const filtered = applyFilters(store.messages, req.query);
  res.json(applySort(filtered, req.query.sort));
});

app.get('/messages/:id', (req, res) => {
  const store = readStore();
  const message = store.messages.find((entry) => entry.id === Number(req.params.id));

  if (!message) {
    return res.status(404).json({ error: 'Message not found.' });
  }

  res.json(message);
});

app.post('/messages', (req, res) => {
  const store = readStore();
  const normalized = normalizeMessageInput(req.body);

  if (!normalized.senderName || !normalized.content) {
    return res.status(400).json({ error: 'senderName and content are required.' });
  }

  const analysis = analyzeMessage(
    normalized.content,
    store.settings.defaultTone,
    store.settings.preferredSignature,
    normalized.senderName
  );

  const created = {
    id: Math.max(0, ...store.messages.map((item) => item.id)) + 1,
    ...normalized,
    ...analysis,
    status: analysis.recommendedAction === 'Ignore' ? 'Ignored' : 'Draft Ready'
  };

  store.messages.push(created);
  writeStore(store);
  res.status(201).json(created);
});

app.post('/api/messages/incoming', requireWebhookAuth, (req, res) => {
  const store = readStore();
  const { sender, source, message, timestamp, contact } = req.body || {};

  if (!sender || !message) {
    return res.status(400).json({ error: 'sender and message are required.' });
  }

  const normalized = normalizeMessageInput({
    senderName: sender,
    source,
    timestamp,
    content: message,
    contact,
    status: 'New',
    internalNote: ''
  });

  const analysis = analyzeMessage(
    normalized.content,
    store.settings.defaultTone,
    store.settings.preferredSignature,
    normalized.senderName
  );

  const created = {
    id: Math.max(0, ...store.messages.map((item) => item.id)) + 1,
    ...normalized,
    ...analysis,
    status: 'New',
    priority: 'Normal'
  };

  store.messages.push(created);
  writeStore(store);

  res.json({ success: true });
});

app.post('/api/messages/send-approved', requireWebhookAuth, async (req, res) => {
  const { to, source, message, originalMessageId } = req.body || {};

  if (!to || !source || !message || !originalMessageId) {
    return res.status(400).json({ error: 'to, source, message, and originalMessageId are required.' });
  }

  if (!OUTGOING_WEBHOOK_URL) {
    return res.status(500).json({ error: 'ZAPIER_OUTGOING_WEBHOOK_URL is not configured.' });
  }

  try {
    const webhookResponse = await fetch(OUTGOING_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, source, message, originalMessageId })
    });

    if (!webhookResponse.ok) {
      return res.status(502).json({ error: 'Failed to send payload to Zapier webhook.' });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(502).json({ error: 'Failed to send payload to Zapier webhook.' });
  }
});

app.patch('/messages/:id', (req, res) => {
  const store = readStore();
  const message = store.messages.find((entry) => entry.id === Number(req.params.id));

  if (!message) {
    return res.status(404).json({ error: 'Message not found.' });
  }

  const allowedFields = [
    'status',
    'draftReply',
    'internalNote',
    'summary',
    'category',
    'urgency',
    'priority',
    'recommendedAction',
    'timestamp',
    'senderName',
    'source',
    'content',
    'contact'
  ];

  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      message[key] = req.body[key];
    }
  }

  if (req.body.reanalyze === true) {
    Object.assign(
      message,
      analyzeMessage(message.content, store.settings.defaultTone, store.settings.preferredSignature, message.senderName)
    );
  }

  if (!STATUS_OPTIONS.includes(message.status)) {
    message.status = 'New';
  }

  writeStore(store);
  res.json(message);
});

app.get('/saved-replies', (_req, res) => {
  const store = readStore();
  res.json(store.savedReplies);
});

app.post('/saved-replies', (req, res) => {
  const store = readStore();
  const label = String(req.body.label || '').trim();
  const text = String(req.body.text || '').trim();

  if (!label || !text) {
    return res.status(400).json({ error: 'label and text are required.' });
  }

  const created = {
    id: Math.max(0, ...store.savedReplies.map((entry) => entry.id)) + 1,
    label,
    text
  };

  store.savedReplies.push(created);
  writeStore(store);
  res.status(201).json(created);
});

app.patch('/saved-replies/:id', (req, res) => {
  const store = readStore();
  const reply = store.savedReplies.find((entry) => entry.id === Number(req.params.id));

  if (!reply) {
    return res.status(404).json({ error: 'Saved reply not found.' });
  }

  if (req.body.label !== undefined) reply.label = String(req.body.label);
  if (req.body.text !== undefined) reply.text = String(req.body.text);

  writeStore(store);
  res.json(reply);
});

app.get('/settings', (_req, res) => {
  const store = readStore();
  res.json(store.settings);
});

app.patch('/settings', (req, res) => {
  const store = readStore();
  const editableFields = ['defaultTone', 'preferredSignature', 'autoPriorityRulesPlaceholder', 'aiPromptTemplatePlaceholder'];

  for (const key of editableFields) {
    if (req.body[key] !== undefined) {
      store.settings[key] = req.body[key];
    }
  }

  writeStore(store);
  res.json(store.settings);
});

app.listen(PORT, () => {
  ensureStore();
  console.log(`Message Control System API running at http://localhost:${PORT}`);
});
