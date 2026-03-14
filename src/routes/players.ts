import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import db from '../services/db.service';

const router = Router();

type Player = {
	id: string;
	name: string;
	tournament_id: string;
};

type AddPlayerBody = {
	name: string;
};

type TournamentRow = { id: string; name: string; status: string };
type PlayerRow = { id: string; name: string; tournament_id: string };

function rowToPlayer(row: PlayerRow): Player {
	return {
		id: row.id,
		name: row.name,
		tournament_id: row.tournament_id,
	};
}

/**
 * POST /tournaments/:id/players — add a player to a tournament.
 */
router.post('/:id/players', (req: Request, res: Response) => {
	const tournamentId = req.params.id;
	const body = req.body as AddPlayerBody;
	const name = body?.name;

	if (typeof name !== 'string' || !name.trim()) {
		res.status(400).json({ error: 'name is required and must be a non-empty string' });
		return;
	}

	const tournamentRows = db.query('SELECT id, name, status FROM tournaments WHERE id = :id', {
		id: tournamentId,
	}) as TournamentRow[];

	if (tournamentRows.length === 0) {
		res.status(404).json({ error: 'Tournament not found' });
		return;
	}

	const tournament = tournamentRows[0];
	if (tournament.status !== 'planning') {
		res.status(400).json({
			error: 'Players can only be added when tournament status is planning',
			currentStatus: tournament.status,
		});
		return;
	}

	const existingPlayers = db.query(
		'SELECT id FROM players WHERE tournament_id = :tournament_id',
		{ tournament_id: tournamentId },
	) as PlayerRow[];

	if (existingPlayers.length >= 5) {
		res.status(400).json({
			error: 'Tournament already has the maximum of 5 players',
			playerCount: existingPlayers.length,
		});
		return;
	}

	const playerId = crypto.randomUUID();
	db.run(
		'INSERT INTO players (id, name, tournament_id) VALUES (:id, :name, :tournament_id)',
		{ id: playerId, name: name.trim(), tournament_id: tournamentId },
	);

	const player: Player = {
		id: playerId,
		name: name.trim(),
		tournament_id: tournamentId,
	};
	res.status(201).json(player);
});

/**
 * GET /tournaments/:id/players — list all players in a tournament.
 */
router.get('/:id/players', (req: Request, res: Response) => {
	const tournamentId = req.params.id;

	const tournamentRows = db.query('SELECT id FROM tournaments WHERE id = :id', {
		id: tournamentId,
	}) as TournamentRow[];

	if (tournamentRows.length === 0) {
		res.status(404).json({ error: 'Tournament not found' });
		return;
	}

	const playerRows = db.query(
		'SELECT id, name, tournament_id FROM players WHERE tournament_id = :tournament_id',
		{ tournament_id: tournamentId },
	) as PlayerRow[];

	const players = playerRows.map(rowToPlayer);
	res.status(200).json(players);
});

export default router;
