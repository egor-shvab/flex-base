import { describe, expect, it } from 'vitest'
import { pagePath } from '~/utils/page-path'

describe('pagePath', () => {
  it('puts every page of a workspace under its address', () => {
    expect(pagePath.workspace('k3f9x2m8qa')).toBe('/w/k3f9x2m8qa')
    expect(pagePath.table('k3f9x2m8qa', '4')).toBe('/w/k3f9x2m8qa/tables/4')
    expect(pagePath.tableSettings('k3f9x2m8qa', '4')).toBe('/w/k3f9x2m8qa/tables/4/settings')
  })
})
