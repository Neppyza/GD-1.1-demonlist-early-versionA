import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { applyConsoleInsertion } from './ranking.js';

initializeApp();
export const shiftConsoleLevel = onDocumentCreated(
    { document: 'levels/{levelId}', retry: true },
    event => applyConsoleInsertion(getFirestore(), event.data, () => FieldValue.serverTimestamp())
);
