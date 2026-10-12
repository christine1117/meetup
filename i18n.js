/* =========================================================
   Interface language: English or Traditional Chinese.
   Write interface text in English as L`...` (or L('...')).
   Values inside ${...} become {0}, {1}... in the key, and the
   Chinese line below can place them anywhere.
   A key with no Chinese line stays in English. Slogans and product
   terms are left out on purpose so they always show in English.
   Chinese voice: short and tidy brand copy with a light, playful
   touch. Not chatty, not a manual.
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

// Slogans that stay in English (no Chinese line on purpose):
// Boba chat, not coffee chat. / Meet the person before the résumé. /
// Conversation before credentials. / I want to meet someone. /
// I need someone for something. / You can’t pick the flavor.
// Product terms also stay in English: Explore, Brew, Mystery Cup, My order,
// First Sip, Pop the seal, Refill, Boba run, Gone cold.

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
  '{0}, {1}': '{0}・{1}',
  '{0}. {1}': '{0}・{1}',
  'went cold': 'Gone cold',

  // Navigation
  Chats: '聊天',
  'Browse ideas': '看看大家在想什麼',
  'Build together': '找人一起做事',
  'Weekly surprise match': '每週一次隨機配對',
  'Your conversations': '你的對話',
  'Your profile': '你的個人檔案',
  'Half Sugar home': 'Half Sugar 首頁',
  Main: '主選單',
  'What is Half Sugar?': '認識 Half Sugar',
  'Switch language': '切換語言',

  // Sugar and time limits
  'Sugar goes up the longer you talk. Every minute adds 5%.': '聊越久越甜：每分鐘 +5%',
  '{0}% sugar': '甜度 {0}%',
  'Closes in {0}d without a reply': '{0} 天內無人回覆將關閉',
  'Closes in {0}h without a reply': '{0} 小時內無人回覆將關閉',
  'Half sugar! You can pop the seal now.': '半糖達成，可以 Pop the seal 了。',
  'Full sugar. Maybe it is time for a boba run?': '全糖了。是時候來場 Boba run？',

  // Small pieces
  'In person': '見面',
  Online: '線上',
  'small group': '小團體',
  '1-on-1': '一對一',
  Flavor: '口味',
  'Working on': '正在做',
  'Proof of work': '作品與成果',
  'Flavor = field. {0} means {1}.': '口味即領域：{0}代表{1}',

  // Toasts and chat notes
  '{0} accepted your response': '{0} 接受了你的回應',
  'They accepted. Take your first sip.': '對方接受了。第一口，請。',
  'You both popped the seal. Identities are unlocked.': '雙方都 Pop the seal 了，身份揭曉。',
  'Seal popped': '身份揭曉',
  'Someone responded to your thought': '你的想法有人接話了',
  'Someone applied to your post': '你的 Brew 有人報名',
  'You responded to this thought: "{0}"': '你回應了：「{0}」',
  'You applied anonymously to this post: "{0}"': '你匿名報名了：「{0}」',
  'They responded to your thought: "{0}"': '對方回應了你的想法：「{0}」',
  'They applied anonymously to your post: "{0}"': '對方匿名報名了你的 Brew：「{0}」',
  'You popped your seal. Waiting for them.': '你已 Pop the seal，等對方出手。',
  'You suggested a boba run.': '你發出了 Boba run 邀約。',
  Saved: '已儲存',
  'Call room opened in a new tab': '通話已在新分頁開啟',

  // Profile
  'Visible from the start': '公開資訊',
  Nickname: '暱稱',
  'Not your real name.': '本名先留著。',
  City: '城市',
  'e.g. Taipei': '例：台北',
  'Field (your flavor)': '領域（也是你的口味）',
  'Your flavor is your field. It sets the colour of your cup.': '一個領域一種口味，杯子顏色跟著變。',
  "What I'm working on": '正在做的事',
  'e.g. A sign-up system for a community college': '例：替社區大學做報名系統',
  'Topics I can talk deeply about': '能聊上一整晚的話題',
  'Separate with commas.': '以逗號分隔',
  'Something you built or achieved': '做過的、完成過的',
  'Sealed until you both pop the seal': '封存資訊：雙方都 Pop the seal 才會公開',
  '“Pop the seal” means showing your real profile. It only happens when both people agree.': 'Pop the seal 等於公開真實身份，必須雙方同意。',
  'Real name': '本名',
  'Job title': '職稱',
  School: '學校',
  Company: '公司',
  "Please add a nickname and what you're working on.": '暱稱與「正在做的事」為必填。',
  'Start sipping': '點好了',
  'Save my order': '儲存',

  // Onboarding and My order
  'Meet the person before the résumé. Fill in your order to start. People see the top half. The bottom half stays sealed until you both pop the seal.': '先填一張點單。上半部人人看得到，下半部先封著，等雙方都準備好再揭曉。',
  'New here? Read what Half Sugar is and what the boba words mean.': '第一次來？先認識 Half Sugar',
  'Your usual. Change it any time.': '你的老樣子，隨時可改。',
  'Your order is your profile. It shows what you are working on, never your titles.': 'My order 就是你的個人檔案：只談正在做的事，不談頭銜。',
  'Your usual': '老樣子',
  'For {0}. Sugar goes up in each chat the longer you talk.': '{0} 的專屬點單。甜度，聊了才會加。',
  'Demo mode': '示範模式',
  'This is not connected to a server yet. Your data stays in this browser, the other people are simulated, and their replies are pre-written. Bookings and notifications are not really sent.': '目前尚未連接伺服器。資料只存在這個瀏覽器，其他使用者為模擬角色，回覆皆為預設內容；訂位與通知也不會真的送出。',
  'Yes, clear it': '確定清除',
  Cancel: '取消',
  'Clear all data': '清除所有資料',

  // Explore
  'No more responses for now.': '暫時沒有新回應',
  'Waiting for responses': '等待回應中',
  'Accept, first sip': '接受，開聊',
  Skip: '略過',
  'Browse what people are thinking about. Reply with your view to start a chat.': '看看大家在想什麼。回一句，就開聊。',
  'Share a thought': '丟個想法',
  'Your thought or question': '你的想法或問題',
  'Something you have been turning over lately': '最近一直在腦中打轉的事',
  'How to meet': '聊天方式',
  'How many people': '人數',
  'Small group': '小團體',
  Post: '發佈',
  'Your thoughts': '你丟出的想法',
  Filters: '篩選',
  'Online or in person': '線上或見面',
  'Any format': '不限方式',
  'Group size': '人數',
  'Any size': '不限人數',
  'All cities': '全部城市',
  Field: '領域',
  'All fields': '全部領域',
  'Responded. Open chat': '已回應，前往聊天',
  'Your perspective': '你的觀點',
  'They see your response and your card, not your titles': '對方只會看到你的回應與點單，看不到頭銜',
  'Send response': '送出',
  Respond: '回應',
  'Nothing matches. Change the filters, or share a thought of your own.': '沒有符合的想法。換個條件，或自己丟一個。',

  // Brew
  'Brew means building something together. Post what you need, or apply to a post without showing your titles.': 'Brew，就是一起把事情煮出來。寫下需求，或匿名報名別人的 Brew，頭銜一律免談。',
  'Start a brew': '開一個 Brew',
  'What you are building and who you are looking for': '想做什麼？在找誰？',
  'e.g. Building a shared-kitchen platform, looking for someone who knows food regulation': '例：正在做共享廚房，徵求懂食品法規的人',
  'I need': '需要',
  'I can offer': '可以提供',
  Time: '時程',
  'e.g. One call, a four-week project': '例：一通電話、四週專案',
  'Your brews': '你開的 Brew',
  Needs: '需要',
  Offers: '提供',
  'Applied. Open chat': '已報名，前往聊天',
  'Why you are a fit': '你能帶來什麼',
  'Say what you would bring. They cannot see your titles': '說說你的強項，對方看不到頭銜',
  'Send anonymously': '匿名送出',
  'Apply anonymously': '匿名報名',

  // Mystery Cup
  '{0}d {1}:{2}:{3}': '{0} 天 {1}:{2}:{3}',
  'They are typing': '對方輸入中',
  'Shaking your mystery cup': '搖杯中',
  'Someone in a different city and a different field.': '對方將來自不同城市、不同領域。',
  'Someone in {0}': '來自 {0} 的神秘人',
  'Field: {0}. That is all you know.': '已知線索：{0}領域。其餘保密。',
  'End chat': '結束聊天',
  Message: '訊息',
  'Say something': '說點什麼',
  Send: '送出',
  "Cup's empty. Want a refill?": '喝完了，要 Refill 嗎？',
  'Refill means you keep talking and your real profiles are revealed. It only happens if you both choose it. If either of you says no, this cup disappears.': 'Refill 代表繼續聊，並揭曉彼此身份。雙方都選才成立；只要一方婉拒，這杯就此消失。',
  'Waiting for them to decide': '等待對方決定',
  "I'm good": '先不了',
  'You both want a refill.': '雙方都選了 Refill。',
  'You were talking to {0}, {1}.': '剛才和你聊天的是：{0}，{1}。',
  'Back to Mystery Cup': '回到 Mystery Cup',
  'This cup is gone.': '這杯已消失。',
  'You chose not to refill.': '你選擇不 Refill。',
  'They passed on a refill this time. Say a bit more next time and your odds go up.': '對方這次沒有選 Refill。下次多聊幾句，機率會更高。',
  'A Mystery Cup is a surprise match. Once a week, everyone joins at the same time and gets paired with someone from a different city and field.': 'Mystery Cup 是每週一次的隨機配對：同一時間開放，系統替你配一位不同城市、不同領域的人。',
  'Mystery Cup is open': 'Mystery Cup 開放中',
  'Join now': '立即加入',
  'Next Mystery Cup in': '下一杯 Mystery Cup',
  '{0} your time. Open for 10 minutes.': '你的時間 {0}，限時 10 分鐘。',
  'Pour me one': '來一杯',
  'Try a practice cup': '先試喝一杯',
  'No picking flavors': '口味不能挑',
  'We pour you someone from a different city and field.': '系統為你配一位不同城市、不同領域的人。',
  '8 minutes': '8 分鐘',
  'Text only. When time is up, it ends.': '純文字聊天，時間到即結束。',
  'Refill only if you both want one': '雙方同意才 Refill',
  'Otherwise the cup disappears.': '否則這杯就此消失。',
  'You have had 1 mystery cup.': '已喝過 1 杯 Mystery Cup',
  'You have had {0} mystery cups.': '已喝過 {0} 杯 Mystery Cup',
  'Your first sip lasts 8 minutes. Start by asking what they are busy with.': '你們有 8 分鐘。不妨從「最近在忙什麼」開始。',
  'You met over a Mystery Cup and both chose a refill. The seal is popped.': '你們在 Mystery Cup 相遇，雙方都選了 Refill，身份已揭曉。',

  // Chats
  'Every chat starts with a first sip.': '慢慢聊，慢慢甜。',
  'Sugar goes up the longer you talk. At half sugar (50%) you can pop the seal. A chat goes cold and closes if nobody replies for 3 days.': '聊越久越甜。到了半糖（50%）就能 Pop the seal；3 天無人回覆，聊天將自動關閉（Gone cold）。',
  ', waiting for them to accept': '，等待對方接受',
  '{0} unread': '{0} 則未讀',
  'No cups yet.': '還沒有任何一杯。',
  'Respond to a thought': '去回應一個想法',
  'Try a Mystery Cup': '試試 Mystery Cup',
  Sealed: '封存中',
  'Back to chats': '返回聊天列表',
  Call: '通話',
  'Waiting for them to pop': '等待對方',
  'Pop the seal at {0}%': '{0}% 解鎖 Pop the seal',
  'You both popped the seal, so real names and profiles are visible. The chat closes if nobody replies for {0} days.': '雙方都已 Pop the seal，名字與資料皆已公開。{0} 天無人回覆，聊天將自動關閉。',
  'Names are still hidden. Sugar goes up the longer you talk: 10 minutes of chatting is half sugar (50%), and then you can pop the seal if you both agree. The chat closes if nobody replies for {0} days. “Boba run” means meeting in person.': '名字仍在封存中。聊越久越甜，約 10 分鐘可達半糖（50%），雙方同意即可 Pop the seal。{0} 天無人回覆，聊天將自動關閉。Boba run＝約出來見面。',
  'Their full card': '對方的完整點單',
  'Their card': '對方的點單',
  Name: '名字',
  'Go on a boba run': '來場 Boba run',
  'A boba run means meeting in person, at a boba shop or a café.': '約在珍奶店或咖啡廳，見個面。',
  Type: '地點',
  'Boba shop, 1-on-1': '珍奶店・一對一',
  Café: '咖啡廳',
  'Small dinner table': '小型餐敘',
  Area: '地區',
  "e.g. Taipei, Da'an": '例：台北大安區',
  Date: '日期',
  'Demo mode: this is saved in the chat, but no table is really booked.': '示範模式：邀約會記錄在聊天中，不會真的訂位。',
  'Please add an area and a date.': '請填寫地區與日期。',
  'Send invite': '送出邀約',
  'This cup went cold. Nobody replied for {0} days, so the chat closed.': '這杯已 Gone cold：{0} 天無人回覆，聊天已關閉。',
  'Waiting for them to accept your response': '等待對方接受你的回應',
  '{0}, {1}. {2}, {3}': '{0} {1}・{2}・{3}',

  // About and the menu of boba words
  Sugar: '甜度',
  'Your profile. It shows what you are working on, never your titles.': '你的個人檔案。只談正在做的事，不談頭銜。',
  'Your field. Each field is a boba flavor and sets the colour of your cup.': '你的領域。每個領域對應一種口味，也決定杯子的顏色。',
  'How long you two have talked. Every minute adds 5%, so 10 minutes is half sugar (50%), when you can pop the seal. Long pauses do not count.': '你們聊了多久。每分鐘 +5%，聊滿 10 分鐘就是半糖（50%），可以 Pop the seal。長時間沉默不計入。',
  'Browse open thoughts and questions. Reply with your view to start talking.': '瀏覽大家丟出的想法與問題，回一句就能開聊。',
  'Build something together. Post what you need, or apply to a post without showing your titles.': '一起把事情煮出來。寫下需求，或匿名報名別人的 Brew。',
  'A surprise match once a week. Everyone joins at the same time and you cannot pick who you get.': '每週一次的隨機配對。同一時間開放，對象不能挑。',
  'Your first conversation with someone. Real names are still hidden.': '和某人的第一段對話，名字仍在封存中。',
  'Show your real name, school, company and title. It only happens when both of you press it.': '公開本名、學校、公司與職稱。雙方都按下才會揭曉。',
  'At the end of a Mystery Cup, you both choose Refill to keep talking.': 'Mystery Cup 結束時，雙方都選 Refill，就能繼續聊。',
  'A chat closes if nobody replies for 3 days.': '3 天無人回覆，聊天自動關閉。',
  'Meet in person, at a boba shop or a café.': '約出來見面，珍奶店或咖啡廳都行。',
  'Back to Explore': '回到 Explore',
  'Half Sugar is a place to meet people by talking first. Schools, companies and job titles stay hidden until you both want to share them.': 'Half Sugar 是先聊天、再認識人的地方。學校、公司與職稱先封存，等雙方都想說了再揭曉。',
  'Why we built it': '為什麼做 Half Sugar',
  'Networking today leans on résumés. People decide whether you are worth talking to before you say a word. So networking turns into a performance, people from different fields rarely meet, and lots of online matches never become a real conversation.': '現在認識人，太看履歷。還沒開口，就先被評估值不值得聊。於是交流變成表演，不同領域的人難以相遇，許多線上配對也始終沒有開始。',
  'Why boba': '為什麼是珍奶',
  'A coffee chat sounds like a meeting. Grabbing boba sounds like hanging out with a friend. We want that second feeling, because good collaborations often start in relaxed conversations.': '約喝咖啡像開會，約喝珍奶像見朋友。我們選擇後者，因為好的合作，常常始於一場輕鬆的對話。',
  'Why half sugar': '為什麼是半糖',
  'Not too sweet, not too serious. Half sugar is the order for people who want balance: less performing, and still something real to take home. It is also the moment a chat reaches 50%, when you can finally see who you have been talking to.': '不過甜，也不嚴肅，剛剛好。少一點表演，多一點收穫。半糖也是聊天抵達 50% 的時刻：你終於知道，對方是誰。',
  'How it works': '怎麼玩',
  'Fill in your order.': '填一張點單。',
  'Say what you are working on. Your titles stay sealed.': '寫下正在做的事，頭銜先封存。',
  'Take a first sip.': '來個 First Sip。',
  'Reply to a thought in Explore, apply to a Brew, or join the weekly Mystery Cup.': '在 Explore 回應想法、報名 Brew，或加入每週的 Mystery Cup。',
  'Reach half sugar, then pop the seal.': '聊到半糖，再 Pop the seal。',
  'Sugar goes up as you talk. At 50%, if you both want to, show each other who you are.': '聊越久越甜；到了 50%，雙方都同意就能揭曉身份。',
  'Keep it warm.': '別讓它冷掉。',
  'Keep talking, build something, or go on a boba run and meet in person. A chat goes cold after 3 days with no reply.': '繼續聊、一起做點東西，或來場 Boba run。3 天無人回覆，聊天就會關閉。',
  'Why chats go cold': '為什麼聊天會關閉',
  'If nobody replies for {0} days, the chat closes. We do this on purpose.': '{0} 天無人回覆，聊天就會關閉。這是刻意的設計。',
  'On most networking apps, people match and then disappear, or agree to meet and never show up. Here, every chat is a small chance that will not wait forever. So reply while it is warm, and show up when you say you will.': '太多平台配對之後就沒了下文，或約好了卻沒出現。在這裡，每段對話都是一次不會無限等待的機會：想聊，就趁現在；約好了，就準時出現。',
  'Each chat shows how much time is left, so nothing closes by surprise.': '每段聊天上方都會顯示剩餘時間，不會無預警關閉。',
  'The menu': '菜單',
  'What our boba words mean.': '這些珍奶用語，是什麼意思？',
  Flavors: '口味',
};
