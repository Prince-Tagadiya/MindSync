const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ===== PROMPTS =====
const PROMPTS = [
    { category: "🍎 Food", prompt: "Name a fruit" },
    { category: "🐾 Animals", prompt: "Name a common pet" },
    { category: "🌈 Colors", prompt: "Name a color of the rainbow" },
    { category: "🏠 Home", prompt: "Something you'd find in a kitchen" },
    { category: "🦸 Heroes", prompt: "Name a superhero" },
    { category: "⚽ Sports", prompt: "Name a sport played with a ball" },
    { category: "🎵 Music", prompt: "Name a musical instrument" },
    { category: "👕 Clothing", prompt: "Name an article of clothing" },
    { category: "🌍 Geography", prompt: "Name a continent" },
    { category: "📚 School", prompt: "Name a school subject" },
    { category: "🍕 Dining", prompt: "Name a pizza topping" },
    { category: "🎮 Gaming", prompt: "Name a classic video game" },
    { category: "☀️ Weather", prompt: "Name a type of weather" },
    { category: "🚗 Transport", prompt: "Name a vehicle" },
    { category: "🌊 Ocean", prompt: "Name an ocean creature" },
    { category: "🎂 Party", prompt: "Something at a birthday party" },
    { category: "📱 Tech", prompt: "Name a social media platform" },
    { category: "🌸 Nature", prompt: "Name a type of flower" },
    { category: "🍰 Desserts", prompt: "Name a dessert" },
    { category: "📺 TV", prompt: "Name a TV show genre" },
    { category: "🏢 Jobs", prompt: "Name a profession" },
    { category: "🎨 Art", prompt: "Name a color you'd paint a room" },
    { category: "🌮 World Food", prompt: "Name a cuisine" },
    { category: "🎄 Holidays", prompt: "Name a holiday" },
    { category: "🔧 Tools", prompt: "Name a hand tool" },
    { category: "💎 Precious", prompt: "Name a precious stone" },
    { category: "🌙 Space", prompt: "Name a planet in our solar system" },
    { category: "🎸 Music", prompt: "Name a music genre" },
    { category: "🏖️ Summer", prompt: "Something you bring to the beach" },
    { category: "❄️ Winter", prompt: "Something associated with winter" },
    { category: "🍫 Snacks", prompt: "Name a candy bar" },
    { category: "🎬 Movies", prompt: "Name a movie genre" },
    { category: "🏋️ Fitness", prompt: "Name an exercise" },
    { category: "🧪 Science", prompt: "Name a chemical element" },
    { category: "🎯 Games", prompt: "Name a board game" },
    { category: "🌿 Plants", prompt: "Name a type of tree" },
    { category: "🏰 Fantasy", prompt: "Name a mythical creature" },
    { category: "🍹 Drinks", prompt: "Name a hot beverage" },
    { category: "👟 Brands", prompt: "Name a shoe brand" },
    { category: "🎪 Fun", prompt: "Something at an amusement park" },
    { category: "🐶 Dogs", prompt: "Name a dog breed" },
    { category: "🧁 Baking", prompt: "A baking ingredient" },
    { category: "🎒 Travel", prompt: "Something you pack for a trip" },
    { category: "🎃 Spooky", prompt: "Something associated with Halloween" },
    { category: "🏀 Athletes", prompt: "Name a famous athlete" },
    { category: "📖 Books", prompt: "Name a book genre" },
    { category: "🧊 Cold", prompt: "Something cold" },
    { category: "🔥 Hot", prompt: "Something hot" },
    { category: "🌅 Morning", prompt: "Something you do every morning" },
    { category: "🌙 Night", prompt: "Something you do before bed" },
];

// ===== ROOM MANAGEMENT =====
const rooms = new Map();

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
        code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
    } while (rooms.has(code));
    return code;
}

function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function getRandomPrompts(count) {
    return shuffleArray(PROMPTS).slice(0, Math.min(count, PROMPTS.length));
}

function sanitizeRoom(room) {
    return {
        code: room.code,
        host: room.host,
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            score: p.score,
            avatar: p.avatar,
        })),
        settings: room.settings,
        currentRound: room.currentRound,
        gameState: room.gameState,
        totalRounds: room.settings.rounds,
    };
}

