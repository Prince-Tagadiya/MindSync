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
    history: [],
    submittedPlayers: new Set()
};

// Start by setting the name in UI
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('player-name-input').value = STATE.playerName;
    document.getElementById('nav-player-name').textContent = STATE.playerName;
    app.showScreen('home-screen');
});

// ===== AVATARS =====
const AVATARS = [
    { seedSuffix: "a", color: 'from-orange-400 to-primary' },
    { seedSuffix: "b", color: 'from-purple-400 to-indigo-500' },
    { seedSuffix: "c", color: 'from-yellow-300 to-orange-500' },
    { seedSuffix: "d", color: 'from-teal-300 to-emerald-500' },
    { seedSuffix: "e", color: 'from-pink-400 to-rose-500' },
    { seedSuffix: "f", color: 'from-blue-400 to-cyan-500' },
    { seedSuffix: "g", color: 'from-green-400 to-emerald-500' },
    { seedSuffix: "h", color: 'from-red-400 to-rose-600' },
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
        
        const globalHeader = document.getElementById('global-header');
        const globalFooter = document.getElementById('global-footer');
        
        if(badge && navName) {
            badge.classList.add('hidden');
            navName.classList.add('hidden');
        }
        
        if (screenId === 'game-screen') {
            if(globalHeader) globalHeader.classList.add('hidden');
            if(globalFooter) globalFooter.classList.add('hidden');
            document.querySelectorAll('.screen-only-bg').forEach(bg => {
                bg.classList.remove('opacity-0');
                bg.classList.add('opacity-100');
            });
            document.getElementById('status-room-code').textContent = '#' + STATE.roomCode;
        } else {
            if(globalHeader) globalHeader.classList.remove('hidden');
            if(globalFooter) globalFooter.classList.remove('hidden');
            document.querySelectorAll('.screen-only-bg').forEach(bg => {
                bg.classList.remove('opacity-100');
                bg.classList.add('opacity-0');
            });
            
            if (screenId !== 'home-screen' && badge && navName) {
                badge.classList.remove('hidden');
                navName.classList.remove('hidden');
                navName.textContent = STATE.playerName;
                const roomCodeEl = document.getElementById('nav-room-code');
                if(roomCodeEl) roomCodeEl.textContent = STATE.roomCode;
            }
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
        // Legacy wrapper
        app.showCreateRoomModal();
    },
    
    showCreateRoomModal: () => {
        app.updatePlayerNameFromInput();
        document.getElementById('modal-create-room').classList.add('active');
    },

    confirmCreateRoom: () => {
        const rounds = 5; // hardcoded since removed from UI
        const time = parseInt(document.getElementById('create-setting-time').value) || 30;
        const players = parseInt(document.querySelector('input[name="create-setting-players"]:checked')?.value) || 6;
        const mode = document.querySelector('input[name="create-mode"]:checked')?.value || 'normal';
        const preventRepeat = document.getElementById('create-setting-prevent-repeat')?.checked || false;
        const hideGuesses = document.getElementById('create-setting-hide-guesses')?.checked || false;
        const showHistory = document.getElementById('create-setting-show-history')?.checked || false;
        const countdown = document.getElementById('create-setting-countdown')?.checked || false;
        const tts = document.getElementById('create-setting-tts')?.checked || false;
        const confetti = document.getElementById('create-setting-confetti')?.checked || false;
        const effects = document.getElementById('create-setting-effects')?.checked || false;

        const settings = {
            rounds,
            timePerRound: time,
            maxPlayers: players,
            mode,
            preventRepeat,
            hideGuesses,
            showHistory,
            countdown,
            tts,
            confetti,
            effects
        };

        socket.emit('create-room', { playerName: STATE.playerName, settings });
        document.getElementById('modal-create-room').classList.remove('active');
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
    
    clearError: () => {
        const input = document.getElementById('word-input');
        const container = document.getElementById('word-input-container');
        const icon = document.getElementById('word-error-icon');
        const msg = document.getElementById('word-error-msg');
        
        if(!input || !container) return;
        
        input.classList.remove('border-red-500/50', 'text-red-100');
        input.classList.add('border-white/10');
        container.classList.remove('animate-shake');
        icon.classList.add('hidden');
        msg.classList.remove('flex');
        msg.classList.add('hidden');
        
        // Reset indicators
        ['status-short', 'status-empty', 'status-used'].forEach(id => {
            const el = document.getElementById(id);
            if(el) {
               el.className = 'bg-white/5 border border-white/10 p-3 md:p-4 rounded-2xl flex flex-col items-center opacity-40 transition-all';
               const iconEl = el.querySelector('span:nth-child(1)');
               const textEl = el.querySelector('span:nth-child(2)');
               if(iconEl) iconEl.className = 'material-symbols-outlined text-slate-400 mb-1';
               if(textEl) textEl.className = 'text-[9px] md:text-[10px] uppercase font-black tracking-widest text-slate-500 text-center';
            }
        });
    },

    showErrorPhase: (type, text) => {
        app.clearError();
        
        const input = document.getElementById('word-input');
        const container = document.getElementById('word-input-container');
        const icon = document.getElementById('word-error-icon');
        const msg = document.getElementById('word-error-msg');
        const textEl = document.getElementById('word-error-text');
        
        if(!input || !container) return;

        // Trigger animation
        void container.offsetWidth; // reset animation
        container.classList.add('animate-shake');
        input.classList.remove('border-white/10', 'focus:border-primary/40');
        input.classList.add('border-red-500/50', 'text-red-100');
        icon.classList.remove('hidden');
        
        textEl.textContent = text;
        msg.classList.remove('hidden');
        msg.classList.add('flex');
        
        // Highlight indicator
        const targetId = type === 'empty' ? 'status-empty' : (type === 'short' ? 'status-short' : 'status-used');
        const el = document.getElementById(targetId);
        if(el) {
            el.className = 'bg-primary/20 border border-primary/40 p-3 md:p-4 rounded-2xl flex flex-col items-center shadow-lg shadow-primary/5 transition-all';
            const iconEl = el.querySelector('span:nth-child(1)');
            const statusTextEl = el.querySelector('span:nth-child(2)');
            if(iconEl) iconEl.className = 'material-symbols-outlined text-primary mb-1';
            if(statusTextEl) statusTextEl.className = 'text-[9px] md:text-[10px] uppercase font-black tracking-widest text-primary text-center';
        }
    },

    submitWord: () => {
        const input = document.getElementById('word-input');
        const word = input.value.trim();
        
        if (!word) {
            app.showErrorPhase('empty', 'Input is empty. Please enter a word.');
            return;
        }
        
        if (word.length < 2) {
            app.showErrorPhase('short', 'Word is too short. minimum 2 characters.');
            return;
        }
        
        let alreadyUsed = false;
        STATE.history.forEach(round => {
            const mySub = round.submissions.find(s => s.id === socket.id);
            if (mySub && mySub.word.toLowerCase() === word.toLowerCase()) {
                alreadyUsed = true;
            }
        });
        
        if (alreadyUsed) {
            app.showErrorPhase('used', 'Word already used in a previous round.');
            return;
        }
        
        app.clearError();
        
        STATE.myWord = word;
        socket.emit('submit-word', { word });
        
        // UI updates
        input.setAttribute('disabled', 'true');
        input.classList.add('opacity-50', 'cursor-not-allowed');
        document.getElementById('submit-section').classList.add('hidden');
        document.getElementById('waiting-msg').classList.remove('hidden');
        
        // Mark myself as submitted if not already handled
        STATE.submittedPlayers.add(socket.id);
        app.renderSubmissionStatus();
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
        
        STATE.players.forEach((p, index) => {
            const avatar = AVATARS[p.avatar % AVATARS.length];
            const isMe = p.id === socket.id;
            const isHost = p.id === STATE.host;
            const staggerDelay = (index % 4) * 0.1;
            const seed = encodeURIComponent(p.name + avatar.seedSuffix);
            const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=transparent`;
            
            const hostIcon = isHost ? '<span class="material-symbols-outlined text-yellow-400 absolute -top-4 -right-4 bg-slate-900 rounded-full text-lg shadow-lg border border-slate-700 p-1 z-10">crown</span>' : '';
            const statusIcon = p.id ? 'check' : 'more_horiz';
            const statusColor = p.id ? 'bg-green-500' : 'bg-slate-500';
            const statusText = p.id ? 'Ready' : 'Waiting';
            const statusTextColor = p.id ? 'text-green-400' : 'text-slate-400';
            
            container.innerHTML += `
                <div class="flex flex-col items-center gap-4 group animate-entrance" style="animation-delay: ${staggerDelay}s">
                    <div class="relative w-24 h-24">
                        ${hostIcon}
                        <div class="w-full h-full rounded-full bg-gradient-to-tr ${avatar.color} p-1 shadow-lg group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300 animate-avatarIdle" style="animation-delay: ${staggerDelay}s">
                            <img class="w-full h-full rounded-full bg-slate-800 object-cover" src="${avatarUrl}" alt="Avatar">
                        </div>
                        <div class="absolute bottom-1 right-1 ${statusColor} w-6 h-6 rounded-full border-4 border-slate-900 flex items-center justify-center">
                            <span class="material-symbols-outlined text-[12px] text-white font-bold">${statusIcon}</span>
                        </div>
                    </div>
                    <div class="text-center w-full overflow-hidden">
                        <p class="text-white font-bold text-lg truncate w-full ${isMe ? 'text-primary' : ''}">${p.name}</p>
                        <p class="${statusTextColor} text-xs font-bold uppercase tracking-tighter">${statusText}</p>
                    </div>
                </div>
            `;
        });

        // Fill remaining slots
        for(let i = STATE.players.length; i < 8; i++) {
            const isMobileHidden = i >= 4 ? 'hidden md:flex' : 'flex';
            container.innerHTML += `
                <div class="${isMobileHidden} border-2 border-dashed border-white/10 rounded-full w-24 h-24 mx-auto items-center justify-center group cursor-pointer hover:border-primary/50 transition-colors animate-pulseSlow mt-0">
                    <span class="material-symbols-outlined text-white/20 group-hover:text-primary transition-colors">person_add</span>
                </div>
            `;
        }
        
        document.getElementById('lobby-player-count').textContent = `${STATE.players.length} / 8`;
        
        // Host controls
        const btnStart = document.getElementById('btn-start-game');
        const btnIcon = btnStart.querySelector('.btn-icon');
        const btnText = btnStart.querySelector('.btn-text');
        const hostWarning = document.getElementById('host-warning');
        
        const settingsEls = document.querySelectorAll('.host-only-settings');
        
        if (STATE.isHost) {
            settingsEls.forEach(el => {
                el.classList.remove('hidden');
            });
            hostWarning.classList.add('hidden');
            
            btnStart.classList.remove('hidden');
            if (STATE.players.length >= 2) {
                btnStart.disabled = false;
                btnIcon.textContent = 'play_arrow';
                btnText.textContent = 'START GAME';
            } else {
                btnStart.disabled = true;
                btnIcon.textContent = 'hourglass_empty';
                btnText.textContent = 'WAITING FOR PLAYERS';
            }
        } else {
            settingsEls.forEach(el => {
                el.classList.add('hidden');
            });
            hostWarning.classList.remove('hidden');
            btnStart.classList.add('hidden');
        }
    },
    
    renderSubmissionStatus: () => {
        const readyEl = document.getElementById('players-ready-count');
        if (readyEl) {
            readyEl.textContent = `${STATE.submittedPlayers.size}/${STATE.players.length}`;
        }
        
        // Let renderRoundHistory handle updating the sidebar
        app.renderRoundHistory();
    },
    
    renderRoundHistory: () => {
        const historyContainer = document.getElementById('round-history-list');
        if(!historyContainer) return;
        
        let html = '';
        
        // 1. Render past history rounds
        STATE.history.forEach(round => {
            // Collect unique words
            const uniqueWords = new Set();
            round.submissions.forEach(s => {
                if (s.word !== '(no answer)') {
                    uniqueWords.add(s.word);
                }
            });
            
            let wordsHtml = '';
            Array.from(uniqueWords).forEach(w => {
                wordsHtml += `<span class="px-5 py-2.5 bg-white/5 text-slate-300 rounded-full border border-white/10 text-xs font-black uppercase tracking-tight">${w}</span>`;
            });
            if (uniqueWords.size === 0) {
                wordsHtml += `<span class="px-5 py-2.5 bg-white/5 text-slate-500 rounded-full border border-white/10 text-xs font-black uppercase tracking-tight italic">No answers</span>`;
            }
            
            html += `
            <div class="space-y-4` + (STATE.history.indexOf(round) === 0 ? '' : ' mt-6') + `">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Round ${String(round.round).padStart(2,'0')}</span>
                    <div class="h-px bg-white/10 flex-1 ml-4"></div>
                </div>
                <div class="flex flex-wrap gap-2">
                    ${wordsHtml}
                </div>
            </div>`;
        });
        
        // 2. Render current round
        let currentPlayersHtml = '';
        STATE.players.forEach(p => {
            const hasSubmitted = STATE.submittedPlayers.has(p.id);
            const avatar = AVATARS[p.avatar % AVATARS.length];
            const seed = encodeURIComponent(p.name + avatar.seedSuffix);
            const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=transparent`;
            const isMe = p.id === socket.id;
            
            if (hasSubmitted) {
                const displayWord = isMe && STATE.myWord ? STATE.myWord : 'Ready';
                currentPlayersHtml += `
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full border-2 border-primary shadow-lg overflow-hidden shrink-0">
                        <img alt="User avatar" class="w-full h-full object-cover" src="${avatarUrl}"/>
                    </div>
                    <div class="flex-1 bg-primary/10 p-4 rounded-2xl border border-primary/20 text-white font-black text-sm flex items-center justify-between overflow-hidden">
                        <span class="uppercase tracking-wide truncate">${displayWord}</span>
                        <span class="material-symbols-outlined text-primary text-xl shrink-0">check_circle</span>
                    </div>
                </div>`;
            } else {
                currentPlayersHtml += `
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full border-2 border-white/20 overflow-hidden shrink-0">
                        <img alt="User avatar" class="w-full h-full object-cover grayscale opacity-50" src="${avatarUrl}"/>
                    </div>
                    <div class="flex-1 bg-white/5 p-4 rounded-2xl border border-white/5 italic text-slate-500 text-sm font-medium truncate">
                        Waiting for ${p.name}...
                    </div>
                </div>`;
            }
        });
        
        html += `
        <div class="space-y-4 lg:mt-6 mt-4 pb-4">
            <div class="flex items-center justify-between">
                <span class="text-[10px] font-black text-primary uppercase tracking-widest">Round ${String(STATE.currentRound || 1).padStart(2,'0')} (Current)</span>
                <div class="h-px bg-primary/20 flex-1 ml-4"></div>
            </div>
            <div class="flex flex-col gap-3">
                ${currentPlayersHtml}
            </div>
        </div>`;
        
        historyContainer.innerHTML = html;
        
        setTimeout(() => {
            historyContainer.scrollTop = historyContainer.scrollHeight;
        }, 50);
    },

    renderResults: (data) => {
        const title = document.getElementById('result-title');
        const sub = document.getElementById('result-subtitle');
        const cardsCont = document.getElementById('result-cards');
        const syncText = document.getElementById('result-sync-text');
        const syncBar = document.getElementById('result-sync-bar');
        
        cardsCont.innerHTML = '';
        
        // Hide confetti on new render
        const canvas = document.getElementById('confetti-canvas');
        if (canvas) {
            canvas.style.display = 'none';
            if (app.confettiAnimationId) cancelAnimationFrame(app.confettiAnimationId);
        }
        
        const bgShapes = document.getElementById('results-bg-shapes');
        if (bgShapes) bgShapes.classList.remove('hidden');

        const controls = document.getElementById('result-footer-controls');
        if (controls) controls.classList.remove('hidden');
        
        const syncTextContainer = document.getElementById('result-sync-text')?.parentElement;
        if (syncTextContainer) syncTextContainer.classList.remove('hidden');
        
        const counts = {};
        data.submissions.forEach(s => {
            if (s.word !== '(no answer)') {
                const norm = s.word.toLowerCase();
                counts[norm] = (counts[norm] || 0) + 1;
            }
        });
        const maxMatches = Math.max(0, ...Object.values(counts));
        
        if (syncText && syncBar) {
            syncText.textContent = `${maxMatches} players synced!`;
            const syncPercent = data.submissions.length > 0 ? (maxMatches / data.submissions.length) * 100 : 0;
            syncBar.style.width = `${syncPercent}%`;
        }

        if (data.allMatch) {
            title.innerHTML = `Mind<span class="text-yellow-400">Sync</span>`;
            sub.textContent = 'Results Revealed! Perfect Harmony!';
            sub.className = 'text-lg text-yellow-400 font-black uppercase tracking-widest';
            app.createConfetti();
        } else if (maxMatches > 1) {
            title.innerHTML = `Mind<span class="text-blue-400">Sync</span>`;
            sub.textContent = 'Results Revealed! Partial Sync!';
            sub.className = 'text-lg text-blue-200 font-medium uppercase tracking-widest';
        } else {
            title.innerHTML = `Mind<span class="text-red-400">Sync</span>`;
            sub.textContent = 'Results Revealed! Total Miss!';
            sub.className = 'text-lg text-red-200 font-medium uppercase tracking-widest';
        }

        data.submissions.forEach((p, index) => {
            const pInfo = STATE.players.find(x => x.id === p.id);
            const avatar = AVATARS[(pInfo ? pInfo.avatar : 0) % AVATARS.length];
            const seed = encodeURIComponent(p.name + avatar.seedSuffix);
            const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=transparent`;
            
            let isMatch = false;
            if (p.word !== '(no answer)' && counts[p.word.toLowerCase()] > 1) {
                isMatch = true;
            }
            const wordClass = isMatch ? 'matching-word' : 'text-white';
            const staggerDelay = (index % 4) + 1;
            
            const sanitizedWord = p.word === '(no answer)' ? '' : p.word.replace(/'/g, "\\'");
            
            cardsCont.innerHTML += `
                <div class="player-card stagger-${staggerDelay} bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl flex flex-col items-center">
                    <div class="w-24 h-24 rounded-full bg-gradient-to-tr ${avatar.color} mb-4 border-4 border-white/30 flex items-center justify-center overflow-hidden">
                        <img alt="${p.name} Avatar" class="w-full h-full object-cover" src="${avatarUrl}"/>
                    </div>
                    <h2 class="text-xl font-bold text-white mb-1">${p.name}</h2>
                    <div class="flex items-center gap-2 mt-4 bg-black/20 px-4 py-3 rounded-2xl w-full justify-center">
                        <span class="text-2xl font-black ${wordClass} truncate max-w-full">${p.word === '(no answer)' ? 'TIMEOUT' : p.word}</span>
                        <button onclick="app.playWordTTS('${sanitizedWord}', this)" aria-label="Listen to word" class="text-white/60 hover:text-white transition-colors" title="Listen">
                            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        });
        
        const hOnly = document.querySelectorAll('.host-only-controls');
        const nonHMsg = document.querySelectorAll('.non-host-message');
        
        if (STATE.isHost) {
            hOnly.forEach(el => el.classList.remove('hidden'));
            hOnly.forEach(el => el.classList.add('flex'));
            nonHMsg.forEach(el => el.classList.add('hidden'));
            
            if (data.isLastRound) {
                document.getElementById('btn-next-round').classList.add('hidden');
                document.getElementById('btn-next-round').classList.remove('flex');
                document.getElementById('btn-play-again').classList.remove('hidden');
                document.getElementById('btn-play-again').classList.add('flex');
            } else {
                document.getElementById('btn-next-round').classList.remove('hidden');
                document.getElementById('btn-next-round').classList.add('flex');
                document.getElementById('btn-play-again').classList.add('hidden');
                document.getElementById('btn-play-again').classList.remove('flex');
            }
        } else {
            hOnly.forEach(el => el.classList.add('hidden'));
            hOnly.forEach(el => el.classList.remove('flex'));
            nonHMsg.forEach(el => el.classList.remove('hidden'));
        }
    },
    
    playWordTTS: (word, btn) => {
        if (!word) return;
        const msg = new SpeechSynthesisUtterance(word);
        window.speechSynthesis.speak(msg);
        
        if (btn) {
            btn.classList.add('scale-125', 'text-yellow-400');
            setTimeout(() => {
                btn.classList.remove('scale-125', 'text-yellow-400');
            }, 500);
        }
    },
    
    createConfetti: () => {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;
        canvas.style.display = 'block';
        const ctx = canvas.getContext('2d');
        let particles = [];
        const colors = ['#ec5b13', '#8b5cf6', '#10b981', '#fbbf24']; 
        const shapes = ['square', 'circle', 'star'];

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        window.addEventListener('resize', resize);
        resize();

        class Particle {
            constructor() {
                this.reset();
                this.y = Math.random() * canvas.height;
            }
            reset() {
                this.radius = Math.random() * 6 + 6; 
                this.x = Math.random() * canvas.width;
                this.y = -20;
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.shape = shapes[Math.floor(Math.random() * shapes.length)];
                this.vy = Math.random() * 2 + 1; 
                this.vx = (Math.random() - 0.5) * 1.5;
                this.opacity = Math.random() * 0.5 + 0.3;
                this.rotation = Math.random() * 360;
                this.rotationSpeed = (Math.random() - 0.5) * 5;
            }
            update() {
                this.y += this.vy;
                this.x += this.vx;
                this.rotation += this.rotationSpeed;
                if (this.y > canvas.height + 20) {
                    this.reset();
                }
            }
            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation * Math.PI / 180);
                ctx.globalAlpha = this.opacity;
                ctx.fillStyle = this.color;

                if (this.shape === 'square') {
                    ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
                } else if (this.shape === 'circle') {
                    ctx.beginPath();
                    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                    ctx.fill();
                } else if (this.shape === 'star') {
                    this.drawStar(0, 0, 5, this.radius * 1.5, this.radius * 0.6);
                }
                ctx.restore();
            }
            drawStar(cx, cy, spikes, outerRadius, innerRadius) {
                let rot = Math.PI / 2 * 3;
                let x = cx;
                let y = cy;
                let step = Math.PI / spikes;

                ctx.beginPath();
                ctx.moveTo(cx, cy - outerRadius);
                for (let i = 0; i < spikes; i++) {
                    x = cx + Math.cos(rot) * outerRadius;
                    y = cy + Math.sin(rot) * outerRadius;
                    ctx.lineTo(x, y);
                    rot += step;
                    x = cx + Math.cos(rot) * innerRadius;
                    y = cy + Math.sin(rot) * innerRadius;
                    ctx.lineTo(x, y);
                    rot += step;
                }
                ctx.lineTo(cx, cy - outerRadius);
                ctx.closePath();
                ctx.fill();
            }
        }
        function init() {
            particles = [];
            const count = Math.floor(window.innerWidth / 15);
            for (let i = 0; i < count; i++) {
                particles.push(new Particle());
            }
        }
        function animate() {
            if (canvas.style.display === 'none') return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            app.confettiAnimationId = requestAnimationFrame(animate);
        }
        init();
        animate();
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
    STATE.history = [];
    
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
    STATE.submittedPlayers.clear();
    STATE.currentRound = data.round;
    STATE.totalRounds = data.totalRounds;
    
    if (data.round === 1) {
        STATE.gameStartTime = Date.now();
        STATE.fastestSyncDuration = Infinity;
        STATE.fastestSyncRound = '-';
        STATE.uniqueWords = new Set();
    }
    STATE.roundStartTime = Date.now();
    
    // Reset game screen
    app.clearError();
    document.getElementById('submit-section').classList.remove('hidden');
    document.getElementById('waiting-msg').classList.add('hidden');
    const input = document.getElementById('word-input');
    input.removeAttribute('disabled');
    input.classList.remove('opacity-50', 'cursor-not-allowed');
    input.value = '';
    
    // Set text
    document.getElementById('game-category').textContent = data.prompt.category;
    document.getElementById('game-round-current').textContent = data.round;
    document.getElementById('game-round-total').textContent = data.totalRounds;
    document.getElementById('game-prompt').textContent = data.prompt.prompt;
    document.getElementById('game-timer').textContent = data.timePerRound;
    
    // Reset timer circle
    const circle = document.getElementById('timer-circle');
    if (circle) {
        circle.style.transition = 'none';
        circle.style.strokeDashoffset = '0';
        circle.style.stroke = '#22c55e'; // Green start
        setTimeout(() => { circle.style.transition = 'all 1s linear'; }, 50);
    }
    
    if (circle) {
        circle.style.transition = 'none';
        circle.style.strokeDashoffset = '0';
        circle.style.stroke = '#22c55e'; // Green start
        setTimeout(() => { circle.style.transition = 'all 1s linear'; }, 50);
    }
    
    app.renderRoundHistory();
    app.renderSubmissionStatus();
    app.showScreen('game-screen');
    
    setTimeout(() => input.focus(), 500);
});

