import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

const toNumber = (value) => (value === undefined || value === null || value === '' ? null : Number(value));

app.get('/', async (_req, res) => {
  res.json({ message: 'HD Performance Tracker API is running.' });
});

app.get('/dashboard', async (_req, res) => {
  try {
    const activeStudents = await prisma.student.count({ where: { active: true } });
    const activePackages = await prisma.privatePackage.count({ where: { status: 'ACTIVE' } });
    const atRiskPackages = await prisma.privatePackage.findMany({ where: { status: 'ACTIVE' } });
    const renewalRisk = atRiskPackages.filter((pkg) => pkg.totalSessions - pkg.usedSessions <= 2).length;

    res.json({
      activeStudents,
      activePackages,
      renewalRisk
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard metrics.' });
  }
});

app.get('/students', async (_req, res) => {
  try {
    const students = await prisma.student.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        packages: true
      }
    });

    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students.' });
  }
});

app.get('/students/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        packages: { orderBy: { createdAt: 'desc' } },
        sessions: { orderBy: { sessionDate: 'desc' }, take: 10 },
        notes: { orderBy: { createdAt: 'desc' }, take: 10 }
      }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    res.json(student);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch student.' });
  }
});

app.post('/students', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, program, beltRank, active } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'firstName, lastName, and email are required.' });
    }

    const student = await prisma.student.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        program,
        beltRank,
        active: active === undefined ? true : Boolean(active)
      }
    });

    res.status(201).json(student);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create student.' });
  }
});

app.post('/packages', async (req, res) => {
  try {
    const { studentId, packageName, totalSessions, usedSessions, pricePaid, startDate, expiresAt, status } = req.body;

    if (!studentId || !packageName || !totalSessions || pricePaid === undefined || !startDate) {
      return res.status(400).json({ error: 'studentId, packageName, totalSessions, pricePaid, and startDate are required.' });
    }

    const existingStudent = await prisma.student.findUnique({ where: { id: Number(studentId) } });
    if (!existingStudent) {
      return res.status(404).json({ error: 'Student not found for package.' });
    }

    const parsedTotalSessions = Number(totalSessions);
    const parsedUsedSessions = Number(usedSessions || 0);
    if (parsedUsedSessions > parsedTotalSessions) {
      return res.status(400).json({ error: 'usedSessions cannot be greater than totalSessions.' });
    }

    const created = await prisma.privatePackage.create({
      data: {
        studentId: Number(studentId),
        packageName,
        totalSessions: parsedTotalSessions,
        usedSessions: parsedUsedSessions,
        pricePaid: Number(pricePaid),
        startDate: new Date(startDate),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        status: parsedUsedSessions >= parsedTotalSessions ? 'EXHAUSTED' : status || 'ACTIVE'
      }
    });

    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create package.' });
  }
});

app.get('/packages/renewals', async (_req, res) => {
  try {
    const packages = await prisma.privatePackage.findMany({
      where: { status: 'ACTIVE' },
      include: {
        student: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    const renewalRiskPackages = packages.filter((pkg) => pkg.totalSessions - pkg.usedSessions <= 2);

    res.json(renewalRiskPackages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch renewal packages.' });
  }
});

app.post('/sessions', async (req, res) => {
  try {
    const { studentId, privatePackageId, sessionDate, durationMinutes, focusArea, notes, coachName } = req.body;

    if (!studentId || !sessionDate || !durationMinutes) {
      return res.status(400).json({ error: 'studentId, sessionDate, and durationMinutes are required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let linkedPackage = null;

      if (privatePackageId) {
        linkedPackage = await tx.privatePackage.findUnique({ where: { id: Number(privatePackageId) } });

        if (!linkedPackage) {
          throw new Error('Linked package not found.');
        }

        const remainingSessions = linkedPackage.totalSessions - linkedPackage.usedSessions;
        if (remainingSessions <= 0) {
          throw new Error('No sessions remaining in this package.');
        }

        await tx.privatePackage.update({
          where: { id: linkedPackage.id },
          data: {
            usedSessions: linkedPackage.usedSessions + 1,
            status: linkedPackage.usedSessions + 1 >= linkedPackage.totalSessions ? 'EXHAUSTED' : linkedPackage.status
          }
        });
      }

      const createdSession = await tx.lessonSession.create({
        data: {
          studentId: Number(studentId),
          privatePackageId: toNumber(privatePackageId),
          sessionDate: new Date(sessionDate),
          durationMinutes: Number(durationMinutes),
          focusArea,
          notes,
          coachName
        }
      });

      return createdSession;
    });

    res.status(201).json(result);
  } catch (error) {
    const status = error.message === 'No sessions remaining in this package.' || error.message === 'Linked package not found.' ? 400 : 500;
    res.status(status).json({ error: error.message || 'Failed to create session.' });
  }
});

app.post('/notes', async (req, res) => {
  try {
    const { studentId, category, title, note, score } = req.body;

    if (!studentId || !category || !title || !note) {
      return res.status(400).json({ error: 'studentId, category, title, and note are required.' });
    }

    const created = await prisma.progressNote.create({
      data: {
        studentId: Number(studentId),
        category,
        title,
        note,
        score: toNumber(score)
      }
    });

    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create progress note.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
