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
                const seed = encodeURIComponent(player.name + avatar.seedSuffix);
                const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=transparent`;
                
                playersHtml += `
                    <div class="flex items-center gap-2 bg-black/50 rounded-full pr-4 pb-1 pt-1 pl-1 border border-white/5">
                        <div class="size-8 rounded-full bg-gradient-to-tr ${avatar.color} p-0.5 shrink-0 shadow-lg">
                            <img src="${avatarUrl}" class="w-full h-full rounded-full bg-slate-800 object-cover" />
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
