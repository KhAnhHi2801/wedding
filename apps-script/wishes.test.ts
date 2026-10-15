/**
 * Chạy apps-script/wishes.gs thật trong một sandbox với Sheet, cache, lock và properties giả lập,
 * vì không chạy được Apps Script ở máy này. Kiểm tra luồng ghi/đọc, giới hạn chống spam, phân trang,
 * và việc bản sao logic trong .gs giống bản TypeScript của website.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { beforeEach, describe, expect, it } from 'vitest'
import { PROFANITY_WORDS } from '../src/lib/profanity-list'
import { cleanText, containsProfanity, validateWish } from '../src/lib/wish-validation'

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'wishes.gs'), 'utf8')

type Row = string[]

function createSandbox() {
  const rows: Row[] = [] // rows[0] là dòng 1 (tiêu đề)
  const formatCalls: Array<{ row: number; format: string }> = []
  const cacheStore = new Map<string, string>()
  const props = new Map<string, string>()
  let uuid = 0

  const sheet = {
    appendRow: (row: Row) => void rows.push(row),
    setFrozenRows: () => undefined,
    getLastRow: () => rows.length,
    getRange: (row: number, col: number, numRows: number, numCols: number) => ({
      setNumberFormat(format: string) {
        formatCalls.push({ row, format })
        return this
      },
      setValues(values: Row[]) {
        rows[row - 1] = values[0]
      },
      getValues: () => rows.slice(row - 1, row - 1 + numRows).map((r) => r.slice(col - 1, col - 1 + numCols)),
    }),
  }
  let hasSheet = false
  const spreadsheet = {
    getSheetByName: () => (hasSheet ? sheet : null),
    insertSheet: () => {
      hasSheet = true
      return sheet
    },
  }

  const output = (text: string) => ({
    text,
    setMimeType() {
      return this
    },
  })

  const context = vm.createContext({
    ContentService: { createTextOutput: output, MimeType: { JSON: 'json' } },
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    CacheService: {
      getScriptCache: () => ({
        get: (key: string) => cacheStore.get(key) ?? null,
        put: (key: string, value: string) => {
          // CacheService thật từ chối giá trị > 100KB.
          if (Buffer.byteLength(value) > 100 * 1024) throw new Error('Argument too large: value')
          cacheStore.set(key, value)
        },
        remove: (key: string) => void cacheStore.delete(key),
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => props.get(key) ?? null,
        setProperty: (key: string, value: string) => void props.set(key, value),
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock: () => undefined, hasLock: () => true, releaseLock: () => undefined }) },
    Utilities: {
      formatDate: () => '2026-12-20',
      getUuid: () => `id-${++uuid}`,
    },
  })
  vm.runInContext(source, context)

  const call = (fn: 'doGet' | 'doPost', arg: unknown) =>
    JSON.parse((vm.runInContext(`${fn}`, context) as (a: unknown) => { text: string })(arg).text)

  const post = (body: Record<string, unknown>) =>
    call('doPost', { postData: { contents: JSON.stringify(body) } })
  const get = (parameter: Record<string, string> = {}) => call('doGet', { parameter })

  return {
    rows,
    formatCalls,
    cacheStore,
    props,
    post,
    get,
    postRaw: (contents: string) => call('doPost', { postData: { contents } }),
    run: <T>(code: string) => vm.runInContext(code, context) as T,
    /** Thêm thẳng một dòng vào Sheet (bỏ qua giới hạn chống spam) để dựng dữ liệu phân trang. */
    seed: (id: string, status = 'visible', name = `name-${id}`, message = `message ${id}`) => {
      if (rows.length === 0) rows.push(['id', 'createdAt', 'name', 'message', 'status'])
      hasSheet = true
      rows.push([id, `2026-12-01T00:00:${String(rows.length).padStart(2, '0')}Z`, name, message, status])
    },
  }
}

