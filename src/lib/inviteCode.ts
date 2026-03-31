const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O, 1/I

export function generateInviteCode(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += INVITE_CHARS[bytes[i] % INVITE_CHARS.length]
  }
  return code
}
