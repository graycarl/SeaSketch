import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSeaSketchStore } from './store'
import { invoke } from '@tauri-apps/api/core'
import { act } from '@testing-library/react'

// Get the mocked invoke function
const mockedInvoke = vi.mocked(invoke)

describe('SeaSketch Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSeaSketchStore.setState({
      ...useSeaSketchStore.getState(),
      folders: [],
      currentFolderId: null,
      currentFileId: null,
      isLoading: false,
      hasLoaded: true,
    })
    
    // Clear mock calls
    mockedInvoke.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Folder Operations', () => {
    it('should create a new folder with default file', () => {
      act(() => {
        useSeaSketchStore.getState().createFolder()
      })

      const state = useSeaSketchStore.getState()
      expect(state.folders).toHaveLength(1)
      expect(state.folders[0].name).toBe('New Folder')
      expect(state.folders[0].files).toHaveLength(1)
      expect(state.folders[0].files[0].name).toBe('New Diagram')
      expect(state.currentFolderId).toBe(state.folders[0].id)
      expect(state.currentFileId).toBe(state.folders[0].files[0].id)
    })

    it('should rename a folder', () => {
      // First create a folder
      act(() => {
        useSeaSketchStore.getState().createFolder()
      })

      const folderId = useSeaSketchStore.getState().folders[0].id

      act(() => {
        useSeaSketchStore.getState().renameFolder(folderId, 'Renamed Folder')
      })

      expect(useSeaSketchStore.getState().folders[0].name).toBe('Renamed Folder')
    })

    it('should delete a folder and update current selection', () => {
      // Create two folders
      act(() => {
        useSeaSketchStore.getState().createFolder()
      })
      
      act(() => {
        useSeaSketchStore.getState().createFolder()
      })

      const firstFolderId = useSeaSketchStore.getState().folders[0].id
      const secondFolderId = useSeaSketchStore.getState().folders[1].id

      // Delete the second folder (which is currently selected)
      act(() => {
        useSeaSketchStore.getState().deleteFolder(secondFolderId)
      })

      const state = useSeaSketchStore.getState()
      expect(state.folders).toHaveLength(1)
      expect(state.currentFolderId).toBe(firstFolderId)
    })

    it('should handle deleting the last folder', () => {
      act(() => {
        useSeaSketchStore.getState().createFolder()
      })

      const folderId = useSeaSketchStore.getState().folders[0].id

      act(() => {
        useSeaSketchStore.getState().deleteFolder(folderId)
      })

      const state = useSeaSketchStore.getState()
      expect(state.folders).toHaveLength(0)
      expect(state.currentFolderId).toBeNull()
      expect(state.currentFileId).toBeNull()
    })
  })

  describe('File Operations', () => {
    beforeEach(() => {
      // Create a folder with one file for file operations
      act(() => {
        useSeaSketchStore.getState().createFolder()
      })
    })

    it('should create a new file in folder', () => {
      const folderId = useSeaSketchStore.getState().folders[0].id

      act(() => {
        useSeaSketchStore.getState().createFile(folderId)
      })

      const state = useSeaSketchStore.getState()
      expect(state.folders[0].files).toHaveLength(2)
      expect(state.folders[0].files[1].name).toBe('New Diagram')
      expect(state.currentFileId).toBe(state.folders[0].files[1].id)
    })

    it('should rename a file', () => {
      const folderId = useSeaSketchStore.getState().folders[0].id
      const fileId = useSeaSketchStore.getState().folders[0].files[0].id

      act(() => {
        useSeaSketchStore.getState().renameFile(folderId, fileId, 'Renamed File')
      })

      expect(useSeaSketchStore.getState().folders[0].files[0].name).toBe('Renamed File')
    })

    it('should delete a file and select another file in folder', () => {
      const folderId = useSeaSketchStore.getState().folders[0].id

      // Create a second file
      act(() => {
        useSeaSketchStore.getState().createFile(folderId)
      })

      const files = useSeaSketchStore.getState().folders[0].files
      const firstFileId = files[0].id
      const secondFileId = files[1].id

      // Currently second file is selected, delete it
      act(() => {
        useSeaSketchStore.getState().deleteFile(folderId, secondFileId)
      })

      const state = useSeaSketchStore.getState()
      expect(state.folders[0].files).toHaveLength(1)
      expect(state.currentFileId).toBe(firstFileId)
    })

    it('should update file content', () => {
      const folderId = useSeaSketchStore.getState().folders[0].id
      const fileId = useSeaSketchStore.getState().folders[0].files[0].id
      const newContent = 'graph LR\n    X --> Y'

      act(() => {
        useSeaSketchStore.getState().updateFileContent(folderId, fileId, newContent)
      })

      expect(useSeaSketchStore.getState().folders[0].files[0].content).toBe(newContent)
    })
  })

  describe('File Selection', () => {
    beforeEach(() => {
      mockedInvoke.mockResolvedValue([])
      act(() => {
        useSeaSketchStore.getState().createFolder()
      })
    })

    it('should select a file', async () => {
      const folderId = useSeaSketchStore.getState().folders[0].id
      
      act(() => {
        useSeaSketchStore.getState().createFile(folderId)
      })

      const firstFileId = useSeaSketchStore.getState().folders[0].files[0].id

      await act(async () => {
        useSeaSketchStore.getState().selectFile(folderId, firstFileId)
        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(useSeaSketchStore.getState().currentFileId).toBe(firstFileId)
    })
  })

  describe('Layout Operations', () => {
    it('should update layout', () => {
      act(() => {
        useSeaSketchStore.getState().updateLayout({
          sidebarWidth: 300,
          editorWidth: 500,
        })
      })

      const layout = useSeaSketchStore.getState().layout
      expect(layout?.sidebarWidth).toBe(300)
      expect(layout?.editorWidth).toBe(500)
    })

    it('should merge with existing layout', () => {
      // First set initial layout
      act(() => {
        useSeaSketchStore.getState().updateLayout({
          sidebarWidth: 200,
          editorWidth: 400,
        })
      })

      // Then update only sidebar
      act(() => {
        useSeaSketchStore.getState().updateLayout({
          sidebarWidth: 300,
        })
      })

      const layout = useSeaSketchStore.getState().layout
      expect(layout?.sidebarWidth).toBe(300)
      expect(layout?.editorWidth).toBe(400)
    })
  })

  describe('Toast', () => {
    it('should show and hide toast', () => {
      act(() => {
        useSeaSketchStore.getState().showToast('Test message', 'success')
      })

      let toast = useSeaSketchStore.getState().toast
      expect(toast.message).toBe('Test message')
      expect(toast.type).toBe('success')
      expect(toast.visible).toBe(true)

      act(() => {
        useSeaSketchStore.getState().hideToast()
      })

      toast = useSeaSketchStore.getState().toast
      expect(toast.visible).toBe(false)
    })
  })

  describe('State Persistence', () => {
    beforeEach(() => {
      mockedInvoke.mockResolvedValue(undefined)
    })

    it('should call invoke when saving state', async () => {
      act(() => {
        useSeaSketchStore.getState().createFolder()
      })

      // Wait for debounced save (300ms)
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 350))
      })

      expect(mockedInvoke).toHaveBeenCalledWith('save_state', expect.any(Object))
    })

    it('should load state from backend', async () => {
      const mockState = {
        folders: [{
          id: 'loaded-folder',
          name: 'Loaded Folder',
          files: [{
            id: 'loaded-file',
            name: 'Loaded File',
            content: 'graph TD\n    A --> B',
            previewBackground: 'dark' as const,
            snapshots: [],
          }],
        }],
        currentFolderId: 'loaded-folder',
        currentFileId: 'loaded-file',
        layout: {
          sidebarWidth: 250,
          editorWidth: 450,
        },
      }

      mockedInvoke.mockResolvedValueOnce(mockState)

      await act(async () => {
        await useSeaSketchStore.getState().loadState()
      })

      const state = useSeaSketchStore.getState()
      expect(state.folders).toHaveLength(1)
      expect(state.folders[0].name).toBe('Loaded Folder')
      expect(state.currentFolderId).toBe('loaded-folder')
      expect(state.hasLoaded).toBe(true)
      expect(state.isLoading).toBe(false)
    })

    it('should create default state when load fails', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('Load failed'))

      await act(async () => {
        await useSeaSketchStore.getState().loadState()
      })

      const state = useSeaSketchStore.getState()
      expect(state.folders).toHaveLength(1)
      expect(state.folders[0].name).toBe('Default Folder')
      expect(state.hasLoaded).toBe(true)
    })
  })

  describe('Settings', () => {
    beforeEach(() => {
      mockedInvoke.mockResolvedValue(undefined)
    })

    it('should update settings', async () => {
      const newSettings = {
        aiProvider: 'gemini' as const,
        openaiApiKey: '',
        openaiApiHost: 'https://api.openai.com',
        openaiModel: 'gpt-4o',
        geminiApiKey: 'test-key',
        geminiModel: 'gemini-3-flash-preview',
      }

      await act(async () => {
        await useSeaSketchStore.getState().saveSettings(newSettings)
      })

      expect(useSeaSketchStore.getState().settings.aiProvider).toBe('gemini')
      expect(useSeaSketchStore.getState().settings.geminiApiKey).toBe('test-key')
      expect(mockedInvoke).toHaveBeenCalledWith('save_settings', { settings: newSettings })
    })

    it('should load settings from backend', async () => {
      const mockSettings = {
        aiProvider: 'openai',
        openaiApiKey: 'sk-test',
        openaiApiHost: 'https://custom.api.com',
        openaiModel: 'gpt-4o',
        geminiApiKey: '',
        geminiModel: 'gemini-3-flash-preview',
      }

      mockedInvoke.mockResolvedValueOnce(mockSettings)

      await act(async () => {
        await useSeaSketchStore.getState().loadSettings()
      })

      expect(useSeaSketchStore.getState().settings.openaiApiKey).toBe('sk-test')
      expect(useSeaSketchStore.getState().settings.openaiApiHost).toBe('https://custom.api.com')
    })
  })
})
