import express, { Express } from 'express';
import dotenv from 'dotenv';
import tournamentsRouter from './routes/tournaments';
import playersRouter from './routes/players';
import gamesRouter from './routes/games';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use('/tournaments', tournamentsRouter);
app.use('/tournaments', playersRouter);
app.use('/tournaments', gamesRouter);

app.get('/health', (req, res) => {
	res.status(200).json({
		status: 'ok',
		timestamp: new Date().toISOString(),
	});
});

app.listen(port, () => {
	console.log(`[server]: Server is running at http://localhost:${port}`);
});
