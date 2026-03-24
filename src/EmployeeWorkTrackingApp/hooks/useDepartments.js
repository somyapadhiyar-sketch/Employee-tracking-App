import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { DEPARTMENTS as initialDepts } from '../constants/config';

export const useDepartments = () => {
  const [departmentsMap, setDepartmentsMap] = useState(initialDepts);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = collection(db, 'departments');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbDepts = {};
      snapshot.forEach(doc => {
        dbDepts[doc.id] = doc.data();
      });
      
      // Merge default hardcoded config with dynamically fetched ones
      setDepartmentsMap({ ...initialDepts, ...dbDepts });
      setLoading(false);
    }, (error) => {
      console.error('Error fetching dynamic departments:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Use departmentsList for the dropdowns
  const departmentsList = Object.entries(departmentsMap).map(([id, data]) => ({ id, ...data }));

  const addDepartment = async (id, departmentData) => {
    try {
      await setDoc(doc(db, 'departments', id), {
        ...departmentData,
        createdAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error adding new department:', error);
      return { success: false, error };
    }
  };

  const editDepartment = async (id, updatedData) => {
    try {
      await setDoc(doc(db, 'departments', id), updatedData, { merge: true });
      return { success: true };
    } catch (error) {
      console.error('Error editing department:', error);
      return { success: false, error };
    }
  };

  const deleteDepartment = async (id) => {
    try {
      await deleteDoc(doc(db, 'departments', id));
      return { success: true };
    } catch (error) {
      console.error('Error deleting department:', error);
      return { success: false, error };
    }
  };

  return { departmentsMap, departmentsList, loading, addDepartment, editDepartment, deleteDepartment };
};
