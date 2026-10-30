/* ---------- Simulated people ---------- */

import { L } from '../shared/i18n.js?v=20261030e';


export const PEOPLE = [
  {
    id: 'p1', alias: 'Mochi', city: 'Taipei', country: 'Taiwan', field: 'Design',
    doing: 'An inventory tool for independent bookstores',
    topics: ['Bookstores', 'Pricing', 'Interviews'],
    fun: 'Has visited 140 independent bookstores across Taiwan.',
    real: { name: 'Yen Shu-Wei', school: 'National Cheng Kung University, Industrial Design', company: 'Logistics startup, 12 people', title: 'Product designer', linkedin: 'linkedin.com/in/shuwei-yen' },
    lines: ['Interesting. How did you get started on it?', 'I interviewed a dozen bookstore owners. What they dread most is stock counting.', 'Which part are you most stuck on right now?', 'If you like, I can send you my interview guide.'],
    take: 'In my experience, talking to three people face to face beats a hundred survey replies.',
    pitch: 'I have run user interviews from scratch twice. I can help you ask the right questions.',
  },
  {
    id: 'p2', alias: 'Kite', city: 'Berlin', country: 'Germany', field: 'Engineering',
    doing: 'An open-source tool that maps bike-lane gaps from GPS traces',
    topics: ['Open data', 'Cities', 'Rust'],
    fun: 'Bikes 40 km to work, even in winter.',
    real: { name: 'Jonas Albrecht', school: 'TU Berlin, Computer Science', company: 'Mobility startup, 40 people', title: 'Backend engineer', linkedin: 'linkedin.com/in/jonas-albrecht' },
    lines: ['Interesting. What made you start on that?', "Here it's the opposite: the city has the data but nobody is allowed to use it.", 'How are you testing whether people actually want it?', "I'd love to see what you have so far, even if it's rough."],
    take: 'I would flip the question: who loses something if this works? Talk to them first.',
    pitch: 'I can build the data side in a weekend. I mostly want to learn how you find users.',
  },
  {
    id: 'p3', alias: 'Sol', city: 'Lagos', country: 'Nigeria', field: 'Founder',
    doing: 'A savings app for market traders who get paid daily',
    topics: ['Fintech', 'Informal markets', 'Distribution'],
    fun: 'Sold handmade soap at the market at age 12.',
    real: { name: 'Adaeze Okonkwo', school: 'University of Lagos, Economics', company: 'Her own startup', title: 'Co-founder', linkedin: 'linkedin.com/in/adaeze-okonkwo' },
    lines: ["That sounds familiar. Our traders don't trust anything that asks for a password.", "What's the hardest part for you right now?", 'We got our first 50 users by standing in the market for a week. Nothing clever.', 'If you want, I can share how we run agent onboarding.'],
    take: 'In my market this fails for one reason: trust. Who vouches for you on day one?',
    pitch: 'I know distribution in places where ads do not work. Happy to trade notes.',
  },
  {
    id: 'p4', alias: 'Nori', city: 'Seoul', country: 'South Korea', field: 'Content',
    doing: 'A newsletter about small factories in Asia',
    topics: ['Manufacturing', 'Writing', 'Community'],
    fun: 'Writes every first draft on a typewriter.',
    real: { name: 'Han Seo-yeon', school: 'Yonsei University, Sociology', company: 'Freelance', title: 'Writer', linkedin: 'linkedin.com/in/seoyeon-han' },
    lines: ['Oh nice. Who is this for, exactly?', "I've interviewed about thirty factory owners. Most said nobody had ever asked.", 'What would make you pay for something like this yourself?', 'Happy to read a draft if you have one.'],
    take: 'Write down the story of one real person who has this problem. It clears things up fast.',
    pitch: 'I can write the story of the project so strangers get it in ten seconds.',
  },
  {
    id: 'p5', alias: 'Pim', city: 'Taipei', country: 'Taiwan', field: 'Research',
    doing: 'Measuring indoor air in old apartments with cheap sensors',
    topics: ['Air quality', 'Sensors', 'Housing'],
    fun: 'Keeps a sensor in the fridge, just to see.',
    real: { name: 'Tsou Ting-An', school: 'National Tsing Hua University, MSc Environmental Engineering', company: 'University lab', title: 'Research assistant', linkedin: 'linkedin.com/in/tingan-tsou' },
    lines: ['I see. Whose problem are you trying to solve?', 'I measured twenty-some old apartments. The kitchen numbers were worse than I expected.', 'Have you tried showing it to users directly?', 'I can share the data. I just really cannot build interfaces.'],
    take: 'I would check for existing data first. Many questions were already measured, just never organized.',
    pitch: 'I can help with data and experiment design. I want to learn how research becomes a product.',
  },
  {
    id: 'p6', alias: 'Rue', city: 'São Paulo', country: 'Brazil', field: 'Design',
    doing: 'A booking tool for independent tattoo artists',
    topics: ['Branding', 'Creators', 'Mobile'],
    fun: 'Has drawn over 300 tattoo designs and has no tattoos.',
    real: { name: 'Beatriz Nogueira', school: 'Universidade de São Paulo, Design', company: 'Design studio, 8 people', title: 'Brand designer', linkedin: 'linkedin.com/in/beatriz-nogueira' },
    lines: ['Love that. How did you find your first users?', "Tattoo artists here take bookings over Instagram DMs. It's chaos.", 'What does it look like today? A sketch is fine.', 'Payments are the part that scares me. Have you dealt with that?'],
    take: 'Show it to people before it looks good. Ugly prototypes get more honest answers.',
    pitch: 'I can make it look and feel right. I need someone to argue with about scope.',
  },
  {
    id: 'p7', alias: 'Tavi', city: 'Bangalore', country: 'India', field: 'Engineering',
    doing: 'Turning voice notes into structured records for small clinics',
    topics: ['Health', 'Speech', 'ML'],
    fun: 'Can recite pi to 80 digits.',
    real: { name: 'Karthik Venkataraman', school: 'IISc Bangalore, MTech', company: 'Health-tech company', title: 'ML engineer', linkedin: 'linkedin.com/in/karthik-venkataraman' },
    lines: ['Got it. What does a normal day of using it look like?', 'Small clinics here write everything by hand, then type it again at night.', "What have you tried that didn't work?", 'I can share the on-device setup if that is useful.'],
    take: 'Measure the boring thing first: how many minutes does this save one person per day?',
    pitch: 'I can handle the ML part. I am looking for people who question my assumptions.',
  },
  {
    id: 'p8', alias: 'Ode', city: 'Taichung', country: 'Taiwan', field: 'Business',
    doing: "Selling small farms' surplus produce to restaurants",
    topics: ['Farming', 'Sales channels', 'Logistics'],
    fun: 'Can tell how sweet a mango is by smell.',
    real: { name: 'Lai Po-Jui', school: 'Tunghai University, International Business', company: 'Family produce wholesaler', title: 'Second-generation successor', linkedin: 'linkedin.com/in/pojui-lai' },
    lines: ['Sounds good. How far along are you?', 'Restaurants are happy to buy. Nobody helps them put a full order together.', 'Is the hard part the tech, or finding people willing to try it?', 'I can take you to the market once. It makes more sense when you see it.'],
    take: 'Ask whether anyone would pay. One person paying three dollars matters more than a hundred saying it is great.',
    pitch: 'I know sales channels and price negotiation. I need someone who can turn the process into a system.',
  },
];
export const P = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));

