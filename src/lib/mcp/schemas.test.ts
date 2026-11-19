import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { addTaskCommentShape, createTaskShape, definedOnly, listTasksShape, updateTaskShape } from './schemas'

const UUID = '11111111-1111-4111-8111-111111111111'

describe('create_task input', () => {
  const schema = z.object(createTaskShape)

  it('accepts a minimal task', () => {
    expect(schema.safeParse({ title: 'Call Acme' }).success).toBe(true)
  })

  it('rejects an empty title and a bad due date', () => {
    expect(schema.safeParse({ title: '   ' }).success).toBe(false)
    expect(schema.safeParse({ title: 'x', due_date: '11/19/2026' }).success).toBe(false)
  })

  it('drops fields the MCP must not set', () => {
    const parsed = schema.parse({ title: 'x', store_id: UUID, task_owner: UUID, sort_order: 3 })
    expect(parsed).not.toHaveProperty('store_id')
    expect(parsed).not.toHaveProperty('task_owner')
    expect(parsed).not.toHaveProperty('sort_order')
  })
})

describe('update_task input', () => {
  const schema = z.object(updateTaskShape)

  it('requires a uuid id', () => {
    expect(schema.safeParse({ id: 'nope', status: 'completed' }).success).toBe(false)
  })

  it('accepts null to clear a link', () => {
    expect(schema.safeParse({ id: UUID, customer_id: null }).success).toBe(true)
  })

  it('rejects statuses outside the task workflow', () => {
    expect(schema.safeParse({ id: UUID, status: 'deleted' }).success).toBe(false)
  })

  it('never passes through the whitelist-excluded columns', () => {
    const parsed = schema.parse({ id: UUID, title: 'x', last_worked_by: UUID, task_owner: UUID })
    expect(parsed).not.toHaveProperty('last_worked_by')
    expect(parsed).not.toHaveProperty('task_owner')
  })

  it('keeps progress within 0 to 100', () => {
    expect(schema.safeParse({ id: UUID, progress: 101 }).success).toBe(false)
    expect(schema.safeParse({ id: UUID, progress: 40 }).success).toBe(true)
  })
})

describe('list_tasks and comment input', () => {
  it('caps limit at 100', () => {
    expect(z.object(listTasksShape).safeParse({ limit: 101 }).success).toBe(false)
  })

  it('requires non-empty comment text', () => {
    expect(z.object(addTaskCommentShape).safeParse({ task_id: UUID, comment: '  ' }).success).toBe(false)
    expect(z.object(addTaskCommentShape).safeParse({ task_id: UUID, comment: 'Done' }).success).toBe(true)
  })
})

describe('definedOnly', () => {
  it('removes undefined keys and keeps nulls', () => {
    expect(definedOnly({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null })
  })
})
