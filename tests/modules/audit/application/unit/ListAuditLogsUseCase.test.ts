import { describe, expect, it, vi } from 'vitest'

import { ListAuditLogsUseCase } from '@/modules/audit/application/use-cases/ListAuditLogsUseCase.js'

describe('ListAuditLogsUseCase', () => {
  it('forwards complete filters and returns mapped paginated logs', async () => {
    const createdAt = new Date('2026-05-02T10:00:00.000Z')
    const listEvents = vi.fn(() =>
      Promise.resolve({
        events: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            userId: '22222222-2222-4222-8222-222222222222',
            actorUserId: '33333333-3333-4333-8333-333333333333',
            sessionId: '44444444-4444-4444-8444-444444444444',
            roleId: '55555555-5555-4555-8555-555555555555',
            eventType: 'user_role_assigned',
            eventStatus: 'success',
            ipAddress: '127.0.0.1',
            userAgent: 'Vitest',
            requestId: '66666666-6666-4666-8666-666666666666',
            metadata: {
              roleCode: 'admin',
            },
            createdAt,
          },
        ],
        total: 9,
      }),
    )
    const useCase = new ListAuditLogsUseCase({
      listEvents,
      recordEvent: vi.fn(),
    } as never)

    const from = new Date('2026-05-01T00:00:00.000Z')
    const to = new Date('2026-05-02T23:59:59.000Z')
    const result = await useCase.execute({
      page: 2,
      limit: 4,
      userId: '22222222-2222-4222-8222-222222222222',
      actorUserId: '33333333-3333-4333-8333-333333333333',
      requestId: '66666666-6666-4666-8666-666666666666',
      eventType: 'user_role_assigned',
      eventStatus: 'success',
      from,
      to,
    })

    expect(listEvents).toHaveBeenCalledWith({
      limit: 4,
      offset: 4,
      userId: '22222222-2222-4222-8222-222222222222',
      actorUserId: '33333333-3333-4333-8333-333333333333',
      requestId: '66666666-6666-4666-8666-666666666666',
      eventType: 'user_role_assigned',
      eventStatus: 'success',
      createdFrom: from,
      createdTo: to,
    })
    expect(result).toEqual({
      logs: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          userId: '22222222-2222-4222-8222-222222222222',
          actorUserId: '33333333-3333-4333-8333-333333333333',
          sessionId: '44444444-4444-4444-8444-444444444444',
          roleId: '55555555-5555-4555-8555-555555555555',
          eventType: 'user_role_assigned',
          eventStatus: 'success',
          ipAddress: '127.0.0.1',
          userAgent: 'Vitest',
          requestId: '66666666-6666-4666-8666-666666666666',
          metadata: {
            roleCode: 'admin',
          },
          createdAt: '2026-05-02T10:00:00.000Z',
        },
      ],
      pagination: {
        page: 2,
        limit: 4,
        total: 9,
        totalPages: 3,
      },
    })
  })

  it('returns empty logs with totalPages 1 when no events match', async () => {
    const listEvents = vi.fn(() =>
      Promise.resolve({
        events: [],
        total: 0,
      }),
    )
    const useCase = new ListAuditLogsUseCase({
      listEvents,
      recordEvent: vi.fn(),
    })

    const result = await useCase.execute({
      page: 1,
      limit: 10,
    })

    expect(listEvents).toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
    })
    expect(result.logs).toEqual([])
    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
    })
  })

  it('omits undefined optional filters from service call', async () => {
    const listEvents = vi.fn(() =>
      Promise.resolve({
        events: [],
        total: 0,
      }),
    )
    const useCase = new ListAuditLogsUseCase({
      listEvents,
      recordEvent: vi.fn(),
    })

    await useCase.execute({
      page: 1,
      limit: 20,
    })

    expect(listEvents).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
    })
  })
})
