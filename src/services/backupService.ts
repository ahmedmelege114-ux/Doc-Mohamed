import { 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  setDoc, 
  deleteDoc,
  query,
  orderBy,
  limit,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { BackupRecord } from '../types';
import { get, set } from 'idb-keyval';

const COLLECTIONS_TO_BACKUP = [
  'users',
  'settings',
  'config',
  'patients',
  'appointments',
  'medicalRecords',
  'examinations',
  'invoices',
  'expenses'
];

const DIRECTORY_HANDLE_KEY = 'clinic_backup_dir_handle';
const LAST_AUTO_BACKUP_KEY = 'last_auto_backup';
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const writeBackupToDirectory = async (backup: BackupRecord, handle: any): Promise<boolean> => {
  try {
    const hasPermission = await backupService.verifyPermission(handle, true);
    if (!hasPermission) return false;

    const fileHandle = await handle.getFileHandle(backup.filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(backup.data);
    await writable.close();
    return true;
  } catch (err) {
    console.warn('Auto-backup could not be written to saved directory:', err);
    return false;
  }
};

export const backupService = {
  /**
   * Generates a full backup of the database
   */
  async createFullBackup(type: 'manual' | 'auto' = 'manual'): Promise<BackupRecord> {
    const backupData: Record<string, any[]> = {};
    
    for (const colName of COLLECTIONS_TO_BACKUP) {
      try {
        const snapshot = await getDocs(collection(db, colName));
        backupData[colName] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (e) {
        console.error(`Error backed up collection ${colName}:`, e);
        backupData[colName] = [];
      }
    }

    const jsonString = JSON.stringify(backupData);
    const timestamp = new Date().toISOString();
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-').slice(0, 5);
    const filename = `clinic-backup-${dateStr}-${timeStr}.json`;
    const backupId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2);

    const backupRecord: BackupRecord = {
      id: backupId,
      filename,
      timestamp,
      size: new Blob([jsonString]).size,
      data: jsonString,
      createdBy: auth.currentUser?.email || 'System',
      type
    };

    // Save metadata and data to a backups collection
    try {
      await setDoc(doc(db, 'backups', backupRecord.id), backupRecord);
      
      // Add to audit logs - don't block if auditing fails
      const logId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      setDoc(doc(db, 'audit_logs', logId), {
        action: 'BACKUP_CREATED',
        filename: backupRecord.filename,
        type: backupRecord.type,
        timestamp: backupRecord.timestamp,
        user: backupRecord.createdBy,
        details: `Full database backup generated (${(backupRecord.size / 1024).toFixed(1)} KB)`
      }).catch(err => console.error("Failed to log audit:", err));
    } catch (e) {
      console.warn("Could not save full backup to Firestore (likely too large or permission issue). Storing metadata only.");
      const metadataOnly = { ...backupRecord, data: 'TOO_LARGE_STORED_LOCALLY' };
      await setDoc(doc(db, 'backups', backupRecord.id), metadataOnly);
    }

    return backupRecord;
  },

  /**
   * Check if File System Access API is supported
   */
  isSupported(): boolean {
    return 'showDirectoryPicker' in window;
  },

  /**
   * Directory Management
   */
  async selectBackupDirectory(): Promise<string> {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('BROWSER_NOT_SUPPORTED');
    }
    
    const handle = await (window as any).showDirectoryPicker();
    await set(DIRECTORY_HANDLE_KEY, handle);
    return handle.name;
  },

  async getSavedDirectoryName(): Promise<string | null> {
    const handle = await get(DIRECTORY_HANDLE_KEY);
    return handle ? handle.name : null;
  },

  async clearSavedDirectory(): Promise<void> {
    await set(DIRECTORY_HANDLE_KEY, null);
  },

  async verifyPermission(handle: any, readWrite: boolean): Promise<boolean> {
    const options: any = {};
    if (readWrite) {
      options.mode = 'readwrite';
    }
    
    try {
      // Check if permission was already granted. If so, return true.
      if ((await handle.queryPermission(options)) === 'granted') {
        return true;
      }
      // Request permission. If the user grants permission, return true.
      if ((await handle.requestPermission(options)) === 'granted') {
        return true;
      }
    } catch (err) {
      console.error('Permission verification failed:', err);
    }
    
    // The user didn't grant permission, so return false.
    return false;
  },

  /**
   * Downloads the backup as a JSON file. 
   * To preserve user activation for showSaveFilePicker, we try to call it as early as possible.
   */
  async downloadBackup(backup: BackupRecord) {
    // 1. Check if we have a saved directory handle
    const savedHandle = await get(DIRECTORY_HANDLE_KEY);
    if (savedHandle) {
      try {
        const hasPermission = await this.verifyPermission(savedHandle, true);
        if (hasPermission) {
          const fileHandle = await savedHandle.getFileHandle(backup.filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(backup.data);
          await writable.close();
          return;
        }
      } catch (err) {
        console.warn('Failed to save to saved directory, falling back:', err);
      }
    }

    // Traditional download fallback if no directory or failed
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: backup.filename,
          types: [{
            description: 'JSON File',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(backup.data);
        await writable.close();
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('File System Access API failed, falling back:', err);
      }
    }

    // Traditional download fallback
    const blob = new Blob([backup.data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backup.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Special version that can be called directly from a click handler
   * to ensure transient activation is not lost while fetching data.
   */
  async createAndSaveBackup() {
    let handle: any = null;
    const savedHandle = await get(DIRECTORY_HANDLE_KEY);

    // 1. Try to use saved directory if permission is already granted or can be requested
    if (savedHandle) {
      try {
        const hasPermission = await this.verifyPermission(savedHandle, true);
        if (hasPermission) {
          // Check if it's still reachable
          try {
            const tempFileName = `.perm-check-${Date.now()}`;
            const tempFile = await savedHandle.getFileHandle(tempFileName, { create: true });
            await savedHandle.removeEntry(tempFileName);
            
            const backup = await this.createFullBackup('manual');
            const fileHandle = await savedHandle.getFileHandle(backup.filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(backup.data);
            await writable.close();
            return backup;
          } catch (accessErr) {
             console.warn('Saved directory has permission but not reachable/writable:', accessErr);
             // Fallback to picker
          }
        }
      } catch (err) {
        console.warn('Saved directory access failed:', err);
      }
    }
    
    // 2. Otherwise try to open the picker immediately to capture user activation
    if ('showSaveFilePicker' in window) {
      try {
        handle = await (window as any).showSaveFilePicker({
          suggestedName: `clinic-backup-${new Date().toISOString().split('T')[0]}.json`,
          types: [{
            description: 'JSON File',
            accept: { 'application/json': ['.json'] },
          }],
        });
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        console.warn('showSaveFilePicker blocked or failed:', err);
      }
    }

    // 3. Fetch the data (this is the long-running part)
    const backup = await this.createFullBackup('manual');

    // 4. Write to the handle if we have it, otherwise fallback to traditional download
    if (handle) {
      const writable = await handle.createWritable();
      await writable.write(backup.data);
      await writable.close();
    } else {
      await this.downloadBackup(backup);
    }

    return backup;
  },

  async createAndSaveAutoBackup(): Promise<BackupRecord> {
    const backup = await this.createFullBackup('auto');
    const savedHandle = await get(DIRECTORY_HANDLE_KEY);

    if (savedHandle && backup.data !== 'TOO_LARGE_STORED_LOCALLY') {
      await writeBackupToDirectory(backup, savedHandle);
    }

    return backup;
  },

  /**
   * Restores data from a JSON string
   */
  async restoreFromData(jsonString: string, onProgress?: (progress: number) => void): Promise<void> {
    const backupData = JSON.parse(jsonString);
    let totalDocs = 0;
    let processedDocs = 0;

    // Count total docs
    Object.values(backupData).forEach((docs: any) => {
      totalDocs += Array.isArray(docs) ? docs.length : 0;
    });

    for (const [colName, docs] of Object.entries(backupData)) {
      if (!Array.isArray(docs)) continue;

      // Firestore batches have a limit of 500 operations
      const BATCH_SIZE = 400;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + BATCH_SIZE);
        
        chunk.forEach(data => {
          const { id, ...docData } = data;
          const docRef = doc(db, colName, id);
          batch.set(docRef, docData, { merge: true });
          processedDocs++;
          if (onProgress) onProgress(Math.floor((processedDocs / totalDocs) * 100));
        });

        await batch.commit();
      }
    }

    // Add to audit logs
    const logId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    setDoc(doc(db, 'audit_logs', logId), {
      action: 'RESTORE_PERFORMED',
      timestamp: new Date().toISOString(),
      user: auth.currentUser?.email || 'System',
      details: `Database restore performed from JSON data.`
    }).catch(err => console.error("Audit log failed:", err));
  },

  /**
   * Gets all backups from history
   */
  async getBackupHistory(): Promise<BackupRecord[]> {
    const q = query(collection(db, 'backups'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as BackupRecord);
  },

  /**
   * Deletes a backup record
   */
  async deleteBackup(id: string): Promise<void> {
    const docRef = doc(db, 'backups', id);
    const docSnap = await getDoc(docRef);
    const data = docSnap.exists() ? docSnap.data() : null;

    try {
      await deleteDoc(docRef);
      
      // Add to audit logs - don't block if auditing fails
      const logId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      setDoc(doc(db, 'audit_logs', logId), {
        action: 'BACKUP_DELETED',
        filename: data?.filename || 'Unknown',
        timestamp: new Date().toISOString(),
        user: auth.currentUser?.email || 'System',
        details: `Backup record removed from system history.`
      }).catch(err => console.error("Audit log failed:", err));
    } catch (err) {
      console.error("Critical error deleting backup doc:", err);
      throw err;
    }
  },

  /**
   * Checks if an auto backup is needed (every 24h)
   */
  async checkAndRunAutoBackup(): Promise<void> {
    const lastBackupTime = localStorage.getItem(LAST_AUTO_BACKUP_KEY);
    const now = Date.now();

    if (!lastBackupTime || now - parseInt(lastBackupTime) > AUTO_BACKUP_INTERVAL_MS) {
      console.log("Running scheduled auto-backup...");
      try {
        await this.createAndSaveAutoBackup();
        localStorage.setItem(LAST_AUTO_BACKUP_KEY, now.toString());
      } catch (e) {
        console.error("Auto-backup failed:", e);
      }
    }
  },

  startAutoBackupScheduler(): () => void {
    void this.checkAndRunAutoBackup();

    const intervalId = window.setInterval(() => {
      void this.checkAndRunAutoBackup();
    }, 60 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  },

  getAutoBackupIntervalHours(): number {
    return AUTO_BACKUP_INTERVAL_MS / (60 * 60 * 1000);
  },
};
