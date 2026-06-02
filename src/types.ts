export type Role = 'admin' | 'doctor' | 'receptionist';

export interface RolePermissions {
  viewDashboard: boolean;
  managePatients: boolean;
  manageAppointments: boolean;
  viewMedicalRecords: boolean;
  viewFinances: boolean;
  viewReports: boolean;
  manageSettings: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface ClinicSettings {
  name: string;
  address: string;
  phone: string;
  defaultPrice: number;
  doctorName: string;
  language: 'ar' | 'en';
  theme: 'light' | 'dark';
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  phone: string;
  address: string;
  medicalHistory: string;
  attachments?: { name: string; url: string; type: string; date: string }[];
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus = 'pending' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  notes: string;
  createdAt: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  visitDate: string;
  diagnosis: string;
  treatment: string;
  prescription: string;
  doctorId: string;
}

export type PaymentMethod = 'cash' | 'transfer' | 'insurance';
export type InvoiceStatus = 'paid' | 'unpaid';

export interface Invoice {
  id: string;
  patientId: string;
  patientName: string;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  status: InvoiceStatus;
  updatedAt?: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  createdAt: string;
}

export interface Examination {
  id?: string;
  patientId: string;
  patientName: string;
  date: string;
  type: string;
  vitals: {
    weight?: string;
    height?: string;
    bloodPressure?: string;
    pulse?: string;
    temperature?: string;
  };
  complaint: string;
  findings: string;
  diagnosis: string;
  notes: string;
  amount?: number;
  createdAt: string;
}

export interface BackupRecord {
  id: string;
  filename: string;
  timestamp: string;
  size: number;
  data: string; // JSON string
  createdBy: string;
  type: 'manual' | 'auto';
}
