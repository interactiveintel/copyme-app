// ---------------------------------------------------------------------------
// Mock data for demo mode — profiles, conversations, and chat messages
// ---------------------------------------------------------------------------

export interface MockProfile {
  id: string;
  displayName: string;
  bio: string;
  interests: string[];
  location: { globalArea: string; region: string; cityZip: string };
  profileType: "personal" | "social" | "legal_entity";
  online: boolean;
  lastSeen: string;
  avatarUrl: string;
  voiceName?: string;
  // Enriched profile fields
  occupation: string;
  company?: string;
  education: string;
  languages: string[];
  memberSince: string; // e.g. "Jan 2025"
  verified: boolean;
  profileCompletion: number; // 0-100
  stats: {
    messagesSent: number;
    contacts: number;
    groups: number;
    ruleOf7: { messages: number; contacts: number; interests: number }; // out of 7
  };
  socialLinks?: { type: string; label: string }[];
  age?: number;
}

export interface MockConversation {
  contactId: string;
  contactName: string;
  lastMessage: {
    id: string;
    type: string;
    content: string | null;
    createdAt: string;
    direction: "sent" | "received";
  };
}

export interface MockChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  type: "text" | "image" | "voice";
  content: string | null;
  mediaUrls: string[] | null;
  durationSeconds: number | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 10 complete user profiles
// ---------------------------------------------------------------------------

