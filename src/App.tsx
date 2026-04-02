/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  where,
  getDocFromServer,
  doc,
  deleteDoc,
  updateDoc,
  limit,
  increment,
  setDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
// import { ref, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, signIn, logOut } from './firebase';
import { Card, Review, Comment, OperationType, FirestoreErrorInfo } from './types';
import { 
  Plus, 
  MessageSquare, 
  Image as ImageIcon, 
  Send, 
  X, 
  ChevronRight, 
  ChevronLeft,
  Shield, 
  Zap, 
  Heart,
  Star,
  LogOut,
  LogIn,
  Loader2,
  Trash2,
  Edit,
  Play,
  Calendar,
  UploadCloud,
  Youtube,
  Link,
  Paperclip,
  CornerDownRight,
  Menu,
  AlertTriangle,
  Eye,
  EyeOff,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Tweet } from 'react-tweet';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DialogState = {
  isOpen: boolean;
  type: 'alert' | 'confirm' | 'prompt';
  message: string;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
};

let showDialogFn: (state: Omit<DialogState, 'isOpen'>) => void;

export const customAlert = (message: string) => {
  return new Promise<void>(resolve => {
    showDialogFn({ type: 'alert', message, onConfirm: () => resolve() });
  });
};

export const customConfirm = (message: string) => {
  return new Promise<boolean>(resolve => {
    showDialogFn({ 
      type: 'confirm', 
      message, 
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });
};

export const customPrompt = (message: string) => {
  return new Promise<string | null>(resolve => {
    showDialogFn({ 
      type: 'prompt', 
      message, 
      onConfirm: (val) => resolve(val || ''),
      onCancel: () => resolve(null)
    });
  });
};

export function CustomDialog() {
  const [state, setState] = useState<DialogState>({ isOpen: false, type: 'alert', message: '' });
  const [inputValue, setInputValue] = useState('');
  
  useEffect(() => {
    showDialogFn = (newState) => {
      setState({ ...newState, isOpen: true });
      setInputValue('');
    };
  }, []);

  if (!state.isOpen) return null;

  const handleConfirm = () => {
    if (state.onConfirm) state.onConfirm(state.type === 'prompt' ? inputValue : undefined);
    setState(prev => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    if (state.onCancel) state.onCancel();
    setState(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="fixed inset-0 z-[999999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-bold text-gray-900 mb-2">러브앤딥스페이스 아카이브</h3>
        <p className="text-sm text-gray-600 mb-6 whitespace-pre-wrap">{state.message}</p>
        
        {state.type === 'prompt' && (
          <input 
            type="password" 
            autoComplete="new-password"
            autoFocus
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
          />
        )}
        
        <div className="flex justify-end gap-2">
          {state.type !== 'alert' && (
            <button onClick={handleCancel} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl">취소</button>
          )}
          <button onClick={handleConfirm} className="px-4 py-2 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 rounded-xl">확인</button>
        </div>
      </div>
    </div>
  );
}

const ADMIN_EMAIL = "ceunji1218@gmail.com";

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const uploadMedia = async (file: File, pathPrefix: string, onProgress?: (progress: number) => void): Promise<string> => {
  const cloudName = (import.meta as any).env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = (import.meta as any).env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    alert("미디어 업로드를 위해서는 Cloudinary 설정이 필요합니다.\n\n1. cloudinary.com 에 가입하세요.\n2. Settings > Upload 에서 'Upload preset'을 추가하고 'Unsigned'로 설정하세요.\n3. AI Studio의 Settings 메뉴에서 Environment Variables에 다음을 추가하세요:\n- VITE_CLOUDINARY_CLOUD_NAME: (대시보드의 Cloud Name)\n- VITE_CLOUDINARY_UPLOAD_PRESET: (생성한 preset 이름)");
    throw new Error("Cloudinary configuration missing");
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  
  const resourceType = 'auto'; // Use 'auto' to let Cloudinary detect the file type, better for mobile
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`);
    
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress((e.loaded / e.total) * 100);
      }
    };
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        resolve(response.secure_url);
      } else {
        reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
      }
    };
    
    xhr.onerror = () => reject(new Error('Cloudinary upload failed'));
    xhr.send(formData);
  });
};

const renderMediaUrl = (url: string) => {
  if (url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/|e\/))([a-zA-Z0-9_-]{11})/)) {
    return (
      <iframe 
        src={`https://www.youtube.com/embed/${url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/|e\/))([a-zA-Z0-9_-]{11})/)?.[1]}`}
        className="w-full aspect-video rounded-2xl"
        allowFullScreen
      />
    );
  } else if (url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/)) {
    return (
      <div className="flex flex-col items-center w-full overflow-hidden rounded-2xl">
        <Tweet id={url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/)?.[1] || ''} />
        <p className="text-[10px] text-gray-400 mt-2 px-4 text-center break-keep">* 트위터 정책에 따라 영상이 재생되지 않을 수 있습니다. 원본 링크에서 확인해주세요.</p>
      </div>
    );
  } else if (url.match(/\.(mp4|webm|ogg|mov|m4v|avi|wmv)/i) || url.includes('video')) {
    return (
      <video 
        src={url} 
        className="w-full aspect-video rounded-2xl bg-black" 
        controls 
      />
    );
  } else {
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noreferrer" 
        className="flex items-center gap-2 text-blue-500 hover:text-blue-600 font-bold text-sm p-4"
      >
        <Link className="w-4 h-4" /> 외부 링크로 보기
      </a>
    );
  }
};

