import type { Request, Response } from 'express';
import mongoose from 'mongoose';

import { PhotoContestModel } from '../models/photo-contest.model.js';
import { PhotoContestEntryModel } from '../models/photo-contest-entry.model.js';
import { PhotoContestVoteModel } from '../models/photo-contest-vote.model.js';
import { EventPhotoModel } from '../models/event-photo.model.js';
import { hashDeviceId } from '../utils/device-hash.js';
import { rankByCount } from '../utils/photo-ranking.js';

/* Solo i campi che decidono l'apertura: cosi' la funzione accetta sia il
   documento Mongoose sia il risultato di `.lean()`. */
type ContestSchedule = {
  status?: string | null;
  votingEnabled?: boolean | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

function isContestOpen(contest: ContestSchedule | null) {
  if (!contest) return false;
  if (contest.status !== 'open') return false;
  if (!contest.votingEnabled) return false;
  const now = new Date();
  if (contest.startsAt && now < contest.startsAt) return false;
  if (contest.endsAt && now > contest.endsAt) return false;
  return true;
}

export async function listPhotoContests(req: Request, res: Response) {
  try {
    const { eventId } = req.params;
    const contests = await PhotoContestModel.find({ eventId }).sort({ createdAt: -1 }).lean();
    return res.json({ items: contests });
  } catch (error) {
    console.error('listPhotoContests error', error);
    return res.status(500).json({ message: 'Errore nel recupero dei contest fotografici' });
  }
}

export async function getPhotoContest(req: Request, res: Response) {
  try {
    const { eventId, contestId } = req.params;
    const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId : undefined;

    const contest = await PhotoContestModel.findOne({ _id: contestId, eventId }).lean();
    if (!contest) return res.status(404).json({ message: 'Contest non trovato' });

    // Tutte le foto della galleria partecipano automaticamente al contest
    const photos = await EventPhotoModel.find({ eventId, type: 'image' }).sort({ sequenceNumber: 1, createdAt: 1 }).lean();
    const photoMap = new Map(photos.map((p) => [String(p._id), p]));
    const photoIds = photos.map((p) => String(p._id));

    const votes = await PhotoContestVoteModel.find({ contestId }).lean();

    const voteCountByPhoto = new Map<string, number>();
    for (const v of votes) {
      const key = String(v.photoId);
      voteCountByPhoto.set(key, (voteCountByPhoto.get(key) || 0) + 1);
    }

    /* Medaglie top-3 con gli ex aequo sullo stesso gradino, stessa regola
       della galleria (`rankByCount`): se le due classifiche divergessero, la
       stessa foto avrebbe una medaglia nel contest e un'altra nella galleria. */
    const rankByPhoto = new Map<string, number>(
      rankByCount(voteCountByPhoto, { maxRank: 3 }).map((row) => [row.photoId, row.rank])
    );

    let hasVoted = false;
    let votedPhotoId: string | null = null;
    if (deviceId) {
      const dh = hashDeviceId(deviceId);
      const existing = await PhotoContestVoteModel.findOne({ contestId, deviceIdHash: dh }).lean();
      if (existing) {
        hasVoted = true;
        votedPhotoId = String(existing.photoId);
      }
    }

    const devicePhotoMatchByPhoto = new Map<string, boolean>();
    if (deviceId) {
      const dh = hashDeviceId(deviceId);
      for (const pid of photoIds) {
        const p = photoMap.get(String(pid));
        if (p && p.takenByDeviceIdHash && p.takenByDeviceIdHash === dh) {
          devicePhotoMatchByPhoto.set(String(pid), true);
        }
      }
    }

    /* Le foto partecipano tutte automaticamente: `photos` e' gia' la lista
       ordinata della galleria, quindi non esistono piu' record `Entry` da
       attraversare (la vecchia `entries.map` referenziava una variabile
       rimossa e faceva fallire l'endpoint con un ReferenceError). */
    const items = photos
      .map((photo) => {
        const pid = String(photo._id);
        return {
          photoId: pid,
          photo,
          voteCount: contest.showVotesCount || contest.resultsPublished || contest.status === 'closed' ? (voteCountByPhoto.get(pid) || 0) : undefined,
          rank: rankByPhoto.get(pid) || null,
          isTakenByThisDevice: devicePhotoMatchByPhoto.get(pid) || false
        };
      })
      .filter(Boolean);

    return res.json({
      contest,
      items,
      hasVoted,
      votedPhotoId,
      isOpen: isContestOpen(contest)
    });
  } catch (error) {
    console.error('getPhotoContest error', error);
    return res.status(500).json({ message: 'Errore nel recupero del contest fotografico' });
  }
}

/* Classifica per il pannello «Info» della gestione contest.
 *
 * Rotta ADMIN: i conteggi qui sono sempre esposti, anche con
 * `showVotesCount` spento. Quel flag nasconde i voti al pubblico, non
 * all'organizzatore che sta gestendo la votazione in corso (prima l'unico
 * modo di vedere la classifica era pubblicare i risultati o chiudere il
 * contest, cioe' due azioni irreversibili). */
export async function getPhotoContestResults(req: Request, res: Response) {
  try {
    const { eventId, contestId } = req.params;

    const contest = await PhotoContestModel.findOne({ _id: contestId, eventId }).lean();
    if (!contest) return res.status(404).json({ message: 'Contest non trovato' });

    const votes = await PhotoContestVoteModel.find({ contestId }).lean();
    const voteCountByPhoto = new Map<string, number>();
    for (const v of votes) {
      const key = String(v.photoId);
      voteCountByPhoto.set(key, (voteCountByPhoto.get(key) || 0) + 1);
    }

    const ranked = rankByCount(voteCountByPhoto);
    const photos = await EventPhotoModel.find({
      _id: { $in: ranked.map((row) => row.photoId) },
      eventId
    })
      .select('sequenceNumber image')
      .lean();
    const photoMap = new Map(photos.map((p) => [String(p._id), p]));

    const ranking = ranked
      .map((row) => {
        const photo = photoMap.get(row.photoId);
        return {
          photoId: row.photoId,
          sequenceNumber: photo?.sequenceNumber ?? null,
          imageUrl: photo?.image?.url ?? null,
          voteCount: row.count,
          rank: row.rank
        };
      })
      /* il gradino raggruppa gli ex aequo, il numero di scatto li ordina */
      .sort((a, b) => a.rank - b.rank || (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));

    return res.json({
      contest,
      isOpen: isContestOpen(contest),
      totalVotes: votes.length,
      ranking
    });
  } catch (error) {
    console.error('getPhotoContestResults error', error);
    return res.status(500).json({ message: 'Errore nel recupero della classifica del contest' });
  }
}

export async function createPhotoContest(req: Request, res: Response) {
  try {
    const { eventId } = req.params;
    const { title, description, status, votingEnabled, startsAt, endsAt, resultsPublished, showVotesCount, requireDevicePhotoMatch } = req.body || {};

    const contest = await PhotoContestModel.create({
      eventId,
      title,
      description: description || null,
      status: status || 'draft',
      votingEnabled: !!votingEnabled,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      resultsPublished: !!resultsPublished,
      showVotesCount: showVotesCount !== undefined ? !!showVotesCount : true,
      requireDevicePhotoMatch: !!requireDevicePhotoMatch,
      createdBy: req.user?.id || null
    });

    return res.status(201).json({ item: contest });
  } catch (error) {
    console.error('createPhotoContest error', error);
    return res.status(500).json({ message: 'Errore nella creazione del contest fotografico' });
  }
}

export async function updatePhotoContest(req: Request, res: Response) {
  try {
    const { eventId, contestId } = req.params;
    const updates: Record<string, string | boolean | Date | null> = {};
    const allowed = ['title', 'description', 'status', 'votingEnabled', 'startsAt', 'endsAt', 'resultsPublished', 'showVotesCount', 'requireDevicePhotoMatch'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === 'startsAt' || key === 'endsAt') {
          updates[key] = req.body[key] ? new Date(req.body[key]) : null;
        } else {
          updates[key] = req.body[key];
        }
      }
    }
    if (updates.status === 'closed') {
      updates.closedAt = new Date();
      updates.votingEnabled = false;
    }

    const contest = await PhotoContestModel.findOneAndUpdate({ _id: contestId, eventId }, updates, { new: true });
    if (!contest) return res.status(404).json({ message: 'Contest non trovato' });
    return res.json({ item: contest });
  } catch (error) {
    console.error('updatePhotoContest error', error);
    return res.status(500).json({ message: 'Errore nell\'aggiornamento del contest fotografico' });
  }
}

