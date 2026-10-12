import assert from 'node:assert/strict'
import axios from 'axios'
import { afterEach, it, vi } from 'vitest'
import { BilibiliClient } from '../src/bilibili'

afterEach(() => vi.restoreAllMocks())

const bvid = 'BV111BeBPEaD'
const aid = 115785037059324
const cid = 35045576155
function track(id: string, lan = 'zh-CN', url = `https://subtitle.invalid/${id}`) {
  return {
    id_str: id,
    lan,
    subtitle_url: url,
  }
}

interface FixtureOptions {
  ids?: string[] | null
  htmlCid?: number
  tracks?: ReturnType<typeof track>[]
  identity?: { bvid?: string, aid?: number, cid?: number }
  responses?: ReturnType<typeof track>[][]
}

function fixture({ ids = ['correct'], htmlCid = cid, tracks = [track('correct')], identity = {}, responses }: FixtureOptions = {}) {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const requests: URL[] = []
  let attempts = 0
  const http = axios.create()
  vi.spyOn(http, 'get').mockImplementation(async (url) => {
    requests.push(new URL(url))
    if (url.includes('www.bilibili.com/video/')) {
      return { data: ids === null
        ? '<html></html>'
        : `window.__INITIAL_STATE__=${JSON.stringify({ videoData: { bvid, cid: htmlCid, subtitle: { list: ids.map(id => ({ id_str: id })) } } })};` }
    }
    if (url.includes('/x/player/wbi/v2')) {
      const subtitles = responses ? responses[attempts++] : tracks
      return { data: { code: 0, data: { bvid, aid, cid, ...identity, subtitle: { subtitles } } } }
    }
    assert.equal(new URL(url).hostname, 'subtitle.invalid')
    return { data: { body: [{ from: 0, to: 1, content: new URL(url).pathname.slice(1) }] } }
  })
  vi.spyOn(axios, 'create').mockReturnValue(http)
  const client = new BilibiliClient()
  return { client, requests }
}

it('matching subtitle is downloaded once', async () => {
  const { client, requests } = fixture()
  assert.equal((await client.getSubtitles(bvid, cid, aid))[0].content, 'correct')
  assert.equal(requests.filter(r => r.pathname === '/x/player/wbi/v2').length, 1)
})

it('mismatched subtitle IDs are never downloaded after retry exhaustion', async () => {
  // Observed on this video in Chrome: correct video identity, unrelated drama subtitle.
  const { client, requests } = fixture({
    ids: ['1919454681436866816'],
    tracks: [track('1533361809971806976', 'ai-zh')],
  })
  assert.deepEqual(await client.getSubtitles(bvid, cid, aid), [])
  assert.equal(requests.filter(r => r.pathname === '/x/player/wbi/v2').length, 4)
  assert.equal(requests.filter(r => r.hostname === 'subtitle.invalid').length, 0)
})

it('a later matching response recovers without downloading earlier mismatches', async () => {
  const { client, requests } = fixture({ responses: [[track('wrong')], [track('correct')]] })
  assert.equal((await client.getSubtitles(bvid, cid, aid))[0].content, 'correct')
  assert.deepEqual(requests.filter(r => r.hostname === 'subtitle.invalid').map(r => r.pathname), ['/correct'])
})

it('HTML verification uses the requested part, while API uses its CID', async () => {
  const { client, requests } = fixture()
  assert.equal((await client.getSubtitles(bvid, cid, aid, 2))[0].content, 'correct')
  assert.equal(requests.find(r => r.hostname === 'www.bilibili.com')?.searchParams.get('p'), '2')
  assert.equal(requests.find(r => r.pathname === '/x/player/wbi/v2')?.searchParams.get('cid'), String(cid))
})

it('P2 accepts its WBI subtitles when HTML metadata still belongs to P1', async () => {
  const { client, requests } = fixture({ htmlCid: 28092009765, ids: ['p1'], tracks: [track('p2')] })
  assert.equal((await client.getSubtitles(bvid, cid, aid, 2))[0]?.content, 'p2')
  assert.deepEqual(requests.filter(r => r.hostname === 'subtitle.invalid').map(r => r.pathname), ['/p2'])
})

it('P2 rejects a WBI response for P1 even when HTML metadata belongs to P1', async () => {
  const { client, requests } = fixture({ htmlCid: 28092009765, ids: ['p1'], tracks: [track('p1')], identity: { cid: 28092009765 } })
  assert.deepEqual(await client.getSubtitles(bvid, cid, aid, 2), [])
  assert.equal(requests.filter(r => r.hostname === 'subtitle.invalid').length, 0)
})

for (const [field, value] of [['bvid', 'BV9999999999'], ['aid', 999], ['cid', 999], ['cid', undefined]] as const) {
  it(`rejects wrong or missing response identity: ${field}=${value}`, async () => {
    const { client, requests } = fixture({ identity: { [field]: value } })
    assert.deepEqual(await client.getSubtitles(bvid, cid, aid), [])
    assert.equal(requests.filter(r => r.hostname === 'subtitle.invalid').length, 0)
  })
}

it('matching response identity cannot bypass missing HTML subtitle IDs', async () => {
  const { client, requests } = fixture({ ids: null })
  assert.deepEqual(await client.getSubtitles(bvid, cid, aid), [])
  assert.equal(requests.filter(r => r.hostname === 'subtitle.invalid').length, 0)
})

it('tracks with empty URLs do not hide a usable lower-priority language', async () => {
  const { client } = fixture({ ids: ['ai', 'correct'], tracks: [track('ai', 'ai-zh', ''), track('correct')] })
  assert.equal((await client.getSubtitles(bvid, cid, aid))[0].content, 'correct')
})

it('no subtitles returns an empty result for the existing transcription fallback', async () => {
  const { client, requests } = fixture({ tracks: [] })
  assert.deepEqual(await client.getSubtitles(bvid, cid, aid), [])
  assert.equal(requests.filter(r => r.hostname === 'subtitle.invalid').length, 0)
})
