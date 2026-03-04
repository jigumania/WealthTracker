import {
    collection,
    doc,
    setDoc,
    getDocs,
    deleteDoc
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
