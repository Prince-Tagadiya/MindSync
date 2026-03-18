import promptsData from './prompts.json';

export function getRandomPrompt(usedPrompts: string[] = []): string {
  const allPrompts = promptsData as string[];
  
  // Filter out any prompts that have already been used in this room
  const available = allPrompts.filter(p => !usedPrompts.includes(p));
  
  // Fallback: If ALL are used, clear the list (or take from all)
  const pool = available.length > 0 ? available : allPrompts;
  
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}