const valid = (overrides: Record<string, unknown> = {}) => ({
  name: 'Thu Hà',
  message: 'Chúc hai bạn trăm năm hạnh phúc!',
  token: 'browser-1',
  elapsedMs: 5000,
  website: '',
  requestId: '',
  ...overrides,
})

let sandbox: ReturnType<typeof createSandbox>
beforeEach(() => {
  sandbox = createSandbox()
})

describe('doGet', () => {
  it('returns an empty list for a new sheet', () => {
    expect(sandbox.get()).toEqual({ ok: true, items: [], nextCursor: null })
  })

  it('lists only visible wishes, newest first', () => {
    sandbox.seed('a')
    sandbox.seed('b', 'hidden')
    sandbox.seed('c')
    expect(sandbox.get().items.map((i: { id: string }) => i.id)).toEqual(['c', 'a'])
  })

  it('pages through every visible wish exactly once', () => {
    for (let i = 1; i <= 7; i++) sandbox.seed(`w${i}`, i % 3 === 0 ? 'hidden' : 'visible')
    const seen: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const page: { items: Array<{ id: string }>; nextCursor: string | null } = sandbox.get({
        limit: '2',
        ...(cursor ? { before: cursor } : {}),
      })
      seen.push(...page.items.map((i) => i.id))
      cursor = page.nextCursor
      pages++
    } while (cursor && pages < 10)
    expect(seen).toEqual(['w7', 'w5', 'w4', 'w2', 'w1'])
  })

  it('returns no cursor when every visible wish fits in the page', () => {
    sandbox.seed('a')
    sandbox.seed('b')
    expect(sandbox.get({ limit: '2' }).nextCursor).toBeNull()
    expect(sandbox.get({ limit: '5' }).nextCursor).toBeNull()
  })

  it('returns a cursor to older rows when the page is full', () => {
    sandbox.seed('a')
    sandbox.seed('b')
    sandbox.seed('c')
    const page = sandbox.get({ limit: '2' })
    expect(page.items.map((i: { id: string }) => i.id)).toEqual(['c', 'b'])
    expect(page.nextCursor).toBe('3') // dòng 3 (b) là dòng cuối đã trả; trang sau bắt đầu từ dòng 2
    expect(sandbox.get({ limit: '2', before: '3' }).items.map((i: { id: string }) => i.id)).toEqual(['a'])
  })

  it('clamps an oversized limit', () => {
    for (let i = 1; i <= 3; i++) sandbox.seed(`w${i}`)
    expect(sandbox.get({ limit: '99999' }).items).toHaveLength(3)
  })

  it('invalidates cached pages of every size when a wish is posted', () => {
    sandbox.seed('a')
    expect(sandbox.get({ limit: '10' }).items).toHaveLength(1)
    sandbox.seed('b')
    expect(sandbox.get({ limit: '10' }).items).toHaveLength(1) // vẫn từ cache
    sandbox.post(valid())
    expect(sandbox.get({ limit: '10' }).items).toHaveLength(3)
  })

  it('still answers when the page is too large for CacheService', () => {
    for (let i = 0; i < 200; i++) sandbox.seed(`w${i}`, 'visible', 'An', 'ệ'.repeat(300))
    const page = sandbox.get({ limit: '200' })
    expect(page.ok).toBe(true)
    expect(page.items).toHaveLength(200)
  })

  it('serves a cached page for a minute and drops it when a wish is posted', () => {
    sandbox.seed('a')
    expect(sandbox.get().items).toHaveLength(1)
    sandbox.seed('b') // thay đổi trực tiếp trên Sheet: trang đầu vẫn lấy từ cache
    expect(sandbox.get().items).toHaveLength(1)
    expect(sandbox.post(valid()).ok).toBe(true) // ghi mới xóa cache trang đầu
    expect(sandbox.get().items).toHaveLength(3)
  })
})

