import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { requestMermaidUpdate, type GeminiRequestPayload } from './gemini'
import { invoke } from '@tauri-apps/api/core'
import { fetch } from '@tauri-apps/plugin-http'

// Mock Tauri plugins
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}))

const mockFetch = vi.mocked(fetch)
const mockInvoke = vi.mocked(invoke)

// Helper to create valid mock response
const createMockResponse = (overrides: Partial<{ assistantMessage: string; mermaid: string; noChange?: boolean }> = {}) => ({
  candidates: [{
    content: {
      parts: [{
        text: JSON.stringify({
          assistantMessage: overrides.assistantMessage ?? 'Done',
          mermaid: overrides.mermaid ?? 'graph TD\n  A-->B',
          noChange: overrides.noChange,
        }),
      }],
      role: 'model',
    },
    finishReason: 'STOP',
  }],
})

describe('requestMermaidUpdate', () => {
  const createPayload = (overrides: Partial<GeminiRequestPayload> = {}): GeminiRequestPayload => ({
    settings: {
      aiProvider: 'gemini',
      openaiApiKey: '',
      openaiApiHost: 'https://api.openai.com',
      openaiModel: 'gpt-4o',
      geminiApiKey: 'test-gemini-key',
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
    mockInvoke.mockClear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should use API key when OAuth is not available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify(createMockResponse()),
    } as Response)

    const result = await requestMermaidUpdate(createPayload())

    expect(result.assistantMessage).toBe('Done')
    expect(result.mermaid).toBe('graph TD\n  A-->B')
    
    // Verify API key endpoint is used
    expect(mockFetch.mock.calls[0][0]).toContain('test-gemini-key')
    expect(mockFetch.mock.calls[0][0]).toContain('generativelanguage.googleapis.com')
  })

  it('should throw error when no authentication is provided', async () => {
    const payload = createPayload({
      settings: {
        aiProvider: 'gemini',
        openaiApiKey: '',
        openaiApiHost: 'https://api.openai.com',
        openaiModel: 'gpt-4o',
        geminiApiKey: '',
        geminiOAuth: undefined,
      },
    })

    await expect(requestMermaidUpdate(payload)).rejects.toThrow('Gemini authentication required')
  })

  it('should refresh expired OAuth token', async () => {
    const expiredTime = Date.now() - 1000 // Expired 1 second ago
    const newToken = 'new-refreshed-token'
    
    mockInvoke.mockResolvedValueOnce({
      access_token: newToken,
      refresh_token: 'new-refresh-token',
      expires_at: Date.now() + 3600000,
      project_id: 'test-project',
    })
    
    // OAuth uses SSE streaming format
    const streamResponse = `data: {"response":{"candidates":[{"content":{"parts":[{"text":"{\\"assistantMessage\\":\\"Done\\",\\"mermaid\\":\\"graph TD\\"}"}],"role":"model"},"finishReason":"STOP"}]}}

data: {"response":{"candidates":[{"content":{"parts":[{"text":""}],"role":"model"}}]}}`
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => streamResponse,
    } as Response)

    const onTokenRefreshed = vi.fn()
    const payload = createPayload({
      settings: {
        aiProvider: 'gemini',
        openaiApiKey: '',
        openaiApiHost: 'https://api.openai.com',
        openaiModel: 'gpt-4o',
        geminiApiKey: '',
        geminiOAuth: {
          access_token: 'old-token',
          refresh_token: 'refresh-token',
          expires_at: expiredTime,
          project_id: 'test-project',
        },
      },
      onTokenRefreshed,
    })

    await requestMermaidUpdate(payload)

    // Verify token refresh was called
    expect(mockInvoke).toHaveBeenCalledWith('refresh_gemini_token', {
      refreshToken: 'refresh-token',
      projectId: 'test-project',
    })
    
    // Verify new token was used in request
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${newToken}`)
    
    // Verify callback was called
    expect(onTokenRefreshed).toHaveBeenCalled()
  })

  it('should use valid OAuth token without refresh', async () => {
    const futureTime = Date.now() + 3600000 // Valid for 1 hour
    
    // OAuth uses SSE streaming format
    const streamResponse = `data: {"response":{"candidates":[{"content":{"parts":[{"text":"{\\"assistantMessage\\":\\"Done\\",\\"mermaid\\":\\"graph TD\\"}"}],"role":"model"},"finishReason":"STOP"}]}}

data: {"response":{"candidates":[{"content":{"parts":[{"text":""}],"role":"model"}}]}}`
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => streamResponse,
    } as Response)

    const payload = createPayload({
      settings: {
        aiProvider: 'gemini',
        openaiApiKey: '',
        openaiApiHost: 'https://api.openai.com',
        openaiModel: 'gpt-4o',
        geminiApiKey: '',
        geminiOAuth: {
          access_token: 'valid-token',
          refresh_token: 'refresh-token',
          expires_at: futureTime,
          project_id: 'test-project',
        },
      },
    })

    await requestMermaidUpdate(payload)

    // Verify token refresh was NOT called
    expect(mockInvoke).not.toHaveBeenCalled()
    
    // Verify existing token was used
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer valid-token')
  })

  it('should use OAuth endpoint when OAuth credentials are provided', async () => {
    // OAuth uses SSE streaming format
    const streamResponse = `data: {"response":{"candidates":[{"content":{"parts":[{"text":"{\\"assistantMessage\\":\\"Done\\",\\"mermaid\\":\\"graph TD\\"}"}],"role":"model"},"finishReason":"STOP"}]}}

data: {"response":{"candidates":[{"content":{"parts":[{"text":""}],"role":"model"}}]}}`
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => streamResponse,
    } as Response)

    const payload = createPayload({
      settings: {
        aiProvider: 'gemini',
        openaiApiKey: '',
        openaiApiHost: 'https://api.openai.com',
        openaiModel: 'gpt-4o',
        geminiApiKey: '',
        geminiOAuth: {
          access_token: 'token',
          refresh_token: 'refresh',
          expires_at: Date.now() + 3600000,
          project_id: 'my-project',
        },
      },
    })

    await requestMermaidUpdate(payload)

    // Verify OAuth endpoint is used
    expect(mockFetch.mock.calls[0][0]).toContain('cloudcode-pa.googleapis.com')
    expect(mockFetch.mock.calls[0][0]).toContain('streamGenerateContent')
  })

  it('should include attachments in request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify(createMockResponse()),
    } as Response)

    const payload = createPayload({
      attachmentContents: [
        { name: 'data.txt', content: 'attachment content' },
      ],
    })

    await requestMermaidUpdate(payload)

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    const contentText = requestBody.contents[0].parts[0].text
    expect(contentText).toContain('data.txt')
    expect(contentText).toContain('attachment content')
  })

  it('should throw error on API failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'Invalid request',
    } as Response)

    await expect(requestMermaidUpdate(createPayload())).rejects.toThrow('Gemini API error')
  })

  it('should throw error when blocked by safety', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({
        candidates: [],
        promptFeedback: {
          blockReason: 'SAFETY',
        },
      }),
    } as Response)

    await expect(requestMermaidUpdate(createPayload())).rejects.toThrow('Request blocked: SAFETY')
  })

  it('should throw error on empty response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({
        candidates: [{
          content: {
            parts: [],
            role: 'model',
          },
        }],
      }),
    } as Response)

    await expect(requestMermaidUpdate(createPayload())).rejects.toThrow('No response from Gemini API')
  })

  it('should include recent chat history', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify(createMockResponse()),
    } as Response)

    const payload = createPayload({
      messages: [
        { id: '1', role: 'user', content: 'Hello', timestamp: '2024-01-01' },
        { id: '2', role: 'assistant', content: 'Hi there', timestamp: '2024-01-01' },
      ],
    })

    await requestMermaidUpdate(payload)

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    const contentText = requestBody.contents[0].parts[0].text
    expect(contentText).toContain('user: Hello')
    expect(contentText).toContain('assistant: Hi there')
  })

  it('should use default model when not specified', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify(createMockResponse()),
    } as Response)

    const payload = createPayload({
      settings: {
        aiProvider: 'gemini',
        openaiApiKey: '',
        openaiApiHost: 'https://api.openai.com',
        openaiModel: 'gpt-4o',
        geminiApiKey: 'key',
        geminiModel: undefined,
      },
    })

    await requestMermaidUpdate(payload)

    expect(mockFetch.mock.calls[0][0]).toContain('gemini-3-flash-preview')
  })

  it('should set correct temperature in request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify(createMockResponse()),
    } as Response)

    await requestMermaidUpdate(createPayload())

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(requestBody.generationConfig.temperature).toBe(0.2)
  })

  it('should parse streaming response correctly', async () => {
    const streamResponse = `data: {"response":{"candidates":[{"content":{"parts":[{"text":"{\\"assistantMessage\\":\\"Done\\",\\"mermaid\\":\\"graph TD\\"}"}],"role":"model"},"finishReason":"STOP"}]}}

data: {"response":{"candidates":[{"content":{"parts":[{"text":""}],"role":"model"}}]}}`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => streamResponse,
    } as Response)

    const payload = createPayload({
      settings: {
        aiProvider: 'gemini',
        openaiApiKey: '',
        openaiApiHost: 'https://api.openai.com',
        openaiModel: 'gpt-4o',
        geminiApiKey: '',
        geminiOAuth: {
          access_token: 'token',
          refresh_token: 'refresh',
          expires_at: Date.now() + 3600000,
          project_id: 'project',
        },
      },
    })

    const result = await requestMermaidUpdate(payload)

    expect(result.assistantMessage).toBe('Done')
    expect(result.mermaid).toBe('graph TD')
  })

  it('should include system instruction in request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify(createMockResponse()),
    } as Response)

    await requestMermaidUpdate(createPayload())

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(requestBody.systemInstruction).toBeDefined()
    expect(requestBody.systemInstruction.parts[0].text).toContain('Mermaid diagram assistant')
  })
})