function normalizeWord(word) {
    return word.toLowerCase().trim().replace(/\s+/g, ' ');
}

function calculateScores(submissions, players) {
    const wordGroups = {};
    for (const [playerId, word] of Object.entries(submissions)) {
        if (word === '(no answer)') continue;
        const normalized = normalizeWord(word);
        if (!wordGroups[normalized]) wordGroups[normalized] = [];
        wordGroups[normalized].push(playerId);
    }

    const totalPlayers = players.length;
    const results = {};
    let allMatch = false;

    for (const [word, playerIds] of Object.entries(wordGroups)) {
        if (playerIds.length === totalPlayers) {
            allMatch = true;
            playerIds.forEach(id => { results[id] = 3; });
        } else if (playerIds.length > 1) {
            playerIds.forEach(id => { results[id] = (results[id] || 0) + 1; });
        }
    }

    players.forEach(p => {
        if (!results[p.id]) results[p.id] = 0;
    });

    return { results, allMatch, wordGroups };
}

// ===== SOCKET.IO =====
io.on('connection', (socket) => {
    console.log('⚡ Player connected:', socket.id);

    socket.on('create-room', ({ playerName, settings }) => {
        const code = generateCode();
        const room = {
            code,
            host: socket.id,
            players: [{
                id: socket.id,
                name: playerName,
                score: 0,
                avatar: Math.floor(Math.random() * 8),
            }],
            settings: settings || { rounds: 5, timePerRound: 30 },
            currentRound: 0,
            gameState: 'lobby',
            prompts: [],
            submissions: {},
            timer: null,
        };
        rooms.set(code, room);
        socket.join(code);
        socket.roomCode = code;
        socket.emit('room-created', { code, room: sanitizeRoom(room) });
        console.log(`🏠 Room ${code} created by ${playerName}`);
    });

    socket.on('join-room', ({ code, playerName }) => {
        code = code.toUpperCase().trim();
        const room = rooms.get(code);

        if (!room) {
            socket.emit('error-msg', { message: 'Room not found. Check the code and try again.' });
            return;
        }
        if (room.gameState !== 'lobby') {
            socket.emit('error-msg', { message: 'Game is already in progress.' });
            return;
        }
        if (room.players.length >= 8) {
            socket.emit('error-msg', { message: 'Room is full (max 8 players).' });
            return;
        }
        if (room.players.find(p => p.name.toLowerCase() === playerName.toLowerCase())) {
            socket.emit('error-msg', { message: 'That name is already taken in this room.' });
            return;
        }

        room.players.push({
            id: socket.id,
            name: playerName,
            score: 0,
            avatar: Math.floor(Math.random() * 8),
        });

        socket.join(code);
        socket.roomCode = code;
        socket.emit('room-joined', { code, room: sanitizeRoom(room) });
        socket.to(code).emit('player-update', {
            room: sanitizeRoom(room),
            message: `${playerName} joined the room!`
        });
        console.log(`👤 ${playerName} joined room ${code}`);
    });

    socket.on('update-settings', ({ rounds, timePerRound }) => {
        const room = rooms.get(socket.roomCode);
        if (!room || room.host !== socket.id) return;

        room.settings.rounds = Math.min(Math.max(rounds || room.settings.rounds, 1), 10);
        room.settings.timePerRound = Math.min(Math.max(timePerRound || room.settings.timePerRound, 10), 60);

        io.to(socket.roomCode).emit('settings-updated', {
            settings: room.settings,
            room: sanitizeRoom(room),
        });
    });

    socket.on('start-game', () => {
        const room = rooms.get(socket.roomCode);
        if (!room || room.host !== socket.id) return;
        if (room.players.length < 2) {
            socket.emit('error-msg', { message: 'Need at least 2 players to start!' });
            return;
        }

        room.prompts = getRandomPrompts(room.settings.rounds);
        room.currentRound = 0;
        room.gameState = 'playing';
        room.players.forEach(p => p.score = 0);

        console.log(`🎮 Game started in room ${room.code}`);
        startRound(room);
    });

    socket.on('submit-word', ({ word }) => {
        const room = rooms.get(socket.roomCode);
        if (!room || room.gameState !== 'playing') return;

        const trimmed = word.trim();
        if (!trimmed || room.submissions[socket.id]) return;

        room.submissions[socket.id] = trimmed;

        io.to(socket.roomCode).emit('player-submitted', {
            playerId: socket.id,
            submittedCount: Object.keys(room.submissions).length,
            totalPlayers: room.players.length,
        });

        if (Object.keys(room.submissions).length === room.players.length) {
            endRound(room);
        }
    });

    socket.on('next-round', () => {
        const room = rooms.get(socket.roomCode);
        if (!room || room.host !== socket.id) return;

        if (room.currentRound >= room.prompts.length) {
            room.gameState = 'gameover';
            const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
            io.to(socket.roomCode).emit('game-over', {
                players: sortedPlayers,
                winner: sortedPlayers[0],
            });
        } else {
            startRound(room);
        }
    });

    socket.on('play-again', () => {
        const room = rooms.get(socket.roomCode);
        if (!room || room.host !== socket.id) return;

        room.gameState = 'lobby';
        room.currentRound = 0;
        room.prompts = [];
        room.submissions = {};
        room.players.forEach(p => p.score = 0);

        io.to(socket.roomCode).emit('back-to-lobby', { room: sanitizeRoom(room) });
    });

    socket.on('leave-room', () => {
        leaveRoom(socket);
    });

    socket.on('disconnect', () => {
        console.log('💨 Player disconnected:', socket.id);
        leaveRoom(socket);
    });
});

