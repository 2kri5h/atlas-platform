export const DOMAINS = [
  { value: 'sde', label: 'SDE / Placements' },
  { value: 'ai_ml', label: 'AI / ML' },
  { value: 'finance', label: 'Finance' },
  { value: 'core', label: 'Core Engineering' },
  { value: 'research', label: 'Research' },
  { value: 'consulting', label: 'Consulting' },
]

export const DOMAIN_COLORS: Record<string, string> = {
  sde: '#1e40af',
  ai_ml: '#065f46',
  finance: '#92400e',
  core: '#3730a3',
  research: '#6b21a8',
  consulting: '#9d174d',
}

export const getDomainBadgeClass = (domain: string) => {
  return `badge ${domain.toLowerCase().replace(' ', '_')}`
}

export const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}