const getLinkedCardIds = (cardId: string, allCards: Card[]) => {
  const ids = new Set<string>([cardId]);
  const card = allCards.find(c => c.id === cardId);
  if (card?.linkedCardId) ids.add(card.linkedCardId);
  allCards.forEach(c => {
    if (c.linkedCardId === cardId) ids.add(c.id);
    if (card?.linkedCardId && c.linkedCardId === card.linkedCardId) ids.add(c.id);
  });
  return Array.from(ids);
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [cardAverages, setCardAverages] = useState<{[key: string]: {overall: number, story: number, directing: number, count: number}}>({});
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'전체' | '심성훈' | '이서언' | '기욱' | '진운' | '하우주'>('전체');
  const [rarityFilter, setRarityFilter] = useState<'all' | 4 | 5>('all');
  const [sortBy, setSortBy] = useState<'최신순' | '가나다순' | '출시일순' | '색상순' | '능력치순'>('최신순');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [userIp, setUserIp] = useState<string>('');
  const [visitorId, setVisitorId] = useState<string>('');
  const isAdmin = user?.email === ADMIN_EMAIL;
  
  const scrollPosRef = useRef<number>(0);

  const handleSelectCard = (card: Card) => {
    scrollPosRef.current = window.scrollY;
    setSelectedCard(card);
    window.scrollTo(0, 0);
  };

  const handleBackToList = () => {
    setSelectedCard(null);
    setTimeout(() => {
      window.scrollTo(0, scrollPosRef.current);
    }, 10);
  };

  const [showStats, setShowStats] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<'1' | '7' | '30' | 'all'>('30');
  const [stats, setStats] = useState<any[]>([]);

  // Admin Form State
  const [newCard, setNewCard] = useState<Partial<Card>>({
    name: '',
    imageUrls: [] as string[],
    gachaStartDate: '',
    gachaEndDate: '',
    rerunStartDate: '',
    rerunEndDate: '',
    releaseDate: '',
    pvUrl: '',
    memoryIntroUrl: '',
    attribute: '공격' as Card['attribute'],
    color: '레드' as Card['color'],
    type: '단독' as Card['type'],
    category: '백야' as Card['category'],
    character: '심성훈' as Card['character']
  });
  const [tempImageUrl, setTempImageUrl] = useState('');
  const [uploadingImages, setUploadingImages] = useState(false);

  // Review Form State
  const [reviewForm, setReviewForm] = useState({
    content: '',
    nickname: '',
    password: '',
    mediaUrls: [] as string[],
    mediaUrlInput: '',
    isSpoiler: false,
    ratings: {
      overall: 0,
      story: 0,
      directing: 0
    }
  });
  const [reviewSortBy, setReviewSortBy] = useState<'latest' | 'likes' | 'comments'>('latest');
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editReviewForm, setEditReviewForm] = useState<any>(null);
  const [uploadingReviewImage, setUploadingReviewImage] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [globalLightboxData, setGlobalLightboxData] = useState<{ urls: string[], index: number } | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const globalLightboxMountTime = useRef<number>(0);
  const lightboxSwiped = useRef<boolean>(false);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const reviewFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lightboxTouchStartX = useRef<number | null>(null);
  const reviewsPerPage = 5;

  useEffect(() => {
    if (globalLightboxData) {
      globalLightboxMountTime.current = Date.now();
      setIsZoomed(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [globalLightboxData]);

  useEffect(() => {
    if (selectedCard) {
      window.scrollTo(0, 0);
      setCurrentImageIndex(0);
      setReviewPage(1);
    }
  }, [selectedCard]);

  useEffect(() => {
    let id = localStorage.getItem('visitor_id');
    if (!id) {
      id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('visitor_id', id);
    }
    setVisitorId(id);
    (window as any).visitorId = id;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      setLoading(false);
    });
    
    // Generate/Retrieve Visitor ID
    let vid = localStorage.getItem('visitor_id');
    if (!vid) {
      vid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('visitor_id', vid);
    }
    setVisitorId(vid);

    // Fetch user IP
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => {
        setUserIp(data.ip);
      })
      .catch(err => console.error("Error fetching IP:", err));

    // Track visit and page views
    const trackVisit = async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Visitor ID (Persistent)
      let vid = localStorage.getItem('visitor_id');
      if (!vid) {
        vid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('visitor_id', vid);
      }
      
      // Session ID (Tab session)
      let sid = sessionStorage.getItem('session_id');
      if (!sid) {
        sid = Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('session_id', sid);
      }
      
      const lastVisitDate = localStorage.getItem('last_visit_date');
      const lastTrackedSessionId = sessionStorage.getItem('last_tracked_session_id');
      
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const deviceType = isMobile ? 'mobile' : 'desktop';
      
      let browser = 'Other';
      const ua = navigator.userAgent;
      if (ua.includes('Chrome')) browser = 'Chrome';
      else if (ua.includes('Safari')) browser = 'Safari';
      else if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Edge')) browser = 'Edge';
      
      const referrer = document.referrer ? new URL(document.referrer).hostname : 'Direct';
      const currentPath = selectedCard ? `card_${selectedCard.id}` : 'home';

      const statRef = doc(db, 'stats', today);
      
      const updateData: any = {
        pageViews: increment(1),
        [`paths.${currentPath.replace(/\./g, '_')}`]: increment(1),
        [`devices.${deviceType}`]: increment(1),
        [`browsers.${browser}`]: increment(1),
        [`referrers.${referrer.replace(/\./g, '_')}`]: increment(1),
        lastUpdated: serverTimestamp()
      };

      let isNewVisit = false;
      let isNewUniqueVisitor = false;

      // Unique Visitor: Once per visitor_id per day
      if (lastVisitDate !== today) {
        isNewUniqueVisitor = true;
        localStorage.setItem('last_visit_date', today);
      }
      
      // Visit (Session): Once per session_id
      if (lastTrackedSessionId !== sid) {
        isNewVisit = true;
        sessionStorage.setItem('last_tracked_session_id', sid);
      }

      if (isNewVisit) {
        updateData.visits = increment(1);
      }
      if (isNewUniqueVisitor) {
        updateData.uniqueVisitors = increment(1);
      }

      try {
        await updateDoc(statRef, updateData);
      } catch (error) {
        // If doc doesn't exist, set it
        const initialData = {
          date: today,
          pageViews: 1,
          visits: 1,
          uniqueVisitors: 1,
          paths: { [currentPath.replace(/\./g, '_')]: 1 },
          devices: { [deviceType]: 1 },
          browsers: { [browser]: 1 },
          referrers: { [referrer.replace(/\./g, '_')]: 1 },
          lastUpdated: serverTimestamp()
        };
        await setDoc(statRef, initialData, { merge: true });
      }
    };

    trackVisit();

    return () => unsubscribe();
  }, [selectedCard?.id]);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'cards'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cardList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Card));
      setCards(cardList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'cards'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedCard) {
      const updatedCard = cards.find(c => c.id === selectedCard.id);
      if (updatedCard && JSON.stringify(updatedCard) !== JSON.stringify(selectedCard)) {
        setSelectedCard(updatedCard);
      } else if (!updatedCard) {
        setSelectedCard(null);
      }
    }
  }, [cards, selectedCard]);

  useEffect(() => {
    if (!selectedCard) {
      setReviews([]);
      return;
    }
    const linkedIds = getLinkedCardIds(selectedCard.id, cards);
    const q = query(
      collection(db, 'reviews'), 
      where('cardId', 'in', linkedIds),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reviewList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      setReviews(reviewList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'reviews'));
    return () => unsubscribe();
  }, [selectedCard]);

  const sortedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => {
      if (reviewSortBy === 'likes') return (b.likes || 0) - (a.likes || 0);
      if (reviewSortBy === 'comments') return (b.commentCount || 0) - (a.commentCount || 0);
      return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
    });
  }, [reviews, reviewSortBy]);

  useEffect(() => {
    if (isAdmin && showStats) {
      let q;
      if (statsPeriod === 'all') {
        q = query(collection(db, 'stats'), orderBy('date', 'desc'));
      } else {
        q = query(collection(db, 'stats'), orderBy('date', 'desc'), limit(parseInt(statsPeriod)));
      }
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setStats(snapshot.docs.map(doc => doc.data()));
      });
      return () => unsubscribe();
    }
  }, [isAdmin, showStats, statsPeriod]);

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    try {
      if (editingCardId) {
        const cardRef = doc(db, 'cards', editingCardId);
        await updateDoc(cardRef, {
          ...newCard,
          updatedAt: serverTimestamp()
        });
        await customAlert('카드가 성공적으로 수정되었습니다.');
      } else {
        await addDoc(collection(db, 'cards'), {
          ...newCard,
          createdAt: serverTimestamp()
        });
        await customAlert('카드가 성공적으로 추가되었습니다.');
      }
      setShowAdminModal(false);
      setEditingCardId(null);
      setNewCard({
        name: '',
        imageUrls: [],
        gachaStartDate: '',
        gachaEndDate: '',
        rerunStartDate: '',
        rerunEndDate: '',
        releaseDate: '',
        pvUrl: '',
        attribute: '공격',
        color: '레드',
        type: '단독',
        character: '심성훈',
        category: '백야'
      });
      setTempImageUrl('');
    } catch (error) {
      console.error("Error adding/updating card:", error);
      await customAlert('카드 저장에 실패했습니다.');
      handleFirestoreError(error, editingCardId ? OperationType.UPDATE : OperationType.CREATE, editingCardId ? `cards/${editingCardId}` : 'cards');
    }
  };

  const handleEditCard = (card: Card) => {
    setEditingCardId(card.id);
    const colorMap: Record<string, string> = {
      '빨강': '레드',
      '파랑': '블루',
      '노랑': '골드',
      '초록': '그린',
      '보라': '퍼플',
      '분홍': '핑크'
    };
    const newColor = colorMap[card.color] || card.color;

    setNewCard({
      name: card.name,
      imageUrls: card.imageUrls || [],
      gachaStartDate: card.gachaStartDate || '',
      gachaEndDate: card.gachaEndDate || '',
      rerunStartDate: card.rerunStartDate || '',
      rerunEndDate: card.rerunEndDate || '',
      releaseDate: card.releaseDate || '',
      pvUrl: card.pvUrl || '',
      memoryIntroUrl: card.memoryIntroUrl || '',
      attribute: card.attribute,
      color: newColor as any,
      type: card.type,
      category: card.category,
      character: card.character
    });
    setShowAdminModal(true);
  };

  const handleDeleteCard = async (card: Card) => {
    if (!isAdmin) return;
    if (!(await customConfirm("정말 이 카드를 삭제하시겠습니까?"))) return;
    try {
      await deleteDoc(doc(db, 'cards', card.id));
      setSelectedCard(null);
      await customAlert("카드가 삭제되었습니다.");
    } catch (error) {
      console.error("Error deleting card:", error);
      await customAlert("카드 삭제에 실패했습니다.");
      handleFirestoreError(error, OperationType.DELETE, `cards/${card.id}`);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setUploadingImages(true);
    setUploadProgress(0);
    
    try {
      const uploadPromises = files.map(async (file) => {
        const isVideo = file.type.startsWith('video/');
        const limit = isVideo ? 100 : 10; // 100MB for video, 10MB for image (Cloudinary Free tier)
        if (file.size > limit * 1024 * 1024) {
          throw new Error(`${file.name}은(는) 너무 큽니다 (최대 ${limit}MB)`);
        }
        return uploadMedia(file, 'card', setUploadProgress);
      });
      
      const urls = await Promise.all(uploadPromises);
      setNewCard(prev => ({ ...prev, imageUrls: [...(prev.imageUrls || []), ...urls] }));
    } catch (error: any) {
      console.error("Error uploading images:", error);
      await customAlert(`이미지 업로드에 실패했습니다: ${error.message}\n\n[해결 방법]\nFirebase Storage 요금제 문제일 수 있습니다. .env 파일에 VITE_CLOUDINARY_CLOUD_NAME과 VITE_CLOUDINARY_UPLOAD_PRESET을 설정하여 무료로 미디어를 업로드하세요.`);
    } finally {
      setUploadingImages(false);
      setUploadProgress(null);
    }
  };

  const handleReviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    
    setUploadingReviewImage(true);
    setUploadProgress(0);
    
    try {
      const uploadPromises = files.map(async (file) => {
        const isVideo = file.type.startsWith('video/');
        const limit = isVideo ? 100 : 10;
        if (file.size > limit * 1024 * 1024) {
          throw new Error(`${file.name}은(는) 너무 큽니다 (최대 ${limit}MB)`);
        }
        return uploadMedia(file, 'review', setUploadProgress);
      });
      
      const urls = await Promise.all(uploadPromises);
      setReviewForm(prev => ({ ...prev, mediaUrls: [...prev.mediaUrls, ...urls] }));
    } catch (error: any) {
      console.error("Error uploading images:", error);
      await customAlert(`이미지 업로드에 실패했습니다: ${error.message}\n\n[해결 방법]\nFirebase Storage 요금제 문제일 수 있습니다. .env 파일에 VITE_CLOUDINARY_CLOUD_NAME과 VITE_CLOUDINARY_UPLOAD_PRESET을 설정하여 무료로 미디어를 업로드하세요.`);
    } finally {
      setUploadingReviewImage(false);
      setUploadProgress(null);
      if (e.target) e.target.value = '';
    }
  };

  const handleEditReviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    
    setUploadingReviewImage(true);
    setUploadProgress(0);
    
    try {
      const uploadPromises = files.map(async (file) => {
        const isVideo = file.type.startsWith('video/');
        const limit = isVideo ? 100 : 10;
        if (file.size > limit * 1024 * 1024) {
          throw new Error(`${file.name}은(는) 너무 큽니다 (최대 ${limit}MB)`);
        }
        return uploadMedia(file, 'review', setUploadProgress);
      });
      
      const urls = await Promise.all(uploadPromises);
      setEditReviewForm(prev => prev ? ({ ...prev, mediaUrls: [...prev.mediaUrls, ...urls] }) : null);
    } catch (error: any) {
      console.error("Error uploading images:", error);
      await customAlert(`이미지 업로드에 실패했습니다: ${error.message}\n\n[해결 방법]\nFirebase Storage 요금제 문제일 수 있습니다. .env 파일에 VITE_CLOUDINARY_CLOUD_NAME과 VITE_CLOUDINARY_UPLOAD_PRESET을 설정하여 무료로 미디어를 업로드하세요.`);
    } finally {
      setUploadingReviewImage(false);
      setUploadProgress(null);
      if (e.target) e.target.value = '';
    }
  };

  const handleLikeReview = async (review: Review) => {
    const identifier = user ? user.uid : userIp;
    if (!identifier) {
      await customAlert('좋아요를 누르려면 로그인이 필요하거나 IP를 가져올 수 있어야 합니다.');
      return;
    }

    const reviewRef = doc(db, 'reviews', review.id);
    const isLiked = review.likedBy?.includes(identifier);

    try {
      if (isLiked) {
        await updateDoc(reviewRef, {
          likes: increment(-1),
          likedBy: arrayRemove(identifier)
        });
      } else {
        await updateDoc(reviewRef, {
          likes: increment(1),
          likedBy: arrayUnion(identifier)
        });
      }
    } catch (error) {
      console.error('좋아요 처리 중 오류 발생:', error);
      handleFirestoreError(error, OperationType.UPDATE, `reviews/${review.id}`);
    }
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleAddReview called");
    if (!selectedCard) return;
    console.log("reviewForm.password length:", reviewForm.password.length);
    if (reviewForm.password.length < 4) {
      console.log("Password too short");
      await customAlert("비밀번호는 4자리 이상이어야 합니다. (작성하신 글을 수정하거나 삭제할 때 필요합니다.)");
      return;
    }
    if (reviewForm.ratings.overall < 0.5) {
        await customAlert("총평(별점)은 필수입니다.");
        return;
      }
    try {
      console.log("Adding review...");
      await addDoc(collection(db, 'reviews'), {
        cardId: selectedCard.id,
        content: reviewForm.content,
        nickname: reviewForm.nickname || '익명',
        password: reviewForm.password || '',
        mediaUrls: reviewForm.mediaUrlInput ? [...reviewForm.mediaUrls, reviewForm.mediaUrlInput] : reviewForm.mediaUrls,
        isSpoiler: reviewForm.isSpoiler,
        ratings: (reviewForm.ratings.overall > 0 || reviewForm.ratings.story > 0 || reviewForm.ratings.directing > 0) ? reviewForm.ratings : null,
        likes: 0,
        likedBy: [],
        commentCount: 0,
        ip: userIp,
        visitorId: visitorId,
        createdAt: serverTimestamp()
      });
      console.log("Review added successfully");
      setReviewForm({ content: '', nickname: '', password: '', mediaUrls: [], mediaUrlInput: '', isSpoiler: false, ratings: { overall: 0, story: 0, directing: 0 } });
    } catch (error) {
      console.error("Error adding review:", error);
      await customAlert("감상평 등록에 실패했습니다. 다시 시도해주세요.");
      handleFirestoreError(error, OperationType.CREATE, 'reviews');
    }
  };

  const handleUpdateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReviewId || !editReviewForm) return;
    const review = reviews.find(r => r.id === editingReviewId);
    if (!review) return;

    try {
      const reviewRef = doc(db, 'reviews', editingReviewId);
      
      // Ensure mediaUrls is updated correctly
      const finalMediaUrls = editReviewForm.mediaUrlInput 
        ? [...editReviewForm.mediaUrls, editReviewForm.mediaUrlInput]
        : editReviewForm.mediaUrls;

      const reviewPassword = review.password || '';
      const formPassword = editReviewForm.password || '';
      
      if (!isAdmin && formPassword !== reviewPassword) {
        await customAlert("비밀번호가 일치하지 않습니다.");
        return;
      }
      if (!editReviewForm.ratings || editReviewForm.ratings.overall < 0.5) {
        await customAlert("총평(별점)은 필수입니다.");
        return;
      }

      await updateDoc(reviewRef, {
        content: editReviewForm.content,
        nickname: editReviewForm.nickname || '익명',
        mediaUrls: finalMediaUrls,
        isSpoiler: editReviewForm.isSpoiler,
        ratings: (editReviewForm.ratings.overall > 0 || editReviewForm.ratings.story > 0 || editReviewForm.ratings.directing > 0) ? editReviewForm.ratings : null,
        updatedAt: serverTimestamp()
      });
      setEditingReviewId(null);
      setEditReviewForm(null);
      await customAlert("수정되었습니다.");
    } catch (error) {
      console.error("Error updating review:", error);
      await customAlert("수정에 실패했습니다.");
    }
  };

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    const currentTouchEndX = e.changedTouches[0].clientX;
    const currentTouchEndY = e.changedTouches[0].clientY;
    setTouchEndX(currentTouchEndX);
    setTouchEndY(currentTouchEndY);

    const swipeDistanceX = currentTouchEndX - touchStartX;
    const swipeDistanceY = currentTouchEndY - touchStartY;
    
    // Swipe right (from left to right) to go back
    // Ensure it's mostly horizontal (X distance > 100, Y distance < 50)
    if (swipeDistanceX > 100 && Math.abs(swipeDistanceY) < 50) {
      handleBackToList();
    }
    
    setTouchStartX(null);
    setTouchStartY(null);
    setTouchEndX(null);
    setTouchEndY(null);
  };

  const handleDeleteReview = async (review: Review) => {
    // Admin can delete everything
    if (isAdmin) {
      if (!(await customConfirm("관리자 권한으로 삭제하시겠습니까?"))) return;
    } else {
      const pwd = await customPrompt("삭제하려면 비밀번호를 입력하세요:");
      if (pwd === null) return;
      if (pwd !== review.password) {
        await customAlert("비밀번호가 일치하지 않습니다.");
        return;
      }
    }
    try {
      await deleteDoc(doc(db, 'reviews', review.id));
      await customAlert("삭제되었습니다.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reviews/${review.id}`);
    }
  };

  const filteredCards = (() => {
    let list = activeTab === '전체' ? cards : cards.filter(c => c.character === activeTab);
    
    if (rarityFilter !== 'all') {
      list = list.filter(c => (c.rarity || 5) === rarityFilter);
    }
    
    switch(sortBy) {
      case '가나다순':
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
      case '출시일순':
        return [...list].sort((a, b) => {
          const dateA = a.releaseDate || a.gachaStartDate || '';
          const dateB = b.releaseDate || b.gachaStartDate || '';
          return dateA.localeCompare(dateB);
        });
      case '색상순':
        return [...list].sort((a, b) => a.color.localeCompare(b.color));
      case '능력치순':
        return [...list].sort((a, b) => a.attribute.localeCompare(b.attribute));
      default: // 최신순
        return [...list].sort((a, b) => {
          const dateA = a.releaseDate || a.gachaStartDate || '';
          const dateB = b.releaseDate || b.gachaStartDate || '';
          // If dates are same, fallback to createdAt
          if (dateA === dateB) {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
          }
          return dateB.localeCompare(dateA);
        });
    }
  })();

  const getThemeColor = (char: string) => {
    switch(char) {
      case '심성훈': return 'bg-[#F4F0F8]'; // Soft Lavender
      case '이서언': return 'bg-[#F0F6FA]'; // Soft Ice Blue
      case '기욱': return 'bg-[#FFF0F5]'; // Soft Coral Pink
      case '진운': return 'bg-[#FDF0F0]'; // Soft Crimson
      case '하우주': return 'bg-[#FFF5ED]'; // Soft Orange
      default: return 'bg-[#F8F9FA]'; // Off-white
    }
  };

  const getAccentColor = (char: string) => {
    switch(char) {
      case '심성훈': return 'text-[#8B78A5]';
      case '이서언': return 'text-[#7BA4C4]';
      case '기욱': return 'text-[#D48C9A]';
      case '진운': return 'text-[#B85C5C]';
      case '하우주': return 'text-[#D49A6A]';
      default: return 'text-gray-600';
    }
  };

  const getButtonColor = (char: string) => {
    switch(char) {
      case '심성훈': return 'bg-gradient-to-r from-[#8B78A5] to-[#A393BA]';
      case '이서언': return 'bg-gradient-to-r from-[#7BA4C4] to-[#92B6D1]';
      case '기욱': return 'bg-gradient-to-r from-[#D48C9A] to-[#E3A3B0]';
      case '진운': return 'bg-gradient-to-r from-[#B85C5C] to-[#C97575]';
      case '하우주': return 'bg-gradient-to-r from-[#D49A6A] to-[#E3B085]';
      default: return 'bg-gradient-to-r from-gray-700 to-gray-600';
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'reviews'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allReviews = snapshot.docs.map(d => d.data() as Review);
      const averages: {[key: string]: {overall: number, story: number, directing: number, count: number}} = {};
      
      cards.forEach(card => {
        const linkedIds = getLinkedCardIds(card.id, cards);
        const cardReviews = allReviews.filter(r => linkedIds.includes(r.cardId));
        
        const count = cardReviews.length;
        const overallCount = cardReviews.filter(r => r.ratings && r.ratings.overall > 0).length;
        const storyCount = cardReviews.filter(r => r.ratings && r.ratings.story > 0).length;
        const directingCount = cardReviews.filter(r => r.ratings && r.ratings.directing > 0).length;

        let overall = 0, story = 0, directing = 0;
        
        if (overallCount > 0) {
          overall = cardReviews.reduce((sum, r) => sum + (r.ratings?.overall || 0), 0) / overallCount;
        }
        if (storyCount > 0) {
          story = cardReviews.reduce((sum, r) => sum + (r.ratings?.story || 0), 0) / storyCount;
        }
        if (directingCount > 0) {
          directing = cardReviews.reduce((sum, r) => sum + (r.ratings?.directing || 0), 0) / directingCount;
        }

        averages[card.id] = { overall, story, directing, count };
      });
      
      setCardAverages(averages);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'reviews'));
    return () => unsubscribe();
  }, [cards]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center gap-6"
        >
          <div className="relative w-16 h-16">
            <motion.div 
              className="absolute inset-0 border-4 border-gray-200 rounded-full"
            />
            <motion.div 
              className="absolute inset-0 border-4 border-gray-900 rounded-full border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
            <motion.div 
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="w-2 h-2 bg-gray-900 rounded-full" />
            </motion.div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 tracking-widest uppercase">Love and Deepspace</h2>
            <p className="text-xs text-gray-500 font-medium tracking-widest uppercase animate-pulse">Loading Archive...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentTheme = selectedCard ? getThemeColor(selectedCard.character) : getThemeColor(activeTab);
  const currentAccent = selectedCard ? getAccentColor(selectedCard.character) : getAccentColor(activeTab);
  const currentButton = selectedCard ? getButtonColor(selectedCard.character) : getButtonColor(activeTab);

  return (
    <div className={cn("min-h-screen transition-colors duration-500 font-sans text-gray-900 flex", currentTheme)}>
      <CustomDialog />
      {/* Sidebar */}
      <aside className={cn(
        "w-64 fixed inset-y-0 left-0 bg-white/80 backdrop-blur-xl border-r border-gray-200 z-[100] flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-transform duration-300 lg:translate-x-0 pt-[max(env(safe-area-inset-top),3rem)] lg:pt-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        selectedCard && !isSidebarOpen && "hidden lg:flex"
      )}>
        <div className="p-8 flex items-center justify-between lg:block">
          <div className="min-w-0">
            <h1 
              className="text-xl font-bold tracking-tight text-gray-900 leading-tight whitespace-nowrap cursor-pointer hover:opacity-70 transition-opacity"
              onClick={() => {
                setSelectedCard(null);
                setActiveTab('전체');
                setIsSidebarOpen(false);
                window.scrollTo(0, 0);
              }}
            >
              러브앤딥스페이스
            </h1>
            <p className="mt-1 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Card Archive</p>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto custom-scrollbar">
          {['전체', '심성훈', '이서언', '기욱', '진운', '하우주'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setSelectedCard(null);
                setActiveTab(tab as any);
                setIsSidebarOpen(false);
                window.scrollTo(0, 0);
              }}
              className={cn(
                "w-full text-left px-5 py-4 rounded-2xl text-sm font-bold transition-all relative overflow-hidden group",
                activeTab === tab ? cn("text-white shadow-lg", currentButton) : "text-gray-500 hover:bg-white/60 hover:text-gray-900"
              )}
            >
              <span className="relative z-10">{tab}</span>
              {activeTab === tab && (
                <motion.div 
                  layoutId="activeTabBg"
                  className="absolute inset-0 bg-white/20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              )}
            </button>
          ))}
          
          {/* Mobile Rules */}
          <div className="lg:hidden mt-8 px-2 space-y-6 pb-8">
            <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm", currentButton)}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight leading-tight">아카이브 이용 규칙</h3>
                </div>
                <div className="space-y-4 text-xs leading-relaxed text-gray-600 font-medium">
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                    <p>본 아카이브는 러브앤딥스페이스 카드 감상평을 자유롭게 나누는 공간입니다.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                    <p>특정 캐릭터에 대한 혐오 발언이나 비하, 취향 존중을 벗어난 무분별한 비난은 엄격히 금지됩니다.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                    <p>유저 간의 친목 도모, 네임드화, 타 커뮤니티 언급 등 분쟁을 조장할 수 있는 행위는 엄격히 금지됩니다.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                    <p>스포일러가 포함된 감상평 및 댓글은 반드시 <span className="font-bold text-amber-500">스포일러 체크</span>를 해주시기 바랍니다.</p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-gray-100 mx-6" />

              <div className="p-6">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm", currentButton)}>
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight leading-tight">서버 최적화를 위한 권장 사항</h3>
                </div>
                <div className="space-y-4 text-xs leading-relaxed text-gray-600 font-medium">
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-300 mt-1.5 shrink-0" />
                    <p>
                      안정적인 서버 운영을 위해 유튜브, 트위터 등 <span className="text-amber-500 font-bold">URL 삽입이 가능한 미디어는 가급적 URL로 첨부</span>해 주시길 적극 권장합니다. 직접 업로드 대신 URL을 사용하시면 서버 부하를 크게 줄일 수 있습니다.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-300 mt-1.5 shrink-0" />
                    <p>
                      부득이하게 기기 내의 미디어를 직접 업로드하실 경우, 서버 과부하 방지를 위해 적절한 용량의 파일을 사용해 주시길 부탁드립니다. <span className="text-amber-500 font-bold">(권장: 이미지 2MB, 영상 5MB 이하)</span>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-300 mt-1.5 shrink-0" />
                    <p>
                      전체 서버의 미디어 저장 할당량이 한정되어 있으므로, 불필요한 중복 업로드나 지나치게 큰 파일 업로드는 자제하여 매너 있는 이용을 부탁드립니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div className="p-6 border-t border-gray-200/50 bg-white/30">
          {isAdmin && (
            <div className="space-y-2">
              <button 
                onClick={() => {
                  setEditingCardId(null);
                  setNewCard({
                    name: '',
                    imageUrls: [] as string[],
                    gachaStartDate: '',
                    gachaEndDate: '',
                    rerunStartDate: '',
                    rerunEndDate: '',
                    pvUrl: '',
                    memoryIntroUrl: '',
                    attribute: '공격' as Card['attribute'],
                    color: '레드' as Card['color'],
                    type: '단독' as Card['type'],
                    category: '백야' as Card['category'],
                    character: '심성훈' as Card['character']
                  });
                  setShowAdminModal(true);
                  setIsSidebarOpen(false);
                }}
                className={cn("w-full flex items-center justify-center gap-2 px-4 py-3 text-white transition-all rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5", currentButton)}
              >
                <Plus className="w-4 h-4" />
                카드 추가
              </button>
              <button 
                onClick={() => {
                  setShowStats(true);
                  setIsSidebarOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all rounded-xl text-sm font-bold border border-indigo-100"
              >
                <BarChart3 className="w-4 h-4" />
                통계 보기
              </button>
            </div>
          )}
          {user ? (
            <button 
              onClick={logOut}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-500 hover:bg-white transition-colors rounded-xl text-sm font-bold border border-transparent hover:border-gray-200 hover:shadow-sm"
              title={user.email || ''}
            >
              <LogOut className="w-4 h-4" />
              로그아웃
            </button>
          ) : (
            <button 
              onClick={signIn}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 hover:bg-white hover:shadow-sm transition-all rounded-xl text-sm font-bold text-gray-600"
            >
              <LogIn className="w-4 h-4" />
              관리자 로그인
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-500", 
        !selectedCard ? "lg:ml-64 p-6 lg:p-12 pt-[calc(1.5rem+max(env(safe-area-inset-top),3rem))] lg:pt-[calc(3rem+env(safe-area-inset-top))]" : "lg:ml-64 p-0"
      )}>
        {!selectedCard && (
          <div className="lg:hidden flex items-center justify-between mb-6">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 bg-white rounded-xl border border-gray-200 shadow-sm text-gray-600"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        )}
        {selectedCard && (
          <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-md border-b border-gray-200 shadow-sm pt-[max(env(safe-area-inset-top),3rem)] lg:pt-0">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="lg:hidden p-2 bg-white rounded-xl border border-gray-200 shadow-sm text-gray-600"
                >
                  <Menu className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-2 cursor-pointer group" onClick={handleBackToList}>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all group-hover:scale-105 shadow-sm", currentButton)}>
                    <ChevronRight className="w-5 h-5 text-white rotate-180" />
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-gray-900 group-hover:text-gray-600 transition-colors">
                    목록으로 돌아가기
                  </h1>
                </div>
              </div>
            </div>
          </header>
        )}

        <div className={cn("max-w-7xl mx-auto", selectedCard ? "px-4 py-8 lg:px-8 lg:py-12" : "")}>
        {!selectedCard ? (
          <div>
            <div>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900">카드 아카이브</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRulesModal(true)}
                    className="hidden lg:flex items-center gap-1.5 bg-white/50 border border-gray-200 px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-white transition-colors focus:outline-none"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">이용 규칙</span>
                  </button>
                  <select 
                    className="bg-white/50 border border-gray-200 px-4 py-2 rounded-xl text-xs font-bold text-gray-600 focus:outline-none"
                    value={rarityFilter}
                    onChange={(e) => setRarityFilter(e.target.value === 'all' ? 'all' : Number(e.target.value) as any)}
                  >
                    <option value="all">전체 성급</option>
                    <option value="5">★5</option>
                    <option value="4">★4</option>
                  </select>
                  <select 
                    className="bg-white/50 border border-gray-200 px-4 py-2 rounded-xl text-xs font-bold text-gray-600 focus:outline-none"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                  >
                    <option value="최신순">최신순</option>
                    <option value="출시일순">출시일순</option>
                    <option value="색상순">색상순</option>
                    <option value="능력치순">능력치순</option>
                  </select>
                </div>
              </div>
              {filteredCards.length === 0 ? (
                <div className="py-32 text-center bg-white/30 rounded-3xl border border-dashed border-gray-300">
                  <p className="text-gray-400 font-medium text-lg">등록된 카드가 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-12">
                  {sortBy === '색상순' || sortBy === '능력치순' ? (
                    (() => {
                      const groups: { [key: string]: Card[] } = {};
                      filteredCards.forEach(card => {
                        const key = sortBy === '색상순' ? card.color : card.attribute;
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(card);
                      });
                      
                      return Object.entries(groups).map(([groupName, groupCards]) => (
                        <div key={groupName} className="p-8 rounded-[2.5rem] bg-white/40 border border-white/60 backdrop-blur-sm shadow-sm">
                          <div className="flex items-center gap-4 mb-8">
                            <div className={cn(
                              "w-1.5 h-8 rounded-full",
                              sortBy === '색상순' ? (
                                groupName === '레드' ? "bg-red-500" :
                                groupName === '블루' ? "bg-blue-500" :
                                groupName === '골드' ? "bg-yellow-500" :
                                groupName === '그린' ? "bg-green-500" :
                                groupName === '퍼플' ? "bg-purple-500" :
                                groupName === '핑크' ? "bg-pink-500" : "bg-gray-900"
                              ) : "bg-gray-700"
                            )} />
                            <h3 className="text-2xl font-bold text-gray-900">{groupName === '체력' ? 'HP' : groupName}</h3>
                            <span className="text-sm font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{groupCards.length}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                            <AnimatePresence mode="popLayout">
                              {groupCards.map((card) => (
                                <CardItem 
                                  key={card.id} 
                                  card={card} 
                                  setSelectedCard={handleSelectCard} 
                                  average={cardAverages[card.id]}
                                />
                              ))}
                            </AnimatePresence>
                          </div>
                        </div>
                      ));
                    })()
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                      <AnimatePresence mode="popLayout">
                        {filteredCards.map((card) => (
                          <CardItem 
                            key={card.id} 
                            card={card} 
                            setSelectedCard={handleSelectCard} 
                            average={cardAverages[card.id]}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div 
            className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Left: Card Image, Info, PV */}
            <div className="lg:col-span-5 lg:sticky lg:top-24 max-h-[calc(100vh-6rem)] overflow-y-auto custom-scrollbar pr-2 pb-8 space-y-8">
              <motion.div 
                layoutId={selectedCard.id}
                className="relative rounded-3xl overflow-hidden border border-gray-200 bg-white aspect-[3/4]"
              >
                {selectedCard.imageUrls && selectedCard.imageUrls.filter(url => url).length > 0 ? (
                  <div className="relative w-full h-full group cursor-zoom-in touch-manipulation" onClick={() => setGlobalLightboxData({ urls: selectedCard.imageUrls, index: currentImageIndex })}>
                    <AnimatePresence mode="wait">
                      <motion.img 
                        key={currentImageIndex}
                        src={selectedCard.imageUrls[currentImageIndex]} 
                        alt={selectedCard.name}
                        className="w-full h-full object-cover"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.3 }}
                        referrerPolicy="no-referrer"
                      />
                    </AnimatePresence>
                    
                    {selectedCard.imageUrls.filter(url => url).length > 1 && (
                      <>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentImageIndex(prev => (prev - 1 + selectedCard.imageUrls.length) % selectedCard.imageUrls.length);
                          }}
                          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/40 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentImageIndex(prev => (prev + 1) % selectedCard.imageUrls.length);
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/40 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                          {selectedCard.imageUrls.filter(url => url).map((_, idx) => (
                            <div 
                              key={idx}
                              className={cn(
                                "w-1.5 h-1.5 rounded-full transition-all",
                                idx === currentImageIndex ? "bg-white w-4" : "bg-white/40"
                              )}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-300" />
                  </div>
                )}
                
                <button 
                  onClick={() => setSelectedCard(null)}
                  className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition-colors text-gray-900 z-50"
                >
                  <X className="w-5 h-5" />
                </button>
                {isAdmin && (
                  <div className="absolute top-4 right-4 flex gap-2 z-50">
                    <button 
                      onClick={() => handleEditCard(selectedCard)}
                      className="w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-blue-50 hover:text-blue-500 transition-colors text-gray-900"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteCard(selectedCard)}
                      className="w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors text-gray-900"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </motion.div>

              {/* Card Info */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <div className="mb-6">
                  <div className={cn("text-xs font-black uppercase tracking-[0.2em] mb-2", currentAccent)}>
                    {selectedCard.character}
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 leading-tight flex items-center gap-3">
                    <span className={cn(
                      "text-2xl lg:text-3xl",
                      (selectedCard.rarity || 5) === 5 ? "text-amber-400" : "text-purple-400"
                    )}>★{(selectedCard.rarity || 5)}</span>
                    {selectedCard.name}
                  </h2>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm">
                    <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-1 font-bold">Category</p>
                    <div className="text-xs font-bold text-gray-900">{selectedCard.category}</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm">
                    <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-1 font-bold">Color</p>
                    <div className={cn(
                      "text-xs font-bold",
                      (selectedCard.color === '레드' || selectedCard.color === '빨강') && "text-red-500",
                      (selectedCard.color === '블루' || selectedCard.color === '파랑') && "text-blue-500",
                      (selectedCard.color === '골드' || selectedCard.color === '노랑') && "text-amber-600",
                      (selectedCard.color === '그린' || selectedCard.color === '초록') && "text-green-500",
                      (selectedCard.color === '퍼플' || selectedCard.color === '보라') && "text-purple-500",
                      (selectedCard.color === '핑크' || selectedCard.color === '분홍') && "text-pink-500",
                    )}>
                      {selectedCard.color}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm">
                    <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-1 font-bold">Attribute</p>
                    <div className="text-xs font-bold text-gray-900">
                      {selectedCard.attribute === '체력' ? 'HP' : selectedCard.attribute}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm">
                    <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-1 font-bold">Type</p>
                    <p className="font-bold text-xs">{selectedCard.type}</p>
                  </div>
                </div>

                {/* Gacha & Rerun Dates */}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {(selectedCard.gachaStartDate || selectedCard.gachaEndDate) && (
                    <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm">
                      <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-1 font-bold flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> Gacha Period
                      </p>
                      <div className="text-[11px] font-bold text-gray-700">
                        {selectedCard.gachaStartDate} {selectedCard.gachaStartDate && selectedCard.gachaEndDate && '~'} {selectedCard.gachaEndDate}
                      </div>
                    </div>
                  )}
                  {(selectedCard.rerunStartDate || selectedCard.rerunEndDate) && (
                    <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm">
                      <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-1 font-bold flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> Rerun Period
                      </p>
                      <div className="text-[11px] font-bold text-gray-700">
                        {selectedCard.rerunStartDate} {selectedCard.rerunStartDate && selectedCard.rerunEndDate && '~'} {selectedCard.rerunEndDate}
                      </div>
                    </div>
                  )}
                </div>

                {cardAverages[selectedCard.id] && cardAverages[selectedCard.id].count > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-50 grid grid-cols-3 gap-4">
                    <div className="text-center group/stat">
                      <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-1 font-bold">Overall</p>
                      <div className="flex items-center justify-center gap-1.5">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-base font-black text-gray-900">{cardAverages[selectedCard.id].overall.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="text-center group/stat">
                      <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-1 font-bold">Story</p>
                      <span className="text-base font-black text-gray-900">{cardAverages[selectedCard.id].story > 0 ? cardAverages[selectedCard.id].story.toFixed(1) : '-'}</span>
                    </div>
                    <div className="text-center group/stat">
                      <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-1 font-bold">Directing</p>
                      <span className="text-base font-black text-gray-900">{cardAverages[selectedCard.id].directing > 0 ? cardAverages[selectedCard.id].directing.toFixed(1) : '-'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* PV Section */}
              {(selectedCard.pvUrl || selectedCard.pvUrl2) && (
                <div id="pv-section" className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800 px-2">
                    <Play className={cn("w-5 h-5", currentAccent)} />
                    PV 영상
                  </h3>
                  <div className="space-y-4">
                    {selectedCard.pvUrl && (
                      <div className="p-4 rounded-3xl bg-white border border-gray-100 shadow-sm">
                        {renderMediaUrl(selectedCard.pvUrl)}
                      </div>
                    )}
                    {selectedCard.pvUrl2 && (
                      <div className="p-4 rounded-3xl bg-white border border-gray-100 shadow-sm">
                        {renderMediaUrl(selectedCard.pvUrl2)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Memory Intro Section */}
              {(selectedCard.memoryIntroUrl || selectedCard.memoryIntroUrl2) && (
                <div id="memory-intro-section" className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800 px-2">
                    <Play className={cn("w-5 h-5", currentAccent)} />
                    메모리 소개 영상
                  </h3>
                  <div className="space-y-4">
                    {selectedCard.memoryIntroUrl && (
                      <div className="p-4 rounded-3xl bg-white border border-gray-100 shadow-sm">
                        {renderMediaUrl(selectedCard.memoryIntroUrl)}
                      </div>
                    )}
                    {selectedCard.memoryIntroUrl2 && (
                      <div className="p-4 rounded-3xl bg-white border border-gray-100 shadow-sm">
                        {renderMediaUrl(selectedCard.memoryIntroUrl2)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Reviews */}
            <div className="lg:col-span-7 space-y-10">
              <div className="space-y-12">

                {/* Review Form */}
                <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
                  <h3 className="text-2xl font-bold mb-8 flex items-center gap-3 text-gray-900">
                    <MessageSquare className={cn("w-6 h-6", currentAccent)} />
                    감상평 남기기
                  </h3>
                  <form onSubmit={handleAddReview} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
                      <div className="lg:col-span-3 space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">닉네임</label>
                        <input 
                          type="text"
                          placeholder="익명"
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                          value={reviewForm.nickname}
                          onChange={e => setReviewForm(prev => ({ ...prev, nickname: e.target.value }))}
                        />
                      </div>
                      <div className="lg:col-span-4 space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">비밀번호</label>
                        <input 
                          type="password"
                          autoComplete="new-password"
                          placeholder="4자리 이상"
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                          value={reviewForm.password}
                          onChange={e => setReviewForm(prev => ({ ...prev, password: e.target.value }))}
                          required
                        />
                        <p className="text-[9px] text-gray-400 ml-1 font-medium">* 작성하신 글을 수정하거나 삭제할 때 필요합니다.</p>
                      </div>

                      {/* Ratings */}
                      <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> 총평 (필수)
                          </label>
                          <div className="flex items-center gap-2">
                            <input 
                              type="range" 
                              min="0.5" 
                              max="5.0" 
                              step="0.5"
                              className="flex-1 accent-amber-500"
                              value={reviewForm.ratings.overall}
                              onChange={e => setReviewForm(prev => ({ ...prev, ratings: { ...prev.ratings, overall: parseFloat(e.target.value) } }))}
                            />
                            <span className="text-sm font-bold text-amber-600 w-8 text-center">{reviewForm.ratings.overall.toFixed(1)}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">스토리 (선택)</label>
                          <div className="flex items-center gap-2">
                            <input 
                              type="range" 
                              min="0" 
                              max="5.0" 
                              step="0.5"
                              className="flex-1 accent-gray-400"
                              value={reviewForm.ratings.story}
                              onChange={e => setReviewForm(prev => ({ ...prev, ratings: { ...prev.ratings, story: parseFloat(e.target.value) } }))}
                            />
                            <span className="text-sm font-bold text-gray-500 w-8 text-center">{reviewForm.ratings.story > 0 ? reviewForm.ratings.story.toFixed(1) : '-'}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">마음흔적 연출 (선택)</label>
                          <div className="flex items-center gap-2">
                            <input 
                              type="range" 
                              min="0" 
                              max="5.0" 
                              step="0.5"
                              className="flex-1 accent-gray-400 custom-range"
                              value={reviewForm.ratings.directing}
                              onChange={e => setReviewForm(prev => ({ ...prev, ratings: { ...prev.ratings, directing: parseFloat(e.target.value) } }))}
                            />
                            <span className="text-sm font-bold text-gray-500 w-8 text-center">{reviewForm.ratings.directing > 0 ? reviewForm.ratings.directing.toFixed(1) : '-'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-12 space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">미디어 URL (이미지, 유튜브 또는 트위터 링크)</label>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder="https://..."
                            className="flex-1 min-w-0 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                            value={reviewForm.mediaUrlInput}
                            onChange={e => setReviewForm(prev => ({ ...prev, mediaUrlInput: e.target.value }))}
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              if (reviewForm.mediaUrlInput) {
                                setReviewForm(prev => ({ 
                                  ...prev, 
                                  mediaUrls: [...prev.mediaUrls, prev.mediaUrlInput],
                                  mediaUrlInput: ''
                                }));
                              }
                            }}
                            className="px-3 sm:px-6 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all text-xs font-bold whitespace-nowrap min-w-[50px] sm:min-w-[70px]"
                          >
                            추가
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {reviewForm.mediaUrls.map((url, index) => (
                            <div key={index} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-lg text-xs">
                              <span className="truncate max-w-[100px]">{url}</span>
                              <button 
                                type="button"
                                onClick={() => setReviewForm(prev => ({ 
                                  ...prev, 
                                  mediaUrls: prev.mediaUrls.filter((_, i) => i !== index)
                                }))}
                                className="text-gray-500 hover:text-red-500"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 w-full">
                      <button 
                        type="button"
                        onClick={() => reviewFileInputRef.current?.click()}
                        disabled={uploadingReviewImage}
                        className={`flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-xs font-bold text-gray-600 ${uploadingReviewImage ? 'min-w-[120px]' : ''}`}
                      >
                        {uploadingReviewImage ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="whitespace-nowrap">{uploadProgress !== null ? `${Math.round(uploadProgress)}%` : '업로드 중...'}</span>
                          </>
                        ) : (
                          <>
                            <Paperclip className="w-4 h-4" />
                            <span>파일 첨부</span>
                          </>
                        )}
                      </button>
                      <input 
                        ref={reviewFileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        onChange={handleReviewImageUpload}
                        disabled={uploadingReviewImage}
                        className="hidden"
                      />
                      <div className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl">
                        <input 
                          type="checkbox"
                          id="spoiler-review"
                          checked={reviewForm.isSpoiler}
                          onChange={e => setReviewForm(prev => ({ ...prev, isSpoiler: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                        />
                        <label htmlFor="spoiler-review" className="text-xs font-bold text-gray-500 cursor-pointer whitespace-nowrap">스포일러 포함</label>
                      </div>
                    </div>

                    {reviewForm.mediaUrls.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {reviewForm.mediaUrls.map((url, index) => (
                          <div key={index} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-100 group">
                            {url.match(/\.(mp4|webm|ogg|mov|m4v|avi|wmv)/i) || url.includes('video') ? (
                              <video src={url} className="w-full h-full object-cover" />
                            ) : (
                              <img src={url} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                            )}
                            <button 
                              type="button"
                              onClick={() => setReviewForm(prev => ({ ...prev, mediaUrls: prev.mediaUrls.filter((_, i) => i !== index) }))}
                              className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">내용</label>
                      <textarea 
                        placeholder="카드 스토리에 대한 감상을 자유롭게 적어주세요..."
                        className="w-full h-40 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all resize-none"
                        value={reviewForm.content}
                        onChange={e => setReviewForm(prev => ({ ...prev, content: e.target.value }))}
                        required
                      />
                    </div>
                    
                    <button 
                      type="submit"
                      className={cn("w-full py-4 text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2", currentButton)}
                    >
                      <Send className="w-4 h-4" />
                      감상평 등록하기
                    </button>
                  </form>
                </div>

                <div className="space-y-8">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                      <MessageSquare className={cn("w-7 h-7", currentAccent)} />
                      감상평
                      <span className="text-sm font-bold text-gray-400 ml-1">{reviews.length}</span>
                    </h2>
                    <div className="flex items-center gap-2 bg-gray-100/50 p-1 rounded-xl">
                      {[
                        { id: 'latest', label: '최신순' },
                        { id: 'likes', label: '좋아요순' },
                        { id: 'comments', label: '댓글순' }
                      ].map((sort) => (
                        <button
                          key={sort.id}
                          onClick={() => setReviewSortBy(sort.id as any)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                            reviewSortBy === sort.id 
                              ? "bg-white text-gray-900 shadow-sm" 
                              : "text-gray-400 hover:text-gray-600"
                          )}
                        >
                          {sort.label}
                        </button>
                      ))}
                    </div>
                  </div>
                {reviews.length === 0 ? (
                  <div className="py-32 text-center bg-white/30 rounded-3xl border border-dashed border-gray-300">
                    <p className="text-gray-400 font-medium text-lg">아직 작성된 감상평이 없습니다. 첫 번째 주인공이 되어보세요!</p>
                  </div>
                ) : (
                  <>
                    {sortedReviews.slice((reviewPage - 1) * reviewsPerPage, reviewPage * reviewsPerPage).map((review) => (
                      <ReviewCard 
                        key={review.id} 
                        review={review} 
                        accentColor={currentAccent} 
                        buttonColor={currentButton} 
                        onDelete={() => handleDeleteReview(review)}
                        onEdit={async () => {
                          if (!isAdmin) {
                            const pwd = await customPrompt("수정하려면 비밀번호를 입력하세요:");
                            if (pwd === null) return;
                            if (pwd !== review.password) {
                              await customAlert("비밀번호가 일치하지 않습니다.");
                              return;
                            }
                          }
                          setEditingReviewId(review.id);
                          setEditReviewForm({ ...review, password: '' });
                        }}
                        onLike={handleLikeReview}
                        isAdmin={isAdmin}
                        userIp={userIp}
                        user={user}
                        onZoom={(urls, index) => setGlobalLightboxData({ urls, index })}
                      />
                    ))}
                    
                    {reviews.length > reviewsPerPage && (
                      <div className="flex items-center justify-center gap-4 mt-12">
                        <button 
                          onClick={() => setReviewPage(prev => Math.max(1, prev - 1))}
                          disabled={reviewPage === 1}
                          className="p-3 rounded-xl bg-white border border-gray-200 text-gray-400 disabled:opacity-30 hover:text-gray-600 transition-all"
                        >
                          <ChevronRight className="w-5 h-5 rotate-180" />
                        </button>
                        <span className="text-sm font-bold text-gray-500">
                          {reviewPage} / {Math.ceil(reviews.length / reviewsPerPage)}
                        </span>
                        <button 
                          onClick={() => setReviewPage(prev => Math.min(Math.ceil(reviews.length / reviewsPerPage), prev + 1))}
                          disabled={reviewPage === Math.ceil(reviews.length / reviewsPerPage)}
                          className="p-3 rounded-xl bg-white border border-gray-200 text-gray-400 disabled:opacity-30 hover:text-gray-600 transition-all"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>

      {/* Admin Modal */}
      <AnimatePresence>
        {showAdminModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdminModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white border border-gray-200 rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-3xl font-bold mb-8 text-gray-900">{editingCardId ? '카드 정보 수정' : '새로운 카드 추가'}</h2>
              <form onSubmit={handleAddCard} className="space-y-5">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">캐릭터</label>
                    <select 
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                      value={newCard.character}
                      onChange={e => setNewCard(prev => ({ ...prev, character: e.target.value as any }))}
                    >
                      <option value="심성훈">심성훈</option>
                      <option value="이서언">이서언</option>
                      <option value="기욱">기욱</option>
                      <option value="진운">진운</option>
                      <option value="하우주">하우주</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">분류</label>
                    <select 
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                      value={newCard.category}
                      onChange={e => setNewCard(prev => ({ ...prev, category: e.target.value as any }))}
                    >
                      <option value="백야">백야</option>
                      <option value="월광">월광</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">성급</label>
                    <select 
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                      value={newCard.rarity || 5}
                      onChange={e => setNewCard(prev => ({ ...prev, rarity: Number(e.target.value) as any }))}
                    >
                      <option value="5">★5</option>
                      <option value="4">★4</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">카드명</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                    value={newCard.name}
                    onChange={e => setNewCard(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">카드 이미지</label>
                  <div className="flex gap-2 mb-2">
                    <input 
                      type="text" 
                      placeholder="이미지 URL 직접 입력" 
                      className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                      value={tempImageUrl}
                      onChange={e => setTempImageUrl(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        if (tempImageUrl) {
                          setNewCard(prev => ({ ...prev, imageUrls: [...(prev.imageUrls || []), tempImageUrl] }));
                          setTempImageUrl('');
                        }
                      }}
                      className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors"
                    >
                      추가
                    </button>
                  </div>
                  <div className="relative border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
                    <input 
                      type="file" 
                      multiple
                      accept="image/*,video/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={handleImageUpload}
                      disabled={uploadingImages}
                    />
                    <UploadCloud className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 font-medium">
                      {uploadingImages ? `업로드 중... ${Math.round(uploadProgress || 0)}%` : "클릭하거나 이미지를 드래그하여 업로드"}
                    </p>
                    {uploadingImages && (
                      <div className="w-full max-w-[200px] h-1 bg-gray-200 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-300" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                    {(newCard.imageUrls?.length || 0) > 0 && (
                      <div className="mt-4 w-full grid grid-cols-4 gap-2">
                        {newCard.imageUrls.map((url, idx) => (
                          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group/img">
                            <img src={url} className="w-full h-full object-cover" alt="" />
                            <button 
                              type="button"
                              onClick={() => setNewCard(prev => ({ ...prev, imageUrls: prev.imageUrls.filter((_, i) => i !== idx) }))}
                              className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">PV 링크 1 (선택)</label>
                    <input 
                      type="text" 
                      placeholder="유튜브 또는 트위터 링크"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                      value={newCard.pvUrl || ''}
                      onChange={e => setNewCard(prev => ({ ...prev, pvUrl: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">PV 링크 2 (선택)</label>
                    <input 
                      type="text" 
                      placeholder="유튜브 또는 트위터 링크"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                      value={newCard.pvUrl2 || ''}
                      onChange={e => setNewCard(prev => ({ ...prev, pvUrl2: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">메모리 소개 영상 링크 1 (선택)</label>
                    <input 
                      type="text" 
                      placeholder="유튜브 또는 트위터 링크"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                      value={newCard.memoryIntroUrl || ''}
                      onChange={e => setNewCard(prev => ({ ...prev, memoryIntroUrl: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">메모리 소개 영상 링크 2 (선택)</label>
                    <input 
                      type="text" 
                      placeholder="유튜브 또는 트위터 링크"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                      value={newCard.memoryIntroUrl2 || ''}
                      onChange={e => setNewCard(prev => ({ ...prev, memoryIntroUrl2: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">연결된 카드 (리뷰 공유)</label>
                  <select
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                    value={newCard.linkedCardId || ''}
                    onChange={e => setNewCard(prev => ({ ...prev, linkedCardId: e.target.value || undefined }))}
                  >
                    <option value="">없음</option>
                    {cards.filter(c => c.id !== newCard.id).map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.character})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">출시일 (정렬용)</label>
                  <input 
                    type="date" 
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-gray-200"
                    value={newCard.releaseDate || ''}
                    onChange={e => setNewCard(prev => ({ ...prev, releaseDate: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">가챠 시작일</label>
                    <input 
                      type="date" 
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-gray-200"
                      value={newCard.gachaStartDate || ''}
                      onChange={e => setNewCard(prev => ({ ...prev, gachaStartDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">가챠 종료일</label>
                    <input 
                      type="date" 
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-gray-200"
                      value={newCard.gachaEndDate || ''}
                      onChange={e => setNewCard(prev => ({ ...prev, gachaEndDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">복각 시작일 (선택)</label>
                    <input 
                      type="date" 
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-gray-200"
                      value={newCard.rerunStartDate || ''}
                      onChange={e => setNewCard(prev => ({ ...prev, rerunStartDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">복각 종료일 (선택)</label>
                    <input 
                      type="date" 
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-gray-200"
                      value={newCard.rerunEndDate || ''}
                      onChange={e => setNewCard(prev => ({ ...prev, rerunEndDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">속성</label>
                    <select 
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                      value={newCard.attribute}
                      onChange={e => setNewCard(prev => ({ ...prev, attribute: e.target.value as any }))}
                    >
                      <option value="공격">공격</option>
                      <option value="방어">방어</option>
                      <option value="체력">체력</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">색상</label>
                    <select 
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                      value={newCard.color}
                      onChange={e => setNewCard(prev => ({ ...prev, color: e.target.value as any }))}
                    >
                      <option value="레드">레드</option>
                      <option value="블루">블루</option>
                      <option value="골드">골드</option>
                      <option value="그린">그린</option>
                      <option value="퍼플">퍼플</option>
                      <option value="핑크">핑크</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">유형</label>
                    <select 
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                      value={newCard.type}
                      onChange={e => setNewCard(prev => ({ ...prev, type: e.target.value as any }))}
                    >
                      <option value="단독">단독</option>
                      <option value="단체">단체</option>
                      <option value="배포">배포</option>
                      <option value="상시">상시</option>
                    </select>
                  </div>
                </div>
                <div className="pt-6 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowAdminModal(false);
                      setEditingCardId(null);
                      setNewCard({
                        character: '심성훈',
                        category: '백야',
                        type: '단독',
                        attribute: '공격',
                        color: '레드',
                        imageUrls: []
                      });
                    }}
                    className="flex-1 py-4 border border-gray-200 rounded-xl font-bold text-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button 
                    type="submit"
                    className={cn("flex-1 py-4 text-white rounded-xl font-bold shadow-lg transition-all", currentButton)}
                  >
                    {editingCardId ? '수정 완료' : '카드 생성'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rules Modal */}
      <AnimatePresence>
        {showRulesModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRulesModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 sm:p-8 flex items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm", currentButton)}>
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">아카이브 이용 규칙</h2>
                    <p className="text-xs text-gray-500 mt-0.5">원활한 이용을 위해 꼭 읽어주세요</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowRulesModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar space-y-8">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight leading-tight mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-900" />
                    기본 이용 규칙
                  </h3>
                  <div className="space-y-4 text-sm leading-relaxed text-gray-600 font-medium bg-gray-50 p-6 rounded-2xl">
                    <div className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 shrink-0" />
                      <p>본 아카이브는 러브앤딥스페이스 카드 감상평을 자유롭게 나누는 공간입니다.</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 shrink-0" />
                      <p>특정 캐릭터에 대한 혐오 발언이나 비하, 취향 존중을 벗어난 무분별한 비난은 엄격히 금지됩니다.</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 shrink-0" />
                      <p>유저 간의 친목 도모, 네임드화, 타 커뮤니티 언급 등 분쟁을 조장할 수 있는 행위는 엄격히 금지됩니다.</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 shrink-0" />
                      <p>스포일러가 포함된 감상평 및 댓글은 반드시 <span className="font-bold text-amber-500">스포일러 체크</span>를 해주시기 바랍니다.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight leading-tight mb-4 flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-gray-900" />
                    서버 최적화를 위한 권장 사항
                  </h3>
                  <div className="space-y-4 text-sm leading-relaxed text-gray-600 font-medium bg-amber-50/50 p-6 rounded-2xl border border-amber-100/50">
                    <div className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                      <p>
                        안정적인 서버 운영을 위해 유튜브, 트위터 등 <span className="text-amber-600 font-bold">URL 삽입이 가능한 미디어는 가급적 URL로 첨부</span>해 주시길 적극 권장합니다. 직접 업로드 대신 URL을 사용하시면 서버 부하를 크게 줄일 수 있습니다.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                      <p>
                        부득이하게 기기 내의 미디어를 직접 업로드하실 경우, 서버 과부하 방지를 위해 적절한 용량의 파일을 사용해 주시길 부탁드립니다. <span className="text-amber-600 font-bold">(권장: 이미지 2MB, 영상 5MB 이하)</span>
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                      <p>
                        전체 서버의 미디어 저장 할당량이 한정되어 있으므로, 불필요한 중복 업로드나 지나치게 큰 파일 업로드는 자제하여 매너 있는 이용을 부탁드립니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-100 bg-gray-50/50">
                <button 
                  onClick={() => setShowRulesModal(false)}
                  className={cn("w-full py-4 text-white rounded-xl font-bold shadow-lg transition-all", currentButton)}
                >
                  확인했습니다
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stats Modal */}
      <AnimatePresence>
        {showStats && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowStats(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">방문자 통계</h2>
                    <p className="text-xs text-gray-400 font-medium">
                      {statsPeriod === '1' ? '오늘의 트래픽 데이터' : 
                       statsPeriod === '7' ? '최근 7일간의 트래픽 데이터' : 
                       statsPeriod === '30' ? '최근 30일간의 트래픽 데이터' : 
                       '전체 트래픽 데이터'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={statsPeriod}
                    onChange={(e) => setStatsPeriod(e.target.value as any)}
                    className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="1">오늘</option>
                    <option value="7">최근 7일</option>
                    <option value="30">최근 30일</option>
                    <option value="all">누적 전체</option>
                  </select>
                  <button 
                    onClick={() => setShowStats(false)}
                    className="p-3 hover:bg-gray-100 rounded-2xl transition-colors text-gray-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-6 rounded-3xl bg-indigo-50 border border-indigo-100 text-center">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">방문 (세션)</p>
                    <p className="text-3xl font-bold text-indigo-900">{stats.reduce((acc, curr) => acc + (curr.visits || 0), 0)}</p>
                  </div>
                  <div className="p-6 rounded-3xl bg-blue-50 border border-blue-100 text-center">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">고유 방문자</p>
                    <p className="text-3xl font-bold text-blue-900">{stats.reduce((acc, curr) => acc + (curr.uniqueVisitors || 0), 0)}</p>
                  </div>
                  <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-100 text-center">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">페이지뷰</p>
                    <p className="text-3xl font-bold text-emerald-900">{stats.reduce((acc, curr) => acc + (curr.pageViews || 0), 0)}</p>
                  </div>
                  <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100 text-center">
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">일평균 방문자</p>
                    <p className="text-3xl font-bold text-amber-900">{stats.length > 0 ? Math.round(stats.reduce((acc, curr) => acc + (curr.uniqueVisitors || 0), 0) / stats.length) : 0}</p>
                  </div>
                </div>

                {/* Daily Traffic */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-800 px-2">일별 트래픽</h3>
                  <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                    <div className="flex items-end gap-1 h-40">
                      {stats.slice().reverse().map((stat, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                          <div 
                            className="w-full bg-indigo-400 rounded-t-lg transition-all group-hover:bg-indigo-600"
                            style={{ height: `${Math.min(100, (stat.visits / (Math.max(...stats.map(s => s.visits)) || 1)) * 100)}%` }}
                          />
                          <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-20">
                            {stat.date}: {stat.visits}명
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-4 text-[10px] font-bold text-gray-400 px-1">
                      <span>{stats[stats.length - 1]?.date}</span>
                      <span>{stats[0]?.date}</span>
                    </div>
                  </div>
                </div>

                {/* Path Analysis */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-800 px-2">페이지별 트래픽</h3>
                  <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4 font-bold text-gray-500">페이지</th>
                          <th className="px-6 py-4 font-bold text-gray-500 text-right">방문 횟수</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {Object.entries(
                          stats.reduce((acc: any, curr) => {
                            if (curr.paths) {
                              Object.entries(curr.paths).forEach(([path, count]) => {
                                acc[path] = (acc[path] || 0) + count;
                              });
                            }
                            return acc;
                          }, {})
                        ).sort((a: any, b: any) => b[1] - a[1]).map(([path, count]: any) => {
                          let displayName = path.replace(/_/g, '/');
                          if (path.startsWith('card_')) {
                            const cardId = path.replace('card_', '');
                            const card = cards.find(c => c.id === cardId);
                            if (card) {
                              displayName = `[${card.character}] ${card.name}`;
                            } else {
                              displayName = `[카드] 삭제됨 (${cardId})`;
                            }
                          } else if (path === 'home') {
                            displayName = '[메인] 홈 화면';
                          }
                          return (
                            <tr key={path} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 font-medium text-xs text-gray-600">{displayName}</td>
                              <td className="px-6 py-4 font-bold text-gray-900 text-right">{count}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  {/* Device Analysis */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 px-2">디바이스</h3>
                    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="px-6 py-4 font-bold text-gray-500">디바이스</th>
                            <th className="px-6 py-4 font-bold text-gray-500 text-right">비율</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {(() => {
                            const deviceStats = stats.reduce((acc, curr) => {
                              Object.entries(curr.devices || {}).forEach(([device, count]) => {
                                acc[device] = (acc[device] || 0) + (count as number);
                              });
                              return acc;
                            }, {} as Record<string, number>);
                            const total = (Object.values(deviceStats).reduce((a: number, b: number) => a + b, 0) as number) || 1;
                            return Object.entries(deviceStats)
                              .sort(([, a], [, b]) => (b as number) - (a as number))
                              .map(([device, count]) => (
                                <tr key={device} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 text-gray-600 font-medium capitalize">{device}</td>
                                  <td className="px-6 py-4 text-gray-900 font-bold text-right">
                                    {Math.round(((count as number) / total) * 100)}%
                                  </td>
                                </tr>
                              ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Browser Analysis */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 px-2">브라우저</h3>
                    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="px-6 py-4 font-bold text-gray-500">브라우저</th>
                            <th className="px-6 py-4 font-bold text-gray-500 text-right">비율</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {(() => {
                            const browserStats = stats.reduce((acc, curr) => {
                              Object.entries(curr.browsers || {}).forEach(([browser, count]) => {
                                acc[browser] = (acc[browser] || 0) + (count as number);
                              });
                              return acc;
                            }, {} as Record<string, number>);
                            const total = (Object.values(browserStats).reduce((a: number, b: number) => a + b, 0) as number) || 1;
                            return Object.entries(browserStats)
                              .sort(([, a], [, b]) => (b as number) - (a as number))
                              .map(([browser, count]) => (
                                <tr key={browser} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 text-gray-600 font-medium">{browser}</td>
                                  <td className="px-6 py-4 text-gray-900 font-bold text-right">
                                    {Math.round(((count as number) / total) * 100)}%
                                  </td>
                                </tr>
                              ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Edit Review Modal */}
      <AnimatePresence>
        {editingReviewId && editReviewForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8 sm:p-10">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                    <Edit className={cn("w-7 h-7", currentAccent)} />
                    감상평 수정
                  </h2>
                  <button 
                    onClick={() => {
                      setEditingReviewId(null);
                      setEditReviewForm(null);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleUpdateReview} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input 
                      type="text"
                      placeholder="닉네임"
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                      value={editReviewForm.nickname}
                      onChange={e => setEditReviewForm(prev => prev ? ({ ...prev, nickname: e.target.value }) : null)}
                      required
                    />
                    <input 
                      type="password"
                      autoComplete="new-password"
                      placeholder="비밀번호 (수정 시 필요)"
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                      value={editReviewForm.password}
                      onChange={e => setEditReviewForm(prev => prev ? ({ ...prev, password: e.target.value }) : null)}
                    />
                  </div>

                  {/* Ratings for Edit */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> 총평 (필수)
                      </label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="range" 
                          min="0.5" 
                          max="5.0" 
                          step="0.5"
                          className="flex-1 accent-amber-500"
                          value={editReviewForm.ratings?.overall || 0.5}
                          onChange={e => setEditReviewForm(prev => prev ? ({ ...prev, ratings: { ...(prev.ratings || { story: 0, directing: 0 }), overall: parseFloat(e.target.value) } }) : null)}
                        />
                        <span className="text-sm font-bold text-amber-600 w-8 text-center">{(editReviewForm.ratings?.overall || 0.5).toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">스토리 (선택)</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="range" 
                          min="0" 
                          max="5.0" 
                          step="0.5"
                          className="flex-1 accent-gray-400"
                          value={editReviewForm.ratings?.story || 0}
                          onChange={e => setEditReviewForm(prev => prev ? ({ ...prev, ratings: { ...(prev.ratings || { overall: 0, directing: 0 }), story: parseFloat(e.target.value) } }) : null)}
                        />
                        <span className="text-sm font-bold text-gray-500 w-8 text-center">{(editReviewForm.ratings?.story || 0) > 0 ? (editReviewForm.ratings?.story || 0).toFixed(1) : '-'}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">마음흔적 연출 (선택)</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="range" 
                          min="0" 
                          max="5.0" 
                          step="0.5"
                          className="flex-1 accent-gray-400 custom-range"
                          value={editReviewForm.ratings?.directing || 0}
                          onChange={e => setEditReviewForm(prev => prev ? ({ ...prev, ratings: { ...(prev.ratings || { overall: 0, story: 0 }), directing: parseFloat(e.target.value) } }) : null)}
                        />
                        <span className="text-sm font-bold text-gray-500 w-8 text-center">{(editReviewForm.ratings?.directing || 0) > 0 ? (editReviewForm.ratings?.directing || 0).toFixed(1) : '-'}</span>
                      </div>
                    </div>
                  </div>

                  <textarea 
                    placeholder="감상평을 자유롭게 남겨주세요..."
                    className="w-full bg-gray-50 border border-gray-100 rounded-3xl px-6 py-5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 min-h-[150px] resize-none transition-all"
                    value={editReviewForm.content}
                    onChange={e => setEditReviewForm(prev => prev ? ({ ...prev, content: e.target.value }) : null)}
                    required
                  />

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">미디어 URL (이미지, 유튜브 또는 트위터 링크)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="https://..."
                        className="flex-1 min-w-0 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 sm:px-5 sm:py-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                        value={editReviewForm.mediaUrlInput || ''}
                        onChange={e => setEditReviewForm(prev => prev ? ({ ...prev, mediaUrlInput: e.target.value }) : null)}
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (editReviewForm.mediaUrlInput) {
                            setEditReviewForm(prev => prev ? ({ 
                              ...prev, 
                              mediaUrls: [...prev.mediaUrls, editReviewForm.mediaUrlInput!],
                              mediaUrlInput: ''
                            }) : null);
                          }
                        }}
                        className="px-3 sm:px-6 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 transition-all text-xs font-bold whitespace-nowrap min-w-[50px] sm:min-w-[70px]"
                      >
                        추가
                      </button>
                    </div>
                    {editReviewForm.mediaUrls.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {editReviewForm.mediaUrls.map((url: string, idx: number) => (
                          <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-100 group">
                            {url.match(/\.(mp4|webm|ogg|mov|m4v|avi|wmv)/i) || url.includes('video') ? (
                              <video src={url} className="w-full h-full object-cover" />
                            ) : (
                              <img src={url} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                            )}
                            <button 
                              type="button"
                              onClick={() => setEditReviewForm(prev => prev ? ({ ...prev, mediaUrls: prev.mediaUrls.filter((_: any, i: number) => i !== idx) }) : null)}
                              className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 w-full">
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingReviewImage}
                      className={`flex-1 px-6 py-3 bg-gray-100 text-gray-600 text-xs font-bold rounded-2xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${uploadingReviewImage ? 'min-w-[120px]' : ''}`}
                    >
                      {uploadingReviewImage ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="whitespace-nowrap">{uploadProgress !== null ? `${Math.round(uploadProgress)}%` : '업로드 중...'}</span>
                        </>
                      ) : (
                        <>
                          <Paperclip className="w-4 h-4" />
                          미디어 추가
                        </>
                      )}
                    </button>
                    <input 
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={handleEditReviewImageUpload}
                      disabled={uploadingReviewImage}
                      className="hidden"
                    />
                    <div className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100">
                      <input 
                        type="checkbox"
                        id="edit-spoiler"
                        checked={editReviewForm.isSpoiler}
                        onChange={e => setEditReviewForm(prev => prev ? ({ ...prev, isSpoiler: e.target.checked }) : null)}
                        className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                      />
                      <label htmlFor="edit-spoiler" className="text-xs font-bold text-gray-500 cursor-pointer">스포일러 포함</label>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className={cn("w-full py-4 text-white font-bold rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2", currentButton)}
                  >
                    수정 완료
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Lightboxes */}
      <AnimatePresence>
        {globalLightboxData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center p-4 sm:p-8"
            onClick={(e) => {
              if (lightboxSwiped.current) {
                lightboxSwiped.current = false;
                return;
              }
              if (e.target === e.currentTarget && Date.now() - globalLightboxMountTime.current > 300) {
                setGlobalLightboxData(null);
              }
            }}
          >
            <button 
              className="absolute top-[max(env(safe-area-inset-top,2rem),2rem)] right-4 sm:right-8 text-white/60 hover:text-white transition-colors z-[99999]"
              onClick={() => setGlobalLightboxData(null)}
            >
              <X className="w-8 h-8" />
            </button>
            
            {globalLightboxData.urls.length > 1 && (
              <>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setGlobalLightboxData(prev => prev ? { ...prev, index: (prev.index - 1 + prev.urls.length) % prev.urls.length } : null);
                  }}
                  className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-all z-[99999]"
                >
                  <ChevronLeft className="w-8 h-8 sm:w-10 sm:h-10" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setGlobalLightboxData(prev => prev ? { ...prev, index: (prev.index + 1) % prev.urls.length } : null);
                  }}
                  className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-all z-[99999]"
                >
                  <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10" />
                </button>
              </>
            )}

            <AnimatePresence mode="wait">
              {(() => {
                const url = globalLightboxData.urls[globalLightboxData.index];
                const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/);
                
                if (youtubeMatch) {
                  return (
                    <motion.div
                      key={globalLightboxData.index}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="w-full max-w-4xl aspect-video z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <iframe 
                        src={`https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1`}
                        className="w-full h-full"
                        allow="autoplay; fullscreen"
                        allowFullScreen
                      />
                    </motion.div>
                  );
                }
                
                if (url.match(/\.(mp4|webm|ogg|mov|m4v|avi|wmv)/i) || url.includes('video')) {
                  return (
                    <motion.video 
                      key={globalLightboxData.index}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      src={url} 
                      controls
                      autoPlay
                      muted
                      playsInline
                      className="max-w-full max-h-full object-contain shadow-2xl z-50 cursor-zoom-in touch-manipulation"
                      draggable={false}
                      onClick={(e) => e.stopPropagation()}
                    />
                  );
                }
                
                return (
                  <motion.div
                    key={globalLightboxData.index}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="w-full h-full flex items-center justify-center z-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGlobalLightboxData(null);
                    }}
                  >
                    <TransformWrapper
                      initialScale={1}
                      minScale={1}
                      maxScale={5}
                      centerOnInit
                      wheel={{ step: 0.1 }}
                      doubleClick={{ mode: "zoomIn" }}
                    >
                      <TransformComponent wrapperClass="!w-full !h-full flex items-center justify-center" contentClass="!w-full !h-full flex items-center justify-center">
                        <img
                          src={url} 
                          alt="Lightbox media"
                          className="max-w-full max-h-[90vh] object-contain shadow-2xl cursor-zoom-in active:cursor-grabbing touch-manipulation"
                          referrerPolicy="no-referrer"
                          draggable={false}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TransformComponent>
                    </TransformWrapper>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CardItem({ card, setSelectedCard, average }: { card: Card, setSelectedCard: (card: Card) => void, average?: {overall: number, story: number, directing: number, count: number} }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => setSelectedCard(card)}
      className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-white border border-gray-200 cursor-pointer shadow-sm hover:shadow-xl transition-all"
      whileHover={{ y: -8 }}
    >
      {card.imageUrls?.[0] ? (
        <img 
          src={card.imageUrls[0]} 
          alt={card.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center transition-transform duration-700 group-hover:scale-105">
          <ImageIcon className="w-8 h-8 text-gray-300" />
        </div>
      )}
      
      {/* Top Right Badges */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
        <div className="px-2.5 h-6 flex items-center justify-center rounded-lg bg-black/40 backdrop-blur-md border border-white/20 text-[10px] font-bold text-white uppercase tracking-wider shadow-lg">
          {card.category}
        </div>
        <div className="px-2.5 h-6 flex items-center justify-center rounded-lg bg-amber-500/90 backdrop-blur-md border border-amber-400/50 gap-1.5 shadow-lg">
          <Star className="w-3 h-3 fill-white text-white" />
          <span className="text-[10px] font-black text-white tracking-tighter">
            {average && average.overall > 0 ? average.overall.toFixed(1) : '0.0'}
          </span>
        </div>
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
      
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-bold text-white uppercase tracking-widest drop-shadow-md flex items-center gap-1">
            {card.character}
            <span className={cn(
              "text-[10px]",
              (card.rarity || 5) === 5 ? "text-amber-300" : "text-purple-300"
            )}>★{card.rarity || 5}</span>
          </span>
          <span className={cn(
            "px-2.5 min-w-[40px] h-5 inline-flex items-center justify-center rounded-lg text-[10px] font-bold border backdrop-blur-md uppercase tracking-wider transition-all",
            (card.color === '레드' || card.color === '빨강') && "bg-red-50/90 border-red-200 text-red-600 shadow-sm",
            (card.color === '블루' || card.color === '파랑') && "bg-blue-50/90 border-blue-200 text-blue-600 shadow-sm",
            (card.color === '골드' || card.color === '노랑') && "bg-amber-50/90 border-amber-200 text-amber-700 shadow-sm",
            (card.color === '그린' || card.color === '초록') && "bg-green-50/90 border-green-200 text-green-700 shadow-sm",
            (card.color === '퍼플' || card.color === '보라') && "bg-purple-50/90 border-purple-200 text-purple-700 shadow-sm",
            (card.color === '핑크' || card.color === '분홍') && "bg-pink-50/90 border-pink-200 text-pink-600 shadow-sm",
          )}>
            {card.color === '빨강' ? '레드' : card.color === '파랑' ? '블루' : card.color === '노랑' ? '골드' : card.color === '초록' ? '그린' : card.color === '보라' ? '퍼플' : card.color === '분홍' ? '핑크' : card.color}
          </span>
          <span className="px-2.5 min-w-[40px] h-5 inline-flex items-center justify-center rounded-lg bg-white/90 backdrop-blur-sm text-[10px] font-bold text-gray-900 border border-white/50 shadow-sm uppercase tracking-wider">
            {card.attribute === '공격' ? '공격' : card.attribute === '방어' ? '방어' : 'HP'}
          </span>
        </div>
        <h3 className="text-2xl font-bold text-white leading-tight drop-shadow-md mb-2">{card.name}</h3>
        
        <div className="flex items-center gap-3 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300 h-[28px]">
          <div className="flex flex-col justify-between h-full">
            <span className="text-[8px] text-white/60 font-bold uppercase tracking-tighter leading-none">Story</span>
            <span className="text-[11px] text-white font-black leading-none">{average && average.story > 0 ? average.story.toFixed(1) : '-'}</span>
          </div>
          <div className="w-px h-3.5 bg-white/20" />
          <div className="flex flex-col justify-between h-full">
            <span className="text-[8px] text-white/60 font-bold uppercase tracking-tighter leading-none">Directing</span>
            <span className="text-[11px] text-white font-black leading-none">{average && average.directing > 0 ? average.directing.toFixed(1) : '-'}</span>
          </div>
          <div className="w-px h-3.5 bg-white/20" />
          <div className="flex flex-col justify-between h-full">
            <span className="text-[8px] text-white/60 font-bold uppercase tracking-tighter leading-none">Reviews</span>
            <span className="text-[11px] text-white font-black leading-none">{average ? average.count : 0}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CommentItem({ comment, comments, onDelete, onZoom, renderContentWithEmbeds, onReply }: { comment: Comment, comments: Comment[], onDelete: () => void, onZoom: (urls: string[], index: number) => void, renderContentWithEmbeds: (content: string) => React.ReactNode, onReply: (comment: Comment) => void }) {
  const [isRevealed, setIsRevealed] = useState(false);

  const getNickname = () => {
    if (comment.nickname && comment.nickname !== '익명') return comment.nickname;
    
    const anonymousComments = comments.filter(c => !c.nickname || c.nickname === '익명');
    const uniqueIdentifiers = Array.from(new Set(anonymousComments.map(c => c.visitorId || c.ip || c.id)));
    const userIndex = uniqueIdentifiers.indexOf(comment.visitorId || comment.ip || comment.id);
    
    return `익명${userIndex + 1}`;
  };

  const nickname = getNickname();
  const getCommentDepth = (commentId: string | null, depth = 0): number => {
    if (!commentId) return depth;
    const parentComment = comments.find(c => c.id === commentId);
    return parentComment ? getCommentDepth(parentComment.parentId, depth + 1) : depth;
  };
  const depth = getCommentDepth(comment.parentId);
  const isReply = depth > 0;

  return (
    <div 
      className={cn("flex gap-2 sm:gap-4 group")}
      style={{ marginLeft: isReply ? `calc(${Math.min(depth, 3)} * clamp(0.5rem, 3vw, 2.5rem))` : '0' }}
    >
      {isReply && <CornerDownRight className="w-3 h-3 text-gray-300 mt-2 shrink-0" />}
      <div className={cn("w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full bg-white border border-gray-100 flex items-center justify-center text-[10px] sm:text-xs font-bold text-gray-300", isReply && "w-7 h-7 sm:w-8 sm:h-8")}>
        {nickname[0]}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
            <span className="text-xs font-bold text-gray-900 truncate max-w-[100px] sm:max-w-none">{nickname}</span>
            <span className="text-[9px] text-gray-400 font-sans shrink-0">
              {comment.createdAt?.toDate().toLocaleString() || '...'}
            </span>
            {comment.isSpoiler && (
              <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[8px] font-black uppercase tracking-tighter border border-amber-100 shrink-0">Spoiler</span>
            )}
          </div>
          <div className="flex items-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
            <button 
              onClick={() => onReply(comment)}
              className="p-1 text-gray-400 hover:text-blue-500 transition-all"
            >
              <MessageSquare className="w-3 h-3" />
            </button>
            <button 
              onClick={onDelete}
              className="p-1 text-gray-400 hover:text-red-500 transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        
        {comment.isSpoiler && !isRevealed ? (
          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">스포일러 주의</span>
            </div>
            <button 
              onClick={() => setIsRevealed(true)}
              className="text-[10px] font-black text-amber-600 hover:text-amber-700 underline underline-offset-2"
            >
              보기
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {renderContentWithEmbeds(comment.content)}
            {comment.mediaUrls && comment.mediaUrls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {comment.mediaUrls.map((url, idx) => {
                  const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/);
                  const twitterMatch = url.match(/(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/(\d+)/);

                  return (
                    <div key={idx} className="mt-2 rounded-xl overflow-hidden border border-gray-100 bg-gray-50 max-w-sm">
                      {youtubeMatch ? (
                        <iframe 
                          src={`https://www.youtube.com/embed/${youtubeMatch[1]}`}
                          className="w-full aspect-video"
                          allowFullScreen
                        />
                      ) : twitterMatch ? (
                        <div className="p-2 bg-white flex flex-col items-center">
                          <Tweet id={twitterMatch[1]} />
                          <p className="text-[10px] text-gray-400 mt-1 px-4 text-center break-keep">* 트위터 정책에 따라 영상이 재생되지 않을 수 있습니다. 원본 링크에서 확인해주세요.</p>
                        </div>
                      ) : url.includes('video') || url.match(/\.(mp4|webm|ogg|mov|m4v|avi|wmv)/i) ? (
                        <video playsInline src={url} className="w-full object-contain" />
                      ) : (
                        <img 
                          src={url} 
                          alt={`Comment media ${idx}`} 
                          className="w-full object-contain cursor-zoom-in touch-manipulation"
                          referrerPolicy="no-referrer"
                          onClick={() => onZoom(comment.mediaUrls || [], idx)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {comment.isSpoiler && (
              <button 
                onClick={() => setIsRevealed(false)}
                className="text-[8px] font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
              >
                <EyeOff className="w-2.5 h-2.5" />
                가리기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewCard({ review, accentColor, buttonColor, onDelete, onEdit, onLike, isAdmin, userIp, user, onZoom }: { review: Review, accentColor: string, buttonColor: string, onDelete: () => void, onEdit: () => void, onLike: (review: Review) => void, isAdmin: boolean, userIp: string, user: User | null, onZoom: (urls: string[], index: number) => void }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [nickname, setNickname] = useState('');
  const [commentPassword, setCommentPassword] = useState('');
  const [commentMediaUrls, setCommentMediaUrls] = useState<string[]>([]);
  const [uploadingCommentImage, setUploadingCommentImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isCommentSpoiler, setIsCommentSpoiler] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentsPage, setCommentsPage] = useState(1);
  const COMMENTS_PER_PAGE = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const renderContentWithEmbeds = (content: string) => {
    const youtubeRegex = /(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/;
    const twitterRegex = /(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/;

    const youtubeMatch = content.match(youtubeRegex);
    const twitterMatch = content.match(twitterRegex);

    if (!youtubeMatch && !twitterMatch) {
      return <p className="text-sm text-gray-600 whitespace-pre-wrap">{content}</p>;
    }

    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 whitespace-pre-wrap">{content}</p>
        {youtubeMatch && (
          <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm max-w-sm">
            <iframe 
              src={`https://www.youtube.com/embed/${youtubeMatch[1]}`}
              className="w-full aspect-video"
              allowFullScreen
            />
          </div>
        )}
        {twitterMatch && (
          <div className="max-w-sm overflow-hidden rounded-xl border border-gray-100 shadow-sm bg-white p-2 flex flex-col items-center">
            <Tweet id={twitterMatch[1]} />
            <p className="text-[10px] text-gray-400 mt-1 px-4 text-center break-keep">* 트위터 정책에 따라 영상이 재생되지 않을 수 있습니다. 원본 링크에서 확인해주세요.</p>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    const q = query(
      collection(db, 'comments'),
      where('reviewId', '==', review.id),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      setComments(commentList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'comments'));
    return () => unsubscribe();
  }, [review.id]);

  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const handleReply = (comment: Comment) => {
    setReplyTo(comment);
    
    const anonymousComments = comments.filter(c => !c.nickname || c.nickname === '익명');
    const uniqueIdentifiers = Array.from(new Set(anonymousComments.map(c => c.visitorId || c.ip || c.id)));
    const userIndex = uniqueIdentifiers.indexOf(comment.visitorId || comment.ip || comment.id);
    const nickname = comment.nickname && comment.nickname !== '익명' ? comment.nickname : `익명${userIndex + 1}`;
    
    setCommentText(`@${nickname} `);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() && commentMediaUrls.length === 0) return;
    if (commentPassword.length < 4) {
      await customAlert("비밀번호는 4자리 이상이어야 합니다. (작성하신 글을 삭제할 때 필요합니다.)");
      return;
    }
    try {
      await addDoc(collection(db, 'comments'), {
        reviewId: review.id,
        parentId: replyTo?.id || null,
        content: commentText,
        nickname: nickname || '익명',
        password: commentPassword || '',
        mediaUrls: commentMediaUrls,
        isSpoiler: isCommentSpoiler,
        ip: userIp,
        visitorId: (window as any).visitorId || localStorage.getItem('visitor_id') || '',
        createdAt: serverTimestamp()
      });
      
      // Update comment count on review
      const reviewRef = doc(db, 'reviews', review.id);
      await updateDoc(reviewRef, {
        commentCount: increment(1)
      });

      setCommentText('');
      setCommentPassword('');
      setCommentMediaUrls([]);
      setIsCommentSpoiler(false);
      setReplyTo(null);
    } catch (error) {
      await customAlert("댓글 등록에 실패했습니다. 다시 시도해주세요.");
      handleFirestoreError(error, OperationType.CREATE, 'comments');
    }
  };

  const handleCommentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setUploadingCommentImage(true);
    setUploadProgress(0);
    
    try {
      const uploadPromises = files.map(async (file) => {
        const isVideo = file.type.startsWith('video/');
        const limit = isVideo ? 100 : 10;
        if (file.size > limit * 1024 * 1024) {
          throw new Error(`${file.name}은(는) 너무 큽니다 (최대 ${limit}MB)`);
        }
        return uploadMedia(file, 'comment', setUploadProgress);
      });
      
      const urls = await Promise.all(uploadPromises);
      setCommentMediaUrls(prev => [...prev, ...urls]);
    } catch (error: any) {
      await customAlert(`이미지 업로드에 실패했습니다: ${error.message}\n\n[해결 방법]\nFirebase Storage 요금제 문제일 수 있습니다. .env 파일에 VITE_CLOUDINARY_CLOUD_NAME과 VITE_CLOUDINARY_UPLOAD_PRESET을 설정하여 무료로 미디어를 업로드하세요.`);
    } finally {
      setUploadingCommentImage(false);
      setUploadProgress(null);
      if (e.target) e.target.value = '';
    }
  };

  const handleDeleteComment = async (comment: Comment) => {
    if (isAdmin) {
      if (!(await customConfirm("관리자 권한으로 삭제하시겠습니까?"))) return;
    } else {
      const pwd = await customPrompt("삭제하려면 비밀번호를 입력하세요:");
      if (pwd === null) return;
      if (pwd !== comment.password) {
        await customAlert("비밀번호가 일치하지 않습니다.");
        return;
      }
    }
    try {
      await deleteDoc(doc(db, 'comments', comment.id));
      
      // Update comment count on review
      const reviewRef = doc(db, 'reviews', review.id);
      await updateDoc(reviewRef, {
        commentCount: increment(-1)
      });

      await customAlert("삭제되었습니다.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `comments/${comment.id}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 backdrop-blur-sm border border-gray-100 rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
    >
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 font-bold text-lg">
              {review.nickname[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-gray-900">{review.nickname}</p>
                {review.ratings && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="text-[10px] font-bold text-amber-700">{review.ratings.overall.toFixed(1)}</span>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-gray-400 font-sans">
                {review.createdAt?.toDate().toLocaleString() || '작성 중...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={onEdit}
              className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
              title="수정"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button 
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {review.isSpoiler && !isRevealed ? (
            <div className="relative rounded-3xl overflow-hidden border border-amber-100 bg-amber-50/30 p-10 flex flex-col items-center justify-center text-center gap-4 min-h-[200px]">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <p className="font-bold text-amber-900 text-lg">스포일러 주의</p>
                <p className="text-sm text-amber-700 mt-1">이 글은 스포일러를 포함하고 있을 수 있습니다.</p>
              </div>
              <button 
                onClick={() => setIsRevealed(true)}
                className="px-8 py-3 bg-amber-600 text-white text-sm font-bold rounded-2xl shadow-lg hover:bg-amber-700 hover:scale-105 transition-all flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                내용 보기
              </button>
            </div>
          ) : (
            <>
              {renderContentWithEmbeds(review.content)}
              
              {review.mediaUrls && review.mediaUrls.length > 0 && (
                <div 
                  className="relative w-full overflow-hidden rounded-2xl bg-gray-50 border border-gray-100"
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    (e.currentTarget as any).touchStartX = touch.clientX;
                  }}
                  onTouchEnd={(e) => {
                    const touchStartX = (e.currentTarget as any).touchStartX;
                    if (touchStartX === undefined) return;
                    const touchEndX = e.changedTouches[0].clientX;
                    const diff = touchStartX - touchEndX;
                    if (diff > 50) {
                      setMediaIndex(prev => Math.min(review.mediaUrls!.length - 1, prev + 1));
                    } else if (diff < -50) {
                      setMediaIndex(prev => Math.max(0, prev - 1));
                    }
                    (e.currentTarget as any).touchStartX = undefined;
                  }}
                >
                  <div className="flex transition-transform duration-300 ease-in-out" style={{ transform: `translateX(-${mediaIndex * 100}%)` }}>
                    {review.mediaUrls.map((url, idx) => {
                      const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/);
                      const twitterMatch = url.match(/(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/(\d+)/);
                      
                      return (
                        <div key={idx} className="w-full shrink-0 flex justify-center items-center">
                          {youtubeMatch ? (
                            <iframe 
                              src={`https://www.youtube.com/embed/${youtubeMatch[1]}`}
                              className="w-full aspect-video"
                              allowFullScreen
                            />
                          ) : twitterMatch ? (
                            <div className="w-full flex flex-col items-center p-4 bg-white rounded-2xl">
                              <Tweet id={twitterMatch[1]} />
                              <p className="text-[10px] text-gray-400 mt-2 px-4 text-center break-keep">* 트위터 정책에 따라 영상이 재생되지 않을 수 있습니다. 원본 링크에서 확인해주세요.</p>
                            </div>
                          ) : url.includes('video') || url.match(/\.(mp4|webm|ogg|mov|m4v|avi|wmv)/i) ? (
                            <video playsInline src={url} controls className="w-full max-h-[500px] object-contain" />
                          ) : (
                            <img 
                              src={url} 
                              alt={`Review media ${idx}`} 
                              className="w-full max-h-[500px] object-contain cursor-zoom-in touch-manipulation"
                              referrerPolicy="no-referrer"
                              onClick={() => onZoom(review.mediaUrls || [], idx)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {review.mediaUrls.length > 1 && (
                    <>
                      <button 
                        onClick={() => setMediaIndex(prev => Math.max(0, prev - 1))}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/20 text-white hover:bg-black/40"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setMediaIndex(prev => Math.min(review.mediaUrls!.length - 1, prev + 1))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/20 text-white hover:bg-black/40"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        {review.mediaUrls.map((_, idx) => (
                          <button 
                            key={idx}
                            onClick={() => setMediaIndex(idx)}
                            className={cn("w-2 h-2 rounded-full transition-all", mediaIndex === idx ? "bg-white" : "bg-white/50")}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              {review.isSpoiler && (
                <button 
                  onClick={() => setIsRevealed(false)}
                  className="text-[10px] font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1 mt-4 transition-colors"
                >
                  <EyeOff className="w-3 h-3" />
                  스포일러 다시 가리기
                </button>
              )}
            </>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setShowComments(!showComments)}
              className={cn("flex items-center gap-2 text-xs font-bold transition-colors", showComments ? accentColor : "text-gray-400 hover:text-gray-600")}
            >
              <MessageSquare className="w-4 h-4" />
              댓글 {comments.length}개
            </button>
            <button 
              onClick={() => onLike(review)}
              className={cn(
                "flex items-center gap-2 text-xs font-bold transition-all active:scale-125",
                (user && review.likedBy?.includes(user.uid)) || (!user && review.likedBy?.includes(userIp)) ? "text-red-500" : "text-gray-400 hover:text-red-400"
              )}
            >
              <Heart className={cn("w-4 h-4", ((user && review.likedBy?.includes(user.uid)) || (!user && review.likedBy?.includes(userIp))) && "fill-current")} />
              좋아요 {review.likes || 0}
            </button>
          </div>
          {review.ratings && (review.ratings.story > 0 || review.ratings.directing > 0) && (
            <div className="hidden sm:flex items-center gap-4 text-[10px] font-bold text-gray-400">
              {review.ratings.story > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-300">STORY</span>
                  <span className="text-gray-600">{review.ratings.story.toFixed(1)}</span>
                </div>
              )}
              {review.ratings.directing > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-300">DIRECTING</span>
                  <span className="text-gray-600">{review.ratings.directing.toFixed(1)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-gray-50/50 border-t border-gray-100"
          >
            <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/30">
              <form onSubmit={handleAddComment} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input 
                    type="text"
                    placeholder="닉네임"
                    className="flex-1 min-w-[100px] bg-white border border-gray-100 rounded-xl px-3 h-[38px] text-[10px] focus:outline-none focus:ring-2 focus:ring-gray-200"
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                  />
                  <input 
                    type="password"
                    autoComplete="new-password"
                    placeholder="비밀번호 (4자 이상)"
                    className="flex-1 min-w-[120px] bg-white border border-gray-100 rounded-xl px-3 h-[38px] text-[10px] focus:outline-none focus:ring-2 focus:ring-gray-200"
                    value={commentPassword}
                    onChange={e => setCommentPassword(e.target.value)}
                  />
                  <div className="flex items-center justify-center gap-1.5 px-3 bg-white border border-gray-100 rounded-xl py-2 h-[38px] flex-1 min-w-[100px]">
                    <input 
                      type="checkbox"
                      id={`spoiler-comment-${review.id}`}
                      checked={isCommentSpoiler}
                      onChange={e => setIsCommentSpoiler(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                    />
                    <label htmlFor={`spoiler-comment-${review.id}`} className="text-[10px] font-bold text-gray-400 cursor-pointer whitespace-nowrap">스포일러</label>
                  </div>
                </div>
                
                <div className="relative">
                  <textarea 
                    placeholder="댓글을 입력하세요..."
                    className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-gray-200 min-h-[80px] resize-none pr-12"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                  />
                  <button 
                    type="submit"
                    className={cn("absolute bottom-3 right-3 p-2 text-white rounded-xl shadow-md transition-all hover:scale-105 active:scale-95", buttonColor)}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

                {commentMediaUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {commentMediaUrls.map((url, index) => (
                      <div key={index} className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-100 group">
                        {url.match(/\.(mp4|webm|ogg|mov|m4v|avi|wmv)/i) || url.includes('video') ? (
                          <video playsInline src={url} className="w-full h-full object-cover" />
                        ) : (
                          <img src={url} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                        )}
                        <button 
                          type="button"
                          onClick={() => setCommentMediaUrls(prev => prev.filter((_, i) => i !== index))}
                          className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </form>
            </div>

            {comments.length > 0 ? (
              <div className="p-6 sm:p-8 space-y-8 max-h-[800px] overflow-y-auto custom-scrollbar">
                {(() => {
                  const topLevelComments = comments
                    .filter(c => !c.parentId)
                    .sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)); // Oldest first for top-level
                  
                  const totalPages = Math.ceil(topLevelComments.length / COMMENTS_PER_PAGE);
                  const paginatedTopLevel = topLevelComments.slice((commentsPage - 1) * COMMENTS_PER_PAGE, commentsPage * COMMENTS_PER_PAGE);

                  const getDescendants = (parentId: string): Comment[] => {
                    return comments
                      .filter(c => c.parentId === parentId)
                      .sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)) // Oldest first for replies
                      .flatMap(c => [c, ...getDescendants(c.id)]);
                  };

                  const displayComments = paginatedTopLevel.flatMap(c => [c, ...getDescendants(c.id)]);

                  return (
                    <>
                      <div className="space-y-8">
                        {displayComments.map((comment) => (
                          <CommentItem 
                            key={comment.id} 
                            comment={comment} 
                            comments={comments}
                            onDelete={() => handleDeleteComment(comment)}
                            onZoom={(urls, index) => onZoom(urls, index)}
                            renderContentWithEmbeds={renderContentWithEmbeds}
                            onReply={handleReply}
                          />
                        ))}
                      </div>
                      
                      {totalPages > 1 && (
                        <div className="mt-10 flex items-center justify-center gap-4 pt-6 border-t border-gray-100">
                          <button 
                            disabled={commentsPage === 1}
                            onClick={() => setCommentsPage(prev => Math.max(1, prev - 1))}
                            className="p-2 rounded-xl bg-white border border-gray-200 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:text-gray-600 transition-all"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <span className="text-xs font-bold text-gray-400">
                            Page <span className="text-gray-900">{commentsPage}</span> of {totalPages}
                          </span>
                          <button 
                            disabled={commentsPage === totalPages}
                            onClick={() => setCommentsPage(prev => Math.min(totalPages, prev + 1))}
                            className="p-2 rounded-xl bg-white border border-gray-200 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:text-gray-600 transition-all"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="p-6 sm:p-8 text-center text-gray-400 text-xs">
                첫 번째 댓글을 남겨보세요!
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
