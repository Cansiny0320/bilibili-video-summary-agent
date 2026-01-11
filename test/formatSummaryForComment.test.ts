import { describe, expect, it } from 'vitest'
import { AIService } from '../src/ai'

describe('AIService.formatSummaryForComment', () => {
  it('converts basic markdown to bilibili comment style', () => {
    const ai = new AIService('test')
    const input = `## Title\n\n- **Bold** item\n- item2\n\nExtra\n\n\nLines\n`

    expect(ai.formatSummaryForComment(input)).toBe(
      '【Title】\n\n• Bold item\n• item2\n\nExtra\n\nLines',
    )
  })
})
