/**
 * MindSync Chemistry Scoring System v2.0
 * Deeply analyzes semantic connection, timing, and group harmony.
 */

// Better string similarity using a combination of Levenshtein and Bigram overlap
export function getEnhancedSimilarity(w1: string, w2: string): number {
  const s1 = w1.toLowerCase().trim();
  const s2 = w2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0;

  // 1. Semantic Shortcut Map for common associations
  const semanticMap: Record<string, Record<string, number>> = {
    "sun": { "beach": 0.6, "sand": 0.5, "summer": 0.8, "hot": 0.6, "yellow": 0.4, "star": 0.5 },
    "beach": { "ocean": 0.9, "sand": 0.9, "vacation": 0.8, "water": 0.7, "sea": 0.9, "blue": 0.5 },
    "vacation": { "holiday": 0.9, "travel": 0.8, "trip": 0.8, "plane": 0.6, "hotel": 0.7, "island": 0.7 },
    "coffee": { "morning": 0.7, "cup": 0.5, "bean": 0.8, "caffeine": 0.9, "tea": 0.6, "black": 0.4 },
    "pizza": { "cheese": 0.8, "food": 0.5, "italian": 0.7, "dough": 0.6, "pepperoni": 0.8, "delivery": 0.5 },
    "love": { "heart": 0.9, "red": 0.6, "romance": 0.8, "friendship": 0.5, "family": 0.4 },
    "fire": { "hot": 0.8, "burn": 0.7, "smoke": 0.7, "red": 0.5, "water": 0.2 },
    "music": { "song": 0.9, "dance": 0.7, "rhythm": 0.8, "art": 0.5, "instrument": 0.6 }
  };

  if (semanticMap[s1]?.[s2]) return semanticMap[s1][s2];
  if (semanticMap[s2]?.[s1]) return semanticMap[s2][s1];

  // 2. Character Overlap (Bigram)
  const getBigrams = (str: string) => {
    const s = new Set();
    for (let i = 0; i < str.length - 1; i++) s.add(str.substring(i, i + 2));
    return s;
  };
  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersect = 0;
  b1.forEach(bit => { if (b2.has(bit)) intersect++; });
  const dice = (2.0 * intersect) / (b1.size + b2.size || 1);

  // 3. Length Ratio (similar lengths might imply similar word roots)
  const lenRatio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
  
  return (dice * 0.8) + (lenRatio * 0.2);
}

export const getAvgSim = (words: string[]) => {
  if (words.length < 2) return 0;
  let sum = 0, p = 0;
  for (let i=0; i<words.length; i++) {
    for (let j=i+1; j<words.length; j++) {
      sum += getEnhancedSimilarity(words[i], words[j]);
      p++;
    }
  }
  return sum / (p || 1);
};

export function calculateChemistry(
  roundHistory: Record<number, Record<string, string>>,
  totalRounds: number,
  playerCount: number
) {
  const roundEntries = Object.entries(roundHistory);
  const roundsTaken = roundEntries.length;
  
  if (roundsTaken === 0) return { score: 0, label: "Try Again", speedScore: 0, similarityScore: 0, trendScore: 0, agreementScore: 0, rounds: 0 };

  // 1. CONVERGENCE SPEED (Efficiency of thought)
  // Higher weight for faster matches. 
  // R1: 100, R2: 90, R3: 80, R4: 65, R5: 45
  const speedCurve: Record<number, number> = { 1: 100, 2: 92, 3: 80, 4: 65, 5: 50 };
  const speedScore = speedCurve[roundsTaken] || 35;

  // 2. SEMANTIC SIMILARITY (The "Near-Miss" analysis)
  // Even if they didn't match, did they think of similar things?
  let totalSimScore = 0;
  roundEntries.forEach(([_, guesses]) => {
    const words = Object.values(guesses);
    if (words.length < 2) return;
    
    let sum = 0;
    let pairs = 0;
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j < words.length; j++) {
        sum += getEnhancedSimilarity(words[i], words[j]);
        pairs++;
      }
    }
    totalSimScore += (sum / (pairs || 1));
  });
  const similarityScore = (totalSimScore / roundsTaken) * 100;

  // 3. CONVERGENCE TREND (The "Getting Closer" factor)
  // Did their similarity increase over time?
  const initialRoundGuesses = Object.values(roundHistory[1] || {});
  const finalRoundGuesses = Object.values(roundHistory[roundsTaken] || {});
  
  const initialSim = getAvgSim(initialRoundGuesses);
  const finalSim = getAvgSim(finalRoundGuesses); // Should be 1.0 on match
  const trendRaw = finalSim - initialSim;
  // Trend is worth more if you started far apart and ended together
  const trendScore = Math.min(30, Math.max(0, trendRaw * 100));

  // 4. AGREEMENT SCORE (Harmony)
  // How many people agreed even when not everyone did?
  let agreementPoints = 0;
  roundEntries.forEach(([_, guesses]) => {
    const words = Object.values(guesses);
    const counts: Record<string, number> = {};
    words.forEach(w => counts[w] = (counts[w] || 0) + 1);
    const maxMatch = Math.max(...Object.values(counts));
    agreementPoints += (maxMatch / playerCount);
  });
  const agreementScore = (agreementPoints / roundsTaken) * 100;

  // 5. FINAL CALCULATION (Weighted Harmonic Mean approach)
  // This feels more "realistic" as one bad round won't tank you, 
  // but a perfect first round match feels god-like.
  const weightedScore = (
    (speedScore * 0.45) +
    (similarityScore * 0.25) +
    (trendScore * 0.15) +
    (agreementScore * 0.15)
  );

  // Bonus: If it's a Round 1 match, lock it to high range
  let finalScore = Math.min(100, Math.round(weightedScore));
  if (roundsTaken === 1) finalScore = Math.max(98, finalScore);
  
  // 6. Labels
  let label = "Try Again";
  if (finalScore >= 95) label = "Telepathic Twins";
  else if (finalScore >= 85) label = "Perfect Synchronization";
  else if (finalScore >= 70) label = "Strong Chemistry";
  else if (finalScore >= 50) label = "Great Connection";
  else if (finalScore >= 35) label = "Building Core Sync";

  return {
    score: finalScore,
    label,
    speedScore,
    similarityScore,
    trendScore,
    agreementScore,
    rounds: roundsTaken
  };
}

export function calculatePairwiseChemistry(
  roundHistory: Record<number, Record<string, string>>,
  players: { id: string, name: string }[]
) {
  const results: { p1: string, p2: string, score: number, label: string }[] = [];
  
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const p1 = players[i];
      const p2 = players[j];
      
      let totalSim = 0;
      let count = 0;
      Object.values(roundHistory).forEach(guesses => {
        if (guesses[p1.id] && guesses[p2.id]) {
          totalSim += getEnhancedSimilarity(guesses[p1.id], guesses[p2.id]);
          count++;
        }
      });
      
      const avg = totalSim / (count || 1);
      const score = Math.round(avg * 100);
      
      let label = "Soul Sync";
      if (score >= 90) label = "Mind Twins";
      else if (score >= 75) label = "Deeply Sync";
      else if (score >= 50) label = "Good Sync";
      else label = "Developing";
      
      results.push({ p1: p1.name, p2: p2.name, score, label });
    }
  }
  return results;
}
