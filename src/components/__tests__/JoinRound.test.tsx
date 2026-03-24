// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { JoinRound } from '../JoinRound/JoinRound'

// ─── Supabase mock ──────────────────────────────────────────────────────────

let rpcHandler: (name: string, params: any) => Promise<{ data: any; error: any }>

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn((...args: any[]) => rpcHandler(args[0], args[1])),
  },
}))

const onJoined = vi.fn()
const onCancel = vi.fn()

function renderJoinRound(props?: Partial<{ userId: string; initialCode: string }>) {
  return render(
    <JoinRound
      userId={props?.userId ?? 'user-1'}
      initialCode={props?.initialCode}
      onJoined={onJoined}
      onCancel={onCancel}
    />,
  )
}

const mockRoundData = {
  id: 'round-1',
  course_snapshot: { courseName: 'Augusta National' },
  game: { type: 'skins' },
  players: [
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' },
    { id: 'p3', name: 'Charlie' },
  ],
  participants: [
    { id: 'rp-1', user_id: 'other-user', player_id: 'p1' }, // Alice claimed by someone else
    { id: 'rp-2', user_id: 'user-1', player_id: 'p2' },     // Bob claimed by our user
  ],
  current_hole: 5,
}

beforeEach(() => {
  vi.clearAllMocks()
  rpcHandler = async () => ({ data: null, error: null })
})

// ─── Initial render ─────────────────────────────────────────────────────────

describe('initial code entry screen', () => {
  it('renders invite code input and Find Round button', () => {
    renderJoinRound()
    expect(screen.getByPlaceholderText('ABC123')).toBeDefined()
    expect(screen.getByText('Find Round')).toBeDefined()
  })

  it('Find Round button disabled when code < 6 chars', () => {
    renderJoinRound()
    const input = screen.getByPlaceholderText('ABC123') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'ABC' } })
    const btn = screen.getByText('Find Round') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Find Round button enabled when code = 6 chars', () => {
    renderJoinRound()
    const input = screen.getByPlaceholderText('ABC123') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'ABCDEF' } })
    const btn = screen.getByText('Find Round') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('input uppercases and strips non-alphanumeric', () => {
    renderJoinRound()
    const input = screen.getByPlaceholderText('ABC123') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'ab-c1 2!' } })
    expect(input.value).toBe('ABC12')
  })

  it('Cancel button calls onCancel', () => {
    renderJoinRound()
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

// ─── Round lookup ───────────────────────────────────────────────────────────

describe('after successful round lookup', () => {
  beforeEach(() => {
    rpcHandler = async (name: string) => {
      if (name === 'get_event_by_invite') return { data: null, error: { message: 'not found' } }
      if (name === 'get_round_by_invite') return { data: mockRoundData, error: null }
      return { data: null, error: null }
    }
  })

  it('shows round preview with course name and game type', async () => {
    renderJoinRound()
    const input = screen.getByPlaceholderText('ABC123') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'XYZ789' } })
    fireEvent.click(screen.getByText('Find Round'))

    await waitFor(() => {
      expect(screen.getByText('Augusta National')).toBeDefined()
    })
    expect(screen.getByText('Skins')).toBeDefined()
    expect(screen.getByText('3 players')).toBeDefined()
    expect(screen.getByText('Hole 5')).toBeDefined()
  })

  it('shows player picker with claimed/available states', async () => {
    renderJoinRound()
    const input = screen.getByPlaceholderText('ABC123') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'XYZ789' } })
    fireEvent.click(screen.getByText('Find Round'))

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeDefined()
    })

    // Alice is claimed by another user
    expect(screen.getByText('Already claimed')).toBeDefined()

    // Bob is claimed by current user
    expect(screen.getByText('Your player')).toBeDefined()

    // Charlie is unclaimed
    expect(screen.getByText('Charlie')).toBeDefined()
  })

  it('shows "already joined" banner when user has a participant record', async () => {
    renderJoinRound()
    const input = screen.getByPlaceholderText('ABC123') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'XYZ789' } })
    fireEvent.click(screen.getByText('Find Round'))

    await waitFor(() => {
      expect(screen.getByText(/already joined/i)).toBeDefined()
    })
  })

  it('claimed player buttons are disabled', async () => {
    renderJoinRound()
    const input = screen.getByPlaceholderText('ABC123') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'XYZ789' } })
    fireEvent.click(screen.getByText('Find Round'))

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeDefined()
    })

    // Find the button that contains "Alice"
    const aliceBtn = screen.getByText('Alice').closest('button') as HTMLButtonElement
    expect(aliceBtn.disabled).toBe(true)

    // Charlie is not claimed — button should be enabled
    const charlieBtn = screen.getByText('Charlie').closest('button') as HTMLButtonElement
    expect(charlieBtn.disabled).toBe(false)
  })
})

