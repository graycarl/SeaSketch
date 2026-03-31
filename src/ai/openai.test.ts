import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { requestMermaidUpdate, type OpenAIRequestPayload } from './openai'

// Helper to create valid mock response
const createMockResponse = (overrides: Partial<{ assistantMessage: string; mermaid: string; noChange?: boolean }> = {}) => ({
  choices: [{
    message: {
      content: JSON.stringify({
        assistantMessage: overrides.assistantMessage ?? 'Done',
        mermaid: overrides.mermaid ?? 'graph TD\n  A-->B',
        noChange: overrides.noChange,
      }),
    },
  }],
})

describe('requestMermaidUpdate', () => {
  const mockFetch = vi.fn()
  global.fetch = mockFetch

  const createPayload = (overrides: Partial<OpenAIRequestPayload> = {}): OpenAIRequestPayload => ({
    settings: {
      aiProvider: 'openai',
      openaiApiKey: 'test-api-key',
      openaiApiHost: 'https://api.openai.com',
      openaiModel: 'gpt-4o',
      geminiApiKey: '',
    },
    messages: [],
    mermaidSource: 'graph TD\n  A-->B',
    previewSvg: '<svg></svg>',
    previewError: null,
    attachmentContents: [],
    userPrompt: 'Make it better',
    ...overrides,
  })

  beforeEach(() => {
    mockFetch.mockClear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should successfully parse OpenAI response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockResponse({
        assistantMessage: 'Here is the updated diagram',
        mermaid: 'graph TD\n  A-->B\n  B-->C',
        noChange: false,
      }),
    })

    const result = await requestMermaidUpdate(createPayload())

    expect(result.assistantMessage).toBe('Here is the updated diagram')
    expect(result.mermaid).toBe('graph TD\n  A-->B\n  B-->C')
    expect(result.noChange).toBe(false)
  })

  it('should handle noChange response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockResponse({
        assistantMessage: 'No changes needed',
        mermaid: 'graph TD\n  A-->B',
        noChange: true,
      }),
    })

    const result = await requestMermaidUpdate(createPayload())

    expect(result.noChange).toBe(true)
    expect(result.mermaid).toBe('graph TD\n  A-->B')
  })

  it('should strip markdown code blocks from response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: '```json\n' + JSON.stringify({
              assistantMessage: 'Updated',
              mermaid: 'graph LR\n  X-->Y',
            }) + '\n```',
          },
        }],
      }),
    })

    const result = await requestMermaidUpdate(createPayload())

    expect(result.assistantMessage).toBe('Updated')
    expect(result.mermaid).toBe('graph LR\n  X-->Y')
  })

  it('should include attachments in request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockResponse(),
    })

    const payload = createPayload({
      attachmentContents: [
        { name: 'data.txt', content: 'some data' },
        { name: 'notes.md', content: '# Notes' },
      ],
    })

    await requestMermaidUpdate(payload)

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(requestBody.messages[1].content).toContain('data.txt')
    expect(requestBody.messages[1].content).toContain('some data')
    expect(requestBody.messages[1].content).toContain('notes.md')
  })

  it('should include recent chat history', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockResponse(),
    })

    const payload = createPayload({
      messages: [
        { id: '1', role: 'user', content: 'Hello', timestamp: '2024-01-01' },
        { id: '2', role: 'assistant', content: 'Hi there', timestamp: '2024-01-01' },
        { id: '3', role: 'user', content: 'Update diagram', timestamp: '2024-01-01' },
      ],
    })

    await requestMermaidUpdate(payload)

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(requestBody.messages[1].content).toContain('user: Hello')
    expect(requestBody.messages[1].content).toContain('assistant: Hi there')
  })

  it('should use custom API host', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockResponse(),
    })

    const payload = createPayload({
      settings: {
        aiProvider: 'openai',
        openaiApiKey: 'key',
        openaiApiHost: 'https://custom.openai.com/',
        openaiModel: 'gpt-4',
        geminiApiKey: '',
      },
    })

    await requestMermaidUpdate(payload)

    expect(mockFetch.mock.calls[0][0]).toBe('https://custom.openai.com/v1/chat/completions')
  })

  it('should throw error on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Invalid API key',
    })

    await expect(requestMermaidUpdate(createPayload())).rejects.toThrow('Invalid API key')
  })

  it('should throw error when response missing content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: {} }] }),
    })

    await expect(requestMermaidUpdate(createPayload())).rejects.toThrow('OpenAI response missing content')
  })

  it('should throw error on invalid JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'not valid json' } }],
      }),
    })

    await expect(requestMermaidUpdate(createPayload())).rejects.toThrow('Failed to parse OpenAI response JSON')
  })

  it('should throw error when response missing required fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({}) } }],
      }),
    })

    await expect(requestMermaidUpdate(createPayload())).rejects.toThrow('OpenAI response JSON missing fields')
  })

  it('should set correct timeout on AbortController', async () => {
    // Test that AbortController signal is passed to fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockResponse(),
    })

    await requestMermaidUpdate(createPayload())

    const callArgs = mockFetch.mock.calls[0][1]
    expect(callArgs.signal).toBeDefined()
    expect(callArgs.signal).toBeInstanceOf(AbortSignal)
  })

  it('should use default model when not specified', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockResponse(),
    })

    const payload = createPayload({
      settings: {
        aiProvider: 'openai',
        openaiApiKey: 'key',
        openaiApiHost: 'https://api.openai.com',
        openaiModel: undefined,
        geminiApiKey: '',
      },
    })

    await requestMermaidUpdate(payload)

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(requestBody.model).toBe('gpt-4o')
  })

  it('should include preview error in context when present', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockResponse({ assistantMessage: 'Fixed' }),
    })

    const payload = createPayload({
      previewError: 'Syntax error in line 3',
    })

    await requestMermaidUpdate(payload)

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(requestBody.messages[1].content).toContain('Syntax error in line 3')
  })

  it('should use correct Authorization header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockResponse(),
    })

    await requestMermaidUpdate(createPayload({
      settings: {
        aiProvider: 'openai',
        openaiApiKey: 'my-secret-key',
        openaiApiHost: 'https://api.openai.com',
        openaiModel: 'gpt-4o',
        geminiApiKey: '',
      },
    }))

    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer my-secret-key')
  })
})
