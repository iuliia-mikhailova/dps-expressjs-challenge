import { Router, Request, Response } from 'express';
import db from '../services/db.service';

const router = Router();

const VALID_RESULTS = ['player1', 'player2', 'draw'] as const;
type GameResult = (typeof VALID_RESULTS)[number];

type Game = {
	id: string;
	tournament_id: string;
	player1_id: string;
	player2_id: string;
	result: GameResult | null;
};

type RecordResultBody = {
	result: GameResult;
};

type TournamentRow = { id: string };
type GameRow = {
	id: string;
	tournament_id: string;
	player1_id: string;
	player2_id: string;
	result: string | null;
};

function rowToGame(row: GameRow): Game {
	return {
		id: row.id,
		tournament_id: row.tournament_id,
		player1_id: row.player1_id,
		player2_id: row.player2_id,
		result: row.result as GameResult | null,
	};
}

function isValidResult(value: unknown): value is GameResult {
	return typeof value === 'string' && VALID_RESULTS.includes(value as GameResult);
}

/**
 * GET /tournaments/:id/games — list all games for a tournament.
 */
router.get('/:id/games', (req: Request, res: Response) => {
	const tournamentId = req.params.id;

	const tournamentRows = db.query('SELECT id FROM tournaments WHERE id = :id', {
		id: tournamentId,
	}) as TournamentRow[];

	if (tournamentRows.length === 0) {
		res.status(404).json({ error: 'Tournament not found' });
		return;
	}

	const gameRows = db.query(
		'SELECT id, tournament_id, player1_id, player2_id, result FROM games WHERE tournament_id = :tournament_id',
		{ tournament_id: tournamentId },
	) as GameRow[];

	const games = gameRows.map(rowToGame);
	res.status(200).json(games);
});

/**
 * PUT /tournaments/:id/games/:gameId — record a result for a game.
 */
router.put('/:id/games/:gameId', (req: Request, res: Response) => {
	const tournamentId = req.params.id;
	const gameId = req.params.gameId;
	const body = req.body as RecordResultBody;
	const result = body?.result;

	if (!isValidResult(result)) {
		res.status(400).json({
			error: 'result must be one of: player1, player2, draw',
		});
		return;
	}

	const tournamentRows = db.query('SELECT id FROM tournaments WHERE id = :id', {
		id: tournamentId,
	}) as TournamentRow[];

	if (tournamentRows.length === 0) {
		res.status(404).json({ error: 'Tournament not found' });
		return;
	}

	const gameRows = db.query(
		'SELECT id, tournament_id, player1_id, player2_id, result FROM games WHERE id = :gameId AND tournament_id = :tournament_id',
		{ gameId, tournament_id: tournamentId },
	) as GameRow[];

	if (gameRows.length === 0) {
		res.status(404).json({ error: 'Game not found' });
		return;
	}

	const game = gameRows[0];
	if (game.result !== null) {
		res.status(400).json({
			error: 'Game already has a result',
			currentResult: game.result,
		});
		return;
	}

	db.run('UPDATE games SET result = :result WHERE id = :gameId', {
		result,
		gameId,
	});

	const gamesWithNullResult = db.query(
		'SELECT id FROM games WHERE tournament_id = :tournament_id AND result IS NULL',
		{ tournament_id: tournamentId },
	) as { id: string }[];

	if (gamesWithNullResult.length === 0) {
		db.run('UPDATE tournaments SET status = :status WHERE id = :id', {
			status: 'finished',
			id: tournamentId,
		});
	}

	const updatedRows = db.query(
		'SELECT id, tournament_id, player1_id, player2_id, result FROM games WHERE id = :gameId',
		{ gameId },
	) as GameRow[];

	res.status(200).json(rowToGame(updatedRows[0]));
});

export default router;
