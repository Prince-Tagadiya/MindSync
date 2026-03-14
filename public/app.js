const socket = io();

// ===== STATE =====
const STATE = {
    playerName: localStorage.getItem('mindsync_name') || generateRandomName(),
    roomCode: null,
    isHost: false,
    players: [],
    settings: { rounds: 5, timePerRound: 30 },
    currentRound: 0,
    totalRounds: 5,
    myWord: null,
};

// Start by setting the name in UI
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('player-name-input').value = STATE.playerName;
    document.getElementById('nav-player-name').textContent = STATE.playerName;
    app.showScreen('home-screen');
});

// ===== AVATARS =====
const AVATARS = [
    { icon: 'cruelty_free', color: 'bg-pink-500' },
    { icon: 'smart_toy', color: 'bg-blue-500' },
    { icon: 'pets', color: 'bg-orange-500' },
    { icon: 'rocket_launch', color: 'bg-purple-500' },
    { icon: 'sports_esports', color: 'bg-green-500' },
    { icon: 'skateboarding', color: 'bg-teal-500' },
    { icon: 'cookie', color: 'bg-yellow-500' },
    { icon: 'local_pizza', color: 'bg-red-500' },
];

// ===== UTILS =====
function generateRandomName() {
    const adjs = ['Happy', 'Sneaky', 'Fast', 'Clever', 'Brave', 'Wild', 'Cool', 'Lucky'];
    const nouns = ['Fox', 'Panda', 'Tiger', 'Bear', 'Wolf', 'Hawk', 'Shark', 'Lion'];
    const name = `${adjs[Math.floor(Math.random()*adjs.length)]}${nouns[Math.floor(Math.random()*nouns.length)]}${Math.floor(Math.random()*99)}`;
    localStorage.setItem('mindsync_name', name);
    return name;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').textContent = msg;
    toast.classList.remove('translate-x-full');
    setTimeout(() => toast.classList.add('translate-x-full'), 4000);
}

