import type { Tee, Hole } from '../types'

export interface CourseTemplate {
  name: string
  city: string
  tees: Tee[]
  holes: Hole[]
}

// ---------------------------------------------------------------------------
// Data sourced from Greenskeeper.org (USGA/SCGA-derived ratings) and official
// course websites. Verify with the course before posting handicap rounds.
// ---------------------------------------------------------------------------

export const venturaCourses: CourseTemplate[] = [

  // ─── Olivas Links ──────────────────────────────────────────────────────────
  {
    name: 'Olivas Links',
    city: 'Ventura',
    tees: [
      { name: 'Tour',     rating: 73.0, slope: 130 },
      { name: 'Champion', rating: 71.6, slope: 127 },
      { name: 'Club',     rating: 69.5, slope: 121 },
      { name: 'Players',  rating: 65.8, slope: 110 },
    ],
    holes: [
      { number:  1, par: 4, strokeIndex: 18, yardages: { Tour: 362, Champion: 351, Club: 308, Players: 290 } },
      { number:  2, par: 5, strokeIndex:  4, yardages: { Tour: 534, Champion: 529, Club: 512, Players: 464 } },
      { number:  3, par: 4, strokeIndex:  6, yardages: { Tour: 377, Champion: 356, Club: 333, Players: 292 } },
      { number:  4, par: 5, strokeIndex:  8, yardages: { Tour: 514, Champion: 510, Club: 470, Players: 457 } },
      { number:  5, par: 3, strokeIndex: 12, yardages: { Tour: 179, Champion: 167, Club: 132, Players: 106 } },
      { number:  6, par: 4, strokeIndex:  2, yardages: { Tour: 437, Champion: 420, Club: 364, Players: 324 } },
      { number:  7, par: 4, strokeIndex: 14, yardages: { Tour: 408, Champion: 395, Club: 382, Players: 331 } },
      { number:  8, par: 3, strokeIndex: 10, yardages: { Tour: 185, Champion: 164, Club: 145, Players: 115 } },
      { number:  9, par: 4, strokeIndex: 16, yardages: { Tour: 354, Champion: 344, Club: 327, Players: 255 } },
      { number: 10, par: 4, strokeIndex: 11, yardages: { Tour: 407, Champion: 381, Club: 320, Players: 292 } },
      { number: 11, par: 4, strokeIndex:  5, yardages: { Tour: 424, Champion: 378, Club: 370, Players: 327 } },
      { number: 12, par: 4, strokeIndex:  9, yardages: { Tour: 376, Champion: 362, Club: 352, Players: 314 } },
      { number: 13, par: 3, strokeIndex:  7, yardages: { Tour: 201, Champion: 171, Club: 156, Players: 137 } },
      { number: 14, par: 5, strokeIndex:  3, yardages: { Tour: 563, Champion: 548, Club: 519, Players: 452 } },
      { number: 15, par: 4, strokeIndex: 13, yardages: { Tour: 365, Champion: 357, Club: 345, Players: 303 } },
      { number: 16, par: 4, strokeIndex:  1, yardages: { Tour: 479, Champion: 455, Club: 441, Players: 346 } },
      { number: 17, par: 3, strokeIndex: 17, yardages: { Tour: 151, Champion: 149, Club: 138, Players: 119 } },
      { number: 18, par: 5, strokeIndex: 15, yardages: { Tour: 502, Champion: 493, Club: 483, Players: 424 } },
    ],
  },

  // ─── River Ridge – Vineyard Course ─────────────────────────────────────────
  {
    name: 'River Ridge – Vineyard',
    city: 'Oxnard',
    tees: [
      { name: 'Blue',  rating: 72.7, slope: 129 },
      { name: 'White', rating: 70.6, slope: 124 },
      { name: 'Gold',  rating: 68.3, slope: 118 },
      { name: 'Red',   rating: 65.2, slope: 110 },
    ],
    holes: [
      { number:  1, par: 5, strokeIndex:  9, yardages: { Blue: 554, White: 532, Gold: 478, Red: 407 } },
      { number:  2, par: 4, strokeIndex:  3, yardages: { Blue: 393, White: 371, Gold: 330, Red: 300 } },
      { number:  3, par: 3, strokeIndex: 17, yardages: { Blue: 170, White: 150, Gold: 125, Red: 105 } },
      { number:  4, par: 4, strokeIndex:  5, yardages: { Blue: 377, White: 350, Gold: 331, Red: 305 } },
      { number:  5, par: 5, strokeIndex: 11, yardages: { Blue: 502, White: 466, Gold: 453, Red: 424 } },
      { number:  6, par: 4, strokeIndex: 15, yardages: { Blue: 310, White: 276, Gold: 246, Red: 230 } },
      { number:  7, par: 3, strokeIndex: 13, yardages: { Blue: 186, White: 165, Gold: 145, Red: 127 } },
      { number:  8, par: 4, strokeIndex:  1, yardages: { Blue: 454, White: 425, Gold: 377, Red: 342 } },
      { number:  9, par: 3, strokeIndex:  7, yardages: { Blue: 187, White: 172, Gold: 160, Red: 150 } },
      { number: 10, par: 4, strokeIndex:  4, yardages: { Blue: 465, White: 426, Gold: 401, Red: 338 } },
      { number: 11, par: 5, strokeIndex: 16, yardages: { Blue: 489, White: 476, Gold: 443, Red: 399 } },
      { number: 12, par: 3, strokeIndex: 18, yardages: { Blue: 182, White: 148, Gold: 135, Red: 112 } },
      { number: 13, par: 5, strokeIndex:  6, yardages: { Blue: 513, White: 476, Gold: 440, Red: 392 } },
      { number: 14, par: 4, strokeIndex:  2, yardages: { Blue: 444, White: 417, Gold: 399, Red: 308 } },
      { number: 15, par: 5, strokeIndex:  8, yardages: { Blue: 538, White: 506, Gold: 462, Red: 420 } },
      { number: 16, par: 4, strokeIndex: 14, yardages: { Blue: 383, White: 360, Gold: 347, Red: 324 } },
      { number: 17, par: 4, strokeIndex: 12, yardages: { Blue: 392, White: 380, Gold: 361, Red: 346 } },
      { number: 18, par: 3, strokeIndex: 10, yardages: { Blue: 191, White: 166, Gold: 150, Red: 122 } },
    ],
  },

  // ─── River Ridge – Victoria Course ─────────────────────────────────────────
  {
    name: 'River Ridge – Victoria',
    city: 'Oxnard',
    tees: [
      { name: 'Blue',  rating: 72.5, slope: 130 },
      { name: 'White', rating: 70.3, slope: 126 },
      { name: 'Gold',  rating: 67.3, slope: 119 },
      { name: 'Red',   rating: 65.0, slope: 110 },
    ],
    holes: [
      { number:  1, par: 4, strokeIndex:  3, yardages: { Blue: 393, White: 384, Gold: 360, Red: 324 } },
      { number:  2, par: 4, strokeIndex:  5, yardages: { Blue: 395, White: 358, Gold: 321, Red: 287 } },
      { number:  3, par: 4, strokeIndex: 11, yardages: { Blue: 371, White: 345, Gold: 302, Red: 284 } },
      { number:  4, par: 5, strokeIndex: 15, yardages: { Blue: 525, White: 487, Gold: 438, Red: 377 } },
      { number:  5, par: 3, strokeIndex: 13, yardages: { Blue: 199, White: 170, Gold: 134, Red: 115 } },
      { number:  6, par: 4, strokeIndex:  9, yardages: { Blue: 383, White: 349, Gold: 322, Red: 293 } },
      { number:  7, par: 3, strokeIndex: 17, yardages: { Blue: 178, White: 150, Gold: 128, Red: 102 } },
      { number:  8, par: 4, strokeIndex:  1, yardages: { Blue: 424, White: 387, Gold: 351, Red: 327 } },
      { number:  9, par: 5, strokeIndex:  7, yardages: { Blue: 552, White: 517, Gold: 475, Red: 432 } },
      { number: 10, par: 4, strokeIndex:  6, yardages: { Blue: 398, White: 373, Gold: 345, Red: 316 } },
      { number: 11, par: 3, strokeIndex: 18, yardages: { Blue: 168, White: 147, Gold: 120, Red: 112 } },
      { number: 12, par: 5, strokeIndex:  4, yardages: { Blue: 533, White: 503, Gold: 460, Red: 432 } },
      { number: 13, par: 4, strokeIndex:  2, yardages: { Blue: 425, White: 398, Gold: 341, Red: 304 } },
      { number: 14, par: 5, strokeIndex: 12, yardages: { Blue: 569, White: 535, Gold: 493, Red: 452 } },
      { number: 15, par: 3, strokeIndex: 16, yardages: { Blue: 145, White: 126, Gold:  95, Red:  85 } },
      { number: 16, par: 4, strokeIndex:  8, yardages: { Blue: 401, White: 378, Gold: 339, Red: 307 } },
      { number: 17, par: 3, strokeIndex: 10, yardages: { Blue: 208, White: 190, Gold: 165, Red: 138 } },
      { number: 18, par: 5, strokeIndex: 14, yardages: { Blue: 522, White: 507, Gold: 487, Red: 463 } },
    ],
  },

  // ─── Sterling Hills Golf Club ───────────────────────────────────────────────
  // Source: Official website sterlinghillsgolf.com
  {
    name: 'Sterling Hills Golf Club',
    city: 'Camarillo',
    tees: [
      { name: 'Gold',  rating: 73.3, slope: 133 },
      { name: 'Black', rating: 71.4, slope: 128 },
      { name: 'Blue',  rating: 69.2, slope: 122 },
      { name: 'White', rating: 67.5, slope: 117 },
      { name: 'Red',   rating: 63.1, slope: 106 },
    ],
    holes: [
      { number:  1, par: 4, strokeIndex: 11, yardages: { Gold: 433, Black: 416, Blue: 367, White: 342, Red: 263 } },
      { number:  2, par: 4, strokeIndex:  7, yardages: { Gold: 414, Black: 400, Blue: 369, White: 344, Red: 227 } },
      { number:  3, par: 3, strokeIndex:  9, yardages: { Gold: 222, Black: 202, Blue: 171, White: 160, Red: 125 } },
      { number:  4, par: 5, strokeIndex: 15, yardages: { Gold: 525, Black: 495, Blue: 476, White: 442, Red: 362 } },
      { number:  5, par: 4, strokeIndex:  1, yardages: { Gold: 444, Black: 428, Blue: 400, White: 369, Red: 276 } },
      { number:  6, par: 4, strokeIndex:  3, yardages: { Gold: 378, Black: 355, Blue: 328, White: 301, Red: 248 } },
      { number:  7, par: 4, strokeIndex: 17, yardages: { Gold: 350, Black: 333, Blue: 311, White: 292, Red: 292 } },
      { number:  8, par: 3, strokeIndex: 13, yardages: { Gold: 187, Black: 167, Blue: 154, White: 136, Red: 131 } },
      { number:  9, par: 4, strokeIndex:  5, yardages: { Gold: 388, Black: 368, Blue: 351, White: 329, Red: 265 } },
      { number: 10, par: 4, strokeIndex: 14, yardages: { Gold: 379, Black: 355, Blue: 346, White: 330, Red: 300 } },
      { number: 11, par: 3, strokeIndex: 18, yardages: { Gold: 160, Black: 146, Blue: 141, White: 127, Red: 105 } },
      { number: 12, par: 4, strokeIndex:  6, yardages: { Gold: 411, Black: 380, Blue: 339, White: 319, Red: 272 } },
      { number: 13, par: 4, strokeIndex:  4, yardages: { Gold: 406, Black: 390, Blue: 368, White: 354, Red: 302 } },
      { number: 14, par: 4, strokeIndex:  8, yardages: { Gold: 442, Black: 419, Blue: 372, White: 360, Red: 268 } },
      { number: 15, par: 3, strokeIndex: 10, yardages: { Gold: 190, Black: 175, Blue: 164, White: 146, Red: 125 } },
      { number: 16, par: 5, strokeIndex: 16, yardages: { Gold: 501, Black: 466, Blue: 438, White: 406, Red: 402 } },
      { number: 17, par: 4, strokeIndex:  2, yardages: { Gold: 466, Black: 431, Blue: 399, White: 370, Red: 314 } },
      { number: 18, par: 5, strokeIndex: 12, yardages: { Gold: 524, Black: 504, Blue: 459, White: 431, Red: 313 } },
    ],
  },

  // ─── Camarillo Springs Golf Course ──────────────────────────────────────────
  {
    name: 'Camarillo Springs',
    city: 'Camarillo',
    tees: [
      { name: 'Black', rating: 73.1, slope: 130 },
      { name: 'Blue',  rating: 70.9, slope: 125 },
      { name: 'White', rating: 68.8, slope: 119 },
      { name: 'Red',   rating: 65.3, slope: 111 },
    ],
    holes: [
      { number:  1, par: 4, strokeIndex:  1, yardages: { Black: 400, Blue: 382, White: 358, Red: 305 } },
      { number:  2, par: 4, strokeIndex: 11, yardages: { Black: 404, Blue: 379, White: 352, Red: 330 } },
      { number:  3, par: 3, strokeIndex:  5, yardages: { Black: 218, Blue: 193, White: 169, Red: 141 } },
      { number:  4, par: 5, strokeIndex:  7, yardages: { Black: 562, Blue: 512, White: 464, Red: 406 } },
      { number:  5, par: 4, strokeIndex: 13, yardages: { Black: 465, Blue: 377, White: 331, Red: 286 } },
      { number:  6, par: 3, strokeIndex:  3, yardages: { Black: 212, Blue: 195, White: 161, Red: 108 } },
      { number:  7, par: 5, strokeIndex:  9, yardages: { Black: 551, Blue: 535, White: 518, Red: 467 } },
      { number:  8, par: 3, strokeIndex: 17, yardages: { Black: 167, Blue: 155, White: 145, Red: 135 } },
      { number:  9, par: 4, strokeIndex: 15, yardages: { Black: 372, Blue: 342, White: 335, Red: 329 } },
      { number: 10, par: 5, strokeIndex: 10, yardages: { Black: 534, Blue: 509, White: 502, Red: 484 } },
      { number: 11, par: 3, strokeIndex:  4, yardages: { Black: 199, Blue: 194, White: 168, Red: 147 } },
      { number: 12, par: 3, strokeIndex: 14, yardages: { Black: 210, Blue: 180, White: 154, Red: 115 } },
      { number: 13, par: 4, strokeIndex: 12, yardages: { Black: 409, Blue: 345, White: 308, Red: 264 } },
      { number: 14, par: 5, strokeIndex:  2, yardages: { Black: 558, Blue: 525, White: 496, Red: 410 } },
      { number: 15, par: 4, strokeIndex: 18, yardages: { Black: 366, Blue: 334, White: 318, Red: 299 } },
      { number: 16, par: 5, strokeIndex:  8, yardages: { Black: 515, Blue: 475, White: 450, Red: 430 } },
      { number: 17, par: 4, strokeIndex: 16, yardages: { Black: 392, Blue: 372, White: 345, Red: 322 } },
      { number: 18, par: 4, strokeIndex:  6, yardages: { Black: 387, Blue: 382, White: 357, Red: 319 } },
    ],
  },

  // ─── Los Robles Greens Golf Course ──────────────────────────────────────────
  {
    name: 'Los Robles Greens',
    city: 'Thousand Oaks',
    tees: [
      { name: 'Black', rating: 70.3, slope: 126 },
      { name: 'Blue',  rating: 68.9, slope: 122 },
      { name: 'White', rating: 67.1, slope: 118 },
      { name: 'Red',   rating: 65.2, slope: 113 },
    ],
    holes: [
      { number:  1, par: 5, strokeIndex:  9, yardages: { Black: 467, Blue: 452, White: 430, Red: 417 } },
      { number:  2, par: 3, strokeIndex: 17, yardages: { Black: 158, Blue: 151, White: 137, Red: 128 } },
      { number:  3, par: 4, strokeIndex:  3, yardages: { Black: 384, Blue: 361, White: 345, Red: 333 } },
      { number:  4, par: 4, strokeIndex:  7, yardages: { Black: 330, Blue: 309, White: 298, Red: 287 } },
      { number:  5, par: 4, strokeIndex:  5, yardages: { Black: 363, Blue: 344, White: 333, Red: 322 } },
      { number:  6, par: 3, strokeIndex: 13, yardages: { Black: 189, Blue: 178, White: 161, Red: 131 } },
      { number:  7, par: 4, strokeIndex:  1, yardages: { Black: 448, Blue: 427, White: 415, Red: 373 } },
      { number:  8, par: 3, strokeIndex: 15, yardages: { Black: 157, Blue: 149, White: 119, Red: 107 } },
      { number:  9, par: 4, strokeIndex: 11, yardages: { Black: 291, Blue: 279, White: 255, Red: 225 } },
      { number: 10, par: 4, strokeIndex:  2, yardages: { Black: 455, Blue: 438, White: 429, Red: 420 } },
      { number: 11, par: 3, strokeIndex: 12, yardages: { Black: 190, Blue: 168, White: 160, Red: 143 } },
      { number: 12, par: 5, strokeIndex: 18, yardages: { Black: 459, Blue: 449, White: 429, Red: 373 } },
      { number: 13, par: 4, strokeIndex: 14, yardages: { Black: 337, Blue: 324, White: 304, Red: 290 } },
      { number: 14, par: 5, strokeIndex:  8, yardages: { Black: 611, Blue: 593, White: 555, Red: 518 } },
      { number: 15, par: 4, strokeIndex:  6, yardages: { Black: 428, Blue: 396, White: 362, Red: 336 } },
      { number: 16, par: 3, strokeIndex: 16, yardages: { Black: 188, Blue: 176, White: 169, Red: 132 } },
      { number: 17, par: 4, strokeIndex:  4, yardages: { Black: 459, Blue: 443, White: 404, Red: 376 } },
      { number: 18, par: 4, strokeIndex: 10, yardages: { Black: 390, Blue: 363, White: 321, Red: 295 } },
    ],
  },

  // ─── Tierra Rejada Golf Club ─────────────────────────────────────────────────
  {
    name: 'Tierra Rejada Golf Club',
    city: 'Moorpark',
    tees: [
      { name: 'Championship', rating: 71.4, slope: 130 },
      { name: 'Tournament',   rating: 69.3, slope: 124 },
      { name: 'Players',      rating: 66.9, slope: 118 },
      { name: 'Forward',      rating: 64.7, slope: 112 },
    ],
    holes: [
      { number:  1, par: 5, strokeIndex:  5, yardages: { Championship: 580, Tournament: 511, Players: 511, Forward: 475 } },
      { number:  2, par: 3, strokeIndex: 11, yardages: { Championship: 153, Tournament: 153, Players: 130, Forward: 105 } },
      { number:  3, par: 4, strokeIndex:  1, yardages: { Championship: 455, Tournament: 455, Players: 290, Forward: 270 } },
      { number:  4, par: 5, strokeIndex:  7, yardages: { Championship: 530, Tournament: 530, Players: 445, Forward: 445 } },
      { number:  5, par: 4, strokeIndex: 15, yardages: { Championship: 375, Tournament: 280, Players: 280, Forward: 235 } },
      { number:  6, par: 4, strokeIndex: 13, yardages: { Championship: 385, Tournament: 320, Players: 320, Forward: 295 } },
      { number:  7, par: 3, strokeIndex: 17, yardages: { Championship: 130, Tournament: 110, Players: 110, Forward:  80 } },
      { number:  8, par: 4, strokeIndex:  3, yardages: { Championship: 355, Tournament: 355, Players: 295, Forward: 295 } },
      { number:  9, par: 5, strokeIndex:  9, yardages: { Championship: 545, Tournament: 480, Players: 480, Forward: 480 } },
      { number: 10, par: 4, strokeIndex:  6, yardages: { Championship: 345, Tournament: 345, Players: 288, Forward: 288 } },
      { number: 11, par: 3, strokeIndex: 10, yardages: { Championship: 195, Tournament: 185, Players: 185, Forward: 165 } },
      { number: 12, par: 5, strokeIndex: 16, yardages: { Championship: 520, Tournament: 520, Players: 502, Forward: 417 } },
      { number: 13, par: 4, strokeIndex:  2, yardages: { Championship: 400, Tournament: 373, Players: 342, Forward: 342 } },
      { number: 14, par: 3, strokeIndex: 12, yardages: { Championship: 165, Tournament: 154, Players: 154, Forward: 125 } },
      { number: 15, par: 4, strokeIndex:  8, yardages: { Championship: 425, Tournament: 375, Players: 375, Forward: 307 } },
      { number: 16, par: 5, strokeIndex: 18, yardages: { Championship: 488, Tournament: 465, Players: 465, Forward: 403 } },
      { number: 17, par: 3, strokeIndex: 14, yardages: { Championship: 105, Tournament: 105, Players: 118, Forward:  75 } },
      { number: 18, par: 4, strokeIndex:  4, yardages: { Championship: 406, Tournament: 406, Players: 310, Forward: 310 } },
    ],
  },

  // ─── Soule Park Golf Course ──────────────────────────────────────────────────
  {
    name: 'Soule Park Golf Course',
    city: 'Ojai',
    tees: [
      { name: 'Oak',     rating: 72.8, slope: 128 },
      { name: 'Orange',  rating: 71.6, slope: 125 },
      { name: 'Avocado', rating: 70.7, slope: 123 },
      { name: 'Lime',    rating: 66.9, slope: 118 },
    ],
    holes: [
      { number:  1, par: 4, strokeIndex:  7, yardages: { Oak: 393, Orange: 382, Avocado: 370, Lime: 351 } },
      { number:  2, par: 4, strokeIndex:  9, yardages: { Oak: 395, Orange: 361, Avocado: 328, Lime: 312 } },
      { number:  3, par: 3, strokeIndex: 11, yardages: { Oak: 140, Orange: 132, Avocado: 123, Lime: 116 } },
      { number:  4, par: 5, strokeIndex: 13, yardages: { Oak: 512, Orange: 502, Avocado: 492, Lime: 439 } },
      { number:  5, par: 5, strokeIndex: 17, yardages: { Oak: 490, Orange: 478, Avocado: 442, Lime: 432 } },
      { number:  6, par: 3, strokeIndex:  5, yardages: { Oak: 242, Orange: 229, Avocado: 190, Lime: 183 } },
      { number:  7, par: 4, strokeIndex:  3, yardages: { Oak: 429, Orange: 420, Avocado: 357, Lime: 323 } },
      { number:  8, par: 4, strokeIndex:  1, yardages: { Oak: 426, Orange: 408, Avocado: 310, Lime: 301 } },
      { number:  9, par: 4, strokeIndex: 15, yardages: { Oak: 350, Orange: 347, Avocado: 342, Lime: 272 } },
      { number: 10, par: 3, strokeIndex: 14, yardages: { Oak: 160, Orange: 155, Avocado: 142, Lime: 139 } },
      { number: 11, par: 5, strokeIndex: 12, yardages: { Oak: 551, Orange: 513, Avocado: 501, Lime: 460 } },
      { number: 12, par: 4, strokeIndex:  8, yardages: { Oak: 427, Orange: 420, Avocado: 382, Lime: 371 } },
      { number: 13, par: 4, strokeIndex: 16, yardages: { Oak: 370, Orange: 357, Avocado: 344, Lime: 309 } },
      { number: 14, par: 4, strokeIndex:  2, yardages: { Oak: 427, Orange: 420, Avocado: 410, Lime: 355 } },
      { number: 15, par: 4, strokeIndex:  4, yardages: { Oak: 461, Orange: 418, Avocado: 406, Lime: 330 } },
      { number: 16, par: 3, strokeIndex: 10, yardages: { Oak: 172, Orange: 162, Avocado: 156, Lime: 151 } },
      { number: 17, par: 4, strokeIndex:  6, yardages: { Oak: 410, Orange: 392, Avocado: 384, Lime: 354 } },
      { number: 18, par: 5, strokeIndex: 18, yardages: { Oak: 501, Orange: 492, Avocado: 479, Lime: 429 } },
    ],
  },

  // ─── Saticoy Regional Golf Course ───────────────────────────────────────────
  // Par 68 · 18 distinct holes (same par sequence front/back; different yardages)
  {
    name: 'Saticoy Regional',
    city: 'Ventura',
    tees: [
      { name: 'Back',    rating: 66.3, slope: 106 },
      { name: 'Forward', rating: 62.9, slope: 100 },
    ],
    holes: [
      { number:  1, par: 4, strokeIndex:  7, yardages: { Back: 329, Forward: 314 } },
      { number:  2, par: 4, strokeIndex: 11, yardages: { Back: 306, Forward: 298 } },
      { number:  3, par: 5, strokeIndex: 13, yardages: { Back: 449, Forward: 361 } },
      { number:  4, par: 4, strokeIndex:  3, yardages: { Back: 403, Forward: 388 } },
      { number:  5, par: 3, strokeIndex:  9, yardages: { Back: 170, Forward: 150 } },
      { number:  6, par: 3, strokeIndex: 17, yardages: { Back:  99, Forward:  88 } },
      { number:  7, par: 4, strokeIndex:  1, yardages: { Back: 400, Forward: 324 } },
      { number:  8, par: 3, strokeIndex: 15, yardages: { Back: 159, Forward: 151 } },
      { number:  9, par: 4, strokeIndex:  5, yardages: { Back: 324, Forward: 321 } },
      { number: 10, par: 4, strokeIndex:  6, yardages: { Back: 361, Forward: 348 } },
      { number: 11, par: 4, strokeIndex: 12, yardages: { Back: 313, Forward: 292 } },
      { number: 12, par: 5, strokeIndex: 10, yardages: { Back: 463, Forward: 346 } },
      { number: 13, par: 4, strokeIndex:  4, yardages: { Back: 423, Forward: 379 } },
      { number: 14, par: 3, strokeIndex: 16, yardages: { Back: 142, Forward: 133 } },
      { number: 15, par: 3, strokeIndex: 18, yardages: { Back: 110, Forward: 103 } },
      { number: 16, par: 4, strokeIndex:  2, yardages: { Back: 408, Forward: 329 } },
      { number: 17, par: 3, strokeIndex: 14, yardages: { Back: 168, Forward: 140 } },
      { number: 18, par: 4, strokeIndex:  8, yardages: { Back: 328, Forward: 313 } },
    ],
  },

]
