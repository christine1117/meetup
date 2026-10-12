/* =========================================================
   Interface language: English or Traditional Chinese.
   Write interface text in English as L`...` (or L('...')).
   Values inside ${...} become {0}, {1}... in the key, and the
   Chinese line below can place them anywhere.
   A key with no Chinese line stays in English. Slogans are left
   out on purpose so they always show in English.
   Chinese copy: write it the way people in Taiwan talk, and keep
   English words out of Chinese sentences.
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

  // Navigation
  Explore: '逛逛',
  Brew: '揪團',
  'Mystery Cup': '神秘杯',
  Chats: '聊天',
  'My order': '我的點單',
  'Browse ideas': '看大家在想什麼',
  'Build together': '找人一起做事',
  'Weekly surprise match': '每週隨機配一個人',
  'Your conversations': '你的對話',
  'Your profile': '個人資料',
  'Half Sugar home': 'Half Sugar 首頁',
  Main: '主選單',
  'What is Half Sugar?': '什麼是 Half Sugar？',
  'Switch language': '切換語言',

  // Sugar and time limits
  'Sugar goes up the longer you talk. Every minute adds 5%.': '聊越久越甜，每聊 1 分鐘加 5%',
  '{0}% sugar': '甜度 {0}%',
  'Closes in {0}d without a reply': '{0} 天沒人回就會關閉',
  'Closes in {0}h without a reply': '{0} 小時沒人回就會關閉',
  'Half sugar! You can pop the seal now.': '半糖了！可以戳封膜了',
  'Full sugar. Maybe it is time for a boba run?': '全糖了，要不要約出來喝一杯？',

  // Small pieces
  'In person': '見面',
  Online: '線上',
  'small group': '小團體',
  '1-on-1': '一對一',
  Flavor: '口味',
  'Working on': '最近在做',
  'Proof of work': '做過的事',
  'Flavor = field. {0} means {1}.': '口味代表領域，{0}就是{1}',

  // Toasts and chat notes
  '{0} accepted your response': '{0} 接受了你的回應',
  'They accepted. Take your first sip.': '對方接受了，開始聊吧',
  'You both popped the seal. Identities are unlocked.': '你們都戳了封膜，現在知道彼此是誰了',
  'Seal popped': '封膜戳開了',
  'Someone responded to your thought': '有人回你的想法了',
  'Someone applied to your post': '有人報名你的揪團',
  'You responded to this thought: "{0}"': '你回應了：「{0}」',
  'You applied anonymously to this post: "{0}"': '你匿名報名了：「{0}」',
  'They responded to your thought: "{0}"': '對方回了你的想法：「{0}」',
  'They applied anonymously to your post: "{0}"': '對方匿名報名了你的揪團：「{0}」',
  'You popped your seal. Waiting for them.': '你戳了封膜，等對方也戳',
  'You suggested a boba run.': '你約對方出來喝珍奶',
  Saved: '已儲存',
  'Call room opened in a new tab': '通話已在新分頁打開',

  // Profile
  'Visible from the start': '大家看得到的',
  Nickname: '暱稱',
  'Not your real name.': '不用填真名',
  City: '城市',
  'e.g. Taipei': '例如：台北',
  'Field (your flavor)': '領域（決定你的口味）',
  'Your flavor is your field. It sets the colour of your cup.': '每個領域對應一種口味，也是你杯子的顏色',
  "What I'm working on": '最近在做什麼',
  'e.g. A sign-up system for a community college': '例如：幫社區大學做報名系統',
  'Topics I can talk deeply about': '可以聊很久的話題',
  'Separate with commas.': '用逗號隔開',
  'Something you built or achieved': '做過的東西或成果',
  'Sealed until you both pop the seal': '先封起來，兩個人都戳封膜才看得到',
  '“Pop the seal” means showing your real profile. It only happens when both people agree.': '「戳封膜」就是公開真實資料，要兩個人都同意才會打開',
  'Real name': '真實姓名',
  'Job title': '職稱',
  School: '學校',
  Company: '公司',
  "Please add a nickname and what you're working on.": '暱稱和「最近在做什麼」要填喔',
  'Start sipping': '點好了，開始！',
  'Save my order': '儲存',

  // Onboarding and My order
  'Meet the person before the résumé. Fill in your order to start. People see the top half. The bottom half stays sealed until you both pop the seal.': '填好點單就能開始。上半部大家看得到，下半部會先封起來，等你們都想公開再打開。',
  'New here? Read what Half Sugar is and what the boba words mean.': '第一次來？先看看 Half Sugar 是什麼',
  'Your usual. Change it any time.': '你的老樣子，隨時可以改',
  'Your order is your profile. It shows what you are working on, never your titles.': '點單就是你的個人資料，只寫你在做什麼，不寫頭銜。',
  'Your usual': '老樣子',
  'For {0}. Sugar goes up in each chat the longer you talk.': '{0} 的點單。甜度會跟著每段聊天慢慢增加。',
  'Demo mode': '示範模式',
  'This is not connected to a server yet. Your data stays in this browser, the other people are simulated, and their replies are pre-written. Bookings and notifications are not really sent.': '目前還沒接上伺服器。資料只存在這個瀏覽器裡，其他人是模擬的，回覆也是先寫好的。訂位和通知都不會真的送出。',
  'Yes, clear it': '確定清除',
  Cancel: '取消',
  'Clear all data': '清除所有資料',

  // Explore
  'No more responses for now.': '目前沒有新的回應',
  'Waiting for responses': '等人回應中',
  'Accept, first sip': '接受，開始聊',
  Skip: '跳過',
  'Browse what people are thinking about. Reply with your view to start a chat.': '看看大家最近在想什麼，留下你的看法就能開始聊。',
  'Share a thought': '丟個想法',
  'Your thought or question': '你的想法或問題',
  'Something you have been turning over lately': '最近一直在想的事',
  'How to meet': '怎麼聊',
  'How many people': '幾個人',
  'Small group': '小團體',
  Post: '發佈',
  'Your thoughts': '你丟的想法',
  Filters: '篩選',
  'Online or in person': '線上或見面',
  'Any format': '線上、見面都可以',
  'Group size': '人數',
  'Any size': '人數不限',
  'All cities': '所有城市',
  Field: '領域',
  'All fields': '所有領域',
  'Responded. Open chat': '已回應，去聊天',
  'Your perspective': '你的看法',
  'They see your response and your card, not your titles': '對方只看得到你的回應和點單，看不到頭銜',
  'Send response': '送出',
  Respond: '回應',
  'Nothing matches. Change the filters, or share a thought of your own.': '沒有符合的想法。換個條件，或自己丟一個吧。',

  // Brew
  'Brew means building something together. Post what you need, or apply to a post without showing your titles.': '有想做的事就發起揪團，寫下你需要什麼。看到有興趣的，也可以匿名報名，不用亮頭銜。',
  'Start a brew': '發起揪團',
  'What you are building and who you are looking for': '想做什麼？想找什麼樣的人？',
  'e.g. Building a shared-kitchen platform, looking for someone who knows food regulation': '例如：在做共享廚房，想找懂食品法規的人',
  'I need': '需要',
  'I can offer': '我可以提供',
  Time: '時間',
  'e.g. One call, a four-week project': '例如：聊一次、四週的專案',
  'Your brews': '你發起的揪團',
  Needs: '需要',
  Offers: '可以提供',
  'Applied. Open chat': '已報名，去聊天',
  'Why you are a fit': '你可以幫上什麼',
  'Say what you would bring. They cannot see your titles': '說說你能帶來什麼，對方看不到你的頭銜',
  'Send anonymously': '匿名送出',
  'Apply anonymously': '匿名報名',

  // Mystery Cup
  '{0}d {1}:{2}:{3}': '{0} 天 {1}:{2}:{3}',
  'They are typing': '對方輸入中',
  'Shaking your mystery cup': '正在幫你搖一杯',
  'Someone in a different city and a different field.': '對方會來自不同城市、不同領域',
  'Someone in {0}': '來自{0}的某個人',
  'Field: {0}. That is all you know.': '你只知道對方是做{0}的',
  'End chat': '結束聊天',
  Message: '訊息',
  'Say something': '說點什麼',
  Send: '送出',
  "Cup's empty. Want a refill?": '喝完了，要續杯嗎？',
  'Refill means you keep talking and your real profiles are revealed. It only happens if you both choose it. If either of you says no, this cup disappears.': '續杯就是繼續聊，也會看到彼此的真實資料。要兩個人都選續杯才算數，只要有一方不要，這杯就沒了。',
  'Waiting for them to decide': '等對方決定',
  Refill: '續杯',
  "I'm good": '先不用',
  'You both want a refill.': '你們都想續杯！',
  'You were talking to {0}, {1}.': '剛剛跟你聊的是 {0}，{1}',
  'Back to Mystery Cup': '回神秘杯',
  'This cup is gone.': '這杯沒了',
  'You chose not to refill.': '你選了先不用',
  'They passed on a refill this time. Say a bit more next time and your odds go up.': '對方這次沒有續杯。下次多聊幾句，機會會比較大。',
  'A Mystery Cup is a surprise match. Once a week, everyone joins at the same time and gets paired with someone from a different city and field.': '神秘杯是每週一次的隨機配對。大家同一時間加入，系統會幫你配一個不同城市、不同領域的人。',
  'Mystery Cup is open': '神秘杯開放中',
  'Join now': '現在就能加入',
  'Next Mystery Cup in': '下一杯還有',
  '{0} your time. Open for 10 minutes.': '你那邊是{0}，只開 10 分鐘',
  'Pour me one': '來一杯',
  'Try a practice cup': '先試喝看看',
  'No picking flavors': '不能挑口味',
  'We pour you someone from a different city and field.': '幫你配一個不同城市、不同領域的人',
  '8 minutes': '聊 8 分鐘',
  'Text only. When time is up, it ends.': '只能打字，時間到就結束',
  'Refill only if you both want one': '兩個人都想才續杯',
  'Otherwise the cup disappears.': '不然這杯就沒了',
  'You have had 1 mystery cup.': '你喝過 1 杯神秘杯了',
  'You have had {0} mystery cups.': '你喝過 {0} 杯神秘杯了',
  'Your first sip lasts 8 minutes. Start by asking what they are busy with.': '你們有 8 分鐘。先問問對方最近在忙什麼吧。',
  'You met over a Mystery Cup and both chose a refill. The seal is popped.': '你們在神秘杯認識，兩個人都選了續杯，現在知道彼此是誰了。',

  // Chats
  'Every chat starts with a first sip.': '慢慢聊，慢慢變甜',
  'Sugar goes up the longer you talk. At half sugar (50%) you can pop the seal. A chat goes cold and closes if nobody replies for 3 days.': '聊越久越甜。到半糖（50%）就能戳封膜；3 天沒人回，這杯就會淡掉、關閉。',
  'went cold': '淡掉了',
  ', waiting for them to accept': '，等對方接受',
  '{0} unread': '{0} 則未讀',
  'No cups yet.': '還沒有任何一杯',
  'Respond to a thought': '去回應一個想法',
  'Try a Mystery Cup': '試試神秘杯',
  Sealed: '還封著',
  'Back to chats': '回聊天列表',
  Call: '通話',
  'Boba run': '約喝珍奶',
  'Waiting for them to pop': '等對方戳',
  'Pop the seal': '戳封膜',
  'Pop the seal at {0}%': '{0}% 才能戳',
  'You both popped the seal, so real names and profiles are visible. The chat closes if nobody replies for {0} days.': '你們都戳了封膜，現在看得到彼此的名字和資料。{0} 天沒人回，聊天就會關閉。',
  'Names are still hidden. Sugar goes up the longer you talk: 10 minutes of chatting is half sugar (50%), and then you can pop the seal if you both agree. The chat closes if nobody replies for {0} days. “Boba run” means meeting in person.': '名字還藏著。聊越久越甜，大約聊 10 分鐘會到半糖（50%），兩個人都同意就能戳封膜。{0} 天沒人回，聊天會關閉。「約喝珍奶」就是約出來見面。',
  'Their full card': '對方的完整點單',
  'Their card': '對方的點單',
  Name: '名字',
  'Go on a boba run': '約出來喝珍奶',
  'A boba run means meeting in person, at a boba shop or a café.': '約在珍奶店或咖啡廳見個面',
  Type: '地點',
  'Boba shop, 1-on-1': '珍奶店，一對一',
  Café: '咖啡廳',
  'Small dinner table': '小型聚餐',
  Area: '地區',
  "e.g. Taipei, Da'an": '例如：台北大安區',
  Date: '日期',
  'Demo mode: this is saved in the chat, but no table is really booked.': '示範模式：會記在聊天裡，但不會真的訂位',
  'Please add an area and a date.': '請填地區和日期',
  'Send invite': '送出邀約',
  'This cup went cold. Nobody replied for {0} days, so the chat closed.': '這杯淡掉了：{0} 天都沒人回，聊天已經關閉。',
  'Waiting for them to accept your response': '等對方接受你的回應',
  '{0}, {1}. {2}, {3}': '{0} {1}・{2}・{3}',

  // About and the menu of boba words
  Sugar: '甜度',
  'First Sip': '第一口',
  'Gone cold': '淡掉',
  'Your profile. It shows what you are working on, never your titles.': '你的個人資料。只寫你在做什麼，不寫頭銜。',
  'Your field. Each field is a boba flavor and sets the colour of your cup.': '你的領域。每個領域對應一種口味，也是你杯子的顏色。',
  'How long you two have talked. Every minute adds 5%, so 10 minutes is half sugar (50%), when you can pop the seal. Long pauses do not count.': '代表你們聊了多久。每分鐘加 5%，聊 10 分鐘就是半糖（50%），可以戳封膜。中間停很久不會一直加。',
  'Browse open thoughts and questions. Reply with your view to start talking.': '看大家丟出來的想法和問題，留下你的看法就能開始聊。',
  'Build something together. Post what you need, or apply to a post without showing your titles.': '找人一起做事。寫下你需要什麼，或匿名報名別人的揪團。',
  'A surprise match once a week. Everyone joins at the same time and you cannot pick who you get.': '每週一次的隨機配對。大家同時加入，不能挑人。',
  'Your first conversation with someone. Real names are still hidden.': '跟一個人的第一段對話，這時名字還藏著。',
  'Show your real name, school, company and title. It only happens when both of you press it.': '公開你的名字、學校、公司和職稱。兩個人都按才會打開。',
  'At the end of a Mystery Cup, you both choose Refill to keep talking.': '神秘杯聊完後，兩個人都選續杯，就能繼續聊。',
  'A chat closes if nobody replies for 3 days.': '3 天沒人回，聊天就會關閉。',
  'Meet in person, at a boba shop or a café.': '約出來見面，在珍奶店或咖啡廳。',
  'Back to Explore': '回去逛逛',
  'Half Sugar is a place to meet people by talking first. Schools, companies and job titles stay hidden until you both want to share them.': 'Half Sugar 是先聊天、再認識人的地方。學校、公司、職稱都先藏起來，等你們都想說了再公開。',
  'Why we built it': '為什麼做這個',
  'Networking today leans on résumés. People decide whether you are worth talking to before you say a word. So networking turns into a performance, people from different fields rarely meet, and lots of online matches never become a real conversation.': '現在認識人太看履歷了。你還沒開口，對方就先判斷你值不值得聊。結果交流變得像在表演，不同領域的人很難真的認識，很多線上配對也從來沒聊起來。',
  'Why boba': '為什麼是珍奶',
  'A coffee chat sounds like a meeting. Grabbing boba sounds like hanging out with a friend. We want that second feeling, because good collaborations often start in relaxed conversations.': '約喝咖啡感覺像開會，約喝珍奶就像找朋友出來晃晃。我們想要後面那種感覺，因為很多好的合作，都是從輕鬆聊天開始的。',
  'Why half sugar': '為什麼是半糖',
  'Not too sweet, not too serious. Half sugar is the order for people who want balance: less performing, and still something real to take home. It is also the moment a chat reaches 50%, when you can finally see who you have been talking to.': '不會太甜，也不會太嚴肅，剛剛好。少一點表演，聊完還是有收穫。半糖也是聊天到 50% 的時候，你終於可以知道對方是誰。',
  'How it works': '怎麼玩',
  'Fill in your order.': '填點單。',
  'Say what you are working on. Your titles stay sealed.': '寫你最近在做什麼，頭銜先封起來。',
  'Take a first sip.': '喝第一口。',
  'Reply to a thought in Explore, apply to a Brew, or join the weekly Mystery Cup.': '在「逛逛」回應一個想法、報名別人的揪團，或加入每週的神秘杯。',
  'Reach half sugar, then pop the seal.': '聊到半糖，再戳封膜。',
  'Sugar goes up as you talk. At 50%, if you both want to, show each other who you are.': '聊越久越甜。到 50% 時，如果你們都想，就可以交換身份。',
  'Keep it warm.': '別讓它淡掉。',
  'Keep talking, build something, or go on a boba run and meet in person. A chat goes cold after 3 days with no reply.': '繼續聊、一起做點東西，或約出來喝珍奶。3 天沒人回，聊天就會關閉。',
  'Why chats go cold': '為什麼聊天會淡掉',
  'If nobody replies for {0} days, the chat closes. We do this on purpose.': '{0} 天沒人回，聊天就會關閉。這是我們刻意設計的。',
  'On most networking apps, people match and then disappear, or agree to meet and never show up. Here, every chat is a small chance that will not wait forever. So reply while it is warm, and show up when you say you will.': '很多認識人的 App，都是配對完就沒下文，或約好了卻放鳥。在這裡，每段對話都是一個不會一直等你的機會。想聊就趁現在回，約好了就要到。',
  'Each chat shows how much time is left, so nothing closes by surprise.': '每段聊天上方都看得到還剩多少時間，不會突然被關掉。',
  'The menu': '菜單',
  'What our boba words mean.': '這些珍奶用語是什麼意思？',
  Flavors: '口味',
};
