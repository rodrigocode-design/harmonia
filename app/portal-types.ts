import type { RoleCode } from "@/lib/access";

export type Lesson = {
  id: string; title: string; startsAt: string; endsAt: string; status: string; modality: string;
  teacherId: string; teacherName: string; roomId: string | null; roomName: string | null;
  studentIds: string[]; studentNames: string[]; attendanceStatus: string | null; bufferMinutes: number;
};

export type Task = {
  id: string; title: string; instructions: string; dueAt: string; priority: string; status: string;
  teacherId: string; teacherName: string; recipientIds: string; recipients: string;
  submissionId: string | null; submissionStatus: string | null; currentVersion: number | null;
};

export type Report = {
  id: string; referenceMonth: string; status: string; currentVersion: number; studentId: string;
  studentName: string; teacherName: string; data: Record<string, string | number>; coordinationComment: string | null; updatedAt: string;
};

export type EventItem = {
  id: string; type: string; title: string; description: string; startsAt: string; endsAt: string;
  location: string; capacity: number | null; registrations: number; myStatus: string | null;
};

export type PortalData = {
  session: {
    user: { id: string; displayName: string; email: string };
    roles: RoleCode[]; activeRole: RoleCode; permissions: string[];
    school: { name: string; timezone: string }; unit: { id: string; name: string }; studentId: string | null; teacherId: string | null;
  };
  lessons: Lesson[];
  tasks: Task[];
  reports: Report[];
  events: EventItem[];
  announcements: Array<{ id: string; title: string; body: string; priority: string; publishedAt: string; requiresAcknowledgement: number; readAt: string | null }>;
  students: Array<{ id: string; name: string; email: string; birthDate: string | null; active: number }>;
  teachers: Array<{ id: string; name: string; bio: string | null; active: number }>;
  rooms: Array<{ id: string; name: string; capacity: number; accessible: number; resources: string }>;
  courses: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string }>;
  instruments: Array<{ id: string; name: string }>;
  charges: Array<{ id: string; studentId: string; studentName: string; referenceMonth: string; dueDate: string; finalAmountCents: number; status: string; paidCents: number }>;
  practice: Array<{ id: string; studentId: string; practicedOn: string; minutes: number; repertoire: string | null; difficulty: string | null }>;
  goals: Array<{ id: string; title: string; progressPercent: number; targetDate: string | null }>;
  metrics: Array<{
    teacherId: string; teacherName: string; plannedLessons: number; taughtLessons: number; taughtHours: number;
    attendanceRecords: number; expectedAttendanceRecords: number; tasksCreated: number; tasksReviewed: number;
    reportsDelivered: number; sampleSize: number;
  }>;
  audit: Array<{ id: string; action: string; entityType: string; outcome: string; actorRole: string | null; occurredAt: string; metadata: Record<string, unknown> }>;
  notifications: Array<{ id: string; title: string; body: string; readAt: string | null }>;
  dashboard: {
    availableTeachersToday: number;
    pendingMakeupCredits: number;
    freeSlots: Array<{ teacherId: string; teacherName: string; startsAt: string; endsAt: string }>;
  };
  system: { generatedAt: string; timezone: string; demoData: boolean; externalServices: Record<string, string> };
};

export type Mutation = (action: string, payload: unknown) => Promise<boolean>;
