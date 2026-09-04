import axios from 'axios'

export const getApiOrigin = () => {
  const envUrl = (import.meta as any).env?.VITE_API_URL
  return envUrl ? envUrl.replace(/\/$/, '') : ''
}

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

// On an expired/invalid session, clear the token and send the user to login
// instead of leaving them on a page full of failed requests.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('token')
      delete api.defaults.headers.common['Authorization']
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

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

/* ── Unified Today Dashboard (GET /dashboard/today) ── */

export interface TodayTimetableBlock {
  id: number
  title: string
  start_time: string
  end_time: string
  location: string
  category: string
  tag: string
  is_recurring: boolean
  link: string
}

export interface TodayDeadline {
  id: number
  title: string
  deadline_date: string | null
  deadline_label: string
  overdue: boolean
}

export interface TodayTask {
  id: number
  title: string
  priority: number
  estimated_hours: number
  due_date: string | null
  overdue: boolean
}

export interface TodayDashboardData {
  date: string
  timetable: TodayTimetableBlock[]
  deadlines: { overdue: TodayDeadline[]; due_soon: TodayDeadline[] }
  tasks: { open_count: number; overdue_count: number; next_tasks: TodayTask[] }
  burnout: {
    exists: boolean
    score?: number
    risk_level?: string
    ml_score?: number
    telemetry_score?: number
    created_at?: string | null
  }
  working_hours_today: number
}

