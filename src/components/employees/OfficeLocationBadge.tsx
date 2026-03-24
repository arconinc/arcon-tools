import { OfficeLocation } from '@/types'

const variants: Record<OfficeLocation, string> = {
  Remote: 'bg-slate-100 text-slate-600',
  Minnesota: 'bg-blue-100 text-blue-700',
  Arizona: 'bg-amber-100 text-amber-700',
  Colorado: 'bg-green-100 text-green-700',
}

export default function OfficeLocationBadge({ location }: { location: OfficeLocation }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[location]}`}>
      {location}
    </span>
  )
}
