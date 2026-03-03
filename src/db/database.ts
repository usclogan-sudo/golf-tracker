import Dexie, { type Table } from 'dexie'
import type { Course, Player, Round, RoundPlayer, HoleScore, BuyIn, BBBPoint } from '../types'

class GolfDatabase extends Dexie {
  courses!: Table<Course, string>
  players!: Table<Player, string>
  rounds!: Table<Round, string>
  roundPlayers!: Table<RoundPlayer, string>
  holeScores!: Table<HoleScore, string>
  buyIns!: Table<BuyIn, string>
  bbbPoints!: Table<BBBPoint, string>

  constructor() {
    super('GolfTrackerDB')

    // v1: original schema
    this.version(1).stores({
      courses: 'id, name, createdAt',
      players: 'id, name',
      rounds: 'id, courseId, date, status',
    })

    // v2: add join + score tables; add createdAt to players; add courseSnapshot to rounds
    this.version(2)
      .stores({
        courses: 'id, name, createdAt',
        players: 'id, name, createdAt',
        rounds: 'id, courseId, date, status',
        roundPlayers: 'id, roundId, playerId, [roundId+playerId]',
        holeScores: 'id, roundId, playerId, [roundId+playerId+holeNumber]',
      })
      .upgrade(async tx => {
        await tx.table('players').toCollection().modify((p: any) => {
          if (!p.createdAt) p.createdAt = new Date()
        })
        const rounds = await tx.table('rounds').toArray()
        for (const r of rounds as any[]) {
          if (!r.courseSnapshot && r.courseId) {
            const course = await tx.table('courses').get(r.courseId)
            if (course) {
              r.courseSnapshot = {
                courseId: course.id,
                courseName: course.name,
                tees: course.tees,
                holes: course.holes,
              }
            }
          }
        }
        await tx.table('rounds').bulkPut(rounds as any[])
      })

    // v3: add buyIns table; add treasurer + game fields to round index
    this.version(3)
      .stores({
        courses: 'id, name, createdAt',
        players: 'id, name, createdAt',
        rounds: 'id, courseId, date, status, treasurerPlayerId',
        roundPlayers: 'id, roundId, playerId, [roundId+playerId]',
        holeScores: 'id, roundId, playerId, [roundId+playerId+holeNumber]',
        buyIns: 'id, roundId, playerId, [roundId+playerId], status',
      })
      .upgrade(async tx => {
        await tx.table('rounds').toCollection().modify((r: any) => {
          if (!('treasurerPlayerId' in r)) r.treasurerPlayerId = undefined
          if (!('game' in r)) r.game = undefined
        })
      })

    // v4: add bbbPoints table for Bingo Bango Bongo per-hole tracking
    this.version(4).stores({
      courses: 'id, name, createdAt',
      players: 'id, name, createdAt',
      rounds: 'id, courseId, date, status, treasurerPlayerId',
      roundPlayers: 'id, roundId, playerId, [roundId+playerId]',
      holeScores: 'id, roundId, playerId, [roundId+playerId+holeNumber]',
      buyIns: 'id, roundId, playerId, [roundId+playerId], status',
      bbbPoints: 'id, roundId, holeNumber, [roundId+holeNumber]',
    })
  }
}

export const db = new GolfDatabase()