export const dashboardAPI = {
  getToday: async (horizonHours = 48): Promise<TodayDashboardData> => {
    const res = await api.get<TodayDashboardData>('/dashboard/today', {
      params: { horizon_hours: horizonHours },
    })
    return res.data
  },
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

export interface ExtractedLink {
  title: string
  url: string
  type: 'submission' | 'meeting' | 'form' | 'doc' | 'portal' | 'other' | string
  email_subject?: string
}

export interface ActionItem {
  task: string
  deadline?: string | null
  urgency: 'HIGH' | 'MEDIUM' | 'LOW' | string
  completed?: boolean
  email_id?: number | string
  email_subject?: string
}

export interface DailyDigestSummaryBullet {
  category: string
  importance: string
  subject: string
  text: string
  sender: string
  has_action: boolean
  has_deadline: boolean
}

export interface DailyDigest {
  date: string
  display_date: string
  relative_tag: string
  full_date: string
  diff_days: number
  priority_score: 'HIGH' | 'MEDIUM' | 'LOW'
  priority_label: string
  email_count: number
  deadlines_count: number
  action_items_count: number
  links_count: number
  summary_bullets: DailyDigestSummaryBullet[]
  deadlines: any[]
  action_items: ActionItem[]
  key_links: ExtractedLink[]
}

export interface EmailEvent {
  id: number | string
  title: string
  event_type: string
  event_date?: string
  event_time?: string
  location?: string
  confidence?: string | number
  urgency?: string
  category?: string
}

export interface EmailRecord {
  id: number | string
  subject: string
  sender: string
  category: string
  importance: string
  summary: string
  structured_summary?: string
  body?: string
  body_snippet?: string
  received_at?: string
  date_received?: string
  date?: string
  created_at?: string
  timestamp?: string
  email_date?: string
  is_archived?: boolean
  links?: ExtractedLink[]
  action_items?: ActionItem[]
  events: EmailEvent[]
}

export const emailsAPI = {
  getDailyDigest: async (maxDays = 3): Promise<{ digests: DailyDigest[]; count: number }> => {
    const res = await api.get<{ digests: DailyDigest[]; count: number }>('/emails/daily-digest', {
      params: { max_days: maxDays },
    })
    return res.data
  },
  listEmails: async (): Promise<EmailRecord[]> => {
    const res = await api.get<EmailRecord[]>('/emails/')
    return res.data
  },
  fetchEmails: async (): Promise<{ status: string; ai_processing: boolean; model?: string }> => {
    const res = await api.post<{ status: string; ai_processing: boolean; model?: string }>('/emails/fetch')
    return res.data
  },
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

export interface GoogleAccountStatus {
  is_connected: boolean
  email?: string
  name?: string
  picture?: string
  scopes: string[]
  is_sandbox?: boolean
}

export const googleIntegrationsAPI = {
  getStatus: async (): Promise<GoogleAccountStatus> => {
    const res = await api.get<GoogleAccountStatus>('/integrations/google/status')
    return res.data
  },
  getAuthUrl: async (redirectUri?: string): Promise<{ auth_url: string; is_configured: boolean }> => {
    const res = await api.get<{ auth_url: string; is_configured: boolean }>('/integrations/google/auth-url', {
      params: { redirect_uri: redirectUri },
    })
    return res.data
  },
  handleCallback: async (code: string, redirectUri?: string, state?: string): Promise<{ status: string; message: string; email: string }> => {
    const res = await api.post<{ status: string; message: string; email: string }>('/integrations/google/callback', {
      code,
      redirect_uri: redirectUri,
      state,
    })
    return res.data
  },
  disconnect: async (): Promise<{ status: string; message: string }> => {
    const res = await api.post<{ status: string; message: string }>('/integrations/google/disconnect')
    return res.data
  },
  getGmailMessages: async (maxResults: number = 20, query?: string): Promise<{ status: string; messages: any[]; count: number; ai_enriched: boolean }> => {
    const res = await api.get<{ status: string; messages: any[]; count: number; ai_enriched: boolean }>('/integrations/google/gmail/messages', {
      params: { max_results: maxResults, query },
    })
    return res.data
  },
  getGmailDailyDigest: async (maxDays = 3): Promise<{ digests: DailyDigest[]; count: number }> => {
    const res = await api.get<{ digests: DailyDigest[]; count: number }>('/integrations/google/gmail/daily-digest', {
      params: { max_days: maxDays },
    })
    return res.data
  },
  exportToDrive: async (payload: { title: string; url: string; course_code: string; year?: number; description?: string }): Promise<{ status: string; file_id: string; web_view_link: string; folder_path: string; message: string }> => {
    const res = await api.post<{ status: string; file_id: string; web_view_link: string; folder_path: string; message: string }>('/integrations/google/drive/export', payload)
    return res.data
  },
  syncTimetableToCalendar: async (): Promise<{ status: string; calendar_id: string; synced_count: number; message: string }> => {
    const res = await api.post<{ status: string; calendar_id: string; synced_count: number; message: string }>('/integrations/google/calendar/sync-timetable')
    return res.data
  },
  syncDeadlinesToCalendar: async (): Promise<{ status: string; calendar_id: string; synced_count: number; message: string }> => {
    const res = await api.post<{ status: string; calendar_id: string; synced_count: number; message: string }>('/integrations/google/calendar/sync-deadlines')
    return res.data
  },
}

export interface DriveItem {
  id: string
  name: string
  mimeType: string
  size: string
  modifiedTime?: string
  webViewLink?: string
  iconLink?: string
  thumbnailLink?: string
  is_folder: boolean
}

export interface DriveFolderContent {
  current_folder_id: string
  current_folder_name: string
  breadcrumbs: Array<{ id: string; name: string }>
  folders: DriveItem[]
  files: DriveItem[]
}

export interface LibraryResource extends Resource {
  is_owner: boolean
  origin: 'bookmark' | 'upload' | 'note'
}

export interface TaskFromResourcePayload {
  resource_id?: number
  file_id?: string
  title: string
  url?: string
  course_code?: string
  due_date?: string
  end_time?: string
  priority?: number
  tag?: string
  custom_tag?: string
  notes?: string
  create_planner_deadline?: boolean
}

export const googleDriveAPI = {
  browse: async (folderId?: string): Promise<DriveFolderContent> => {
    const res = await api.get<DriveFolderContent>('/integrations/google/drive/browse', {
      params: folderId ? { folder_id: folderId } : {},
    })
    return res.data
  },
  createFolder: async (folderName: string, parentId?: string): Promise<DriveItem> => {
    const res = await api.post<DriveItem>('/integrations/google/drive/folder', {
      folder_name: folderName,
      parent_id: parentId,
    })
    return res.data
  },
  rename: async (fileId: string, newName: string): Promise<{ id: string; name: string; status: string }> => {
    const res = await api.patch<{ id: string; name: string; status: string }>('/integrations/google/drive/rename', {
      file_id: fileId,
      new_name: newName,
    })
    return res.data
  },
  move: async (fileId: string, destinationFolderId: string): Promise<{ id: string; destination: string; status: string }> => {
    const res = await api.post<{ id: string; destination: string; status: string }>('/integrations/google/drive/move', {
      file_id: fileId,
      destination_folder_id: destinationFolderId,
    })
    return res.data
  },
  deleteFile: async (fileId: string): Promise<{ id: string; status: string }> => {
    const res = await api.delete<{ id: string; status: string }>(`/integrations/google/drive/file/${fileId}`)
    return res.data
  },
  ensureFolderPath: async (folderPath: string, parentId?: string): Promise<{ folder_id: string; folder_path: string }> => {
    const res = await api.post<{ folder_id: string; folder_path: string }>('/integrations/google/drive/folder-path', {
      folder_path: folderPath,
      parent_id: parentId,
    })
    return res.data
  },
  uploadFile: async (
    file: File,
    folderId?: string,
    relativePath?: string,
    onProgress?: (percent: number) => void
  ): Promise<DriveItem> => {
    const formData = new FormData()
    formData.append('file', file)
    if (folderId) {
      formData.append('folder_id', folderId)
    }
    if (relativePath) {
      formData.append('relative_path', relativePath)
    }
    const res = await api.post<DriveItem>('/integrations/google/drive/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      },
    })
    return res.data
  },
}

export const myLibraryAPI = {
  getLibrary: async (params?: { course?: string; type?: string; q?: string }): Promise<LibraryResource[]> => {
    const res = await api.get<LibraryResource[]>('/resources/library', { params })
    return res.data
  },
  createTaskFromResource: async (payload: TaskFromResourcePayload): Promise<{ status: string; task_id: number; planner_event_id?: number; message: string }> => {
    const res = await api.post<{ status: string; task_id: number; planner_event_id?: number; message: string }>('/resources/tasks-from-resource', payload)
    return res.data
  },
}




