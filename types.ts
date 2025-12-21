
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'partner';
  memberId: string;
  status: 'active' | 'pending' | 'inactive';
}

export interface PaymentRecord {
  id: string;
  date: string;
  name: string;
  method: string;
  amount: number;
  status: 'paid' | 'pending' | 'cancelled';
}

export interface Merchant {
  id: string;
  name: string;
  type: string;
  promo: string;
  status: 'active' | 'pending';
  img: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface ForumTopic {
  id: string;
  title: string;
  author: string;
  category: string;
  replies: number;
  views: string;
  time: string;
  isOfficial: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface MapsGroundingResponse {
  text: string;
  links: { uri: string; title: string }[];
}
