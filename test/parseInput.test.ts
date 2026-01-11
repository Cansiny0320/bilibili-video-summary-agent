import { describe, expect, it } from 'vitest'
import { BilibiliClient } from '../src/bilibili'

describe('BilibiliClient.parseInput', () => {
  it('parses BV id from plain input', () => {
    expect(BilibiliClient.parseInput('BV1uT4y1P7CX')).toEqual({
      bvid: 'BV1uT4y1P7CX',
      page: 1,
    })
  })

  it('parses BV id and page from URL', () => {
    expect(
      BilibiliClient.parseInput('https://www.bilibili.com/video/BV1uT4y1P7CX?p=2'),
    ).toEqual({
      bvid: 'BV1uT4y1P7CX',
      page: 2,
    })
  })

  it('returns null for invalid input', () => {
    expect(BilibiliClient.parseInput('not-a-bvid')).toEqual({
      bvid: null,
      page: 1,
    })
  })
})
