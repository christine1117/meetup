"""The interface translator: finding text, reading/writing zh.js, checking answers."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import translate_ui as t  # noqa: E402


def test_finds_template_and_list_text(tmp_path):
    (tmp_path / "a.js").write_text("""
export const ROLES = ['Frontend', 'Backend'];
export const GOALS = [['win', 'Aiming to win']];
const x = L`${n} of ${m} spots`;
const y = L('Competitions');
c.msgs.push({ from: 'sys', text: 'Chat ended.', at: 1 });
const z = L`Signed in as ${`<b>${esc(e)}</b>`}. Saved.`;
""")
    keys = t.find_keys(tmp_path)
    assert {"Frontend", "Backend", "Aiming to win", "{0} of {1} spots", "Competitions", "Chat ended.", "Signed in as {0}. Saved."} <= keys
    assert "win" not in keys, "ids are not interface text"


def test_zh_file_round_trip(tmp_path):
    p = tmp_path / "zh.js"
    t.write_zh({"Save": "儲存", 'Say "hi"': "打招呼"}, p)
    assert t.read_zh(p) == {"Save": "儲存", 'Say "hi"': "打招呼"}


def test_answers_are_checked():
    assert t.acceptable("{0} of {1} spots", "{0}/{1} 人")
    assert not t.acceptable("{0} of {1} spots", "{0} 個名額"), "a placeholder went missing"
    assert not t.acceptable("Open a Brew", "開一個企劃"), "product names stay English"
    assert t.acceptable("Open a Brew", "開一個 Brew")
    assert not t.acceptable("Save", "")


def test_the_real_zh_file_reads():
    zh = t.read_zh()
    assert zh.get("Competitions") == "比賽" and len(zh) > 500
