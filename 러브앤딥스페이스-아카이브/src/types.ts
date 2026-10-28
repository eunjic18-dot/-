export interface Card {
  id: string;
  name: string;
  imageUrls: string[];
  gachaPeriod?: string;
  gachaStartDate?: string;
  gachaEndDate?: string;
  rerunStartDate?: string;
  rerunEndDate?: string;
  releaseDate?: string;
  pvUrl?: string;
  pvUrl2?: string;
  memoryIntroUrl?: string;
  memoryIntroUrl2?: string;
  linkedCardId?: string | null;
  attribute: '공격' | '방어' | '체력';
  color: '레드' | '블루' | '골드' | '그린' | '퍼플' | '핑크' | '빨강' | '파랑' | '노랑' | '초록' | '보라' | '분홍';
  type: '단독' | '단체' | '배포' | '상시' | '비밀 약속' | '주년 기념 배포' | '별의 나침반';
  category: '백야' | '월광';
  character: '심성훈' | '이서언' | '기욱' | '진운' | '하우주';
  rarity?: 4 | 5;
  createdAt: any;
}

export interface Review {
  id: string;
  cardId: string;
  content: string;
  mediaUrls: string[];
  nickname: string;
  password?: string;
  ip?: string;
  isSpoiler?: boolean;
  ratings?: {
    overall: number;
    story?: number;
    directing?: number;
  };
  likes?: number;
  likedBy?: string[];
  commentCount?: number;
  visitorId?: string;
  createdAt: any;
}

export interface Comment {
  id: string;
  reviewId: string;
  cardId?: string;
  parentId?: string;
  content: string;
  nickname: string;
  password?: string;
  mediaUrls?: string[];
  ip?: string;
  visitorId?: string;
  isSpoiler?: boolean;
  createdAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