socket.on('timer-tick', ({ timeLeft }) => {
    const timeEl = document.getElementById('game-timer');
    const circle = document.getElementById('timer-circle');
    
    if (timeEl) timeEl.textContent = timeLeft;
    
    if (circle) {
        // Calculate dashboard offset (max 226)
        const maxOffset = 226;
        const progress = 1 - (timeLeft / STATE.settings.timePerRound);
        circle.style.strokeDashoffset = progress * maxOffset;
        
        // Color change based on time
        if (timeLeft <= 5) {
            circle.style.stroke = '#ef4444'; // Red
        } else if (timeLeft <= 10) {
            circle.style.stroke = '#eab308'; // Yellow
        } else {
            circle.style.stroke = '#22c55e'; // Green
        }
    }

    if (timeEl) {
        if (timeLeft <= 5) {
            timeEl.classList.add('text-red-500', 'animate-pulse');
            timeEl.classList.remove('text-primary', 'text-yellow-400', 'animate-bounce');
        } else if (timeLeft <= 10) {
            timeEl.classList.add('text-yellow-400');
            timeEl.classList.remove('text-primary', 'text-red-500', 'animate-pulse', 'animate-bounce');
        } else {
            timeEl.classList.add('text-primary');
            timeEl.classList.remove('text-red-500', 'text-yellow-400', 'animate-pulse', 'animate-bounce');
        }
    }
});

