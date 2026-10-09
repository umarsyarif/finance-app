import express from 'express';
import { requireApiToken } from '../middleware/requireApiToken';

const router = express.Router();

router.post('/text', requireApiToken, (_req, res) => {
  res.status(501).json({ status: 'error', message: 'Not implemented yet' });
});

export default router;