function startRound(room) {
    room.submissions = {};
    room.gameState = 'playing';
    const prompt = room.prompts[room.currentRound];

    io.to(room.code).emit('round-start', {
        round: room.currentRound + 1,
        totalRounds: room.prompts.length,
        prompt: prompt,
        timePerRound: room.settings.timePerRound,
    });

    let timeLeft = room.settings.timePerRound;

    if (room.timer) clearInterval(room.timer);

    room.timer = setInterval(() => {
        timeLeft--;
        io.to(room.code).emit('timer-tick', { timeLeft });

        if (timeLeft <= 0) {
            endRound(room);
        }
    }, 1000);
}

function endRound(room) {
    if (room.timer) {
        clearInterval(room.timer);
        room.timer = null;
    }

    room.players.forEach(p => {
        if (!room.submissions[p.id]) {
            room.submissions[p.id] = '(no answer)';
        }
    });

    const { results, allMatch } = calculateScores(room.submissions, room.players);

    for (const [playerId, points] of Object.entries(results)) {
        const player = room.players.find(p => p.id === playerId);
        if (player) player.score += points;
    }

    room.currentRound++;
    room.gameState = 'results';

    const submissionsList = room.players.map(p => ({
        id: p.id,
        name: p.name,
        word: room.submissions[p.id],
        points: results[p.id],
        score: p.score,
        avatar: p.avatar,
    }));

    io.to(room.code).emit('round-results', {
        submissions: submissionsList,
        allMatch,
        round: room.currentRound,
        totalRounds: room.prompts.length,
        isLastRound: room.currentRound >= room.prompts.length,
        prompt: room.prompts[room.currentRound - 1],
    });
}

function leaveRoom(socket) {
    const code = socket.roomCode;
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    const playerName = playerIndex >= 0 ? room.players[playerIndex].name : 'Unknown';

    if (playerIndex >= 0) {
        room.players.splice(playerIndex, 1);
    }

    socket.leave(code);
    socket.roomCode = null;

    if (room.players.length === 0) {
        if (room.timer) clearInterval(room.timer);
        rooms.delete(code);
        console.log(`🗑️ Room ${code} deleted (empty)`);
        return;
    }

    if (room.host === socket.id) {
        room.host = room.players[0].id;
    }

    if (room.gameState === 'playing' && room.players.length < 2) {
        if (room.timer) clearInterval(room.timer);
        room.gameState = 'lobby';
        room.currentRound = 0;
        io.to(code).emit('back-to-lobby', {
            room: sanitizeRoom(room),
            message: 'Not enough players. Returning to lobby.',
        });
    } else {
        io.to(code).emit('player-update', {
            room: sanitizeRoom(room),
            message: `${playerName} left the room.`,
        });
    }
}

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🧠 MindSync server running on http://localhost:${PORT}\n`);
});
