import { describe, it, expect } from 'vitest'
import {
  parseFrontmatter,
  writeFrontmatter,
  stripFrontmatter,
  getEffectiveTheme,
  getEffectiveLook,
  DEFAULT_THEME,
  DEFAULT_LOOK,
  type MermaidTheme,
  type MermaidLook,
} from './frontmatter'

describe('parseFrontmatter', () => {
  it('should return empty config when no frontmatter exists', () => {
    const content = 'graph TD\n    A --> B'
    const result = parseFrontmatter(content)
    
    expect(result.config).toEqual({})
    expect(result.body).toBe(content)
  })

  it('should parse theme from frontmatter', () => {
    const content = `---
config:
  theme: forest
---
graph TD
    A --> B`
    const result = parseFrontmatter(content)
    
    expect(result.config.theme).toBe('forest')
    expect(result.body).toBe('graph TD\n    A --> B')
  })

  it('should parse look from frontmatter', () => {
    const content = `---
config:
  look: handDrawn
---
graph TD
    A --> B`
    const result = parseFrontmatter(content)
    
    expect(result.config.look).toBe('handDrawn')
    expect(result.body).toBe('graph TD\n    A --> B')
  })

  it('should parse both theme and look', () => {
    const content = `---
config:
  theme: dark
  look: handDrawn
---
graph LR
    X --> Y`
    const result = parseFrontmatter(content)
    
    expect(result.config.theme).toBe('dark')
    expect(result.config.look).toBe('handDrawn')
    expect(result.body).toBe('graph LR\n    X --> Y')
  })

  it('should handle Windows-style line endings', () => {
    const content = `---\r\nconfig:\r\n  theme: neutral\r\n---\r\ngraph TD\r\n    A --> B`
    const result = parseFrontmatter(content)
    
    expect(result.config.theme).toBe('neutral')
  })

  it('should handle empty frontmatter', () => {
    const content = `---
---
graph TD
    A --> B`
    const result = parseFrontmatter(content)
    
    expect(result.config).toEqual({})
    // Empty frontmatter is still considered frontmatter, body keeps the markers
    expect(result.body).toBe('---\n---\ngraph TD\n    A --> B')
  })
})

describe('writeFrontmatter', () => {
  it('should add frontmatter with theme', () => {
    const content = 'graph TD\n    A --> B'
    const result = writeFrontmatter(content, { theme: 'forest' as MermaidTheme })
    
    expect(result).toBe(`---
config:
  theme: forest
---
graph TD
    A --> B`)
  })

  it('should add frontmatter with look', () => {
    const content = 'graph TD\n    A --> B'
    const result = writeFrontmatter(content, { look: 'handDrawn' as MermaidLook })
    
    expect(result).toBe(`---
config:
  look: handDrawn
---
graph TD
    A --> B`)
  })

  it('should update existing frontmatter', () => {
    const content = `---
config:
  theme: forest
---
graph TD
    A --> B`
    const result = writeFrontmatter(content, { theme: 'dark' as MermaidTheme })
    
    // When new theme is default (dark), frontmatter is removed
    expect(result).toBe('graph TD\n    A --> B')
  })

  it('should remove frontmatter when both values are default and frontmatter exists', () => {
    const content = `---
config:
  theme: dark
---
graph TD
    A --> B`
    const result = writeFrontmatter(content, { theme: DEFAULT_THEME, look: DEFAULT_LOOK })
    
    expect(result).toBe('graph TD\n    A --> B')
  })

  it('should keep content pristine when both values are default and no frontmatter exists', () => {
    const content = 'graph TD\n    A --> B'
    const result = writeFrontmatter(content, { theme: DEFAULT_THEME, look: DEFAULT_LOOK })
    
    expect(result).toBe('graph TD\n    A --> B')
  })

  it('should handle empty config object', () => {
    const content = 'graph TD\n    A --> B'
    const result = writeFrontmatter(content, {})
    
    expect(result).toBe('graph TD\n    A --> B')
  })
})

describe('stripFrontmatter', () => {
  it('should remove frontmatter and return body', () => {
    const content = `---
config:
  theme: forest
---
graph TD
    A --> B`
    
    expect(stripFrontmatter(content)).toBe('graph TD\n    A --> B')
  })

  it('should return original content when no frontmatter', () => {
    const content = 'graph TD\n    A --> B'
    
    expect(stripFrontmatter(content)).toBe(content)
  })
})

describe('getEffectiveTheme', () => {
  it('should return provided theme', () => {
    expect(getEffectiveTheme({ theme: 'forest' as MermaidTheme })).toBe('forest')
  })

  it('should return default theme when not provided', () => {
    expect(getEffectiveTheme({})).toBe(DEFAULT_THEME)
  })
})

describe('getEffectiveLook', () => {
  it('should return provided look', () => {
    expect(getEffectiveLook({ look: 'handDrawn' as MermaidLook })).toBe('handDrawn')
  })

  it('should return default look when not provided', () => {
    expect(getEffectiveLook({})).toBe(DEFAULT_LOOK)
  })
})