export async function setPhotoContestEntries(req: Request, res: Response) {
  try {
    const { eventId, contestId } = req.params;
    const contest = await PhotoContestModel.findOne({ _id: contestId, eventId });
    if (!contest) return res.status(404).json({ message: 'Contest non trovato' });

    // Tutte le foto della galleria partecipano automaticamente al contest
    await PhotoContestEntryModel.deleteMany({ contestId });
    return res.json({ ok: true });
  } catch (error) {
    console.error('setPhotoContestEntries error', error);
    return res.status(500).json({ message: 'Errore nell\'aggiornamento delle foto del contest' });
  }
}

export async function votePhotoContest(req: Request, res: Response) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { eventId, contestId } = req.params;
    const { photoId, deviceId } = req.body || {};

    if (!photoId || !deviceId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Dati mancanti' });
    }

    const contest = await PhotoContestModel.findOne({ _id: contestId, eventId }).session(session);
    if (!contest) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Contest non trovato' });
    }
    if (!isContestOpen(contest)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'Contest fotografico chiuso' });
    }

    const photo = await EventPhotoModel.findOne({ _id: photoId, eventId }).session(session);
    if (!photo || photo.type !== 'image') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Foto non valida per questo contest' });
    }

    const dh = hashDeviceId(deviceId);
    const existingVote = await PhotoContestVoteModel.findOne({ contestId, deviceIdHash: dh }).session(session);
    if (existingVote) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ message: 'Hai già votato in questo contest' });
    }

    if (contest.requireDevicePhotoMatch) {
      const photo = await EventPhotoModel.findById(photoId).session(session);
      if (!photo || photo.takenByDeviceIdHash !== dh) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({ message: 'Può votare solo chi ha scattato questa foto da questo dispositivo' });
      }
    }

    await PhotoContestVoteModel.create([{ contestId, photoId, deviceIdHash: dh }], { session });
    await session.commitTransaction();
    session.endSession();

    return res.json({ ok: true });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('votePhotoContest error', error);
    return res.status(500).json({ message: 'Errore nel voto' });
  }
}

export async function resetPhotoContestVotes(req: Request, res: Response) {
  try {
    const { eventId, contestId } = req.params;
    const contest = await PhotoContestModel.findOne({ _id: contestId, eventId });
    if (!contest) return res.status(404).json({ message: 'Contest non trovato' });

    await PhotoContestVoteModel.deleteMany({ contestId });
    return res.json({ ok: true });
  } catch (error) {
    console.error('resetPhotoContestVotes error', error);
    return res.status(500).json({ message: 'Errore nel reset dei voti' });
  }
}

export async function closePhotoContest(req: Request, res: Response) {
  try {
    const { eventId, contestId } = req.params;
    const contest = await PhotoContestModel.findOneAndUpdate(
      { _id: contestId, eventId },
      { status: 'closed', votingEnabled: false, closedAt: new Date() },
      { new: true }
    );
    if (!contest) return res.status(404).json({ message: 'Contest non trovato' });
    return res.json({ item: contest });
  } catch (error) {
    console.error('closePhotoContest error', error);
    return res.status(500).json({ message: 'Errore nella chiusura del contest' });
  }
}