describe('doPost', () => {
  it('writes one visible row and returns its id', () => {
    const result = sandbox.post(valid())
    expect(result).toEqual({ ok: true, id: 'id-1', status: 'visible' })
    expect(sandbox.rows).toHaveLength(2) // tiêu đề + 1 lời chúc
    expect(sandbox.rows[1].slice(2)).toEqual(['Thu Hà', 'Chúc hai bạn trăm năm hạnh phúc!', 'visible'])
  })

  it('stores the new wish so that doGet returns it', () => {
    sandbox.post(valid())
    expect(sandbox.get().items[0]).toMatchObject({ id: 'id-1', name: 'Thu Hà' })
  })

  it('writes as plain text so a formula in the name is never evaluated', () => {
    sandbox.post(valid({ name: '=SUM(1,1)', message: '=HYPERLINK("http://evil","x")' }))
    expect(sandbox.formatCalls).toEqual([{ row: 2, format: '@' }])
    // Dấu cách đứng đầu bảo đảm Sheets không bao giờ coi ô là công thức, dù định dạng ô thế nào.
    expect(sandbox.rows[1][2]).toBe(' =SUM(1,1)')
    expect(sandbox.rows[1][3]).toBe(' =HYPERLINK("http://evil","x")')
    // Khi đọc, dấu cách được gỡ để khách thấy đúng nội dung đã nhập.
    expect(sandbox.get().items[0]).toMatchObject({ name: '=SUM(1,1)', message: '=HYPERLINK("http://evil","x")' })
  })

  it.each(['=1+1', '+1 chúc mừng', '-- cảm ơn', '@ten'])('prefixes %s so it can never be a formula', (text) => {
    sandbox.post(valid({ name: 'An', message: text }))
    expect(sandbox.rows[1][3]).toBe(` ${text}`)
    expect(sandbox.get().items[0].message).toBe(text)
  })

  it('does not prefix ordinary text', () => {
    sandbox.post(valid())
    expect(sandbox.rows[1][2]).toBe('Thu Hà')
  })

  it('rejects malformed bodies without writing', () => {
    expect(sandbox.postRaw('not json')).toEqual({ ok: false, error: 'invalid' })
    expect(sandbox.postRaw('"just a string"')).toEqual({ ok: false, error: 'invalid' })
    expect(sandbox.post(valid({ token: '' }))).toEqual({ ok: false, error: 'invalid' })
    expect(sandbox.rows).toHaveLength(0)
  })

  it('rejects invalid names and messages', () => {
    expect(sandbox.post(valid({ name: '   ' }))).toEqual({ ok: false, error: 'name_required' })
    expect(sandbox.post(valid({ name: 'a'.repeat(41) }))).toEqual({ ok: false, error: 'name_too_long' })
    expect(sandbox.post(valid({ message: 'a' }))).toEqual({ ok: false, error: 'message_too_short' })
    expect(sandbox.post(valid({ message: 'a'.repeat(301) }))).toEqual({ ok: false, error: 'message_too_long' })
    expect(sandbox.rows).toHaveLength(0)
  })

  it('pretends to succeed on a filled honeypot but writes nothing', () => {
    expect(sandbox.post(valid({ website: 'http://spam' }))).toEqual({ ok: true, id: '', status: 'hidden' })
    expect(sandbox.rows).toHaveLength(0)
  })

  it('rejects a form filled in faster than 3 seconds', () => {
    expect(sandbox.post(valid({ elapsedMs: 800 }))).toEqual({ ok: false, error: 'too_fast' })
    expect(sandbox.rows).toHaveLength(0)
  })

  it('rejects a body that omits elapsedMs or sends a non-number', () => {
    expect(sandbox.post(valid({ elapsedMs: undefined }))).toEqual({ ok: false, error: 'too_fast' })
    expect(sandbox.post(valid({ elapsedMs: '9999' }))).toEqual({ ok: false, error: 'too_fast' })
    expect(sandbox.rows).toHaveLength(0)
  })

  it('does not write twice when the same requestId is sent again', () => {
    const first = sandbox.post(valid({ requestId: 'req-A' }))
    const retry = sandbox.post(valid({ requestId: 'req-A' }))
    expect(retry).toEqual(first)
    expect(sandbox.rows).toHaveLength(2) // tiêu đề + 1 lời chúc
    // Gửi lại không tính vào giới hạn theo trình duyệt.
    sandbox.post(valid({ requestId: 'req-B' }))
    sandbox.post(valid({ requestId: 'req-C' }))
    expect(sandbox.post(valid({ requestId: 'req-D' })).error).toBe('rate_limited')
  })

  it('records a wish with a profane word as hidden and never serves it', () => {
    const result = sandbox.post(valid({ message: 'đm hay quá' }))
    expect(result.status).toBe('hidden')
    expect(sandbox.rows[1][4]).toBe('hidden')
    expect(sandbox.get().items).toEqual([])
  })

  it('limits each browser token to 3 wishes per window', () => {
    for (let i = 0; i < 3; i++) expect(sandbox.post(valid()).ok).toBe(true)
    expect(sandbox.post(valid())).toEqual({ ok: false, error: 'rate_limited' })
    expect(sandbox.post(valid({ token: 'browser-2' })).ok).toBe(true)
  })

  it('stops accepting wishes once the daily cap is reached', () => {
    sandbox.run('DAILY_CAP = 2')
    expect(sandbox.post(valid({ token: 'a' })).ok).toBe(true)
    expect(sandbox.post(valid({ token: 'b' })).ok).toBe(true)
    expect(sandbox.post(valid({ token: 'c' }))).toEqual({ ok: false, error: 'rate_limited' })
    expect(sandbox.rows).toHaveLength(3)
  })
})

