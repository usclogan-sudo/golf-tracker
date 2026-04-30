import type { Round, RoundParticipant, EventParticipant } from '../types'

export interface ScorecardPermissions {
  isCreator: boolean
  isGameMaster: boolean
  isScoremasterRole: boolean
  selfEntryOnly: boolean
  myParticipant: RoundParticipant | undefined
  myEventParticipant: EventParticipant | undefined
  isEventManager: boolean
  isGroupScorekeeper: boolean
  isScoreMaster: boolean
  groupHasActiveScorekeeper: boolean
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

  // Score Master = event manager or creator in event context (cross-group edit access)
  const isScoreMaster = isEventRound && (isEventManager || isScoremasterRole)

  // Does the current player's group have an active (joined) scorekeeper?
  // True when a scorekeeper EventParticipant exists for this group and it's not the player themselves
  const groupHasActiveScorekeeper = isEventRound && myEventGroupNumber != null &&
    eventParticipants.some(ep =>
      ep.role === 'scorekeeper' &&
      ep.groupNumber === myEventGroupNumber &&
      ep.userId !== userId
    )

  const readOnly = readOnlyProp || (!isScoremasterRole && !myParticipant && !myEventParticipant)

  return {
    isCreator,
    isGameMaster,
    isScoremasterRole,
    selfEntryOnly,
    myParticipant,
    myEventParticipant,
    isEventManager,
    isGroupScorekeeper,
    isScoreMaster,
    groupHasActiveScorekeeper,
    canApproveScores,
    readOnly,
    myEventGroupNumber,
  }
}
