type BrandDataCompany = {
  employees: number | null
  foundedYear: number | null
  industries: { name: string; slug: string }[] | null
  location: { city: string | null; state: string | null; country: string | null } | null
  kind: string | null
}

export function buildCompanySummary(company: BrandDataCompany | null): string | null {
  if (!company) return null
  const parts: string[] = []
  const kind =
    company.kind === 'PUBLIC_COMPANY'
      ? 'a public company'
      : company.kind === 'PRIVATE_COMPANY'
        ? 'a private company'
        : null
  const location = [company.location?.city, company.location?.state, company.location?.country]
    .filter(Boolean)
    .join(', ')
  const industry = company.industries?.map((i) => i.name).join(' and ')
  if (kind && company.foundedYear) parts.push(`${kind} founded in ${company.foundedYear}`)
  else if (kind) parts.push(kind)
  else if (company.foundedYear) parts.push(`founded in ${company.foundedYear}`)
  if (location) parts.push(`headquartered in ${location}`)
  if (company.employees) parts.push(`approximately ${company.employees} employees`)
  if (industry) parts.push(`operating in ${industry}`)
  return parts.length ? parts.join(', ') + '.' : null
}