export const MOCK_PROFILES: Record<string, MockProfile> = {
  mock_1: {
    id: "mock_1",
    displayName: "Sarah Chen",
    bio: "UX researcher by day, street photographer by night. Obsessed with how people interact with the world around them.",
    interests: ["photography", "UX research", "urban sketching", "coffee culture", "hiking", "documentary films", "mindfulness"],
    location: { globalArea: "Americas", region: "United States", cityZip: "San Francisco" },
    profileType: "personal",
    online: true,
    lastSeen: "now",
    avatarUrl: "/api/avatars/SarahChen",
    voiceName: "Samantha",
    occupation: "Senior UX Researcher",
    company: "Figma",
    education: "MS Human-Computer Interaction, Carnegie Mellon",
    languages: ["English", "Mandarin", "French"],
    memberSince: "Jan 2025",
    verified: true,
    profileCompletion: 100,
    age: 29,
    stats: { messagesSent: 142, contacts: 7, groups: 3, ruleOf7: { messages: 5, contacts: 7, interests: 7 } },
    socialLinks: [{ type: "portfolio", label: "sarahchen.design" }, { type: "linkedin", label: "linkedin.com/in/sarahchen" }],
  },
  mock_2: {
    id: "mock_2",
    displayName: "Alex Rivera",
    bio: "Product designer building tools that empower creators. Weekend rock climber and amateur pasta maker.",
    interests: ["product design", "rock climbing", "pasta making", "typography", "sci-fi novels", "open source", "vinyl records"],
    location: { globalArea: "Americas", region: "United States", cityZip: "Austin" },
    profileType: "personal",
    online: true,
    lastSeen: "now",
    avatarUrl: "/api/avatars/AlexRivera",
    voiceName: "Daniel",
    occupation: "Lead Product Designer",
    company: "Vercel",
    education: "BFA Graphic Design, RISD",
    languages: ["English", "Spanish"],
    memberSince: "Feb 2025",
    verified: true,
    profileCompletion: 95,
    age: 31,
    stats: { messagesSent: 89, contacts: 5, groups: 2, ruleOf7: { messages: 7, contacts: 5, interests: 7 } },
    socialLinks: [{ type: "dribbble", label: "dribbble.com/alexrivera" }],
  },
  mock_3: {
    id: "mock_3",
    displayName: "Mia Zhang",
    bio: "Travel writer and language nerd. Fluent in 4 languages, learning my 5th. Currently based in Tokyo but my heart is everywhere.",
    interests: ["travel writing", "languages", "Japanese culture", "street food", "calligraphy", "podcasting", "yoga"],
    location: { globalArea: "Asia", region: "Japan", cityZip: "Tokyo" },
    profileType: "personal",
    online: false,
    lastSeen: "30m ago",
    avatarUrl: "/api/avatars/MiaZhang",
    voiceName: "Karen",
    occupation: "Travel Writer & Columnist",
    company: "Condé Nast Traveler",
    education: "BA Comparative Literature, NYU",
    languages: ["English", "Mandarin", "Japanese", "Korean", "French (learning)"],
    memberSince: "Mar 2025",
    verified: true,
    profileCompletion: 100,
    age: 27,
    stats: { messagesSent: 203, contacts: 7, groups: 4, ruleOf7: { messages: 4, contacts: 7, interests: 7 } },
    socialLinks: [{ type: "blog", label: "miawanders.com" }, { type: "instagram", label: "@miawanders" }],
  },
  mock_4: {
    id: "mock_4",
    displayName: "Jordan Blake",
    bio: "AI researcher at a startup. Fitness enthusiast who believes in balance — heavy deadlifts and heavy reading.",
    interests: ["machine learning", "fitness", "philosophy", "chess", "cooking", "podcasts", "neuroscience"],
    location: { globalArea: "Americas", region: "United States", cityZip: "New York" },
    profileType: "personal",
    online: false,
    lastSeen: "1h ago",
    avatarUrl: "/api/avatars/JordanBlake",
    voiceName: "Alex",
    occupation: "AI Research Scientist",
    company: "Anthropic",
    education: "PhD Machine Learning, MIT",
    languages: ["English"],
    memberSince: "Jan 2025",
    verified: true,
    profileCompletion: 90,
    age: 33,
    stats: { messagesSent: 67, contacts: 4, groups: 1, ruleOf7: { messages: 5, contacts: 4, interests: 7 } },
    socialLinks: [{ type: "github", label: "github.com/jblake-ml" }, { type: "scholar", label: "Google Scholar" }],
  },
  mock_5: {
    id: "mock_5",
    displayName: "Priya Sharma",
    bio: "Data scientist turned entrepreneur. Building climate tech solutions from Bangalore. Tea over coffee, always.",
    interests: ["data science", "climate tech", "entrepreneurship", "classical dance", "tea culture", "meditation", "gardening"],
    location: { globalArea: "Asia", region: "India", cityZip: "Bangalore" },
    profileType: "social",
    online: true,
    lastSeen: "now",
    avatarUrl: "/api/avatars/PriyaSharma",
    voiceName: "Veena",
    occupation: "Founder & CEO",
    company: "GreenPulse Analytics",
    education: "MS Data Science, IIT Delhi",
    languages: ["English", "Hindi", "Tamil", "Kannada"],
    memberSince: "Dec 2024",
    verified: true,
    profileCompletion: 100,
    age: 30,
    stats: { messagesSent: 178, contacts: 7, groups: 5, ruleOf7: { messages: 6, contacts: 7, interests: 7 } },
    socialLinks: [{ type: "linkedin", label: "linkedin.com/in/priyasharma" }, { type: "website", label: "greenpulse.io" }],
  },
  mock_6: {
    id: "mock_6",
    displayName: "Marcus Johnson",
    bio: "Creative director at a boutique agency. Jazz trumpeter on weekends. Firm believer that good design is invisible.",
    interests: ["creative direction", "jazz", "trumpet", "architecture", "cycling", "whiskey tasting", "mentoring"],
    location: { globalArea: "Europe", region: "United Kingdom", cityZip: "London" },
    profileType: "personal",
    online: false,
    lastSeen: "3h ago",
    avatarUrl: "/api/avatars/MarcusJohnson",
    voiceName: "Daniel",
    occupation: "Creative Director",
    company: "Pentagram",
    education: "MA Visual Communication, Royal College of Art",
    languages: ["English", "French"],
    memberSince: "Feb 2025",
    verified: true,
    profileCompletion: 85,
    age: 38,
    stats: { messagesSent: 54, contacts: 3, groups: 2, ruleOf7: { messages: 4, contacts: 3, interests: 7 } },
    socialLinks: [{ type: "behance", label: "behance.net/marcusj" }],
  },
  mock_7: {
    id: "mock_7",
    displayName: "Lena Kowalski",
    bio: "Environmental scientist and avid hiker. Documenting biodiversity one trail at a time. Dog mom to two rescues.",
    interests: ["environmental science", "hiking", "wildlife photography", "sustainability", "dogs", "watercolor", "camping"],
    location: { globalArea: "Europe", region: "Germany", cityZip: "Munich" },
    profileType: "personal",
    online: false,
    lastSeen: "5h ago",
    avatarUrl: "/api/avatars/LenaKowalski",
    voiceName: "Anna",
    occupation: "Environmental Research Scientist",
    company: "Max Planck Institute",
    education: "PhD Ecology, ETH Zurich",
    languages: ["German", "English", "Polish"],
    memberSince: "Mar 2025",
    verified: true,
    profileCompletion: 92,
    age: 34,
    stats: { messagesSent: 45, contacts: 4, groups: 2, ruleOf7: { messages: 4, contacts: 4, interests: 7 } },
    socialLinks: [{ type: "researchgate", label: "ResearchGate" }, { type: "instagram", label: "@lena.trails" }],
  },
  mock_8: {
    id: "mock_8",
    displayName: "David Park",
    bio: "Full-stack developer who codes to lo-fi beats. Building side projects and collecting mechanical keyboards.",
    interests: ["web development", "mechanical keyboards", "lo-fi music", "gaming", "ramen", "anime", "3D printing"],
    location: { globalArea: "Asia", region: "South Korea", cityZip: "Seoul" },
    profileType: "personal",
    online: true,
    lastSeen: "now",
    avatarUrl: "/api/avatars/DavidPark",
    voiceName: "Yuna",
    occupation: "Senior Full-Stack Engineer",
    company: "Toss (Viva Republica)",
    education: "BS Computer Science, KAIST",
    languages: ["Korean", "English", "Japanese"],
    memberSince: "Jan 2025",
    verified: true,
    profileCompletion: 88,
    age: 28,
    stats: { messagesSent: 112, contacts: 6, groups: 3, ruleOf7: { messages: 4, contacts: 6, interests: 7 } },
    socialLinks: [{ type: "github", label: "github.com/dpark-dev" }, { type: "twitter", label: "@davidpark_dev" }],
  },
  mock_9: {
    id: "mock_9",
    displayName: "Amara Okafor",
    bio: "Public health researcher and community organizer. Using data to drive change in maternal health across West Africa.",
    interests: ["public health", "community organizing", "data analytics", "African literature", "running", "baking", "volunteering"],
    location: { globalArea: "Africa", region: "Nigeria", cityZip: "Lagos" },
    profileType: "social",
    online: false,
    lastSeen: "1d ago",
    avatarUrl: "/api/avatars/AmaraOkafor",
    voiceName: "Tessa",
    occupation: "Public Health Researcher",
    company: "WHO West Africa Regional Office",
    education: "MPH Epidemiology, Johns Hopkins",
    languages: ["English", "Yoruba", "Igbo", "French"],
    memberSince: "Feb 2025",
    verified: true,
    profileCompletion: 97,
    age: 32,
    stats: { messagesSent: 91, contacts: 5, groups: 4, ruleOf7: { messages: 4, contacts: 5, interests: 7 } },
    socialLinks: [{ type: "linkedin", label: "linkedin.com/in/amaraokafor" }, { type: "orcid", label: "ORCID" }],
  },
  mock_10: {
    id: "mock_10",
    displayName: "Kai Nakamura",
    bio: "Barista and coffee roaster exploring the craft of the perfect cup. Also into ceramics and very slow mornings.",
    interests: ["coffee roasting", "ceramics", "slow living", "bouldering", "film photography", "jazz", "sourdough"],
    location: { globalArea: "Asia", region: "Japan", cityZip: "Kyoto" },
    profileType: "personal",
    online: false,
    lastSeen: "2d ago",
    avatarUrl: "/api/avatars/KaiNakamura",
    voiceName: "Kyoko",
    occupation: "Head Roaster & Co-founder",
    company: "Kaze Coffee Roasters",
    education: "BA Fine Arts, Kyoto University of Art",
    languages: ["Japanese", "English"],
    memberSince: "Mar 2025",
    verified: false,
    profileCompletion: 78,
    age: 26,
    stats: { messagesSent: 34, contacts: 3, groups: 1, ruleOf7: { messages: 4, contacts: 3, interests: 7 } },
    socialLinks: [{ type: "instagram", label: "@kazecoffee" }],
  },
};

