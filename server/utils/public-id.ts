import { randomBytes } from 'node:crypto'
import { WORKSPACE_ADDRESS_ALPHABET, WORKSPACE_ADDRESS_LENGTH } from '#shared/constants/workspace'

type TReadRandomBytes = (size: number) => Uint8Array

/**
 * The largest multiple of the alphabet's length a byte can hold. A byte at or past it is
 * discarded rather than folded in with `%`, which would make the first letters likelier.
 */
const UNBIASED_BYTE_LIMIT =
  Math.floor(256 / WORKSPACE_ADDRESS_ALPHABET.length) * WORKSPACE_ADDRESS_ALPHABET.length

/** About 51 bits of entropy: a collision is retried by the insert, never prevented here. */
export function buildPublicId(readRandomBytes: TReadRandomBytes = randomBytes): string {
  let publicId = ''

  while (publicId.length < WORKSPACE_ADDRESS_LENGTH) {
    for (const byte of readRandomBytes(WORKSPACE_ADDRESS_LENGTH)) {
      if (byte >= UNBIASED_BYTE_LIMIT) continue

      publicId += WORKSPACE_ADDRESS_ALPHABET[byte % WORKSPACE_ADDRESS_ALPHABET.length]
      if (publicId.length === WORKSPACE_ADDRESS_LENGTH) break
    }
  }

  return publicId
}
