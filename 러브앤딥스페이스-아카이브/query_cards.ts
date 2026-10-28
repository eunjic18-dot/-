import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "project-cb317c20-d359-428e-ba8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "defalut");

async function main() {
  const cardsRef = collection(db, 'cards');
  const snapshot = await getDocs(cardsRef);
  const cards = snapshot.docs.map(doc => doc.data());
  const problematic = cards.filter(c => 
    c.name.includes("물빛 온기에 잠겨") || 
    c.name.includes("깊이 흐르는 눈꽃") || 
    c.name.includes("꽃이 너울지는 계절") || 
    c.name.includes("밤을 휘감는 영혼") || 
    c.name.includes("덩굴이 자라는 본능")
  );
  console.log(JSON.stringify(problematic, null, 2));
}

main().catch(console.error);
