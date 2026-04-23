import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('sql.js/dist/sql-wasm.wasm?url', () => ({
  default: 'sql-wasm.wasm',
}))

vi.mock('recharts', () => {
  const Component = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    Bar: Component,
    BarChart: Component,
    CartesianGrid: Component,
    Legend: Component,
    Line: Component,
    LineChart: Component,
    ResponsiveContainer: Component,
    Tooltip: Component,
    XAxis: Component,
    YAxis: Component,
  }
})

vi.mock('reactflow', async () => {
  const ReactModule = await import('react')
  const Component = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  )

  return {
    default: Component,
    addEdge: (edge: unknown, current: unknown[]) => [...current, edge],
    Background: Component,
    Controls: Component,
    Handle: Component,
    MiniMap: Component,
    Position: {
      Left: 'left',
      Right: 'right',
    },
    MarkerType: {
      ArrowClosed: 'arrowclosed',
    },
    useNodesState: (initial: unknown[]) => {
      const [state, setState] = ReactModule.useState(initial)
      return [state, setState, vi.fn()] as const
    },
    useEdgesState: (initial: unknown[]) => {
      const [state, setState] = ReactModule.useState(initial)
      return [state, setState, vi.fn()] as const
    },
  }
})

vi.mock('sql.js', () => ({
  default: vi.fn(async () => ({
    Database: class {
      run() {}
      exec() {
        return []
      }
      close() {}
    },
  })),
}))

describe('App integration', () => {
  it('renders docs button and toggles theme', async () => {
    const user = userEvent.setup()
    render(<App />)

    const docsLink = screen.getByRole('link', { name: 'Open documentation' })
    expect(docsLink).toHaveAttribute('href', 'http://localhost:3000/docs/intro')

    const toggle = screen.getByRole('button', { name: 'Switch to dark mode' })
    await user.click(toggle)
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    const toggleBack = screen.getByRole('button', { name: 'Switch to light mode' })
    await user.click(toggleBack)
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('shows empty state in model tab before import', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '2. Model Canvas' }))

    expect(
      screen.getByText(/Import Excel files first\. Then create entities from source sheets/),
    ).toBeInTheDocument()
  })

  it('initializes sql tab and shows run validation without modeled tables', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '3. SQL Lab' }))

    expect(screen.getByText('No modeled entities available yet.')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('SQLite Ready')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Run' }))

    expect(
      screen.getByText('Create at least one modeled entity before running SQL queries.'),
    ).toBeInTheDocument()
  })
})
