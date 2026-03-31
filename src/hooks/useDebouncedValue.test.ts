import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('initial', 500))
    
    expect(result.current).toBe('initial')
  })

  it('should debounce value updates', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    expect(result.current).toBe('initial')

    // Update value
    rerender({ value: 'updated', delay: 500 })
    
    // Should still be initial before delay
    expect(result.current).toBe('initial')

    // Advance timer
    act(() => {
      vi.advanceTimersByTime(500)
    })

    // Now should be updated
    expect(result.current).toBe('updated')
  })

  it('should reset timer on rapid updates', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    // First update
    rerender({ value: 'update1', delay: 500 })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current).toBe('initial') // Not yet updated

    // Second update before first completes
    rerender({ value: 'update2', delay: 500 })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current).toBe('initial') // Still not updated

    // Complete second update timer
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('update2')
  })

  it('should work with number values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 0, delay: 100 } }
    )

    expect(result.current).toBe(0)

    rerender({ value: 42, delay: 100 })
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current).toBe(42)
  })

  it('should work with object values', () => {
    const initialObj = { a: 1 }
    const updatedObj = { a: 2, b: 3 }
    
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: initialObj, delay: 100 } }
    )

    expect(result.current).toBe(initialObj)

    rerender({ value: updatedObj, delay: 100 })
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current).toBe(updatedObj)
  })

  it('should update when delay changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    // Change value with long delay
    rerender({ value: 'updated', delay: 500 })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current).toBe('initial')

    // Change delay to shorter while value is pending
    rerender({ value: 'updated', delay: 100 })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('updated')
  })

  it('should clear timer on unmount', () => {
    const { rerender, unmount } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    rerender({ value: 'updated', delay: 500 })
    
    // Unmount before timer completes
    unmount()

    // Timer should be cleared, no errors
    act(() => {
      vi.advanceTimersByTime(500)
    })
  })

  it('should handle zero delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'initial', delay: 0 } }
    )

    rerender({ value: 'updated', delay: 0 })
    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current).toBe('updated')
  })

  it('should handle multiple sequential updates', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'a', delay: 100 } }
    )

    // Sequential updates
    rerender({ value: 'b', delay: 100 })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('b')

    rerender({ value: 'c', delay: 100 })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('c')

    rerender({ value: 'd', delay: 100 })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('d')
  })

  it('should handle null and undefined values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: null as string | null, delay: 100 } }
    )

    expect(result.current).toBeNull()

    rerender({ value: 'not null', delay: 100 })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('not null')

    rerender({ value: null, delay: 100 })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBeNull()
  })

  it('should handle array values', () => {
    const initialArray = [1, 2, 3]
    const updatedArray = [4, 5, 6, 7]
    
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: initialArray, delay: 100 } }
    )

    expect(result.current).toEqual(initialArray)

    rerender({ value: updatedArray, delay: 100 })
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current).toEqual(updatedArray)
  })
})
