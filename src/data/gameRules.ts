import type { GameType } from '../types'

export interface GameRuleEntry {
  title: string
  summary: string
  howToPlay: string[]
  scoring: string[]
  tips: string[]
}

export const GAME_RULES: Record<GameType, GameRuleEntry> = {
  skins: {
    title: 'Skins',
    summary: 'Each hole is worth one "skin." Win the hole outright (lowest score) and you win the skin. Ties carry the skin to the next hole.',
    howToPlay: [
      'Each hole has one skin up for grabs.',
      'The player with the lowest score on the hole wins the skin.',
      'If two or more players tie, the skin carries over to the next hole (if carryovers are on).',
      'Carryover skins accumulate, making later holes worth more.',
      'Optional presses let players double down mid-round.',
    ],
    scoring: [
      'Total pot = buy-in x number of players.',
      'Each skin is worth an equal share of the pot.',
      'If carryovers stack, a single hole can be worth multiple skins.',
      'Press bets multiply the value from the press hole onward.',
      'Gross mode: raw scores. Net mode: handicap strokes applied.',
    ],
    tips: [
      'Carryovers make the game more exciting — a tied hole 17 means hole 18 could be worth a fortune.',
      'Press when you are down to create a new side bet.',
      'Net skins levels the playing field for mixed-handicap groups.',
    ],
  },

  best_ball: {
    title: 'Best Ball (2v2)',
    summary: 'Two teams of two compete. On each hole, the best (lowest) score from each team counts. The team that wins more holes (or has the lower total) wins the pot.',
    howToPlay: [
      'Players are split into Team A and Team B (2 per team).',
      'On each hole, both players on a team play their own ball.',
      'The lower score of the two teammates is the team score for that hole.',
      'Match scoring: team with more holes won wins. Total scoring: lowest cumulative team score wins.',
    ],
    scoring: [
      'Match play: count holes won per team; most holes wins the pot.',
      'Total play: sum each team\'s best-ball scores across all holes; lowest total wins.',
      'Ties result in a pot split / refund.',
      'Gross or net scoring available.',
    ],
    tips: [
      'Pair a strong and weak player on each team for balanced matches.',
      'In match play, individual bad holes hurt less — your partner can bail you out.',
      'Requires an even number of players (2, 4, 6).',
    ],
  },

  nassau: {
    title: 'Nassau',
    summary: 'Three bets in one: front 9, back 9, and overall 18. Win any segment to collect that portion of the pot. The most popular golf betting format.',
    howToPlay: [
      'The bet is split into three segments: front 9, back 9, and total 18.',
      'Each segment is a separate bet worth 1/3 of the total pot.',
      'The player with the lowest total strokes in each segment wins that bet.',
      'Optional presses: when losing, a player can "press" to start a new side bet from that hole to the end of the nine.',
    ],
    scoring: [
      'Pot is divided equally across 3 segments.',
      'Each segment winner takes their 1/3 of the pot.',
      'Ties in a segment result in that portion being split.',
      'Each press creates an additional bet equal to one segment.',
      'Gross or net scoring available.',
    ],
    tips: [
      'Nassau is great because you can lose the front but still win the back and overall.',
      'Pressing when down keeps the game interesting but increases your exposure.',
      'The "2-down automatic press" is a popular house rule.',
    ],
  },

  wolf: {
    title: 'Wolf',
    summary: 'A rotating-captain game where the "wolf" picks a partner (or goes alone) on each hole. Lone wolf doubles the stakes. Strategic and social.',
    howToPlay: [
      'Players rotate as the "wolf" each hole.',
      'After seeing each player tee off, the wolf either picks a partner or goes lone wolf.',
      'Wolf + partner vs. the other players: lower team score wins.',
      'Lone wolf plays 1 vs. all — if the wolf wins, they collect double from each opponent.',
      'If the wolf loses as lone wolf, they pay double to each opponent.',
    ],
    scoring: [
      'Points (units) are tracked per hole based on wins/losses.',
      'Normal hole: winning team gets 1 unit from each loser.',
      'Lone wolf: stakes are doubled (2 units per opponent).',
      'At round end, net units determine pot distribution.',
      'Ties push (no points exchanged).',
    ],
    tips: [
      'Going lone wolf is high risk, high reward — do it when you stripe one down the middle.',
      'Pick your partner strategically based on their tee shot.',
      'Wolf requires at least 3 players (best with 4).',
    ],
  },

  bingo_bango_bongo: {
    title: 'Bingo Bango Bongo',
    summary: 'Three points available per hole: Bingo (first on the green), Bango (closest to the pin once all are on), Bongo (first to hole out). Great equalizer for all skill levels.',
    howToPlay: [
      'Three points are awarded on every hole.',
      'Bingo: First player to get their ball on the green.',
      'Bango: Player closest to the pin after everyone is on the green.',
      'Bongo: First player to hole out (finish the hole).',
      'Points are tallied at the end; highest total wins.',
    ],
    scoring: [
      'Each point is worth an equal share of the pot.',
      'Total possible points = 3 x number of holes (54 for 18 holes).',
      'Winners split the pot proportionally based on points earned.',
      'If no points are recorded, buy-ins are refunded.',
    ],
    tips: [
      'Order of play matters! Play farthest from the hole first (as per golf etiquette).',
      'High-handicap players can compete — short hitters often get Bingo by being closer to the green.',
      'Great game when skill levels vary widely.',
    ],
  },

  hammer: {
    title: 'Hammer',
    summary: 'A 2-player press game where you "throw the hammer" to double the stakes. Your opponent must accept (doubling the value) or decline (losing the current value). Pure psychological warfare.',
    howToPlay: [
      'Played between exactly 2 players.',
      'Each hole starts at the base value. One player holds the "hammer."',
      'The hammer holder can throw it at any point during the hole to double the stakes.',
      'The opponent must either Accept (stakes double, hammer passes to them) or Decline (they lose the current value).',
      'The hammer alternates to start — Player A on odd holes, Player B on even holes.',
      'When accepted, the receiver now holds the hammer and can throw it back.',
    ],
    scoring: [
      'Base value is set before the round (e.g., $1 per hole).',
      'Throwing & accepting doubles the current value: $1 → $2 → $4 → $8...',
      'Declining forfeits the current value to the thrower.',
      'If no hammer is thrown, the hole winner gets the base value.',
      'Running tally tracks net amount owed.',
    ],
    tips: [
      'Throw the hammer when you have a clear advantage — or as a bluff.',
      'Declining early is cheap. Declining after multiple presses is expensive.',
      'The psychological game is as important as the golf.',
      'Set a max number of presses per hole to keep things manageable.',
    ],
  },
}