// ---------------------------------------------------------------------------
// 10 conversations with last messages
// ---------------------------------------------------------------------------

export const MOCK_CONVERSATIONS: MockConversation[] = [
  {
    contactId: "mock_1",
    contactName: "Sarah Chen",
    lastMessage: { id: "m1", type: "text", content: "The Rule of 7 really changed how I think about messaging!", createdAt: new Date(Date.now() - 2 * 60000).toISOString(), direction: "received" },
  },
  {
    contactId: "mock_2",
    contactName: "Alex Rivera",
    lastMessage: { id: "m2", type: "text", content: "Let's sync on the design project tomorrow", createdAt: new Date(Date.now() - 15 * 60000).toISOString(), direction: "sent" },
  },
  {
    contactId: "mock_3",
    contactName: "Mia Zhang",
    lastMessage: { id: "m3", type: "text", content: "Just got back from Tokyo — so much to share!", createdAt: new Date(Date.now() - 45 * 60000).toISOString(), direction: "received" },
  },
  {
    contactId: "mock_4",
    contactName: "Jordan Blake",
    lastMessage: { id: "m4", type: "text", content: "That AI workshop was incredible, thanks for the rec", createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), direction: "received" },
  },
  {
    contactId: "mock_5",
    contactName: "Priya Sharma",
    lastMessage: { id: "m5", type: "text", content: "Can you send me the link to that article?", createdAt: new Date(Date.now() - 3 * 3600000).toISOString(), direction: "sent" },
  },
  {
    contactId: "mock_6",
    contactName: "Marcus Johnson",
    lastMessage: { id: "m6", type: "text", content: "Great meeting today! Looking forward to next steps", createdAt: new Date(Date.now() - 5 * 3600000).toISOString(), direction: "received" },
  },
  {
    contactId: "mock_7",
    contactName: "Lena Kowalski",
    lastMessage: { id: "m7", type: "text", content: "The sunset photos from your hike are stunning", createdAt: new Date(Date.now() - 8 * 3600000).toISOString(), direction: "sent" },
  },
  {
    contactId: "mock_8",
    contactName: "David Park",
    lastMessage: { id: "m8", type: "voice", content: null, createdAt: new Date(Date.now() - 12 * 3600000).toISOString(), direction: "received" },
  },
  {
    contactId: "mock_9",
    contactName: "Amara Okafor",
    lastMessage: { id: "m9", type: "text", content: "Happy birthday! Hope you have an amazing day", createdAt: new Date(Date.now() - 24 * 3600000).toISOString(), direction: "sent" },
  },
  {
    contactId: "mock_10",
    contactName: "Kai Nakamura",
    lastMessage: { id: "m10", type: "text", content: "That new coffee spot on 5th is a must-try", createdAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString(), direction: "received" },
  },
];