// ─── Error handling ─────────────────────────────────────────────────────────

describe('error handling', () => {
  it('shows "Invalid or expired" for not-found errors', async () => {
    rpcHandler = async (name: string) => {
      if (name === 'get_event_by_invite') return { data: null, error: { message: 'not found' } }
      if (name === 'get_round_by_invite') return { data: null, error: null }
      return { data: null, error: null }
    }

    renderJoinRound()
    const input = screen.getByPlaceholderText('ABC123') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'BADCOD' } })
    fireEvent.click(screen.getByText('Find Round'))

    await waitFor(() => {
      expect(screen.getByText('Invalid or expired invite code')).toBeDefined()
    })
  })

  it('shows RPC error message for other failures', async () => {
    rpcHandler = async (name: string) => {
      if (name === 'get_event_by_invite') return { data: null, error: { message: 'not found' } }
      if (name === 'get_round_by_invite') return { data: null, error: { message: 'Server unreachable' } }
      return { data: null, error: null }
    }

    renderJoinRound()
    const input = screen.getByPlaceholderText('ABC123') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'BADCOD' } })
    fireEvent.click(screen.getByText('Find Round'))

    await waitFor(() => {
      expect(screen.getByText('Server unreachable')).toBeDefined()
    })
  })
})

// ─── Join flow ──────────────────────────────────────────────────────────────

describe('join flow', () => {
  it('calls onJoined with roundId after successful join', async () => {
    rpcHandler = async (name: string) => {
      if (name === 'get_event_by_invite') return { data: null, error: { message: 'not found' } }
      if (name === 'get_round_by_invite') return { data: mockRoundData, error: null }
      if (name === 'join_round') return { data: { id: 'rp-new' }, error: null }
      return { data: null, error: null }
    }

    renderJoinRound()
    const input = screen.getByPlaceholderText('ABC123') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'XYZ789' } })
    fireEvent.click(screen.getByText('Find Round'))

    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeDefined()
    })

    // Join as Charlie (unclaimed)
    fireEvent.click(screen.getByText('Charlie').closest('button')!)

    await waitFor(() => {
      expect(onJoined).toHaveBeenCalledWith('round-1')
    })
  })

  it('shows error when join fails due to already-claimed player', async () => {
    rpcHandler = async (name: string) => {
      if (name === 'get_event_by_invite') return { data: null, error: { message: 'not found' } }
      if (name === 'get_round_by_invite') return { data: mockRoundData, error: null }
      if (name === 'join_round') return { data: null, error: { message: 'Player already claimed by another user' } }
      return { data: null, error: null }
    }

    renderJoinRound()
    const input = screen.getByPlaceholderText('ABC123') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'XYZ789' } })
    fireEvent.click(screen.getByText('Find Round'))

    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Charlie').closest('button')!)

    await waitFor(() => {
      expect(screen.getByText('This player is already claimed by another user')).toBeDefined()
    })
  })
})

// ─── "Enter a different code" navigation ────────────────────────────────────

describe('navigation', () => {
  it('"Enter a different code" returns to code entry', async () => {
    rpcHandler = async (name: string) => {
      if (name === 'get_event_by_invite') return { data: null, error: { message: 'not found' } }
      if (name === 'get_round_by_invite') return { data: mockRoundData, error: null }
      return { data: null, error: null }
    }

    renderJoinRound()
    const input = screen.getByPlaceholderText('ABC123') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'XYZ789' } })
    fireEvent.click(screen.getByText('Find Round'))

    await waitFor(() => {
      expect(screen.getByText(/different code/)).toBeDefined()
    })

    fireEvent.click(screen.getByText(/different code/))
    expect(screen.getByPlaceholderText('ABC123')).toBeDefined()
  })
})