socket.on('player-submitted', ({ playerId, submittedCount, totalPlayers }) => {
    STATE.submittedPlayers.add(playerId);
    
    if (document.getElementById('game-screen').classList.contains('active')) {
        app.renderSubmissionStatus();
    }
});

socket.on('round-results', (data) => {
    // Stats calculation
    const roundDuration = Date.now() - (STATE.roundStartTime || Date.now());
    if (data.allMatch) {
         if (roundDuration < (STATE.fastestSyncDuration || Infinity)) {
             STATE.fastestSyncDuration = roundDuration;
             STATE.fastestSyncRound = STATE.currentRound;
         }
    }
    
    // Add unique words
    const counts = {};
    data.submissions.forEach(s => {
        if (s.word !== '(no answer)') {
            counts[s.word.toLowerCase()] = (counts[s.word.toLowerCase()] || 0) + 1;
        }
    });
    for (const word in counts) {
        if (counts[word] === 1) {
            if(!STATE.uniqueWords) STATE.uniqueWords = new Set();
            STATE.uniqueWords.add(word);
        }
    }

    // Add to history
    STATE.history.push({
        round: STATE.currentRound,
        category: data.prompt.category,
        prompt: data.prompt.prompt,
        allMatch: data.allMatch,
        submissions: data.submissions
    });
    
    // Update player scores
    data.submissions.forEach(sub => {
        const p = STATE.players.find(x => x.id === sub.id);
        if(p) p.score = sub.score;
    });
    
    app.renderResults(data);
    app.showScreen('results-screen');
});

