import { describe, expect, it } from 'vitest'
import { DETAIL_PARAM } from '#shared/constants/filter'
import {
  parseDetailChain,
  popDetail,
  pushDetail,
  toDetailParam,
  withDetailChain,
} from '#shared/utils/record-detail'

const ref = (tableAddress: string, recordAddress: string) => ({ tableAddress, recordAddress })

describe('parseDetailChain', () => {
  it('is empty when the param is absent or blank', () => {
    expect(parseDetailChain({})).toEqual([])
    expect(parseDetailChain({ [DETAIL_PARAM]: '' })).toEqual([])
    expect(parseDetailChain({ [DETAIL_PARAM]: undefined })).toEqual([])
  })

  it('reads one entry', () => {
    expect(parseDetailChain({ [DETAIL_PARAM]: 'tbl1.rec1' })).toEqual([ref('tbl1', 'rec1')])
  })

  it('reads a trail, outermost first', () => {
    expect(parseDetailChain({ [DETAIL_PARAM]: 'tbl1.rec1,tbl2.rec2,tbl3.rec3' })).toEqual([
      ref('tbl1', 'rec1'),
      ref('tbl2', 'rec2'),
      ref('tbl3', 'rec3'),
    ])
  })

  it('stops at a malformed entry rather than skipping it', () => {
    // A Back that silently jumped over a record would be worse than a shorter trail
    expect(parseDetailChain({ [DETAIL_PARAM]: 'tbl1.rec1,broken,tbl3.rec3' })).toEqual([
      ref('tbl1', 'rec1'),
    ])
  })

  it('treats an entry with an empty half or an extra separator as malformed', () => {
    expect(parseDetailChain({ [DETAIL_PARAM]: 'tbl1.' })).toEqual([])
    expect(parseDetailChain({ [DETAIL_PARAM]: '.rec1' })).toEqual([])
    expect(parseDetailChain({ [DETAIL_PARAM]: 'tbl1.rec1.extra' })).toEqual([])
  })

  it('reads only the first value of a repeated param', () => {
    expect(parseDetailChain({ [DETAIL_PARAM]: ['tbl1.rec1', 'tbl2.rec2'] })).toEqual([
      ref('tbl1', 'rec1'),
    ])
  })
})

describe('toDetailParam', () => {
  it('drops the param entirely for a closed dialog', () => {
    expect(toDetailParam([])).toBeUndefined()
  })

  it('serializes a trail', () => {
    expect(toDetailParam([ref('tbl1', 'rec1'), ref('tbl2', 'rec2')])).toBe('tbl1.rec1,tbl2.rec2')
  })

  it('round-trips through parseDetailChain', () => {
    const chain = [ref('tbl1', 'rec1'), ref('tbl2', 'rec2'), ref('tbl3', 'rec3')]
    expect(parseDetailChain({ [DETAIL_PARAM]: toDetailParam(chain) })).toEqual(chain)
  })
})

describe('pushDetail / popDetail', () => {
  it('drilling in keeps the trail behind it', () => {
    expect(pushDetail([ref('tbl1', 'rec1')], ref('tbl2', 'rec2'))).toEqual([
      ref('tbl1', 'rec1'),
      ref('tbl2', 'rec2'),
    ])
  })

  it('going back from the outermost record closes the dialog', () => {
    expect(popDetail([ref('tbl1', 'rec1')])).toEqual([])
    expect(popDetail([])).toEqual([])
  })

  it('neither mutates the chain it was given', () => {
    const chain = [ref('tbl1', 'rec1')]
    pushDetail(chain, ref('tbl2', 'rec2'))
    popDetail(chain)
    expect(chain).toEqual([ref('tbl1', 'rec1')])
  })
})

describe('withDetailChain', () => {
  it('leaves the list query it is layered onto untouched', () => {
    const query = { page: '2', stage: ['Won', 'Lost'] }
    expect(withDetailChain(query, [ref('tbl1', 'rec1')])).toEqual({
      page: '2',
      stage: ['Won', 'Lost'],
      [DETAIL_PARAM]: 'tbl1.rec1',
    })
  })

  it('sets the param to undefined for an empty chain, which the router drops', () => {
    expect(withDetailChain({ page: '2' }, [])).toEqual({ page: '2', [DETAIL_PARAM]: undefined })
  })
})
