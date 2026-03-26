import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  getDocs
} from "firebase/firestore";
import { db } from "../../firebase";

export default function MessagingDashboard({ user, role, isDark }) {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef(null);

  const isAdmin = role === "admin";
  const userId = user.uid || user.id;

  const GROUPS = [
    { id: "group_all", firstName: "All", lastName: "Staff", role: "group", isGroup: true, icon: "fa-users" },
    { id: "group_managers", firstName: "All", lastName: "Managers", role: "group", isGroup: true, icon: "fa-user-tie" },
    { id: "group_employees", firstName: "All", lastName: "Employees", role: "group", isGroup: true, icon: "fa-user-friends" },
  ];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch contacts (managers and employees)
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const usersList = usersSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(u => u.status === "approved");

        let availableContacts = [];
        if (isAdmin) {
          const individualContacts = usersList.filter(u => u.id !== userId && u.role !== "admin");
          availableContacts = [...GROUPS, ...individualContacts];
        } else {
          const adminUser = usersList.find(u => u.role === "admin");
          const relevantGroups = GROUPS.filter(g => {
            if (g.id === "group_all") return true;
            if (role === "manager" && g.id === "group_managers") return true;
            if (role === "employee" && g.id === "group_employees") return true;
            return false;
          });

          if (adminUser) {
            availableContacts = [...relevantGroups, adminUser];
          } else {
            const fallback = { id: "admin_system", firstName: "System", lastName: "Admin", role: "admin" };
            availableContacts = [...relevantGroups, fallback];
          }
        }
        setContacts(availableContacts);

        // Auto-select first contact (No persistence as per "remove history" spirit)
        if (!selectedContact && availableContacts.length > 0) {
          setSelectedContact(availableContacts[0]);
        }
      } catch (error) {
        console.error("Error fetching contacts:", error);
      } finally {
        setLoadingContacts(false);
      }
    };

    fetchContacts();
  }, [isAdmin, user, role]);

  // Handle contact selection
  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
  };

  // Fetch messages between current user and selected contact (REAL-TIME ONLY, NO HISTORY)
  useEffect(() => {
    if (!selectedContact) return;

    setLoadingMessages(true);
    let q;
    if (selectedContact.isGroup) {
      q = query(
        collection(db, "messages"),
        where("chatId", "==", selectedContact.id)
      );
    } else {
      const chatId = isAdmin
        ? getChatId(userId, selectedContact.id)
        : getChatId(selectedContact.id, userId);

      q = query(
        collection(db, "messages"),
        where("chatId", "==", chatId)
      );
    }

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const msgs = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp || null
          };
        })
        // Sort client-side to avoid needing Firestore composite index
        .sort((a, b) => {
          const tA = a.timestamp?.toDate?.()?.getTime() ?? 0;
          const tB = b.timestamp?.toDate?.()?.getTime() ?? 0;
          return tA - tB;
        });

      setMessages(msgs);
      setLoadingMessages(false);

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }, (error) => {
      console.error("Message listener error:", error);
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [selectedContact, userId, isAdmin]);

  const getChatId = (id1, id2) => {
    return [id1, id2].sort().join("_");
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContact || !isAdmin) return;

    const messageText = newMessage.trim();
    setNewMessage("");

    try {
      const chatId = selectedContact.isGroup
        ? selectedContact.id
        : getChatId(userId, selectedContact.id);

      await addDoc(collection(db, "messages"), {
        chatId: chatId,
        senderId: userId,
        senderName: `${user.firstName || "Admin"} ${user.lastName || ""}`,
        receiverId: selectedContact.id,
        text: messageText,
        timestamp: serverTimestamp(),
        isGroup: selectedContact.isGroup || false
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageText);
    }
  };

  const filteredContacts = contacts.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`flex h-full rounded-3xl overflow-hidden shadow-2xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>

      {/* Sidebar / Contact List */}
      <div className={`w-full md:w-80 flex flex-col border-r ${isDark ? "bg-gray-900/50 border-gray-700" : "bg-gray-50 border-gray-200"} ${selectedContact && "hidden md:flex"}`}>
        <div className="p-6 border-b border-gray-700/10">
          <h2 className={`text-2xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-800"}`}>Real-time Messaging</h2>
          <div className="relative">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-12 pr-4 py-3 rounded-2xl outline-none transition-all ${isDark ? "bg-gray-800 text-white focus:ring-2 ring-emerald-500/50" : "bg-white text-gray-800 shadow-sm focus:ring-2 ring-emerald-500/20"}`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {loadingContacts ? (
            <div className="flex items-center justify-center h-20">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-10 opacity-50">No users found</div>
          ) : (
            filteredContacts.map(contact => (
              <button
                key={contact.id}
                onClick={() => handleSelectContact(contact)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${selectedContact?.id === contact.id
                  ? "bg-emerald-500 text-white shadow-lg scale-[1.02]"
                  : isDark ? "hover:bg-gray-800 text-gray-300" : "hover:bg-white hover:shadow-md text-gray-700"}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md shrink-0 ${contact.isGroup ? "bg-amber-500 text-white" : (selectedContact?.id === contact.id ? "bg-white/20" : "bg-emerald-500 text-white")}`}>
                  {contact.profileImage ? (
                    <img src={contact.profileImage} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : contact.isGroup ? (
                    <i className={`fas ${contact.icon} text-sm`}></i>
                  ) : (
                    <span className="text-sm">{contact.firstName?.[0]}{contact.lastName?.[0]}</span>
                  )}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-semibold text-[14px] truncate">{contact.firstName} {contact.lastName}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className={`flex-1 flex flex-col ${!selectedContact && "hidden md:flex"} ${isDark ? "bg-gray-800" : "bg-white"}`}>
        {selectedContact ? (
          <>
            {/* Header */}
            <div className={`p-3 flex items-center gap-3 border-b ${isDark ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
              <button onClick={() => setSelectedContact(null)} className="md:hidden text-gray-400 hover:text-emerald-500">
                <i className="fas fa-arrow-left text-xl"></i>
              </button>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm shrink-0 ${selectedContact.isGroup ? "bg-amber-500" : "bg-emerald-500"}`}>
                {selectedContact.profileImage ? (
                  <img src={selectedContact.profileImage} alt="" className="w-full h-full object-cover rounded-full" />
                ) : selectedContact.isGroup ? (
                  <i className={`fas ${selectedContact.icon} text-lg`}></i>
                ) : (
                  <span className="text-sm">{selectedContact.firstName?.[0]}{selectedContact.lastName?.[0]}</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className={`font-bold text-base ${isDark ? "text-white" : "text-gray-800"}`}>{selectedContact.firstName} {selectedContact.lastName}</h3>
                <p className="text-[10px] text-emerald-500 font-medium tracking-tight">Listening for new messages...</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[url('https://i.pinimg.com/originals/f5/05/24/f50524ee5f161f437400aaf215c9e12f.jpg')] bg-repeat bg-contain bg-opacity-5 relative">
              <div className="absolute inset-0 bg-white/95 dark:bg-gray-800/95 -z-10"></div>

              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-30 text-center">
                  <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <i className="fas fa-bolt text-3xl text-emerald-500"></i>
                  </div>
                  <p className="text-xl font-bold italic">Waiting for Admin to send a message...</p>
                  <p className="text-sm mt-2">Historical messages are hidden as per privacy settings.</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.senderId === userId;
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      key={msg.id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[85%] px-3 py-2 rounded-2xl shadow-sm relative transition-all hover:shadow-md ${isMe
                        ? "bg-emerald-500 text-white rounded-tr-none"
                        : isDark ? "bg-gray-700 text-white rounded-tl-none" : "bg-gray-100 text-gray-800 rounded-tl-none"}`}>
                        <div className="flex items-end gap-2 flex-wrap min-w-[50px]">
                          <p className="text-[12.5px] leading-relaxed break-words flex-1">{msg.text}</p>
                          <p className={`text-[9.5px] opacity-70 font-medium whitespace-nowrap mb-[-2px] ml-auto`}>
                            {msg.timestamp?.toDate ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "..."}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {isAdmin ? (
              <form onSubmit={handleSendMessage} className={`p-6 border-t ${isDark ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Instantly broadcast a message..."
                    className={`flex-1 px-6 py-4 rounded-full outline-none transition-all shadow-inner ${isDark ? "bg-gray-800 text-white focus:ring-2 ring-emerald-500" : "bg-white text-gray-800 focus:ring-2 ring-emerald-500 border border-gray-100"}`}
                  />
                  <button
                    type="submit"
                    className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95"
                  >
                    <i className="fas fa-paper-plane text-xl ml-1"></i>
                  </button>
                </div>
              </form>
            ) : (
              <div className={`p-2 text-center border-t italic font-medium ${isDark ? "bg-gray-900/50 text-gray-500 border-gray-700" : "bg-gray-100 text-gray-400 border-gray-200"}`}>
                <i className="fas fa-bolt text-xs mr-2 text-emerald-500"></i>
                Real-time Mode: Only new messages from Admin will appear here.
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-30 p-10 text-center">
            <i className="fas fa-satellite-dish text-9xl mb-6 text-emerald-500"></i>
            <h3 className="text-3xl font-bold italic">Real-time Connection Ready</h3>
            <p className="mt-4 text-lg">Historical data is disabled.</p>
          </div>
        )}
      </div>

    </div>
  );
}
