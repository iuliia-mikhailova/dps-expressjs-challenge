import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import db from '../services/db.service';

const router = Router();

type Tournament = {
	id: string;
	name: string;
	status: 'planning' | 'started' | 'finished';
};

type CreateTournamentBody = {
	name: string;
};

type TournamentRow = { id: string; name: string; status: string };
type PlayerRow = { id: string; name: string; tournament_id: string };

function rowToTournament(row: TournamentRow): Tournament {
	return {
		id: row.id,
		name: row.name,
		status: row.status as Tournament['status'],
	};
}

/**
 * POST /tournaments — create a tournament with { name }.
 * Status starts as 'planning'. Returns 201 + created tournament.
 */
router.post('/', (req: Request, res: Response) => {
	const body = req.body as CreateTournamentBody;
	const name = body?.name;

	if (typeof name !== 'string' || !name.trim()) {
		res.status(400).json({ error: 'name is required and must be a non-empty string' });
		return;
	}

	const id = crypto.randomUUID();
	db.run(
		'INSERT INTO tournaments (id, name, status) VALUES (:id, :name, :status)',
		{ id, name: name.trim(), status: 'planning' },
	);

	const tournament: Tournament = { id, name: name.trim(), status: 'planning' };
	res.status(201).json(tournament);
});

/**
 * GET /tournaments/:id — return the tournament or 404 if not found.
 */
router.get('/:id', (req: Request, res: Response) => {
	const { id } = req.params;
	const rows = db.query('SELECT id, name, status FROM tournaments WHERE id = :id', {
		id,
	}) as TournamentRow[];

	if (rows.length === 0) {
		res.status(404).json({ error: 'Tournament not found' });
		return;
	}

	res.status(200).json(rowToTournament(rows[0]));
});

/**
 * Generate all round-robin pairs (every player vs every other exactly once).
 * Returns array of [player1_id, player2_id] pairs.
 */
function getRoundRobinPairs(playerIds: string[]): [string, string][] {
	const pairs: [string, string][] = [];
	for (let i = 0; i < playerIds.length; i++) {
		for (let j = i + 1; j < playerIds.length; j++) {
			pairs.push([playerIds[i], playerIds[j]]);
		}
	}
	return pairs;
}

/**
 * POST /tournaments/:id/start — start tournament: validate, create all games, set status to 'started'.
 */
router.post('/:id/start', (req: Request, res: Response) => {
	const { id: tournamentId } = req.params;

	const tournamentRows = db.query('SELECT id, name, status FROM tournaments WHERE id = :id', {
		id: tournamentId,
	}) as TournamentRow[];

	if (tournamentRows.length === 0) {
		res.status(404).json({ error: 'Tournament not found' });
		return;
	}

	const tournament = rowToTournament(tournamentRows[0]);

	if (tournament.status !== 'planning') {
		res.status(400).json({
			error: 'Tournament can only be started when status is planning',
			currentStatus: tournament.status,
		});
		return;
	}

	const players = db.query('SELECT id FROM players WHERE tournament_id = :tournament_id', {
		tournament_id: tournamentId,
	}) as PlayerRow[];

	const playerCount = players.length;
	if (playerCount < 2 || playerCount > 5) {
		res.status(400).json({
			error: 'Tournament must have between 2 and 5 players to start',
			playerCount,
		});
		return;
	}

	const playerIds = players.map((p) => p.id);
	const pairs = getRoundRobinPairs(playerIds);

	for (const [player1Id, player2Id] of pairs) {
		const gameId = crypto.randomUUID();
		db.run(
			'INSERT INTO games (id, tournament_id, player1_id, player2_id, result) VALUES (:id, :tournament_id, :player1_id, :player2_id, NULL)',
			{
				id: gameId,
				tournament_id: tournamentId,
				player1_id: player1Id,
				player2_id: player2Id,
			},
		);
	}

	db.run('UPDATE tournaments SET status = :status WHERE id = :id', {
		status: 'started',
		id: tournamentId,
	});

	const updated: Tournament = { ...tournament, status: 'started' };
	res.status(200).json(updated);
});

export default router;
