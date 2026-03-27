import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

const initialStudentForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  program: '',
  beltRank: ''
};

const initialPackageForm = {
  studentId: '',
  packageName: '',
  totalSessions: '',
  pricePaid: '',
  startDate: '',
  expiresAt: ''
};

const initialSessionForm = {
  studentId: '',
  privatePackageId: '',
  sessionDate: '',
  durationMinutes: '60',
  focusArea: '',
  notes: '',
  coachName: ''
};

const initialNoteForm = {
  studentId: '',
  category: '',
  title: '',
  note: '',
  score: ''
};

function App() {
  const [dashboard, setDashboard] = useState({ activeStudents: 0, activePackages: 0, renewalRisk: 0 });
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [renewals, setRenewals] = useState([]);
  const [error, setError] = useState('');

  const [studentForm, setStudentForm] = useState(initialStudentForm);
  const [packageForm, setPackageForm] = useState(initialPackageForm);
  const [sessionForm, setSessionForm] = useState(initialSessionForm);
  const [noteForm, setNoteForm] = useState(initialNoteForm);

  const sessionStudentPackages = useMemo(() => {
    const sessionStudentId = Number(sessionForm.studentId);
    if (!sessionStudentId) {
      return [];
    }

    const matchedStudent = students.find((student) => student.id === sessionStudentId);
    return matchedStudent?.packages || [];
  }, [students, sessionForm.studentId]);

  async function loadDashboard() {
    const data = await api.getDashboard();
    setDashboard(data);
  }

  async function loadStudents() {
    const data = await api.getStudents();
    setStudents(data);

    if (!selectedStudentId && data.length) {
      setSelectedStudentId(data[0].id);
      return;
    }

    if (selectedStudentId && !data.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(data[0]?.id || null);
    }
  }

  async function loadStudentDetails(id) {
    if (!id) {
      setSelectedStudent(null);
      return;
    }

    const details = await api.getStudent(id);
    setSelectedStudent(details);
  }

  async function loadRenewals() {
    const data = await api.getRenewals();
    setRenewals(data);
  }

  async function refreshAll() {
    setError('');
    try {
      await Promise.all([loadDashboard(), loadStudents(), loadRenewals()]);
    } catch (err) {
      setError(err.message || 'Failed to load data.');
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    if (!selectedStudentId) {
      return;
    }

    setError('');
    loadStudentDetails(selectedStudentId).catch((err) => setError(err.message || 'Failed to load student details.'));
  }, [selectedStudentId]);

  async function handleCreateStudent(event) {
    event.preventDefault();
    setError('');

    try {
      await api.createStudent(studentForm);
      setStudentForm(initialStudentForm);
      await refreshAll();
    } catch (err) {
      setError(err.message || 'Failed to create student.');
    }
  }

  async function handleCreatePackage(event) {
    event.preventDefault();
    setError('');

    try {
      await api.createPackage({
        ...packageForm,
        studentId: Number(packageForm.studentId),
        totalSessions: Number(packageForm.totalSessions),
        pricePaid: Number(packageForm.pricePaid)
      });
      setPackageForm(initialPackageForm);
      await refreshAll();
      if (selectedStudentId) {
        await loadStudentDetails(selectedStudentId);
      }
    } catch (err) {
      setError(err.message || 'Failed to create package.');
    }
  }

  async function handleLogSession(event) {
    event.preventDefault();
    setError('');

    try {
      await api.createSession({
        ...sessionForm,
        studentId: Number(sessionForm.studentId),
        privatePackageId: sessionForm.privatePackageId ? Number(sessionForm.privatePackageId) : null,
        durationMinutes: Number(sessionForm.durationMinutes)
      });
      setSessionForm(initialSessionForm);
      await refreshAll();
      if (selectedStudentId) {
        await loadStudentDetails(selectedStudentId);
      }
    } catch (err) {
      setError(err.message || 'Failed to log session.');
    }
  }

  async function handleCreateNote(event) {
    event.preventDefault();
    setError('');

    try {
      await api.createNote({
        ...noteForm,
        studentId: Number(noteForm.studentId),
        score: noteForm.score ? Number(noteForm.score) : null
      });
      setNoteForm(initialNoteForm);
      await refreshAll();
      if (selectedStudentId) {
        await loadStudentDetails(selectedStudentId);
      }
    } catch (err) {
      setError(err.message || 'Failed to add note.');
    }
  }

  return (
    <div className="app">
      <header>
        <h1>HD Performance Tracker MVP</h1>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="dashboard-cards">
        <article>
          <h2>Active Students</h2>
          <p>{dashboard.activeStudents}</p>
        </article>
        <article>
          <h2>Active Packages</h2>
          <p>{dashboard.activePackages}</p>
        </article>
        <article>
          <h2>Renewal Risk</h2>
          <p>{dashboard.renewalRisk}</p>
        </article>
      </section>

      <section className="layout">
        <aside className="panel">
          <h3>Students</h3>
          <ul className="student-list">
            {students.map((student) => (
              <li key={student.id}>
                <button
                  className={student.id === selectedStudentId ? 'selected' : ''}
                  onClick={() => setSelectedStudentId(student.id)}
                >
                  {student.firstName} {student.lastName}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="panel">
          <h3>Student Detail</h3>
          {selectedStudent ? (
            <div>
              <p>
                <strong>Name:</strong> {selectedStudent.firstName} {selectedStudent.lastName}
              </p>
              <p>
                <strong>Email:</strong> {selectedStudent.email}
              </p>

              <h4>Packages</h4>
              <ul>
                {selectedStudent.packages.map((pkg) => (
                  <li key={pkg.id}>
                    {pkg.packageName} — {pkg.usedSessions}/{pkg.totalSessions} used ({pkg.status})
                  </li>
                ))}
              </ul>

              <h4>Recent Sessions</h4>
              <ul>
                {selectedStudent.sessions.map((session) => (
                  <li key={session.id}>
                    {new Date(session.sessionDate).toLocaleDateString()} — {session.durationMinutes} min —{' '}
                    {session.focusArea || 'General'}
                  </li>
                ))}
              </ul>

              <h4>Recent Notes</h4>
              <ul>
                {selectedStudent.notes.map((entry) => (
                  <li key={entry.id}>
                    {entry.category}: {entry.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>Select a student to view details.</p>
          )}
        </main>
      </section>

      <section className="forms-grid">
        <form className="panel" onSubmit={handleCreateStudent}>
          <h3>Create Student</h3>
          <input placeholder="First name" value={studentForm.firstName} onChange={(e) => setStudentForm((p) => ({ ...p, firstName: e.target.value }))} required />
          <input placeholder="Last name" value={studentForm.lastName} onChange={(e) => setStudentForm((p) => ({ ...p, lastName: e.target.value }))} required />
          <input type="email" placeholder="Email" value={studentForm.email} onChange={(e) => setStudentForm((p) => ({ ...p, email: e.target.value }))} required />
          <input placeholder="Phone" value={studentForm.phone} onChange={(e) => setStudentForm((p) => ({ ...p, phone: e.target.value }))} />
          <input placeholder="Program" value={studentForm.program} onChange={(e) => setStudentForm((p) => ({ ...p, program: e.target.value }))} />
          <input placeholder="Belt Rank" value={studentForm.beltRank} onChange={(e) => setStudentForm((p) => ({ ...p, beltRank: e.target.value }))} />
          <button type="submit">Create Student</button>
        </form>

        <form className="panel" onSubmit={handleCreatePackage}>
          <h3>Create Package</h3>
          <select value={packageForm.studentId} onChange={(e) => setPackageForm((p) => ({ ...p, studentId: e.target.value }))} required>
            <option value="">Select student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.firstName} {student.lastName}
              </option>
            ))}
          </select>
          <input placeholder="Package name" value={packageForm.packageName} onChange={(e) => setPackageForm((p) => ({ ...p, packageName: e.target.value }))} required />
          <input type="number" min="1" placeholder="Total sessions" value={packageForm.totalSessions} onChange={(e) => setPackageForm((p) => ({ ...p, totalSessions: e.target.value }))} required />
          <input type="number" min="0" step="0.01" placeholder="Price paid" value={packageForm.pricePaid} onChange={(e) => setPackageForm((p) => ({ ...p, pricePaid: e.target.value }))} required />
          <label>
            Start date
            <input type="date" value={packageForm.startDate} onChange={(e) => setPackageForm((p) => ({ ...p, startDate: e.target.value }))} required />
          </label>
          <label>
            Expires at (optional)
            <input type="date" value={packageForm.expiresAt} onChange={(e) => setPackageForm((p) => ({ ...p, expiresAt: e.target.value }))} />
          </label>
          <button type="submit">Create Package</button>
        </form>

        <form className="panel" onSubmit={handleLogSession}>
          <h3>Log Session</h3>
          <select value={sessionForm.studentId} onChange={(e) => setSessionForm((p) => ({ ...p, studentId: e.target.value }))} required>
            <option value="">Select student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.firstName} {student.lastName}
              </option>
            ))}
          </select>
          <select value={sessionForm.privatePackageId} onChange={(e) => setSessionForm((p) => ({ ...p, privatePackageId: e.target.value }))}>
            <option value="">No package</option>
            {sessionStudentPackages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.packageName} ({pkg.totalSessions - pkg.usedSessions} left)
              </option>
            ))}
          </select>
          <label>
            Session date
            <input type="date" value={sessionForm.sessionDate} onChange={(e) => setSessionForm((p) => ({ ...p, sessionDate: e.target.value }))} required />
          </label>
          <input type="number" min="1" placeholder="Duration (minutes)" value={sessionForm.durationMinutes} onChange={(e) => setSessionForm((p) => ({ ...p, durationMinutes: e.target.value }))} required />
          <input placeholder="Focus area" value={sessionForm.focusArea} onChange={(e) => setSessionForm((p) => ({ ...p, focusArea: e.target.value }))} />
          <input placeholder="Coach name" value={sessionForm.coachName} onChange={(e) => setSessionForm((p) => ({ ...p, coachName: e.target.value }))} />
          <textarea placeholder="Notes" value={sessionForm.notes} onChange={(e) => setSessionForm((p) => ({ ...p, notes: e.target.value }))} />
          <button type="submit">Log Session</button>
        </form>

        <form className="panel" onSubmit={handleCreateNote}>
          <h3>Add Progress Note</h3>
          <select value={noteForm.studentId} onChange={(e) => setNoteForm((p) => ({ ...p, studentId: e.target.value }))} required>
            <option value="">Select student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.firstName} {student.lastName}
              </option>
            ))}
          </select>
          <input placeholder="Category" value={noteForm.category} onChange={(e) => setNoteForm((p) => ({ ...p, category: e.target.value }))} required />
          <input placeholder="Title" value={noteForm.title} onChange={(e) => setNoteForm((p) => ({ ...p, title: e.target.value }))} required />
          <textarea placeholder="Note" value={noteForm.note} onChange={(e) => setNoteForm((p) => ({ ...p, note: e.target.value }))} required />
          <input type="number" placeholder="Score (optional)" value={noteForm.score} onChange={(e) => setNoteForm((p) => ({ ...p, score: e.target.value }))} />
          <button type="submit">Add Note</button>
        </form>
      </section>

      <section className="panel">
        <h3>Renewal Visibility (≤ 2 sessions remaining)</h3>
        <ul>
          {renewals.map((pkg) => (
            <li key={pkg.id}>
              {pkg.student.firstName} {pkg.student.lastName} — {pkg.packageName} ({pkg.totalSessions - pkg.usedSessions} left)
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default App;
