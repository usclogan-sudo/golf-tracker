import type { Round, RoundParticipant, EventParticipant } from '../types'

export interface ScorecardPermissions {
  isCreator: boolean
  isGameMaster: boolean
  isScoremasterRole: boolean
  selfEntryOnly: boolean
  isEventManager: boolean
  isGroupScorekeeper: boolean
  canApproveScores: boolean
  readOnly: boolean
  myEventGroupNumber: number | undefined
}

export function computeScorecardPermissions(
  userId: string,
  round: Pick<Round, 'createdBy' | 'gameMasterId'> | null,
  roundParticipants: RoundParticipant[],
  eventParticipants: EventParticipant[],
  isEventRound: boolean,
  readOnlyProp: boolean,
): ScorecardPermissions {
  const isCreator = userId === round?.createdBy
  const isGameMaster = userId === round?.gameMasterId
  const isScoremasterRole = isCreator || isGameMaster
  const myParticipant = roundParticipants.find(p => p.userId === userId)
  const selfEntryOnly = !!myParticipant && !isScoremasterRole

  const myEventParticipant = eventParticipants.find(ep => ep.userId === userId)
  const isEventManager = myEventParticipant?.role === 'manager' || isCreator
  const isGroupScorekeeper = myEventParticipant?.role === 'scorekeeper'
  const canApproveScores = isEventRound && (isEventManager || isGroupScorekeeper || isScoremasterRole)
  const myEventGroupNumber = myEventParticipant?.groupNumber

  const readOnly = readOnlyProp || (!isScoremasterRole && !myParticipant && !myEventParticipant)

  return {
    isCreator,
    isGameMaster,
    isScoremasterRole,
    selfEntryOnly,
    isEventManager,
    isGroupScorekeeper,
    canApproveScores,
    readOnly,
    myEventGroupNumber,
  }
}
