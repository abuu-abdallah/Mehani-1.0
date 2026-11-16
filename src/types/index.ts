export type UserRole = 'customer' | 'provider' | 'admin';

export type Language = 'ar' | 'en';

export interface ServiceCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  iconName: string;
  descriptionAr: string;
  descriptionEn: string;
  averageRateSDG: number;
  popularLocations: string[];
}

export interface PortfolioItem {
  id: string;
  titleAr: string;
  titleEn: string;
  imageUrl: string;
  descriptionAr?: string;
  descriptionEn?: string;
}

export interface ProviderCustomService {
  id: string;
  nameAr: string;
  nameEn?: string;
  priceSDG: number;
  categoryId?: string; // Links to official category
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  password?: string;
  role: UserRole;
  avatarUrl: string;
  state: string; // e.g., Khartoum, Port Sudan, Gezira
  city: string;
  neighborhood: string; // الحي
  createdAt: string;
  isActive?: boolean; // Account status: active or deactivated by admin
  deactivatedReason?: string;

  // Hirer specific
  unpaidCancellationFeeSDG?: number; // 5% fee from previously cancelled service

  // Provider specific
  tradeCategoryId?: string;
  serviceCategoryIds?: string[]; // Array of categories provider offers (must have at least 1)
  customServices?: ProviderCustomService[]; // Provider-defined specific services and prices
  tradeTitleAr?: string;
  tradeTitleEn?: string;
  bioAr?: string;
  bioEn?: string;
  basePriceSDG?: number;
  pricingType?: 'fixed' | 'per_hour' | 'negotiable';
  isAvailable?: boolean;
  activeServicesCount?: number; // Max 2 allowed!
  rating?: number;
  reviewCount?: number;
  nidUrl?: string; // National ID image/document
  nidNumber?: string;
  nidStatus?: 'pending' | 'approved' | 'reupload_requested'; // NID audit status
  nidRejectionReason?: string; // Admin feedback if wrong/unclear NID was uploaded
  nidSubmittedAt?: string; // Timestamp of latest document submission
  coveredNeighborhoods?: string[];
  portfolio?: PortfolioItem[];
  totalEarningsSDG?: number;
  pendingCommissionDueSDG?: number; // 8% per completed service
  lastThursdayDepositDate?: string;
}

export interface ServiceSuggestion {
  id: string;
  providerId: string;
  providerName: string;
  providerPhone: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  suggestedRateSDG: number;
  iconName?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
}

export type ServiceStatus = 
  | 'pending'       // Client sent request, waiting for provider
  | 'accepted'      // Provider accepted (counts towards 2 active services)
  | 'in_progress'   // Service is actively underway (counts towards 2 active services)
  | 'completed'     // Service finished, ready for payment & commission calc
  | 'cancelled';    // Cancelled by client (triggers 5% next-job penalty) or provider

export interface ServiceRequest {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  providerId: string;
  providerName: string;
  providerPhone: string;
  providerTradeAr: string;
  providerTradeEn: string;
  status: ServiceStatus;
  createdAt: string;
  scheduledTimeNote: string; // Agreement between provider & client
  addressDetails: string;
  city: string;
  neighborhood: string;
  problemDescription: string;
  selectedServiceItemIds?: string[];
  selectedServiceNames?: string[];
  agreedPriceSDG: number;
  cancellationFeePenaltySDG: number; // 5% penalty from past cancellation applied to this order
  commissionRatePercent: number; // Always 8%
  commissionFeeSDG: number; // 8% of agreedPriceSDG
  paymentMethod?: 'cash' | 'bankak' | 'fawry' | 'pending';
  isPaidByClient?: boolean;
  clientRating?: number; // 1 to 5 stars
  clientReviewComment?: string;
  ratedAt?: string;
  cancelledBy?: 'client' | 'provider';
  cancelReason?: string;
  cancelledAt?: string;
  completedAt?: string;
}

export interface ThursdayCommissionDeposit {
  id: string;
  providerId: string;
  providerName: string;
  amountSDG: number;
  depositDate: string;
  bankakReferenceNumber: string;
  receiptFileUrl: string;
  notes?: string;
  status: 'verified' | 'pending_verification' | 'rejected';
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
}

export interface Review {
  id: string;
  clientId: string;
  clientName: string;
  providerId: string;
  rating: number;
  comment: string;
  createdAt: string;
}