// ===== APP LOGIC =====
const app = {
    showScreen: (screenId) => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
        
        // Hide nav elements initially
        const badge = document.querySelector('.id-room-badge');
        const navName = document.getElementById('nav-player-name');
        
        badge.classList.add('hidden');
        navName.classList.add('hidden');
        
        if (screenId !== 'home-screen') {
            badge.classList.remove('hidden');
            navName.classList.remove('hidden');
            navName.textContent = STATE.playerName;
            document.getElementById('nav-room-code').textContent = STATE.roomCode;
        }
    },
    
    editName: () => {
        const modal = document.getElementById('modal-name');
        document.getElementById('modal-name-input').value = STATE.playerName;
        modal.classList.add('active');
        setTimeout(() => document.getElementById('modal-name-input').focus(), 100);
    },
    
    saveName: () => {
        const input = document.getElementById('modal-name-input').value.trim();
        if (input.length > 0) {
            STATE.playerName = input;
            localStorage.setItem('mindsync_name', STATE.playerName);
            document.getElementById('player-name-input').value = STATE.playerName;
            document.getElementById('nav-player-name').textContent = STATE.playerName;
            document.getElementById('modal-name').classList.remove('active');
        }
    },

    updatePlayerNameFromInput: () => {
        const nameInputEle = document.getElementById('player-name-input');
        if(nameInputEle && nameInputEle.value.trim().length > 0) {
            STATE.playerName = nameInputEle.value.trim();
            localStorage.setItem('mindsync_name', STATE.playerName);
        }
    },
    
    createRoom: () => {
        app.updatePlayerNameFromInput();
        socket.emit('create-room', { playerName: STATE.playerName });
    },
    
    joinRoom: () => {
        app.updatePlayerNameFromInput();
        const code = document.getElementById('room-code-input').value;
        if (!code || code.length < 5) {
            showToast('Enter a valid room code');
            return;
        }
        socket.emit('join-room', { code, playerName: STATE.playerName });
    },
    
    leaveRoom: () => {
        if(confirm("Are you sure you want to leave the room?")) {
            socket.emit('leave-room');
            STATE.roomCode = null;
            app.showScreen('home-screen');
        }
    },
    
    updateSettings: () => {
        if (!STATE.isHost) return;
        const rounds = parseInt(document.getElementById('setting-rounds').value);
        const time = parseInt(document.getElementById('setting-time').value);
        
        document.getElementById('setting-rounds-val').textContent = rounds;
        document.getElementById('setting-time-val').textContent = time;
        
        socket.emit('update-settings', { rounds, timePerRound: time });
    },
    
    copyRoomCode: () => {
        navigator.clipboard.writeText(STATE.roomCode).then(() => {
            const icon = document.getElementById('copy-icon');
            icon.textContent = 'check';
            icon.parentElement.classList.add('bg-secondary-green/20', 'text-secondary-green');
            setTimeout(() => {
                icon.textContent = 'content_copy';
                icon.parentElement.classList.remove('bg-secondary-green/20', 'text-secondary-green');
            }, 2000);
        });
    },
    
    startGame: () => {
        if (!STATE.isHost) return;
        if (STATE.players.length < 2) {
            showToast("Need at least 2 players to start!");
            return;
        }
        socket.emit('start-game');
    },
    
    submitWord: () => {
        const input = document.getElementById('word-input');
        const word = input.value.trim();
        if (!word) return;
        
        STATE.myWord = word;
        socket.emit('submit-word', { word });
        
        // UI updates
        document.getElementById('submission-form').classList.add('hidden');
        document.getElementById('waiting-msg').classList.remove('hidden');
    },
    
    nextRound: () => {
        if (STATE.isHost) socket.emit('next-round');
    },
    
    playAgain: () => {
        if (STATE.isHost) socket.emit('play-again');
    },
    
    // UI Renderers
    renderLobby: () => {
        const container = document.getElementById('lobby-players');
        container.innerHTML = '';
        
        STATE.players.forEach(p => {
            const avatar = AVATARS[p.avatar % AVATARS.length];
            const isMe = p.id === socket.id;
            const isHostStr = p.id === STATE.host ? '<span class="material-symbols-outlined text-yellow-400 absolute -top-2 -right-2 bg-slate-900 rounded-full text-lg shadow-lg border border-slate-700 p-0.5">crown</span>' : '';
            
            container.innerHTML += `
                <div class="bg-black/40 border ${isMe ? 'border-primary shadow-[0_0_15px_-3px_rgba(236,91,19,0.3)]' : 'border-white/10'} rounded-2xl p-4 flex flex-col items-center gap-3 relative animate-fade-in-up">
                    ${isHostStr}
                    <div class="size-16 rounded-full ${avatar.color} flex items-center justify-center shadow-lg transform transition-transform hover:scale-110">
                        <span class="material-symbols-outlined text-white text-3xl">${avatar.icon}</span>
                    </div>
                    <span class="text-white font-bold text-lg truncate w-full text-center ${isMe ? 'text-primary' : ''}">${p.name}</span>
                </div>
            `;
        });
        
        document.getElementById('lobby-player-count').textContent = `(${STATE.players.length}/8)`;
        
        // Host controls
        const btnStart = document.getElementById('btn-start-game');
        const btnBg = btnStart.querySelector('.btn-start-bg');
        const btnSpan = btnStart.querySelector('span');
        const hostWarning = document.getElementById('host-warning');
        
        const settingsEls = document.querySelectorAll('.host-only-settings');
        
        if (STATE.isHost) {
            settingsEls.forEach(el => {
                el.classList.remove('opacity-50', 'pointer-events-none');
            });
            hostWarning.classList.add('hidden');
            
            if (STATE.players.length >= 2) {
                btnStart.classList.remove('cursor-not-allowed', 'opacity-50');
                btnStart.classList.add('hover:shadow-[0_0_30px_-5px_rgba(236,91,19,0.6)]');
                btnBg.classList.replace('bg-slate-600', 'bg-primary');
                btnSpan.innerHTML = 'Start Game <span class="material-symbols-outlined">play_circle</span>';
            } else {
                btnStart.classList.add('cursor-not-allowed', 'opacity-50');
                btnStart.classList.remove('hover:shadow-[0_0_30px_-5px_rgba(236,91,19,0.6)]');
                btnBg.classList.replace('bg-primary', 'bg-slate-600');
                btnSpan.innerHTML = 'Waiting for players...';
            }
        } else {
            settingsEls.forEach(el => {
                el.classList.add('opacity-50', 'pointer-events-none');
            });
            hostWarning.classList.remove('hidden');
            btnStart.classList.add('hidden');
        }
    },
    
    renderSubmissionStatus: (submittedCount, totalCount) => {
        const container = document.getElementById('submission-status');
        container.innerHTML = '';
        for (let i = 0; i < totalCount; i++) {
            if (i < submittedCount) {
                container.innerHTML += `<div class="w-12 h-3 rounded-full bg-secondary-green shadow-[0_0_10px_rgba(34,197,94,0.5)] transition-all"></div>`;
            } else {
                container.innerHTML += `<div class="w-12 h-3 rounded-full bg-slate-700 transition-all"></div>`;
            }
        }
    },

    renderResults: (data) => {
        const cardsCont = document.getElementById('result-cards');
        const leadCont = document.getElementById('results-leaderboard');
        
        cardsCont.innerHTML = '';
        leadCont.innerHTML = '';
        
        // Update Titles
        const title = document.getElementById('result-title');
        const sub = document.getElementById('result-subtitle');
        const prompt = document.getElementById('result-prompt');
        
        prompt.textContent = `"${data.prompt.prompt}"`;
        
        if (data.allMatch) {
            title.innerHTML = 'Mind<span class="text-primary glow-text ml-2">Sync!</span>';
            title.className = 'text-5xl md:text-7xl font-black mb-2 animate-bounce-subtle';
            sub.textContent = 'Incredible! Everyone guessed the exact same word! (+3 pts)';
            sub.className = 'text-xl font-bold bg-gradient-to-r from-yellow-400 to-primary text-transparent bg-clip-text';
            
            // Confetti effect (simple DOM based)
            app.createConfetti();
        } else if (data.submissions.length > 2) {
            // Check if there are partial matches
            const pointsGiven = data.submissions.some(s => s.points > 0);
            if(pointsGiven) {
                title.textContent = 'Great Minds...';
                title.className = 'text-4xl md:text-6xl font-black text-white mb-2';
                sub.textContent = 'Some players synced up! (+1 pt for matches)';
                sub.className = 'text-xl text-secondary-green font-medium';
            } else {
                title.textContent = 'Total Miss!';
                title.className = 'text-4xl md:text-6xl font-black text-slate-400 mb-2';
                sub.textContent = 'Nobody guessed the same word. Better luck next round.';
                sub.className = 'text-xl text-slate-500 font-medium';
            }
        } else {
            // 2 players and no match
            title.textContent = 'Not Quite...';
            title.className = 'text-4xl md:text-6xl font-black text-slate-400 mb-2';
            sub.textContent = 'Different wavelengths this time.';
            sub.className = 'text-xl text-slate-500 font-medium';
        }
        
        // Render answer cards
        // Group by normalized word to show matches together visually
        const grouped = {};
        data.submissions.forEach(sub => {
            const norm = sub.word === '(no answer)' ? sub.id : sub.word.toLowerCase().replace(/\s+/g,'');
            if(!grouped[norm]) grouped[norm] = [];
            grouped[norm].push(sub);
        });
        
        Object.values(grouped).forEach(group => {
            const isMatch = group.length > 1 && group[0].word !== '(no answer)';
            const borderClass = isMatch ? (data.allMatch ? 'border-primary shadow-[0_0_20px_rgba(236,91,19,0.3)]' : 'border-secondary-green shadow-[0_0_15px_rgba(34,197,94,0.2)]') : 'border-white/10';
            const bgClass = isMatch ? 'bg-white/10' : 'bg-black/40';
            const wordColor = isMatch ? (data.allMatch ? 'text-primary' : 'text-secondary-green') : 'text-white';
            const wordText = group[0].word === '(no answer)' ? '<span class="text-slate-500 italic text-xl p-2">Time Ran Out</span>' : group[0].word.toUpperCase();
            
            let playersHtml = '';
            group.forEach(player => {
                const avatar = AVATARS[player.avatar % AVATARS.length];
                playersHtml += `
                    <div class="flex items-center gap-2 bg-black/50 rounded-full pr-4 p-1 border border-white/5">
                        <div class="size-8 rounded-full ${avatar.color} flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-white text-sm">${avatar.icon}</span>
                        </div>
                        <span class="text-slate-200 text-sm font-bold truncate">${player.name}</span>
                        ${player.points > 0 ? `<span class="text-xs font-black text-yellow-400 ml-auto">+${player.points}</span>` : ''}
                    </div>
                `;
            });
            
            cardsCont.innerHTML += `
                <div class="${bgClass} border-2 ${borderClass} rounded-2xl p-6 flex flex-col gap-4 transform transition-all hover:scale-105">
                    <div class="text-center w-full min-h-[60px] flex items-center justify-center">
                        <span class="font-black text-2xl md:text-3xl tracking-wider ${wordColor} break-words line-clamp-2">${wordText}</span>
                    </div>
                    <div class="w-full h-px bg-white/10 my-2"></div>
                    <div class="flex flex-col gap-2">
                        ${playersHtml}
                    </div>
                </div>
            `;
        });
        
        // Render Leaderboard
        const sorted = [...data.submissions].sort((a,b) => b.score - a.score);
        sorted.forEach((p, i) => {
            const isMe = p.id === socket.id;
            const rankIcon = i===0 ? '🥇' : i===1 ? '🥈' : i===2 ? '🥉' : `${i+1}.`;
            leadCont.innerHTML += `
                <div class="flex justify-between items-center p-3 rounded-xl ${isMe ? 'bg-primary/20 border border-primary/50' : 'bg-white/5 border border-transparent'}">
                    <div class="flex items-center gap-4">
                        <span class="text-xl font-bold w-6 text-center">${rankIcon}</span>
                        <span class="text-white font-bold text-lg">${p.name} ${isMe ? '<span class="text-primary text-xs ml-1">(You)</span>' : ''}</span>
                    </div>
                    <div class="text-2xl font-black ${i===0 ? 'text-yellow-400' : 'text-slate-300'}">${p.score} <span class="text-sm text-slate-500 font-medium">pts</span></div>
                </div>
            `;
        });
        
        // Controls
        const hOnly = document.querySelectorAll('.host-only-controls');
        const nonHMsg = document.querySelectorAll('.non-host-message');
        
        if (STATE.isHost) {
            hOnly.forEach(el => el.classList.remove('hidden'));
            nonHMsg.forEach(el => el.classList.add('hidden'));
            
            if (data.isLastRound) {
                document.getElementById('btn-next-round').classList.add('hidden');
                document.getElementById('btn-play-again').classList.remove('hidden');
            } else {
                document.getElementById('btn-next-round').classList.remove('hidden');
                document.getElementById('btn-play-again').classList.add('hidden');
            }
        } else {
            hOnly.forEach(el => el.classList.add('hidden'));
            nonHMsg.forEach(el => el.classList.remove('hidden'));
        }
    },
    
    createConfetti: () => {
        const colors = ['#ec5b13', '#22c55e', '#fbbf24', '#a855f7', '#3b82f6'];
        for(let i=0; i<50; i++) {
            const conf = document.createElement('div');
            conf.className = 'fixed w-3 h-3 z-50 rounded-sm';
            conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            conf.style.left = Math.random() * 100 + 'vw';
            conf.style.top = '-10px';
            conf.style.opacity = Math.random() + 0.5;
            conf.style.transform = `rotate(${Math.random() * 360}deg)`;
            conf.style.transition = `all ${Math.random() * 2 + 1}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
            document.body.appendChild(conf);
            
            setTimeout(() => {
                conf.style.top = '100vw';
                conf.style.transform = `rotate(${Math.random() * 720}deg) translateX(${Math.random() * 200 - 100}px)`;
            }, 50);
            
            setTimeout(() => conf.remove(), 3000);
        }
    }
};

// ===== SOCKET EVENTS =====
socket.on('error-msg', ({ message }) => {
    showToast(message);
});

socket.on('room-created', ({ code, room }) => {
    STATE.roomCode = code;
    STATE.isHost = true;
    STATE.host = room.host;
    STATE.players = room.players;
    STATE.settings = room.settings;
    
    // UI Updates
    document.getElementById('lobby-code-display').textContent = code;
    document.getElementById('setting-rounds').value = room.settings.rounds;
    document.getElementById('setting-rounds-val').textContent = room.settings.rounds;
    document.getElementById('setting-time').value = room.settings.timePerRound;
    document.getElementById('setting-time-val').textContent = room.settings.timePerRound;
    
    app.renderLobby();
    app.showScreen('lobby-screen');
});

socket.on('room-joined', ({ code, room }) => {
    STATE.roomCode = code;
    STATE.isHost = false;
    STATE.host = room.host;
    STATE.players = room.players;
    STATE.settings = room.settings;
    
    document.getElementById('lobby-code-display').textContent = code;
    document.getElementById('setting-rounds-val').textContent = room.settings.rounds;
    document.getElementById('setting-time-val').textContent = room.settings.timePerRound;
    
    app.renderLobby();
    app.showScreen('lobby-screen');
});

socket.on('player-update', ({ room, message }) => {
    STATE.players = room.players;
    STATE.host = room.host;
    STATE.isHost = socket.id === room.host;
    
    app.renderLobby();
});

socket.on('settings-updated', ({ settings, room }) => {
    STATE.settings = settings;
    document.getElementById('setting-rounds-val').textContent = settings.rounds;
    document.getElementById('setting-time-val').textContent = settings.timePerRound;
});

socket.on('round-start', (data) => {
    STATE.myWord = null;
    
    // Reset game screen
    document.getElementById('submission-form').classList.remove('hidden');
    document.getElementById('waiting-msg').classList.add('hidden');
    const input = document.getElementById('word-input');
    input.value = '';
    
    // Set text
    document.getElementById('game-category').textContent = data.prompt.category;
    document.getElementById('game-round-current').textContent = data.round;
    document.getElementById('game-round-total').textContent = data.totalRounds;
    document.getElementById('game-prompt').textContent = data.prompt.prompt;
    document.getElementById('game-timer').textContent = data.timePerRound;
    
    // Reset timer circle
    const circle = document.getElementById('timer-circle');
    circle.style.transition = 'none';
    circle.style.strokeDashoffset = '0';
    circle.style.stroke = '#22c55e'; // Green start
    
    setTimeout(() => { circle.style.transition = 'all 1s linear'; }, 50);
    
    app.renderSubmissionStatus(0, STATE.players.length);
    app.showScreen('game-screen');
    
    setTimeout(() => input.focus(), 500);
});

socket.on('timer-tick', ({ timeLeft }) => {
    const timeEl = document.getElementById('game-timer');
    const circle = document.getElementById('timer-circle');
    
    timeEl.textContent = timeLeft;
    
    // Calculate dashboard offset (max 226)
    const maxOffset = 226;
    const progress = 1 - (timeLeft / STATE.settings.timePerRound);
    circle.style.strokeDashoffset = progress * maxOffset;
    
    // Color change based on time
    if (timeLeft <= 5) {
        timeEl.classList.add('text-red-500', 'animate-bounce');
        circle.style.stroke = '#ef4444'; // Red
    } else if (timeLeft <= 10) {
        timeEl.classList.add('text-yellow-400');
        timeEl.classList.remove('text-red-500', 'animate-bounce');
        circle.style.stroke = '#eab308'; // Yellow
    } else {
        timeEl.classList.remove('text-red-500', 'text-yellow-400', 'animate-bounce');
        circle.style.stroke = '#22c55e'; // Green
    }
});

socket.on('player-submitted', ({ playerId, submittedCount, totalPlayers }) => {
    if (document.getElementById('game-screen').classList.contains('active')) {
        app.renderSubmissionStatus(submittedCount, totalPlayers);
    }
});

socket.on('round-results', (data) => {
    app.renderResults(data);
    app.showScreen('results-screen');
});

socket.on('game-over', (data) => {
    document.getElementById('result-title').textContent = 'Game Over!';
    document.getElementById('result-title').className = 'text-5xl md:text-7xl font-black text-white mb-2';
    
    document.getElementById('result-subtitle').innerHTML = `<span class="text-yellow-400 font-bold text-2xl">🏆 ${data.winner.name} Wins!</span>`;
    
    document.getElementById('result-prompt').textContent = 'Final Standings';
    document.getElementById('result-cards').innerHTML = ''; // Hide prompt cards
    
    // Display buttons
    if (STATE.isHost) {
        document.getElementById('btn-next-round').classList.add('hidden');
        document.getElementById('btn-play-again').classList.remove('hidden');
    }
});

socket.on('back-to-lobby', ({ room }) => {
    STATE.players = room.players;
    STATE.host = room.host;
    STATE.settings = room.settings;
    STATE.currentRound = room.currentRound;
    
    app.renderLobby();
    app.showScreen('lobby-screen');
});
