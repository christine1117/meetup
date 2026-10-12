/* =========================================================
   Interface language: English or Traditional Chinese.
   Write interface text in English as L`...` (or L('...')).
   Values inside ${...} become {0}, {1}... in the key, and the
   Chinese line below can place them anywhere.
   A key with no Chinese line falls back to English.
   ========================================================= */

const LANG_KEY = 'halfsugar.lang';

let LANG = (() => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {
    /* Storage is unavailable. Use the browser language. */
  }
  return /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
})();

function setLang(lang) {
  LANG = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* The choice just will not be remembered next visit. */
  }
}

function tr(key, vals = []) {
  const tpl = (LANG === 'zh' && ZH[key]) || key;
  return String(tpl).replace(/\{(\d+)\}/g, (_, i) => vals[i] ?? '');
}

function L(strings, ...vals) {
  if (typeof strings === 'string') return tr(strings);
  const key = strings.reduce((out, s, i) => out + (i ? `{${i - 1}}` : '') + s, '');
  return tr(key, vals);
}

const ZH = {
  // Fields and flavors
  Design: '設計',
  Engineering: '工程',
  Founder: '創業',
  Research: '研究',
  Content: '內容創作',
  Business: '商業',
  Other: '其他',
  Taro: '芋頭',
  Matcha: '抹茶',
  'Brown sugar': '黑糖',
  Oolong: '烏龍',
  Strawberry: '草莓',
  Mango: '芒果',
  'Classic milk tea': '經典奶茶',
  '{0} milk tea': '{0}奶茶',
  '{0}, {1}': '{0}，{1}',

  // Navigation
  Explore: '探索',
  Brew: '一起煮',
  'Mystery Cup': '神秘杯',
  Chats: '聊天',
  'My order': '我的點單',
  'Browse ideas': '看大家在想什麼',
  'Build together': '一起做點東西',
  'Weekly surprise match': '每週驚喜配對',
  'Your conversations': '你的對話',
  'Your profile': '你的個人資料',
  'Half Sugar home': 'Half Sugar 首頁',
  Main: '主選單',
  'What is Half Sugar?': 'Half Sugar 是什麼？',
  'Switch language': '切換語言',

  // Sugar and time limits
  'Sugar goes up the longer you talk. Every minute adds 5%.': '聊越久越甜。每聊一分鐘加 5%。',
  '{0}% sugar': '甜度 {0}%',
  'Closes in {0}d without a reply': '{0} 天內沒人回就會關閉',
  'Closes in {0}h without a reply': '{0} 小時內沒人回就會關閉',
  'Half sugar! You can pop the seal now.': '半糖了！現在可以戳破封膜。',
  'Full sugar. Maybe it is time for a boba run?': '全糖了。要不要約出來喝杯珍奶？',

  // Small pieces
  'In person': '線下',
  Online: '線上',
  'small group': '小組',
  '1-on-1': '一對一',
  Flavor: '口味',
  'Working on': '正在做',
  'Proof of work': '做過的成果',
  'Flavor = field. {0} means {1}.': '口味代表領域。{0}就是{1}。',

  // Toasts and chat notes
  '{0} accepted your response': '{0} 接受了你的回應',
  'They accepted. Take your first sip.': '對方接受了。喝下第一口吧。',
  'You both popped the seal. Identities are unlocked.': '你們都戳破了封膜，身份已解鎖。',
  'Seal popped': '封膜戳破了',
  'Someone responded to your thought': '有人回應了你的想法',
  'Someone applied to your post': '有人匿名申請了你的需求',
  'You responded to this thought: "{0}"': '你回應了這個想法：「{0}」',
  'You applied anonymously to this post: "{0}"': '你匿名申請了這個需求：「{0}」',
  'They responded to your thought: "{0}"': '對方回應了你的想法：「{0}」',
  'They applied anonymously to your post: "{0}"': '對方匿名申請了你的需求：「{0}」',
  'You popped your seal. Waiting for them.': '你戳破了你的封膜，等對方。',
  'You suggested a boba run.': '你提議約出去喝珍奶。',
  Saved: '已儲存',
  'Call room opened in a new tab': '已在新分頁開啟通話房間',

  // Profile
  'Visible from the start': '一開始就看得到',
  Nickname: '暱稱',
  'Not your real name.': '不要用真名。',
  City: '城市',
  'e.g. Taipei': '例如：台北',
  'Field (your flavor)': '領域（你的口味）',
  'Your flavor is your field. It sets the colour of your cup.': '你的口味就是你的領域，會決定你杯子的顏色。',
  "What I'm working on": '我正在做什麼',
  'e.g. A sign-up system for a community college': '例如：幫社區大學做報名系統',
  'Topics I can talk deeply about': '我能深聊的主題',
  'Separate with commas.': '用逗號分開。',
  'Something you built or achieved': '你做過的東西或成果',
  'Sealed until you both pop the seal': '封起來，雙方都戳破封膜才解鎖',
  '“Pop the seal” means showing your real profile. It only happens when both people agree.': '「戳破封膜」就是公開你的真實資料，雙方都同意才會發生。',
  'Real name': '真實姓名',
  'Job title': '職稱',
  School: '學校',
  Company: '公司',
  "Please add a nickname and what you're working on.": '請填暱稱和「我正在做什麼」。',
  'Start sipping': '開始喝',
  'Save my order': '儲存點單',

  // Onboarding and My order
  'Boba chat, not coffee chat.': '不是 coffee chat，是 boba chat。',
  'Meet the person before the résumé. Fill in your order to start. People see the top half. The bottom half stays sealed until you both pop the seal.': '先認識人，再看履歷。填好你的點單就能開始。上半部別人看得到，下半部會先封起來，直到你們都戳破封膜。',
  'New here? Read what Half Sugar is and what the boba words mean.': '第一次來？看看 Half Sugar 是什麼，還有這些珍奶用語的意思。',
  'Your usual. Change it any time.': '你的固定點法，隨時可以改。',
  'Your order is your profile. It shows what you are working on, never your titles.': '你的點單就是你的個人資料。上面寫你正在做什麼，不寫頭銜。',
  'Your usual': '你的固定點法',
  'For {0}. Sugar goes up in each chat the longer you talk.': '給 {0}。每段聊天都是聊越久越甜。',
  'Demo mode': '示範模式',
  'This is not connected to a server yet. Your data stays in this browser, the other people are simulated, and their replies are pre-written. Bookings and notifications are not really sent.': '現在還沒連到伺服器。你的資料只存在這個瀏覽器，其他人是模擬的，回覆是預先寫好的。訂位和通知不會真的送出。',
  'Yes, clear it': '確定清除',
  Cancel: '取消',
  'Clear all data': '清除所有資料',

  // Explore
  'No more responses for now.': '目前沒有更多回應。',
  'Waiting for responses': '等人回應中',
  'Accept, first sip': '接受，喝第一口',
  Skip: '略過',
  'I want to meet someone.': '我想認識新的人。',
  'Browse what people are thinking about. Reply with your view to start a chat.': '看看大家在想什麼。用你的觀點回應，就能開始聊天。',
  'Share a thought': '丟一個想法',
  'Your thought or question': '你的想法或問題',
  'Something you have been turning over lately': '最近一直在想的事',
  'How to meet': '見面方式',
  'How many people': '人數',
  'Small group': '小組',
  Post: '送出',
  'Your thoughts': '你的想法',
  Filters: '篩選',
  'Online or in person': '線上或線下',
  'Any format': '不限方式',
  'Group size': '人數',
  'Any size': '不限人數',
  'All cities': '所有城市',
  Field: '領域',
  'All fields': '所有領域',
  'Responded. Open chat': '已回應，打開聊天',
  'Your perspective': '你的觀點',
  'They see your response and your card, not your titles': '對方只看得到你的回應和卡片，看不到頭銜',
  'Send response': '送出回應',
  Respond: '回應',
  'Nothing matches. Change the filters, or share a thought of your own.': '沒有符合的想法。換個篩選條件，或自己丟一個。',

  // Brew
  'I need someone for something.': '我需要人一起做點事。',
  'Brew means building something together. Post what you need, or apply to a post without showing your titles.': '「一起煮」就是一起做東西。貼出你需要什麼，或不露頭銜地申請別人的需求。',
  'Start a brew': '開一鍋',
  'What you are building and who you are looking for': '你在做什麼、想找誰',
  'e.g. Building a shared-kitchen platform, looking for someone who knows food regulation': '例如：在做共享廚房平台，想找懂食品法規的人',
  'I need': '我需要',
  'I can offer': '我能提供',
  Time: '時間',
  'e.g. One call, a four-week project': '例如：一次通話、四週的專案',
  'Your brews': '你開的鍋',
  Needs: '需要',
  Offers: '能提供',
  'Applied. Open chat': '已申請，打開聊天',
  'Why you are a fit': '為什麼你適合',
  'Say what you would bring. They cannot see your titles': '說說你能帶來什麼。對方看不到你的頭銜',
  'Send anonymously': '匿名送出',
  'Apply anonymously': '匿名申請',

  // Mystery Cup
  '{0}d {1}:{2}:{3}': '{0} 天 {1}:{2}:{3}',
  'They are typing': '對方正在輸入',
  'Shaking your mystery cup': '正在搖你的神秘杯',
  'Someone in a different city and a different field.': '一個不同城市、不同領域的人。',
  'Someone in {0}': '一位在 {0} 的人',
  'Field: {0}. That is all you know.': '領域：{0}。你只知道這些。',
  'End chat': '結束對話',
  Message: '訊息',
  'Say something': '說點什麼',
  Send: '送出',
  "Cup's empty. Want a refill?": '杯子空了。要續杯嗎？',
  'Refill means you keep talking and your real profiles are revealed. It only happens if you both choose it. If either of you says no, this cup disappears.': '續杯就是繼續聊，並且公開彼此的真實資料。雙方都選才會發生。只要一方說不，這杯就會消失。',
  'Waiting for them to decide': '等對方決定',
  Refill: '續杯',
  "I'm good": '不用了',
  'You both want a refill.': '你們都想續杯。',
  'You were talking to {0}, {1}.': '你剛剛聊的是 {0}，{1}。',
  'Back to Mystery Cup': '回到神秘杯',
  'This cup is gone.': '這杯消失了。',
  'You chose not to refill.': '你選擇不續杯。',
  'They passed on a refill this time. Say a bit more next time and your odds go up.': '對方這次沒有續杯。下次多聊幾句，機會比較大。',
  'You can’t pick the flavor.': '不能挑口味。',
  'A Mystery Cup is a surprise match. Once a week, everyone joins at the same time and gets paired with someone from a different city and field.': '神秘杯是驚喜配對。每週一次，大家同時加入，跟一個不同城市、不同領域的人配在一起。',
  'Mystery Cup is open': '神秘杯開放中',
  'Join now': '現在加入',
  'Next Mystery Cup in': '距離下一杯神秘杯',
  '{0} your time. Open for 10 minutes.': '你的時間{0}。只開放 10 分鐘。',
  'Pour me one': '給我一杯',
  'Try a practice cup': '先試喝一杯',
  'No picking flavors': '不能挑口味',
  'We pour you someone from a different city and field.': '我們幫你倒一個不同城市、不同領域的人。',
  '8 minutes': '8 分鐘',
  'Text only. When time is up, it ends.': '只用文字。時間到就結束。',
  'Refill only if you both want one': '雙方都想要才續杯',
  'Otherwise the cup disappears.': '不然這杯就消失。',
  'You have had 1 mystery cup.': '你已經喝過 1 杯神秘杯。',
  'You have had {0} mystery cups.': '你已經喝過 {0} 杯神秘杯。',
  'Your first sip lasts 8 minutes. Start by asking what they are busy with.': '第一口有 8 分鐘。先問問對方最近在忙什麼。',
  'You met over a Mystery Cup and both chose a refill. The seal is popped.': '你們在神秘杯認識，雙方都選了續杯。封膜已經戳破。',

  // Chats
  'Every chat starts with a first sip.': '每段對話都從第一口開始。',
  'Sugar goes up the longer you talk. At half sugar (50%) you can pop the seal. A chat goes cold and closes if nobody replies for 3 days.': '聊越久越甜。到半糖（50%）就能戳破封膜。3 天沒人回，聊天會涼掉並關閉。',
  'went cold': '涼掉了',
  ', waiting for them to accept': '，等對方接受',
  '{0} unread': '{0} 則未讀',
  'No cups yet.': '還沒有任何一杯。',
  'Respond to a thought': '回應一個想法',
  'Try a Mystery Cup': '試試神秘杯',
  Sealed: '封膜中',
  'Back to chats': '回到聊天',
  Call: '通話',
  'Boba run': '珍奶約',
  'Waiting for them to pop': '等對方戳破',
  'Pop the seal': '戳破封膜',
  'Pop the seal at {0}%': '{0}% 才能戳破封膜',
  'You both popped the seal, so real names and profiles are visible. The chat closes if nobody replies for {0} days.': '你們都戳破了封膜，可以看到真實姓名和資料。{0} 天沒人回，聊天就會關閉。',
  'Names are still hidden. Sugar goes up the longer you talk: 10 minutes of chatting is half sugar (50%), and then you can pop the seal if you both agree. The chat closes if nobody replies for {0} days. “Boba run” means meeting in person.': '名字還藏著。聊越久越甜：聊 10 分鐘就是半糖（50%），雙方同意就能戳破封膜。{0} 天沒人回，聊天就會關閉。「珍奶約」就是約出來見面。',
  'Their full card': '對方的完整卡片',
  'Their card': '對方的卡片',
  Name: '姓名',
  'Go on a boba run': '約去喝珍奶',
  'A boba run means meeting in person, at a boba shop or a café.': '珍奶約就是約出來見面，在珍奶店或咖啡廳。',
  Type: '類型',
  'Boba shop, 1-on-1': '珍奶店一對一',
  Café: '咖啡廳',
  'Small dinner table': '小型晚餐桌',
  Area: '地區',
  "e.g. Taipei, Da'an": '例如：台北 大安區',
  Date: '日期',
  'Demo mode: this is saved in the chat, but no table is really booked.': '示範模式：會記在聊天裡，但不會真的訂位。',
  'Please add an area and a date.': '請填地區和日期。',
  'Send invite': '送出邀請',
  'This cup went cold. Nobody replied for {0} days, so the chat closed.': '這杯涼掉了。{0} 天沒人回，聊天已關閉。',
  'Waiting for them to accept your response': '等對方接受你的回應',
  '{0}, {1}. {2}, {3}': '{0} {1}，{2}，{3}',

  // About and the menu of boba words
  Sugar: '甜度',
  'First Sip': '第一口',
  'Gone cold': '涼掉了',
  'Your profile. It shows what you are working on, never your titles.': '你的個人資料。寫你正在做什麼，不寫頭銜。',
  'Your field. Each field is a boba flavor and sets the colour of your cup.': '你的領域。每個領域是一種口味，決定你杯子的顏色。',
  'How long you two have talked. Every minute adds 5%, so 10 minutes is half sugar (50%), when you can pop the seal. Long pauses do not count.': '你們聊了多久。每分鐘加 5%，聊 10 分鐘就是半糖（50%），可以戳破封膜。停很久不算。',
  'Browse open thoughts and questions. Reply with your view to start talking.': '看看大家丟出的想法和問題，用你的觀點回應就能開始聊。',
  'Build something together. Post what you need, or apply to a post without showing your titles.': '一起做東西。貼出你需要什麼，或不露頭銜地申請別人的需求。',
  'A surprise match once a week. Everyone joins at the same time and you cannot pick who you get.': '每週一次的驚喜配對。大家同時加入，你不能挑對象。',
  'Your first conversation with someone. Real names are still hidden.': '跟一個人的第一段對話。真實姓名還藏著。',
  'Show your real name, school, company and title. It only happens when both of you press it.': '公開你的真名、學校、公司和職稱。雙方都按才會發生。',
  'At the end of a Mystery Cup, you both choose Refill to keep talking.': '神秘杯結束時，雙方都選續杯，就能繼續聊。',
  'A chat closes if nobody replies for 3 days.': '3 天沒人回，聊天就會關閉。',
  'Meet in person, at a boba shop or a café.': '約出來見面，在珍奶店或咖啡廳。',
  'Back to Explore': '回到探索',
  'Half Sugar is a place to meet people by talking first. Schools, companies and job titles stay hidden until you both want to share them.': 'Half Sugar 是一個先聊天、再認識人的地方。學校、公司和職稱都先藏起來，等你們都想分享才公開。',
  'Why we built it': '為什麼做這個',
  'Networking today leans on résumés. People decide whether you are worth talking to before you say a word. So networking turns into a performance, people from different fields rarely meet, and lots of online matches never become a real conversation.': '現在的 networking 太依賴履歷。你還沒開口，別人就先決定你值不值得聊。於是交流變成表演，不同領域的人很少真的認識，很多線上配對也從來沒變成真正的對話。',
  'Why boba': '為什麼是珍奶',
  'A coffee chat sounds like a meeting. Grabbing boba sounds like hanging out with a friend. We want that second feeling, because good collaborations often start in relaxed conversations.': 'Coffee chat 聽起來像開會，約喝珍奶聽起來像跟朋友出去。我們想要第二種感覺，因為好的合作常常從輕鬆的聊天開始。',
  'Why half sugar': '為什麼是半糖',
  'Not too sweet, not too serious. Half sugar is the order for people who want balance: less performing, and still something real to take home. It is also the moment a chat reaches 50%, when you can finally see who you have been talking to.': '不要太甜，也不要太嚴肅。半糖是想要剛剛好的人點的：少一點表演，還是能帶走真正的收穫。半糖也是聊天到 50% 的那一刻，你終於能看到對方是誰。',
  'How it works': '怎麼用',
  'Fill in your order.': '填好你的點單。',
  'Say what you are working on. Your titles stay sealed.': '寫你正在做什麼，頭銜先封起來。',
  'Take a first sip.': '喝第一口。',
  'Reply to a thought in Explore, apply to a Brew, or join the weekly Mystery Cup.': '在探索回應一個想法、申請別人開的鍋，或加入每週的神秘杯。',
  'Reach half sugar, then pop the seal.': '聊到半糖，再戳破封膜。',
  'Sugar goes up as you talk. At 50%, if you both want to, show each other who you are.': '聊越久越甜。到 50% 時，如果你們都想，就讓彼此知道你是誰。',
  'Keep it warm.': '別讓它涼掉。',
  'Keep talking, build something, or go on a boba run and meet in person. A chat goes cold after 3 days with no reply.': '繼續聊、一起做東西，或約出去喝珍奶。3 天沒人回，聊天就會涼掉。',
  'The menu': '菜單',
  'What our boba words mean.': '這些珍奶用語的意思。',
  Flavors: '口味',
  'Conversation before credentials.': '先對話，再看資歷。',
  'Meet the person before the résumé.': '先認識人，再看履歷。',
};
