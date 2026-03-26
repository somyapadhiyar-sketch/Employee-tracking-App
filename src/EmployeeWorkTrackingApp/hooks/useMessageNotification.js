import { useState, useEffect, useRef } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

/**
 * Listens for new messages from the Admin in real-time.
 * Returns unread count + the latest message text for toast display.
 * 
 * @param {string} userId - Current user's ID
 * @param {string} role - "manager" | "employee"
 * @param {boolean} isMessagesOpen - Whether the user is currently on the Messages page
 */
export default function useMessageNotification(userId, role, isMessagesOpen) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestMessage, setLatestMessage] = useState(null);
  const mountedAt = useRef(new Date());
  const prevMessageIds = useRef(new Set());

  useEffect(() => {
    if (!userId || !role) return;

    // Determine which chats this user should listen to
    // Groups that apply to this role
    const relevantChatIds = ["group_all"];
    if (role === "manager") relevantChatIds.push("group_managers");
    if (role === "employee") relevantChatIds.push("group_employees");
    // Also direct DM chat (admin<->user) - we listen separately

    const unsubscribers = [];

    // Listen to each relevant group chat
    relevantChatIds.forEach(chatId => {
      const q = query(
        collection(db, "messages"),
        where("chatId", "==", chatId)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(change => {
          if (change.type === "added") {
            const data = change.doc.data();
            const msgId = change.doc.id;

            // Skip if already seen or is before mount time
            if (prevMessageIds.current.has(msgId)) return;
            prevMessageIds.current.add(msgId);

            const msgTime = data.timestamp?.toDate?.() || null;
            // Only notify for messages that arrived after this component mounted
            if (msgTime && msgTime < mountedAt.current) return;

            // Only show notification if not currently on Messages page
            if (!isMessagesOpen && data.senderId !== userId) {
              setUnreadCount(prev => prev + 1);
              setLatestMessage(data.text || "New message from Admin");
            }
          }
        });
      });
      unsubscribers.push(unsub);
    });

    // Listen to direct DM chat with admin
    // We can't know the admin's UID here easily so we'll query by receiverId
    const dmQ = query(
      collection(db, "messages"),
      where("receiverId", "==", userId)
    );
    const dmUnsub = onSnapshot(dmQ, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === "added") {
          const data = change.doc.data();
          const msgId = change.doc.id;

          if (prevMessageIds.current.has(msgId)) return;
          prevMessageIds.current.add(msgId);

          const msgTime = data.timestamp?.toDate?.() || null;
          if (msgTime && msgTime < mountedAt.current) return;

          if (!isMessagesOpen && data.senderId !== userId) {
            setUnreadCount(prev => prev + 1);
            setLatestMessage(data.text || "New direct message from Admin");
          }
        }
      });
    });
    unsubscribers.push(dmUnsub);

    return () => unsubscribers.forEach(unsub => unsub());
  }, [userId, role, isMessagesOpen]);

  // Reset unread when user opens Messages
  useEffect(() => {
    if (isMessagesOpen) {
      setUnreadCount(0);
      setLatestMessage(null);
    }
  }, [isMessagesOpen]);

  const clearNotification = () => {
    setLatestMessage(null);
  };

  return { unreadCount, latestMessage, clearNotification };
}