// Explore is a forum. Each post sits in a topic, has an age in minutes, and a few public comments.
export const CATEGORIES = [
  ['tech', 'Tech'],
  ['startups', 'Startups'],
  ['design', 'Design'],
  ['science', 'Science & research'],
  ['society', 'Society & cities'],
  ['creative', 'Writing & creative'],
  ['career', 'Work & career'],
  ['other', 'Other'],
];
export const catName = (k) => L((CATEGORIES.find(([v]) => v === k) || CATEGORIES[1])[1]);

export const SEED_THOUGHTS = [
  {
    id: 't1', by: 'p2', cat: 'society', ago: 190,
    text: 'If a city gives away its data for free, who should be responsible when someone builds something harmful with it?',
    comments: [
      { by: 'p5', ago: 150, text: 'Researchers ask this too. We publish our air data and still worry about how it gets used.' },
      { by: 'p3', ago: 95, text: 'Whoever sells a product built on it should carry the risk, not the city.' },
    ],
  },
  {
    id: 't2', by: 'p5', cat: 'science', ago: 420,
    text: 'Everyone says "build what users want". But as a researcher, how do I even know who my user is?',
    comments: [
      { by: 'p1', ago: 380, text: 'Find the person who is annoyed enough to email you twice. That is your user.' },
      { by: 'p7', ago: 300, text: 'Run one small pilot. The first person who asks to keep using it is your user.' },
    ],
  },
  {
    id: 't3', by: 'p4', cat: 'creative', ago: 75,
    text: 'Is a newsletter a product or a habit? I cannot tell which one I am building.',
    comments: [
      { by: 'p6', ago: 40, text: 'If people miss it when it is late, it is a habit. If they pay to keep it, it is a product.' },
    ],
  },
  {
    id: 't4', by: 'p8', cat: 'career', ago: 1500,
    text: 'If you took over a family business, how did you convince your parents to let you try something new?',
    comments: [
      { by: 'p3', ago: 1320, text: 'I showed my parents numbers from a small test first. Arguments did not work, results did.' },
    ],
  },
  {
    id: 't5', by: 'p3', cat: 'startups', ago: 260,
    text: 'What is one thing that works in your city that would never work in mine? I am collecting examples.',
    comments: [
      { by: 'p8', ago: 210, text: 'Cash on delivery. Everyone told me online prepayment would win here. It did not.' },
      { by: 'p2', ago: 120, text: 'Bike sharing without docks. Great in one city, chaos in the next.' },
    ],
  },
  {
    id: 't6', by: 'p6', cat: 'design', ago: 30,
    text: 'Designers: when did you last change your mind because an engineer was right?',
    comments: [
      { by: 'p7', ago: 12, text: 'Last week. The engineer showed the design would break on slow phones.' },
    ],
  },
  {
    id: 't7', by: 'p7', cat: 'tech', ago: 600,
    text: 'Is running AI on the device worth the pain for a small team, or should we just use the cloud?',
    comments: [
      { by: 'p2', ago: 560, text: 'Cloud first. Move only the part users actually notice onto the device.' },
    ],
  },
  {
    id: 't8', by: 'p1', cat: 'startups', ago: 900,
    text: 'How do you price a tool for tiny shops that already think software is too expensive?',
    comments: [
      { by: 'p3', ago: 840, text: 'Charge per week, not per month. Small shops think in weeks.' },
    ],
  },
];

