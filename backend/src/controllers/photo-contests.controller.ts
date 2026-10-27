import type { Request, Response } from 'express';
import mongoose from 'mongoose';

import { PhotoContestModel } from '../models/photo-contest.model.js';
import { PhotoContestEntryModel } from '../models/photo-contest-entry.model.js';
import { PhotoContestVoteModel } from '../models/photo-contest-vote.model.js';
import { EventPhotoModel } from '../models/event-photo.model.js';
import { EventModel } from '../models/event.model.js';
import { hashDeviceId } from '../utils/device-hash.js';

function isContestOpen(contest: any) {
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
    const { eventId } = req.params as any;
    const contests = await PhotoContestModel.find({ eventId }).sort({ createdAt: -1 }).lean();
    return res.json({ items: contests });
  } catch (error) {
    console.error('listPhotoContests error', error);
    return res.status(500).json({ message: 'Errore nel recupero dei contest fotografici' });
  }
}

export async function getPhotoContest(req: Request, res: Response) {
  try {
    const { eventId, contestId } = req.params as any;
    const { deviceId } = req.query as any;

    const contest = await PhotoContestModel.findOne({ _id: contestId, eventId }).lean();
    if (!contest) return res.status(404).json({ message: 'Contest non trovato' });

    const entries = await PhotoContestEntryModel.find({ contestId }).sort({ order: 1, addedAt: 1 }).lean();
    const photoIds = entries.map((e: any) => e.photoId);

    const photos = await EventPhotoModel.find({ _id: { $in: photoIds } }).lean();
    const photoMap = new Map(photos.map((p: any) => [String(p._id), p]));

    let votes: any[] = [];
    if (contest.status === 'closed' || contest.resultsPublished) {
      votes = await PhotoContestVoteModel.find({ contestId }).lean();
    } else {
      // still compute for ranking if needed, but public can see counts if showVotesCount
      votes = await PhotoContestVoteModel.find({ contestId }).lean();
    }

    const voteCountByPhoto = new Map<string, number>();
    for (const v of votes) {
      const key = String((v as any).photoId);
      voteCountByPhoto.set(key, (voteCountByPhoto.get(key) || 0) + 1);
    }

    // compute ranks with ties (all get badge if in top 3)
    const itemsWithCounts = Array.from(voteCountByPhoto.entries())
      .map(([photoId, count]) => ({ photoId, count }))
      .sort((a, b) => b.count - a.count);

    const rankByPhoto = new Map<string, number>();
    if (itemsWithCounts.length > 0) {
      let currentRank = 1;
      let i = 0;
      while (i < itemsWithCounts.length && currentRank <= 3) {
        const countAtRank = itemsWithCounts[i].count;
        // find all with this count starting at i
        let j = i;
        while (j < itemsWithCounts.length && itemsWithCounts[j].count === countAtRank) {
          if (currentRank <= 3) {
            rankByPhoto.set(itemsWithCounts[j].photoId, currentRank);
          }
          j++;
        }
        currentRank++;
        i = j;
        if (i < itemsWithCounts.length && itemsWithCounts[i].count === itemsWithCounts[i - 1].count) {
          // should not happen
        }
      }
    }

    let hasVoted = false;
    let votedPhotoId: string | null = null;
    if (deviceId) {
      const dh = hashDeviceId(deviceId);
      const existing = await PhotoContestVoteModel.findOne({ contestId, deviceIdHash: dh }).lean();
      if (existing) {
        hasVoted = true;
        votedPhotoId = String((existing as any).photoId);
      }
    }

    const devicePhotoMatchByPhoto = new Map<string, boolean>();
    if (deviceId) {
      const dh = hashDeviceId(deviceId);
      for (const pid of photoIds) {
        const p = photoMap.get(String(pid));
        if (p && (p as any).takenByDeviceIdHash && (p as any).takenByDeviceIdHash === dh) {
          devicePhotoMatchByPhoto.set(String(pid), true);
        }
      }
    }

    const items = entries
      .map((e: any) => {
        const pid = String(e.photoId);
        const photo = photoMap.get(pid);
        if (!photo) return null;
        return {
          entryId: e._id,
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

export async function createPhotoContest(req: Request, res: Response) {
  try {
    const { eventId } = req.params as any;
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
      createdBy: (req as any).user?._id || null
    });

    return res.status(201).json({ item: contest });
  } catch (error) {
    console.error('createPhotoContest error', error);
    return res.status(500).json({ message: 'Errore nella creazione del contest fotografico' });
  }
}

export async function updatePhotoContest(req: Request, res: Response) {
  try {
    const { eventId, contestId } = req.params as any;
    const updates: any = {};
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
    const { eventId, contestId } = req.params as any;
    const { photoIds } = req.body || {};

    const contest = await PhotoContestModel.findOne({ _id: contestId, eventId });
    if (!contest) return res.status(404).json({ message: 'Contest non trovato' });

    await PhotoContestEntryModel.deleteMany({ contestId });

    if (Array.isArray(photoIds) && photoIds.length > 0) {
      const entries = photoIds.map((pid: string, idx: number) => ({
        contestId,
        photoId: pid,
        order: idx
      }));
      await PhotoContestEntryModel.insertMany(entries);
    }

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
    const { eventId, contestId } = req.params as any;
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

    const entry = await PhotoContestEntryModel.findOne({ contestId, photoId }).session(session);
    if (!entry) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Foto non inclusa in questo contest' });
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
      if (!photo || (photo as any).takenByDeviceIdHash !== dh) {
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
    const { eventId, contestId } = req.params as any;
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
    const { eventId, contestId } = req.params as any;
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
