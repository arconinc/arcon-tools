import { NextResponse } from 'next/server'

export const ok = <T>(data: T) => NextResponse.json(data)
export const created = <T>(data: T) => NextResponse.json(data, { status: 201 })
export const fail = (status: number, error: string) => NextResponse.json({ error }, { status })
export const unauthorized = () => fail(401, 'Unauthorized')
export const forbidden = () => fail(403, 'Forbidden')
export const notFound = (what = 'Not found') => fail(404, what)
export const badRequest = (msg = 'Bad request') => fail(400, msg)
export const serverError = (msg = 'Internal error') => fail(500, msg)
