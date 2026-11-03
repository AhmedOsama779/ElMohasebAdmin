export interface ApiResponse<T> {
  code: number;
  message: string;
  errors: string[] | null;
  status?: number;
  data: T;
}

export interface LookupItem {
  id: number;
  name: string;
}

export interface RegisterRequest {
  fullname: string;
  email: string;
  waPhone: string;
  country: number;
  city: number;
  password: string;
  passwordConfirmation: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ResetPasswordRequest {
  email: string;
  password: string;
}

export interface VerifyRequest {
  email: string;
  otp: string;
}

export interface DocumentItem {
  id: number;
  name: string;
  isMandatory: boolean;
}

export interface ServiceItem {
  id: number;
  name: string;
  url: string;
  description: string;
  price: number;
  deposit: number;
  remind: number;
  documents: DocumentItem[];
  count?: number; // number of documents, counted by the server
}

export interface CategoryItem {
  id: number;
  name: string;
  isValid?: boolean; // false = the category is disabled
  count?: number;
  url: string;
  services: ServiceItem[];
}

export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface DocumentStatus {
  id: number;
  name: string;
  isMandatory: boolean;
  isUploaded: boolean;
}

export interface PaymentInfo {
  ipan: string;
  accountName: string;
  notes: string | null;
}

export interface RequestCreated {
  id: number;
  orderCode: string;
}

export interface RequestOrder {
  customerID: string;
  requestID: number;
  categoryID: number;
  serviceID: number;
  orderCode: string;
  category: string;
  service: string;
  price: number;
  createdAt: string;
  updatedAt: string;
  isPaidComplete: boolean;
}

export interface RequestDetails {
  id: number;
  orderCode: string;
  createdAt: string;
  price: number;
  deposit: number;
  remind: number;
  isPaidComplete: boolean;
}

export interface ContactPhone {
    id?: number;
  phone: string;
  name: string;
}

export interface ContactLocation {
    id?: number;
  locationName: string;
  address: string;
  mapUrl: string | null;
}

export interface ContactInfo {
  id: number;
  updatedAt: string;
  email: string | null;
  contactText: string | null;
  workingDays: string | null;
  workingTimes: string | null;
  extraNotes: string | null;
  facebookUrl: string | null;
  xUrl: string | null;
  youtubeUrl: string | null;
  whatsAppUrl: string | null;
  phones: ContactPhone[];
  locations: ContactLocation[];
}
// What the PUT endpoint accepts (everything except the fields the server fills in)
export type ContactInput = Omit<ContactInfo, 'id' | 'updatedAt'>;

export interface RequestDocument {
  name: string;
  url: string;
}

export interface AdminRequest {
  id: number;
  code: string;
  isRead: boolean;
  receiptUrl: string | null;    // deposit receipt
  remainingUrl: string | null;  // remaining-payment receipt (empty until it is paid)
  createdAt: string;
  service: string;
  price: number;
  deposit: number;
  remind: number;
  phone: string;
  email: string;
  name: string;
  isSpam: boolean;
  documents: RequestDocument[];
}
export type CustomerRole = 'Admin' | 'Customer';

export interface Customer {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  role: CustomerRole;
  isBlacklisted: boolean;
}
// What GET /api/Customers/Customers really returns for each customer
export interface ApiCustomer {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;     // an Arabic label such as "مستخدم عادي"
  roleID: number;
  isActive: boolean;
  isSpam: boolean;  // blacklisted
  country: string;
  city: string;
}

export interface AccountType {
  id: number;
  accountType: string;
}

export interface PaymentAccount {
  id: number;
  ipan: string;
  accountName: string;
  notes: string | null;
  accountType: AccountType;
}

export interface PaymentAccountInput {
  accountType: number;
  ipan: string;
  accountName: string;
  notes: string;
}

// Subscription switch: GET /api/Validity/Validity
export interface ValidityInfo {
  isValid: boolean;
  message: string | null;  // optional reason shown on the page
  phone: string | null;    // WhatsApp number of the service administrator
}
