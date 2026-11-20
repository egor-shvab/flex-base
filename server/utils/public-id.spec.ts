import { describe, expect, it } from 'vitest'
import { buildPublicId } from '#server/utils/public-id'
import { parseWorkspaceAddress } from '#shared/utils/address'

/** Hands out the given bytes in order, as many per call as asked. */
function bytesFrom(...bytes: number[]) {
  const sizes: number[] = []
  let cursor = 0

  const read = (size: number) => {
    sizes.push(size)
    const chunk = Uint8Array.from(bytes.slice(cursor, cursor + size))
    cursor += size
    return chunk
  }

  return { read, sizes }
}

describe('buildPublicId', () => {
  it('maps each byte onto the alphabet', () => {
    const { read } = bytesFrom(0, 1, 2, 25, 26, 35, 36, 37, 71, 72)

    expect(buildPublicId(read)).toBe('abcz09ab9a')
  })

  it('discards a byte that would bias the alphabet, and reads more to fill the gap', () => {
    const { read, sizes } = bytesFrom(252, 255, ...Array.from({ length: 18 }, () => 0))

    expect(buildPublicId(read)).toBe('aaaaaaaaaa')
    expect(sizes).toEqual([10, 10])
  })

  it('produces an address the parser accepts', () => {
    const { read } = bytesFrom(7, 200, 13, 99, 251, 42, 5, 180, 64, 33)

    expect(parseWorkspaceAddress(buildPublicId(read))).not.toBe('')
  })
})
