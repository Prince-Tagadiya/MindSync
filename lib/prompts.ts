const PROMPTS = [
  "Name a fruit",
  "Name an animal",
  "Name a color",
  "Name something at the beach",
  "Name a superhero",
  "Name a country",
  "Name a sport",
  "Name a movie genre",
  "Name something in a kitchen",
  "Name a music instrument",
  "Name a planet",
  "Name something cold",
  "Name a dessert",
  "Name something you do in the morning",
  "Name a vehicle",
  "Name something you find in a classroom",
  "Name a season",
  "Name a body part",
  "Name a holiday",
  "Name something round",
  "Name a drink",
  "Name an emotion",
  "Name a famous city",
  "Name something that flies",
  "Name a flower",
  "Name something sweet",
  "Name a pizza topping",
  "Name something you wear",
  "Name a day of the week",
  "Name something scary",
  "Name a board game",
  "Name something in a park",
  "Name a school subject",
  "Name an ocean creature",
  "Name something you find in a wallet",
  "Name a breakfast food",
  "Name something that makes noise",
  "Name a social media platform",
  "Name something you do on vacation",
  "Name a cartoon character",
];

// Track used prompt indices to avoid repeats within a session
let usedIndices: Set<number> = new Set();

export function getRandomPrompt(): string {
  // Reset if all prompts are used
  if (usedIndices.size >= PROMPTS.length) {
    usedIndices = new Set();
  }

  let index: number;
  do {
    index = Math.floor(Math.random() * PROMPTS.length);
  } while (usedIndices.has(index));

  usedIndices.add(index);
  return PROMPTS[index];
}

export function resetPrompts(): void {
  usedIndices = new Set();
}
