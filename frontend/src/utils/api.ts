import axios from 'axios'

const getBaseUrl = () => {
  const envUrl = (import.meta as any).env?.VITE_API_URL
  if (envUrl) {
    return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/$/, '')}/api`
  }
  return '/api'
}

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api

export interface Student {
  id: number
  roll_number: string
  name: string
  email: string
  branch?: string
  year?: number
  domains?: string
  goals?: string
  weak_subjects?: string
  study_hours_per_week?: number
  cpi?: number
  sleep_hours?: number
  screen_time_hours?: number
}

export interface Resource {
  id: number
  title: string
  description: string
  url: string
  domain: string
  course: string
  resource_type: string
  upvotes: number
  is_private: boolean
  is_curated: boolean
  uploader_id?: number
  user_upvoted: boolean
  user_bookmarked: boolean
  created_at: string
}

export interface RecommendedResource extends Resource {
  match_score: number
  match_reasons: string[]
}

export interface Event {
  id: number
  title: string
  description: string
  event_date?: string
  location: string
  domain: string
  organizer: string
  is_archived: boolean
  slides_link?: string
  recording_link?: string
}

export interface Journey {
  id: number
  title: string
  domain: string
  content: string
  year_completed?: number
  tags: string
  upvotes: number
  is_verified: boolean
  author_id?: number
  author?: Student
}

export interface Task {
  id: number
  title: string
  description: string
  domain: string
  priority: number
  estimated_hours: number
  actual_hours: number
  completed: boolean
  due_date?: string
}

export interface Post {
  id: number
  content: string
  domain: string
  is_mental_health: boolean
  created_at: string
}

export interface Reply {
  id: number
  content: string
  is_senior_verified: boolean
  created_at: string
}

export interface BurnoutScore {
  score: number
  ml_score?: number | null
  telemetry_score?: number | null
  risk_level: string
  recommendations: string[]
  signals?: {
    weekly_working_hours: number
    deadline_pressure: number
    sleep_deficit_hours: number
    task_backlog_score: number
    trend: 'improving' | 'stable' | 'worsening'
  }
  suggestions_injected?: boolean
}

export interface BurnoutHistoryPoint {
  date: string
  score: number
  ml_score?: number | null
  telemetry_score?: number | null
  risk_level: string
}

export interface RoadmapData {
  domain: string
  roadmap: { phase: number; focus: string; resources: string[]; hours: number }[]
  estimated_weeks: number
  weak_subjects: string[]
}

export interface SmartSuggestion {
  id: number
  title: string
  reason: string
  action_steps: string[]
  priority: number
  status: string
  is_pinned: boolean
  resource?: { id: number; title: string; url?: string } | null
}

export interface WorkloadData {
  capacity: number
  scheduled_hours: number
  utilization_percent: number
  status: string
  overload_hours: number
}

export interface RebalanceSuggestion {
  task_id: number
  task_title: string
  current_due_date: string | null
  suggested_due_date: string | null
  reason: string
}

export interface RebalanceData {
  suggestions: RebalanceSuggestion[]
  overload_weeks: number
}

export interface PlannerEvent {
  id: number
  title: string
  description?: string
  date?: string
  start_time: string
  end_time: string
  tag: 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL'
  category: 'CLASS' | 'EXAM' | 'PERSONAL' | 'SLEEP' | 'RECREATION' | 'OTHER'
  is_working_hour: boolean
  link?: string
  is_recurring: boolean
  recurrence_day?: number
  is_completed: boolean
  status?: string
  user_comment?: string
  deadline_date?: string
  deadline_label?: string
}

export interface CapacityDay {
  date: string
  loadPct: number
  status: 'low' | 'medium' | 'high' | 'max'
}

export interface TimetableEntry {
  day: number;
  startTime: string;
  endTime: string;
  subject: string;
  needsReview?: boolean;
}

export interface DeadlineSubtask {
  id: number
  deadline_id: number
  title: string
  is_completed: boolean
  order: number
  created_at?: string
}

export interface DeadlineWithSubtasks extends PlannerEvent {
  subtasks: DeadlineSubtask[]
}

export const deadlineAPI = {
  getDeadlines: async (): Promise<DeadlineWithSubtasks[]> => {
    const res = await api.get<DeadlineWithSubtasks[]>('/planner/deadlines')
    return res.data
  },
  createSubtask: async (deadlineId: number, title: string, order = 0): Promise<DeadlineSubtask> => {
    const res = await api.post<DeadlineSubtask>(`/planner/deadlines/${deadlineId}/subtasks`, { title, order })
    return res.data
  },
  updateSubtask: async (
    subtaskId: number,
    updates: { title?: string; is_completed?: boolean; order?: number }
  ): Promise<DeadlineSubtask> => {
    const res = await api.patch<DeadlineSubtask>(`/planner/deadlines/subtasks/${subtaskId}`, updates)
    return res.data
  },
  deleteSubtask: async (subtaskId: number): Promise<{ message: string }> => {
    const res = await api.delete<{ message: string }>(`/planner/deadlines/subtasks/${subtaskId}`)
    return res.data
  },
  createCustomDeadline: async (payload: {
    title: string;
    deadline_date: string;
    deadline_label?: string;
    category?: 'CLASS' | 'EXAM' | 'PERSONAL' | 'SLEEP' | 'RECREATION' | 'OTHER';
    tag?: 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL';
    subtasks?: string[];
  }): Promise<DeadlineWithSubtasks> => {
    const eventRes = await api.post<PlannerEvent>('/events/', {
      title: payload.title.trim(),
      description: payload.deadline_label || payload.title.trim(),
      date: payload.deadline_date,
      start_time: '09:00',
      end_time: '10:00',
      tag: payload.tag || 'IMPORTANT',
      category: payload.category || 'OTHER',
      is_working_hour: true,
      is_recurring: false,
      deadline_date: payload.deadline_date,
      deadline_label: payload.deadline_label || payload.title.trim(),
    })

    const newEvent = eventRes.data
    const createdSubtasks: DeadlineSubtask[] = []

    if (payload.subtasks && payload.subtasks.length > 0) {
      for (const st of payload.subtasks) {
        if (st.trim()) {
          const subRes = await api.post<DeadlineSubtask>(`/planner/deadlines/${newEvent.id}/subtasks`, { title: st.trim() })
          createdSubtasks.push(subRes.data)
        }
      }
    }

    return { ...newEvent, subtasks: createdSubtasks }
  },
}

export interface EmailEvent {
  id: number
  title: string
  event_type: string
  event_date?: string
  event_time?: string
  location?: string
  confidence: string
}

export interface EmailRecord {
  id: number
  subject: string
  sender: string
  category: string
  importance: string
  summary: string
  body?: string
  received_at?: string
  date_received?: string
  date?: string
  created_at?: string
  timestamp?: string
  email_date?: string
  events: EmailEvent[]
}

export interface UserAPIKey {
  id: number
  provider: 'gemini' | 'openai' | 'anthropic' | 'xai' | 'deepseek' | 'groq' | 'openrouter' | 'mistral' | 'custom' | string
  model_name?: string
  base_url?: string
  is_active: boolean
  last_validated_at?: string
  created_at: string
}

export interface AIProvider {
  id: string
  name: string
  default_model: string
  recommended_models: string[]
  free_tier_available: boolean
  key_help_url: string
  supports_custom_url?: boolean
  default_base_url?: string
}

export const apiKeysAPI = {
  getProviders: async (): Promise<AIProvider[]> => {
    const res = await api.get<{ providers: AIProvider[] }>('/ai/providers')
    return res.data.providers
  },
  getKeys: async (): Promise<{ keys: UserAPIKey[]; has_active_key: boolean }> => {
    const res = await api.get<{ keys: UserAPIKey[]; has_active_key: boolean }>('/ai/keys')
    return res.data
  },
  validateKey: async (provider: string, apiKey: string, modelName?: string, baseUrl?: string): Promise<{ is_valid: boolean; error?: string }> => {
    const res = await api.post<{ is_valid: boolean; error?: string }>('/ai/keys/validate', {
      provider,
      api_key: apiKey,
      model_name: modelName || undefined,
      base_url: baseUrl || undefined,
    })
    return res.data
  },
  saveKey: async (provider: string, apiKey: string, modelName?: string, baseUrl?: string): Promise<{ success: boolean; message: string; key: UserAPIKey }> => {
    const res = await api.post<{ success: boolean; message: string; key: UserAPIKey }>('/ai/keys', {
      provider,
      api_key: apiKey,
      model_name: modelName || undefined,
      base_url: baseUrl || undefined,
    })
    return res.data
  },
  deleteKey: async (provider: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete<{ success: boolean; message: string }>(`/ai/keys/${provider}`)
    return res.data
  },
}


