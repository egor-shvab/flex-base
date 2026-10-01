import { describe, expect, it } from 'vitest'
import { buildPageWindow } from '~/utils/pagination'

describe('buildPageWindow', () => {
  it('draws a single page as itself', () => {
    expect(buildPageWindow(1, 1, false)).toEqual([1])
  })

  it('draws every page when there are few enough', () => {
    expect(buildPageWindow(2, 3, false)).toEqual([1, 2, 3])
  })

  it('keeps the first, the last and the current page with its neighbours', () => {
    expect(buildPageWindow(5, 10, false)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10])
  })

  it('opens at the start with one gap before the last page', () => {
    expect(buildPageWindow(1, 10, false)).toEqual([1, 2, 'gap', 10])
  })

  it('closes at the end with one gap after the first page', () => {
    expect(buildPageWindow(10, 10, false)).toEqual([1, 'gap', 9, 10])
  })

  /** A gap that would hide exactly one page draws that page: the cell is the same size. */
  it('never lets a gap stand in for a single page', () => {
    expect(buildPageWindow(4, 10, false)).toEqual([1, 2, 3, 4, 5, 'gap', 10])
    expect(buildPageWindow(7, 10, false)).toEqual([1, 'gap', 6, 7, 8, 9, 10])
  })

  it('draws page one for an empty table', () => {
    expect(buildPageWindow(1, 0, false)).toEqual([1])
  })

  describe('a capped total', () => {
    /** `pageCount` is a floor, so drawing it as the last page would be a claim. */
    it('never draws the last page, and trails a gap for the pages past the count', () => {
      expect(buildPageWindow(1, 20, true)).toEqual([1, 2, 'gap'])
      expect(buildPageWindow(5, 20, true)).toEqual([1, 'gap', 4, 5, 6, 'gap'])
    })

    it('stops the window at the floor it knows', () => {
      expect(buildPageWindow(20, 20, true)).toEqual([1, 'gap', 19, 20, 'gap'])
    })

    it('still draws the current page when it is past the floor', () => {
      expect(buildPageWindow(22, 20, true)).toEqual([1, 'gap', 21, 22, 'gap'])
    })
  })
})
