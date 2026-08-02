import { TaskBoard } from '@/components/crm/TaskBoard'

export default async function TeamTasksPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  return <TaskBoard defaultTeamKey={key} />
}
