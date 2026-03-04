import {
    collection,
    doc,
    setDoc,
    getDocs,
    deleteDoc,
    onSnapshot,
    query
} from 'firebase/firestore';
import { db } from '../firebase';

export const syncToFirestore = async (userId: string, path: string, data: any) => {
    try {
        const userRef = doc(db, 'users', userId);
        const itemRef = doc(collection(userRef, path), data.id || data.asset_id);
        await setDoc(itemRef, { ...data, updated_at: new Date().toISOString() });
    } catch (error) {
        console.error(`Error syncing ${path}:`, error);
    }
};

export const deleteFromFirestore = async (userId: string, path: string, id: string) => {
    try {
        const itemRef = doc(db, 'users', userId, path, id);
        await deleteDoc(itemRef);
    } catch (error) {
        console.error(`Error deleting ${path}:`, error);
    }
};

export const fetchAllFromFirestore = async (userId: string, path: string) => {
    try {
        const colRef = collection(db, 'users', userId, path);
        const snapshot = await getDocs(colRef);
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error(`Error fetching ${path}:`, error);
        return [];
    }
};

export const subscribeToCollection = (userId: string, path: string, onUpdate: (data: any[]) => void) => {
    console.log(`Setting up subscription for: ${path}`);
    const colRef = collection(db, 'users', userId, path);
    const q = query(colRef);
    return onSnapshot(q, (snapshot) => {
        console.log(`Snapshot received for ${path}: ${snapshot.size} items`);
        const data = snapshot.docs.map(doc => doc.data());
        onUpdate(data);
    }, (error) => {
        console.error(`Error subscribing to ${path}:`, error);
        if (error.code === 'permission-denied') {
            console.error(`Permission denied for ${path}. Please check your Security Rules.`);
        }
    });
};
