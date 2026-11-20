import { describe, expect, it } from 'vitest'
import { apiPath } from '~/api/paths'

describe('apiPath', () => {
  it('leaves an ordinary address as it is', () => {
    expect(apiPath.record('k3f9x2m8qa', '4', '12')).toBe(
      '/api/workspaces/k3f9x2m8qa/tables/4/records/12',
    )
  })

  it('encodes every segment, so an address cannot climb to another endpoint', () => {
    expect(apiPath.table('k3f9x2m8qa', '../../auth/me')).toBe(
      '/api/workspaces/k3f9x2m8qa/tables/..%2F..%2Fauth%2Fme',
    )
    expect(apiPath.member('a/b', 'mem?x=1')).toBe('/api/workspaces/a%2Fb/members/mem%3Fx%3D1')
  })
})