// ---------------------------------------------------------------------------
// Mock chat messages per contact (pre-loaded conversation history)
// ---------------------------------------------------------------------------

const NOW = Date.now();
const MIN = 60000;
const HR = 3600000;

export const MOCK_CHAT_MESSAGES: Record<string, MockChatMessage[]> = {
  mock_1: [
    { id: "c1_1", senderId: "mock_1", receiverId: "me", type: "text", content: "Hey! I just joined CopyMe. This Rule of 7 concept is fascinating.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 30 * MIN).toISOString() },
    { id: "c1_2", senderId: "me", receiverId: "mock_1", type: "text", content: "Welcome! It really makes you choose your words carefully, right?", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 28 * MIN).toISOString() },
    { id: "c1_3", senderId: "mock_1", receiverId: "me", type: "text", content: "Exactly. I've been studying how constraints boost creativity in UX — this is the same principle applied to communication.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 20 * MIN).toISOString() },
    { id: "c1_4", senderId: "me", receiverId: "mock_1", type: "text", content: "That's a great way to frame it. Less noise, more signal.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 15 * MIN).toISOString() },
    { id: "c1_5", senderId: "mock_1", receiverId: "me", type: "text", content: "The Rule of 7 really changed how I think about messaging!", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 2 * MIN).toISOString() },
  ],
  mock_2: [
    { id: "c2_1", senderId: "me", receiverId: "mock_2", type: "text", content: "Hey Alex, saw your portfolio. The typography work is incredible.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 2 * HR).toISOString() },
    { id: "c2_2", senderId: "mock_2", receiverId: "me", type: "text", content: "Thanks! I've been experimenting with variable fonts lately. Game changer.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 1.5 * HR).toISOString() },
    { id: "c2_3", senderId: "me", receiverId: "mock_2", type: "text", content: "We should collaborate. I have a project that could use your design eye.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 1 * HR).toISOString() },
    { id: "c2_4", senderId: "mock_2", receiverId: "me", type: "text", content: "I'm in! What's the timeline looking like?", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 45 * MIN).toISOString() },
    { id: "c2_5", senderId: "me", receiverId: "mock_2", type: "text", content: "Let's sync on the design project tomorrow", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 15 * MIN).toISOString() },
  ],
  mock_3: [
    { id: "c3_1", senderId: "mock_3", receiverId: "me", type: "text", content: "Konnichiwa! Sending this from a tiny ramen shop in Shibuya.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 3 * HR).toISOString() },
    { id: "c3_2", senderId: "me", receiverId: "mock_3", type: "text", content: "That sounds amazing! How's the travel writing going?", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 2.5 * HR).toISOString() },
    { id: "c3_3", senderId: "mock_3", receiverId: "me", type: "text", content: "I'm writing a piece on hidden Tokyo cafes. The 70-word limit is actually perfect for travel notes!", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 2 * HR).toISOString() },
    { id: "c3_4", senderId: "mock_3", receiverId: "me", type: "text", content: "Just got back from Tokyo — so much to share!", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 45 * MIN).toISOString() },
  ],
  mock_4: [
    { id: "c4_1", senderId: "mock_4", receiverId: "me", type: "text", content: "Have you seen the latest paper on transformer architectures? Mind-blowing stuff.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 5 * HR).toISOString() },
    { id: "c4_2", senderId: "me", receiverId: "mock_4", type: "text", content: "Not yet! Send it over. Also, there's an AI workshop this Saturday — interested?", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 4 * HR).toISOString() },
    { id: "c4_3", senderId: "mock_4", receiverId: "me", type: "text", content: "Absolutely. I'll block the time. Is it the one at the NYU campus?", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 3 * HR).toISOString() },
    { id: "c4_4", senderId: "me", receiverId: "mock_4", type: "text", content: "That's the one! See you there.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 2.5 * HR).toISOString() },
    { id: "c4_5", senderId: "mock_4", receiverId: "me", type: "text", content: "That AI workshop was incredible, thanks for the rec", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 2 * HR).toISOString() },
  ],
  mock_5: [
    { id: "c5_1", senderId: "mock_5", receiverId: "me", type: "text", content: "I read that article on climate data visualization you shared — really well done.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 6 * HR).toISOString() },
    { id: "c5_2", senderId: "me", receiverId: "mock_5", type: "text", content: "Glad you liked it! The author has a whole series on environmental data storytelling.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 5 * HR).toISOString() },
    { id: "c5_3", senderId: "mock_5", receiverId: "me", type: "text", content: "That's exactly what I need for my startup's pitch deck. More sources like that?", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 4 * HR).toISOString() },
    { id: "c5_4", senderId: "me", receiverId: "mock_5", type: "text", content: "Can you send me the link to that article?", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 3 * HR).toISOString() },
  ],
  mock_6: [
    { id: "c6_1", senderId: "me", receiverId: "mock_6", type: "text", content: "Marcus, the rebrand concepts look phenomenal. Your team crushed it.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 8 * HR).toISOString() },
    { id: "c6_2", senderId: "mock_6", receiverId: "me", type: "text", content: "Thanks! We iterated a lot. The constraint of keeping it under 7 words per tagline really sharpened our thinking.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 7 * HR).toISOString() },
    { id: "c6_3", senderId: "me", receiverId: "mock_6", type: "text", content: "Rule of 7 applies everywhere! Let's schedule a follow-up this week.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 6 * HR).toISOString() },
    { id: "c6_4", senderId: "mock_6", receiverId: "me", type: "text", content: "Great meeting today! Looking forward to next steps", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 5 * HR).toISOString() },
  ],
  mock_7: [
    { id: "c7_1", senderId: "mock_7", receiverId: "me", type: "text", content: "Just finished a 20km trail through the Bavarian Alps. The views were unreal.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 12 * HR).toISOString() },
    { id: "c7_2", senderId: "me", receiverId: "mock_7", type: "text", content: "Wow! Did you get any good wildlife shots?", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 11 * HR).toISOString() },
    { id: "c7_3", senderId: "mock_7", receiverId: "me", type: "text", content: "A red deer at golden hour — might be my best photo ever. Sending it when I'm back on Wi-Fi!", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 10 * HR).toISOString() },
    { id: "c7_4", senderId: "me", receiverId: "mock_7", type: "text", content: "The sunset photos from your hike are stunning", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 8 * HR).toISOString() },
  ],
  mock_8: [
    { id: "c8_1", senderId: "mock_8", receiverId: "me", type: "text", content: "Check out this mechanical keyboard I just built — Cherry MX Browns with custom keycaps.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 18 * HR).toISOString() },
    { id: "c8_2", senderId: "me", receiverId: "mock_8", type: "text", content: "That looks incredible! How long did the build take?", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 16 * HR).toISOString() },
    { id: "c8_3", senderId: "mock_8", receiverId: "me", type: "text", content: "About 6 hours including the soldering. Worth every minute.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 14 * HR).toISOString() },
    { id: "c8_4", senderId: "mock_8", receiverId: "me", type: "voice", content: null, mediaUrls: null, durationSeconds: 15, createdAt: new Date(NOW - 12 * HR).toISOString() },
  ],
  mock_9: [
    { id: "c9_1", senderId: "me", receiverId: "mock_9", type: "text", content: "Amara! How's the maternal health project going in Lagos?", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 36 * HR).toISOString() },
    { id: "c9_2", senderId: "mock_9", receiverId: "me", type: "text", content: "Making progress! We just partnered with 3 new clinics. Data collection starts next month.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 32 * HR).toISOString() },
    { id: "c9_3", senderId: "me", receiverId: "mock_9", type: "text", content: "That's amazing. You're making a real difference. Also — happy birthday!", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 26 * HR).toISOString() },
    { id: "c9_4", senderId: "me", receiverId: "mock_9", type: "text", content: "Happy birthday! Hope you have an amazing day", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 24 * HR).toISOString() },
  ],
  mock_10: [
    { id: "c10_1", senderId: "mock_10", receiverId: "me", type: "text", content: "I just roasted a single-origin Ethiopian Yirgacheffe. The floral notes are wild.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 60 * HR).toISOString() },
    { id: "c10_2", senderId: "me", receiverId: "mock_10", type: "text", content: "You're making me jealous. I need to visit Kyoto and try your roasts!", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 55 * HR).toISOString() },
    { id: "c10_3", senderId: "mock_10", receiverId: "me", type: "text", content: "Door's always open. I also found a new spot that does pour-over with ceramics I made.", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 50 * HR).toISOString() },
    { id: "c10_4", senderId: "mock_10", receiverId: "me", type: "text", content: "That new coffee spot on 5th is a must-try", mediaUrls: null, durationSeconds: null, createdAt: new Date(NOW - 48 * HR).toISOString() },
  ],
};
