import { Request, Response } from 'express';
import { listEvents, getEventById, createEvent, updateEventStatus, deleteEvent } from '../services/eventService';

export async function getEvents(req: Request, res: Response) {
  try {
    const status = req.query.status as string | undefined;
    const events = await listEvents(status);
    if (!req.headers.authorization) {
      res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
    }
    res.json({ success: true, events });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getEvent(req: Request, res: Response) {
  try {
    const event = await getEventById(req.params.id);
    if (!req.headers.authorization) {
      res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
    }
    res.json({ success: true, event });
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message });
  }
}

export async function postEvent(req: any, res: Response) {
  try {
    const actorId = req.user?.userId;
    const event = await createEvent({ ...req.body, actorId });
    res.status(201).json({ success: true, event });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function patchEventStatus(req: any, res: Response) {
  try {
    const actorId = req.user?.userId;
    const { status } = req.body;
    const event = await updateEventStatus(req.params.id, status, actorId);
    res.json({ success: true, event });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function removeEvent(req: any, res: Response) {
  try {
    const actorId = req.user?.userId;
    const result = await deleteEvent(req.params.id, actorId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}