describe('parity with the website code', () => {
  it('uses the same profanity list', () => {
    expect([...sandbox.run<string[]>('PROFANITY')]).toEqual([...PROFANITY_WORDS])
  })

  const samples = [
    '  Chúc   mừng  ',
    'Chúc mừng\nhạnh phúc',
    'A\u0000B​C‮D',
    'ệ',
    'tab\tseparated',
    '',
  ]

  it('cleans text identically', () => {
    for (const sample of samples) {
      expect(sandbox.run<(s: string) => string>('clean_')(sample)).toBe(cleanText(sample))
    }
  })

  it('detects profanity identically', () => {
    const phrases = ['đm', 'Thế này là VCL luôn', 'what the fuck!', 'Chúc ngủ ngon, lớn nhanh', 'classic dmitri', 'xin chào, đm...']
    for (const phrase of phrases) {
      expect(sandbox.run<(s: string) => boolean>('isProfane_')(phrase)).toBe(containsProfanity(phrase))
    }
  })

  it('validates identically', () => {
    const cases: Array<[string, string]> = [
      ['Thu Hà', 'Chúc hai bạn trăm năm hạnh phúc!'],
      ['  ', 'Chúc mừng'],
      ['a'.repeat(41), 'Chúc mừng'],
      ['An', 'a'],
      ['An', 'a'.repeat(301)],
      ['An', 'đm hay quá'],
    ]
    const validate = sandbox.run<(n: string, m: string) => { ok: boolean; error?: string; profane?: boolean }>('validateWish_')
    for (const [name, message] of cases) {
      const web = validateWish(name, message)
      const script = validate(name, message)
      if (web.ok) {
        expect(script.ok).toBe(true)
        expect(script.profane).toBe(false)
      } else if (web.error === 'profanity') {
        // Website từ chối; script nhận nhưng ghi hidden.
        expect(script.ok).toBe(true)
        expect(script.profane).toBe(true)
      } else {
        expect(script).toMatchObject({ ok: false, error: web.error })
      }
    }
  })
})
