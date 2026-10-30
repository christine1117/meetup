/* What a competition card can say: roles, goals, hours and topics. */


export const ROLES = ['Frontend', 'Backend', 'Design', 'Product', 'Data', 'Research', 'Marketing', 'Pitch', 'Hardware', 'Writing'];
export const GOALS = [['win', 'Aiming to win'], ['learn', 'Here to learn'], ['fun', 'Just for fun']];
export const goalName = (g) => (GOALS.find(([v]) => v === g) || GOALS[1])[1];
export const HOURS = [['3', 'About 3 h a week'], ['6', 'About 6 h a week'], ['10', '10+ h a week']];
export const hoursName = (h) => (HOURS.find(([v]) => v === String(h)) || HOURS[1])[1];
export const TOPICS = ['Environment', 'Health', 'Education', 'Money', 'Food', 'Transport', 'Social good', 'AI'];
export const MAX_ROLES = 2;