socket.on('game-over', (data) => {
    document.getElementById('result-title').innerHTML = `Mind<span class="text-white">Sync</span>`;
    
    document.getElementById('result-subtitle').innerHTML = `<span class="text-yellow-400 font-bold text-2xl">🏆 ${data.winner.name} Wins!</span>`;
    document.getElementById('result-subtitle').className = 'text-center';
    
    const bgShapes = document.getElementById('results-bg-shapes');
    if (bgShapes) bgShapes.classList.add('hidden');
    
    const cardsCont = document.getElementById('result-cards');
    cardsCont.innerHTML = `<div class="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl col-span-1 sm:col-span-2 lg:col-span-4 text-center">
        <h2 class="text-3xl font-black text-yellow-400 mb-6">Final Standings</h2>
        <div class="space-y-4 max-w-md mx-auto">
            ${data.players.map((p, i) => `
                <div class="flex justify-between items-center text-xl bg-black/20 px-6 py-4 rounded-2xl">
                    <span class="font-bold text-white">${i+1}. ${p.name}</span>
                    <span class="font-black text-yellow-400">${p.score} <span class="text-sm">pts</span></span>
                </div>
            `).join('')}
        </div>
    </div>`;
    
    const controls = document.getElementById('result-footer-controls');
    if (controls) controls.classList.remove('hidden');
    
    const syncTextContainer = document.getElementById('result-sync-text')?.parentElement;
    if (syncTextContainer) syncTextContainer.classList.add('hidden');
    
    // Display buttons
    if (STATE.isHost) {
        document.getElementById('btn-next-round').classList.add('hidden');
        document.getElementById('btn-next-round').classList.remove('flex');
        document.getElementById('btn-play-again').classList.remove('hidden');
        document.getElementById('btn-play-again').classList.add('flex');
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
