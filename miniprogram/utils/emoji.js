export const animalEmojis = [
  '🐶', '🐱', '🐭', '🐹', '🐰', 
  '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐸', '🐙', 
  '🐵', '🦉', '🦆', '🐧', '🦋'
];

// 获取随机emoji
export const getRandomEmoji = () => {
  const index = Math.floor(Math.random() * animalEmojis.length);
  return animalEmojis[index];
}; 