// Brew posts: what kind of project, and the roles it needs. The author ticks a role off once it is filled.
export const BREW_KINDS = [
  ['competition', 'Competition'],
  ['hackathon', 'Hackathon'],
  ['startup', 'Startup'],
  ['side', 'Side project'],
  ['research', 'Research'],
  ['course', 'Course project'],
  ['other', 'Other'],
];
export const kindName = (k) => L((BREW_KINDS.find(([v]) => v === k) || BREW_KINDS[6])[1]);
export const hasEvent = (k) => k === 'competition' || k === 'hackathon';
export const ROLE_SUGGESTIONS = ['Frontend developer', 'Backend developer', 'Designer', 'Product manager', 'Data analyst', 'Researcher', 'Marketer', 'Writer', 'Pitch presenter'];
export const MAX_ROLES = 6;

export const SEED_POSTS = [
  {
    id: 'b5', by: 'p5', kind: 'hackathon', event: 'Taipei Climate Hackathon', deadline: '2026-11-28',
    title: 'Joining a climate hackathon with our indoor air data. Need two more people.',
    roles: [{ name: 'Frontend developer', desc: 'Turn our air data into a simple map people can read in 30 seconds.', filled: false }, { name: 'Designer', desc: 'Make the demo and slides clear on a projector.', filled: false }, { name: 'Data analyst', desc: 'Clean the readings and find the three most surprising numbers.', filled: true }],
    offer: 'Real sensor data from 23 homes', duration: 'Two weekends',
  },
  {
    id: 'b1', by: 'p1', kind: 'side',
    title: 'Building a checker for second-hand cameras.',
    roles: [{ name: 'Hardware sourcing expert', desc: 'Know where camera parts come from and what a fair price looks like.', filled: false }, { name: 'Inspection process expert', desc: 'Design a 10-minute check that sellers can follow.', filled: true }],
    offer: 'Front-end development and a list of 40 sellers', duration: 'Six-week project',
  },
  {
    id: 'b2', by: 'p7', kind: 'startup',
    title: 'Making clinic software that nurses do not hate.',
    roles: [{ name: 'Designer', desc: 'Design screens a nurse can use with one hand during a busy shift.', filled: false }],
    offer: 'A working speech model and three clinics to test in', duration: 'Two-week sprint',
  },
  {
    id: 'b6', by: 'p4', kind: 'competition', event: 'Asia Story Prize', deadline: '2026-12-15',
    title: 'Entering a nonfiction prize with a story about one factory family.',
    roles: [{ name: 'Photographer', desc: 'Spend two days in the factory and photograph the family at work.', filled: false }, { name: 'Editor', desc: 'Tighten the story to 5,000 words.', filled: true }],
    duration: 'Six weeks',
  },
  {
    id: 'b3', by: 'p3', kind: 'startup',
    title: 'Need someone to challenge my pricing before I launch in a second city.',
    roles: [{ name: 'Pricing reviewer', desc: 'Look at our numbers and tell us what you would charge, and why.', filled: false }],
    offer: 'Real numbers from 1,300 users', duration: 'One or two calls',
  },
  {
    id: 'b4', by: 'p8', kind: 'startup',
    title: 'Building a produce ordering system for restaurants.',
    roles: [{ name: 'Backend developer', desc: 'Build the back office where orders come in.', filled: true }, { name: 'Chat bot developer', desc: 'Let restaurants order through a chat app in a few taps.', filled: false }],
    offer: '9 restaurant customers and real daily orders', duration: 'Two months, revenue share is possible',
  },
];

// Older saved posts had a single "need" line instead of roles
export const rolesOf = (b) => b.roles || (b.need ? [{ name: b.need, filled: false }] : []);
export const openRoles = (b) => rolesOf(b).filter((r) => !r.filled);
